import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import staging from '../staging/worker.js';

const config = readFileSync(new URL('../staging/wrangler.toml', import.meta.url),'utf8');

test('homologação contém o código real, mas não possui consumidor de fila',()=>{
 assert.equal(typeof staging.fetch,'function');
 assert.equal('queue' in staging,false);
 assert.match(config,/name = "fabrika-atendimento-ia-homologacao"/);
 assert.match(config,/main = "\.\/worker.js"/);
 assert.doesNotMatch(config,/^\s*(route|routes|kv_namespaces|queues|services)\s*=/m);
 assert.doesNotMatch(config,/^\s*\[\[(queues|kv_namespaces|services)/m);
});

test('health responde integração bloqueada',async()=>{
 const res=await staging.fetch(new Request('https://kiara.example/health'));
 assert.equal(res.status,200);
 assert.deepEqual(await res.json(),{
  service:'kiara-homologacao',status:'ok',worker_code:'integrado',external_integrations:'blocked'
 });
});

test('webhooks não recebem mensagens',async()=>{
 for(const path of ['/webhook','/webhook/test-secret','/kiara/coach','/kiara/control','/']){
  const res=await staging.fetch(new Request('https://kiara.example'+path,{method:'POST',body:'{}'}));
  assert.equal(res.status,404,path);
 }
});
