import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {OPERATIONAL_POLICY} from '../src/operational-policy.js';
const config=readFileSync(new URL('../staging/wrangler.toml',import.meta.url),'utf8');
const worker=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');

test('persianas e cortinas não podem ser expostas ao tempo',()=>{
 assert.match(OPERATIONAL_POLICY,/NÃO são indicadas para exposição direta ao tempo/);
 assert.match(OPERATIONAL_POLICY,/não ofereça tecidos ou modelos como resistentes às intempéries/);
 assert.match(OPERATIONAL_POLICY,/não presuma exposição ao tempo/);
});
test('orientações registradas apenas nesta conversa são usadas em homologação',()=>{
 assert.match(config,/^KIARA_GUIDANCE_ENABLED = "true"$/m);
 assert.match(config,/^KIARA_SYNC_ALL_CONTACTS = "false"$/m);
 assert.match(worker,/queryEq\('scope', 'conversation'\)/);
 assert.match(worker,/queryEq\('status', 'recorded'\)/);
 assert.match(worker,/queryEq\('scope', 'global'\)/);
 assert.match(worker,/queryEq\('status', 'approved'\)/);
});
