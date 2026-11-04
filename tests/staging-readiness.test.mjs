import test from 'node:test';
import assert from 'node:assert/strict';
import staging from '../staging/worker.js';

// Todos os recursos abaixo são falsos. Nenhuma chamada externa é realizada.
const provisioned = {
  KIARA_STAGING_LIVE_ENABLED: 'true',
  KIARA_SYNC_ENABLED: 'true',
  KIARA_CONTROL_ENABLED: 'true',
  KIARA_HOLD_ENABLED: 'true',
  KIARA_SYNC_ALL_CONTACTS: 'false',
  CONVERSAS: { get: async () => null, put: async () => {}, delete: async () => {} },
  KIARA_QUEUE: { send: async () => {} },
  META_PHONE_NUMBER_ID: '1234567890123',
  TEST_ALLOWED_WA_ID: '5511999999999',
  META_ACCESS_TOKEN: 'fake-token',
  META_APP_SECRET: 'fake-secret',
  META_VERIFY_TOKEN: 'fake-verify',
  OPENAI_API_KEY: 'fake-ai-key',
  SUPABASE_SERVICE_ROLE_KEY: 'fake-database-key',
};
const url = 'https://staging.invalid/health';

async function health(env) {
  const res = await staging.fetch(new Request(url), env);
  assert.equal(res.status, 200);
  return res.json();
}

test('nenhum segredo ativa WhatsApp se chave geral está desligada', async () => {
  const result = await health({ ...provisioned, KIARA_STAGING_LIVE_ENABLED: 'false' });
  assert.equal(result.external_integrations, 'blocked');
});

test('ativação exige controles de conversa, retenção e sincronização', async () => {
  for (const key of ['KIARA_SYNC_ENABLED', 'KIARA_CONTROL_ENABLED', 'KIARA_HOLD_ENABLED']) {
    const env = { ...provisioned, [key]: 'false' };
    assert.equal((await health(env)).external_integrations, 'blocked', key);
    await assert.rejects(staging.queue({messages:[]}, env), /Homologação real não habilitada/);
  }
});

test('ativação rejeita sincronização de todos os contatos e exige recursos isolados', async () => {
  const variations = [
    { KIARA_SYNC_ALL_CONTACTS: 'true' },
    { META_PHONE_NUMBER_ID: 'not-a-number' },
    { TEST_ALLOWED_WA_ID: 'not-a-number' },
    { META_APP_SECRET: undefined },
    { SUPABASE_SERVICE_ROLE_KEY: undefined },
    { CONVERSAS: {} },
    { KIARA_QUEUE: {} },
  ];
  for (const variation of variations) {
    const result = await health({ ...provisioned, ...variation });
    assert.equal(result.external_integrations, 'blocked', JSON.stringify(Object.keys(variation)));
  }
});

test('somente conjunto completo de pré-requisitos indica transporte test_only', async () => {
  const result = await health(provisioned);
  assert.equal(result.external_integrations, 'test_only');
  // O diagnóstico é puramente local: não dispara webhook, fila ou mensagem.
});

test('diagnóstico de recursos exige origem do painel e sessão Supabase', async () => {
  const env = {
    ...provisioned,
    KIARA_DASHBOARD_ORIGIN: 'https://kiara-painel-homologacao.pages.dev',
  };
  const rejected = await staging.fetch(new Request('https://staging.invalid/kiara/capabilities', {
    headers: { Origin: 'https://unauthorized.invalid' },
  }), env);
  assert.equal(rejected.status, 403);
  const anonymous = await staging.fetch(new Request('https://staging.invalid/kiara/capabilities', {
    headers: { Origin: env.KIARA_DASHBOARD_ORIGIN },
  }), env);
  assert.equal(anonymous.status, 401);
});
