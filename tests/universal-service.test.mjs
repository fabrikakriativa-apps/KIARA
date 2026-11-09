import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const code=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
const staging=readFileSync(new URL('../staging/wrangler.toml',import.meta.url),'utf8');

test('entrada unica sem menu obrigatorio',()=>{
  const greeting=code.match(/const greeting = ([^\n]+);/)?.[1]||'';
  assert.match(greeting,/Como posso ajudar voc[eê] hoje/);
  assert.doesNotMatch(greeting,/Orçamento rápido|1️⃣|2️⃣/);
  assert.match(code,/universalServicePrompt/);
  assert.doesNotMatch(code,/flowPrompt\(routing\.choice\)/);
});

test('primeira resposta aproveita mensagem recebida e registra apresentacao',()=>{
  assert.match(code,/needsGreeting=adsRoutingEnabled\(env\)/);
  assert.match(code,/finalAnswer=welcomePrefix/);
  assert.match(code,/persistRouteState\(env,route,sender,\{intro_sent_at:new Date\(\)\.toISOString\(\),route_choice:'general'\}\)/);
  assert.match(code,/const input=audio\?'\[Áudio recebido\]':image\?'\[Foto recebida\]':message\.type==='interactive'\?legacyButtonIntent/);
});

test('mudanca de assunto pode interromper coleta de orcamento',()=>{
  assert.match(code,/const serviceChange=/);
  assert.match(code,/if\(state && serviceChange && !freshQuote\)/);
  assert.match(code,/await env\.CONVERSAS\.delete\(key\)/);
});

test('homologacao continua restrita a numero autorizado e sem importacao historica',()=>{
  assert.match(code,/digits\(message\.from\)!==digits\(route\.allowed\)/);
  assert.match(staging,/KIARA_SYNC_ALL_CONTACTS = "false"/);
  assert.match(staging,/KIARA_HUMAN_SEND_ENABLED = "false"/);
  assert.doesNotMatch(code,/syncPastHistory\(/);
});

test('apresentacao de diagnostico permanece restrita e sem botoes',()=>{
  assert.match(code,/kind:'routing_preview'/);
  assert.match(code,/async function consumeAdPreview/);
  assert.match(code,/digits\(job\.sender\)!==digits\(route\.allowed\)/);
  assert.doesNotMatch(code,/async function sendChoiceButtons/);
});
