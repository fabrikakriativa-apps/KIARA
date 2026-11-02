import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

const code=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
const wrangler=readFileSync(new URL('../wrangler.example.toml',import.meta.url),'utf8');

test('no deployable production config is committed',()=>{
 assert.equal(existsSync(new URL('../wrangler.toml',import.meta.url)),false);
 assert.equal(existsSync(new URL('../wrangler.jsonc',import.meta.url)),false);
 assert.equal(existsSync(new URL('../.dev.vars',import.meta.url)),false);
});

test('example targets an isolated Worker and defaults hold and guidance to off',()=>{
 assert.match(wrangler,/name\s*=\s*"fabrika-atendimento-ia-homologacao"/);
 for(const name of ['KIARA_HOLD_ENABLED','KIARA_GUIDANCE_ENABLED','KIARA_CONTROL_ENABLED','KIARA_SYNC_ALL_CONTACTS']) {
  assert.match(wrangler,new RegExp(name+'\\s*=\\s*"false"'));
 }
 assert.doesNotMatch(wrangler,/^\s*route\s*=/m);
 assert.doesNotMatch(wrangler,/^\s*routes\s*=/m);
});

test('webhook still isolates test recipient and human takeover',()=>{
 assert.match(code,/TEST_ALLOWED_WA_ID/);
 assert.match(code,/smb_message_echoes/);
 assert.match(code,/x-hub-signature-256/);
 assert.match(code,/route\.source === "original"/);
 assert.match(code,/CONVERSAS/);
 assert.match(code,/KIARA_QUEUE/);
});

test('hold and coaching are opt-in only',()=>{
 assert.match(code,/env\.KIARA_HOLD_ENABLED !== 'true'/);
 assert.match(code,/env\.KIARA_GUIDANCE_ENABLED !== 'true'/);
 assert.match(code,/readHold\(env, route, sender\)/);
 assert.match(code,/KIARA_DASHBOARD_ORIGIN/);
});
