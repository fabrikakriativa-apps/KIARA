import test from 'node:test';
import assert from 'node:assert/strict';
import stagingWorker from '../staging/worker.js';

const ORIGIN = 'https://kiara-painel-homologacao.pages.dev';
const ORG = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const CONVERSATION = '33333333-3333-4333-8333-333333333333';
const TOKEN = 'a'.repeat(80);
const SUPABASE = 'https://test.supabase.co';

function testEnvironment() {
  const kv = new Map();
  return {
    kv,
    env: {
      KIARA_DASHBOARD_ORIGIN: ORIGIN,
      KIARA_STAGING_LIVE_ENABLED: 'false',
      SUPABASE_URL: SUPABASE,
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_only',
      SUPABASE_ORGANIZATION_ID: ORG,
      KIARA_CONTROLES: {
        get: async key => kv.get(key) ?? null,
        put: async (key, value) => { kv.set(key, value); },
      },
    },
  };
}
function authRequest(path, method = 'GET', body) {
  return new Request('https://staging.invalid' + path, {
    method,
    headers: {
      Origin: ORIGIN,
      Authorization: 'Bearer ' + TOKEN,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function withMockSupabase(role, action, conversationVisible = true) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async input => {
    const uri = new URL(String(input));
    calls.push(uri.pathname);
    assert.equal(uri.origin, SUPABASE);
    if (uri.pathname === '/auth/v1/user') return Response.json({ id: USER });
    if (uri.pathname === '/rest/v1/memberships')
      return Response.json(role ? [{ role }] : []);
    if (uri.pathname === '/rest/v1/kiara_conversations')
      return Response.json(conversationVisible ? [{ id: CONVERSATION }] : []);
    throw new Error('Unexpected network request: ' + uri.pathname);
  };
  try { return await action(calls); }
  finally { globalThis.fetch = original; }
}

test('admin pode pausar e reativar apenas estado de teste', async () => {
  const { env, kv } = testEnvironment();
  await withMockSupabase('admin', async () => {
    for (const [action, enabled] of [['pause_all', false], ['resume_all', true]]) {
      const response = await stagingWorker.fetch(authRequest('/kiara/control', 'POST', { action }), env);
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.simulated, true);
      assert.equal(result.productionConnected, false);
      assert.equal(result.enabled, enabled);
    }
    const response = await stagingWorker.fetch(authRequest('/kiara/control'), env);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).enabled, true);
  });
  assert.equal(kv.get('staging:control:' + ORG + ':enabled'), 'true');
});

test('perfil comercial não pode pausar atendimento global', async () => {
  const { env, kv } = testEnvironment();
  await withMockSupabase('comercial', async () => {
    const response = await stagingWorker.fetch(
      authRequest('/kiara/control', 'POST', { action: 'pause_all' }), env);
    assert.equal(response.status, 403);
  });
  assert.equal(kv.size, 0);
});

test('assumir e devolver persistem estado simulado com sessão autorizada', async () => {
  const { env, kv } = testEnvironment();
  await withMockSupabase('comercial', async () => {
    for (const [action, state] of [['assume', 'human'], ['return_to_ai', 'ai']]) {
      const response = await stagingWorker.fetch(authRequest('/kiara/control', 'POST', {
        action, conversationId: CONVERSATION,
      }), env);
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.status, state);
      assert.equal(result.productionConnected, false);
      const read = await stagingWorker.fetch(
        authRequest('/kiara/control?conversationId=' + CONVERSATION), env);
      assert.equal(read.status, 200);
      assert.equal((await read.json()).simulatedStatus, state);
    }
  });
  assert.equal(JSON.parse(kv.get('staging:control:' + ORG + ':conversation:' + CONVERSATION)).state, 'ai');
});

test('conversa sem acesso é recusada e não grava estados', async () => {
  const { env, kv } = testEnvironment();
  await withMockSupabase('admin', async () => {
    const response = await stagingWorker.fetch(authRequest('/kiara/control', 'POST', {
      action: 'assume', conversationId: CONVERSATION,
    }), env);
    assert.equal(response.status, 404);
  }, false);
  assert.equal(kv.size, 0);
});

test('usuário sem associação ativa à organização não controla conversas', async () => {
  const { env, kv } = testEnvironment();
  await withMockSupabase(null, async () => {
    const response = await stagingWorker.fetch(authRequest('/kiara/control', 'POST', {
      action: 'assume', conversationId: CONVERSATION,
    }), env);
    assert.equal(response.status, 403);
  });
  assert.equal(kv.size, 0);
});

test('hold e release são persistidos apenas no KV de homologação', async () => {
  const { env, kv } = testEnvironment();
  await withMockSupabase('admin', async () => {
    for (const [action, held] of [['hold', true], ['release', false]]) {
      const response = await stagingWorker.fetch(authRequest('/kiara/coach', 'POST', {
        action, conversationId: CONVERSATION,
      }), env);
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.held, held);
      assert.equal(result.productionConnected, false);
      const read = await stagingWorker.fetch(
        authRequest('/kiara/coach?conversationId=' + CONVERSATION), env);
      assert.equal(read.status, 200);
      assert.equal((await read.json()).held, held);
    }
  });
  assert.equal(kv.get('staging:control:' + ORG + ':hold:' + CONVERSATION), 'false');
});
