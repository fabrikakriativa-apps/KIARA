import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import staging from '../staging/worker.js';

const config=readFileSync(new URL('../staging/wrangler.toml',import.meta.url),'utf8');
const origin='https://fabrikakriativa-apps.github.io';
const id='5453d08e-eb3f-4699-8d77-16d5da956aaf';
const env={KIARA_DASHBOARD_ORIGIN:origin,SUPABASE_URL:'https://example.supabase.co',
 SUPABASE_PUBLISHABLE_KEY:'sb_publishable_dummy',SUPABASE_ORGANIZATION_ID:'0e398095-cc22-421b-ae34-7bf0df8ad7b2'};
const url='https://staging.workers.dev/kiara/coach?conversationId='+id;

test('isolated Worker has only the exclusive staging KV and no production bindings',()=>{
 assert.equal(typeof staging.fetch,'function');
 assert.equal('queue' in staging,false);
 assert.match(config,/name = "fabrika-atendimento-ia-homologacao"/);
 assert.match(config,/main = "\.\/worker.js"/);
 assert.doesNotMatch(config,/^\s*(routes?|kv_namespaces|queues|services|account_id)\s*=/m);
 assert.doesNotMatch(config,/^\s*\[\[(queues|services)/m);
 assert.equal((config.match(/^\s*\[\[kv_namespaces\]\]/gm)||[]).length,1);
 assert.match(config,/binding = "KIARA_CONTROLES"/);
 assert.match(config,/id = "64e0916fb8a04a2ca75b0220f1fb991b"/);
 assert.doesNotMatch(config,/SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|META_ACCESS_TOKEN|EASY_ACCESS_TOKEN/);
});

test('health confirms authenticated Supabase read-only mode',async()=>{
 const res=await staging.fetch(new Request('https://staging.workers.dev/health'),env);
 assert.equal(res.status,200);
 assert.deepEqual(await res.json(),{service:'kiara-homologacao',status:'ok',worker_code:'integrado',external_integrations:'blocked',supabase_read:'authenticated_only'});
});

test('webhooks, controls and POST coaching are not available',async()=>{
 for(const path of ['/webhook','/webhook/test-secret','/kiara/coach','/kiara/control','/']){
  const res=await staging.fetch(new Request('https://staging.workers.dev'+path,{method:'POST',body:'{}'}),env);
  assert.equal(res.status,404,path);
 }
});

test('staging rejects unauthorized origin before contacting Supabase',async()=>{
 const res=await staging.fetch(new Request(url,{headers:{Origin:'https://attacker.example',Authorization:'Bearer '+'a'.repeat(100)}}),env);
 assert.equal(res.status,403); assert.equal(res.headers.get('access-control-allow-origin'),null);
});

test('CORS preflight is limited to dashboard origin and read methods',async()=>{
 const req=new Request(url,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'GET'}});
 const res=await staging.fetch(req,env);
 assert.equal(res.status,204);
 assert.equal(res.headers.get('access-control-allow-origin'),origin);
 assert.match(res.headers.get('access-control-allow-methods'),/GET/);
 assert.doesNotMatch(res.headers.get('access-control-allow-methods'),/POST/);
});

test('GET without bearer returns 401 with no Supabase calls',async()=>{
 const res=await staging.fetch(new Request(url,{headers:{Origin:origin}}),env);
 assert.equal(res.status,401);
});

test('GET with invalid conversation returns 400',async()=>{
 const res=await staging.fetch(new Request('https://staging.workers.dev/kiara/coach?conversationId=invalid',{headers:{Origin:origin}}),env);
 assert.equal(res.status,400);
});

test('authenticated RLS read passes user JWT and scopes to organization',async()=>{
 const original=globalThis.fetch,requested=[];
 globalThis.fetch=async(input,init={})=>{
  const uri=new URL(input);requested.push({uri,headers:init.headers});
  if(uri.pathname==='/auth/v1/user')return Response.json({id:'operator'});
  if(uri.pathname==='/rest/v1/kiara_conversations')return Response.json([{reply_held:true,status:'human'}]);
  throw Error('Unexpected request');
 };
 try{
  const token='Bearer '+'a'.repeat(100);
  const res=await staging.fetch(new Request(url,{headers:{Origin:origin,Authorization:token}}),env);
  assert.equal(res.status,200);
  assert.deepEqual(await res.json(),{held:true,status:'human',writable:false,environment:'homologacao'});
  assert.equal(requested.length,2);
  assert.equal(requested[0].headers.Authorization,token);
  assert.equal(requested[1].headers.Authorization,token);
  assert.equal(requested[1].uri.searchParams.get('organization_id'),'eq.'+env.SUPABASE_ORGANIZATION_ID);
  assert.equal(requested[1].uri.searchParams.get('id'),'eq.'+id);
 }finally{globalThis.fetch=original}
});

test('invalid session is refused',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({error:'invalid'},{status:401});
 try{
  const res=await staging.fetch(new Request(url,{headers:{Origin:origin,Authorization:'Bearer '+'a'.repeat(100)}}),env);
  assert.equal(res.status,401);
 }finally{globalThis.fetch=original}
});

test('RLS-hidden conversation remains undisclosed',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(input)=>new URL(input).pathname==='/auth/v1/user'?Response.json({id:'user'}):Response.json([]);
 try{
  const res=await staging.fetch(new Request(url,{headers:{Origin:origin,Authorization:'Bearer '+'a'.repeat(100)}}),env);
  assert.equal(res.status,404);
 }finally{globalThis.fetch=original}
});
