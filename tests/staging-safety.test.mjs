import test from 'node:test';
import assert from 'node:assert/strict';
import stagingWorker from '../staging/worker.js';

// Testes locais: sem Supabase, sem Meta, sem Cloudflare e sem credenciais.
// As ações deste arquivo nunca devem enviar mensagens ou modificar produção.
const BASE = 'https://staging.invalid';
const PANEL = 'https://kiara-painel-homologacao.pages.dev';
const env = Object.freeze({
  KIARA_DASHBOARD_ORIGIN: PANEL,
  KIARA_STAGING_LIVE_ENABLED: 'false',
  KIARA_SYNC_ENABLED: 'false',
  KIARA_CONTROL_ENABLED: 'false',
  KIARA_HOLD_ENABLED: 'false',
  KIARA_HUMAN_SEND_ENABLED: 'false',
  KIARA_SYNC_ALL_CONTACTS: 'false',
});

function request(path, method = 'GET', origin) {
  return new Request(BASE + path, {
    method,
    ...(origin ? { headers: { Origin: origin } } : {}),
  });
}

test('homologação identifica integrações externas bloqueadas', async () => {
  const response = await stagingWorker.fetch(request('/health'), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.service, 'kiara-homologacao');
  assert.equal(body.external_integrations, 'blocked');
});

test('webhook não recebe eventos da Meta sem ativação explícita', async () => {
  for (const method of ['GET', 'POST']) {
    const response = await stagingWorker.fetch(request('/webhook', method), env);
    assert.equal(response.status, 404);
  }
});

test('fila não processa mensagens enquanto homologação real está bloqueada', async () => {
  await assert.rejects(
    stagingWorker.queue({ messages: [] }, env, {}),
    /Homologação real não habilitada/,
  );
});

test('envio humano permanece indisponível, mesmo vindo do painel', async () => {
  const response = await stagingWorker.fetch(
    request('/kiara/human-message', 'POST', PANEL), env,
  );
  assert.equal(response.status, 404);
});

test('controle simulado exige sessão e origem permitida', async () => {
  const badOrigin = await stagingWorker.fetch(
    request('/kiara/control', 'GET', 'https://attacker.invalid'), env,
  );
  assert.equal(badOrigin.status, 403);

  const noSession = await stagingWorker.fetch(
    request('/kiara/control', 'GET', PANEL), env,
  );
  assert.equal(noSession.status, 401);
});

test('orientação simulada exige sessão', async () => {
  const response = await stagingWorker.fetch(
    request('/kiara/coach', 'POST', PANEL), env,
  );
  assert.equal(response.status, 401);
});

test('simulação de preços exige sessão e não expõe valores', async () => {
  const response = await stagingWorker.fetch(
    request('/kiara/pricing/simulate', 'POST', PANEL), env,
  );
  assert.equal(response.status, 401);
});

test('preflight somente aceita origem autorizada', async () => {
  const allowed = await stagingWorker.fetch(
    request('/kiara/control', 'OPTIONS', PANEL), env,
  );
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), PANEL);

  const rejected = await stagingWorker.fetch(
    request('/kiara/control', 'OPTIONS', 'https://attacker.invalid'), env,
  );
  assert.equal(rejected.status, 403);
});
