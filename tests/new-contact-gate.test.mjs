import test from 'node:test';
import assert from 'node:assert/strict';
import {multiContactMode,eligibleIncoming,enrolledNewContact,isAuthorizedToSend} from '../src/worker.js';
import {readFileSync} from 'node:fs';

const contact='5511999999999';
const route={source:'easy',phoneId:'989677610885915',allowed:contact};
const common={TEST_ALLOWED_WA_ID:contact,KIARA_CONTROL_ENABLED:'true',
  SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-key',
  SUPABASE_ORGANIZATION_ID:'00000000-0000-4000-8000-000000000001'};
const staging={...common,KIARA_NEW_CONTACTS_ENABLED:'false',KIARA_SYNC_ALL_CONTACTS:'false',KIARA_STAGING_LIVE_ENABLED:'true'};
const production={...common,KIARA_NEW_CONTACTS_ENABLED:'true',KIARA_SYNC_ALL_CONTACTS:'true',KIARA_STAGING_LIVE_ENABLED:'false'};

test('contato de homologacao continua limitado ao telefone autorizado',async()=>{
  assert.equal(multiContactMode(staging),false);
  assert.equal(await eligibleIncoming(staging,route,{from:contact}),true);
  assert.equal(await eligibleIncoming(staging,route,{from:'5511888888888'}),false);
});

test('modo de novos contatos exige flags independentes e nao pode rodar em staging',()=>{
  assert.equal(multiContactMode(production),true);
  assert.equal(multiContactMode({...production,KIARA_NEW_CONTACTS_ENABLED:'false'}),false);
  assert.equal(multiContactMode({...production,KIARA_SYNC_ALL_CONTACTS:'false'}),false);
  assert.equal(multiContactMode({...production,KIARA_STAGING_LIVE_ENABLED:'true'}),false);
});

test('mensagens sem timestamp verificavel falham sem consultar rede',async()=>{
  assert.equal(await eligibleIncoming(production,route,{from:'5511888888888'}),false);
  assert.equal(await eligibleIncoming(production,route,{from:'5511888888888',timestamp:'invalid'}),false);
  assert.equal(await eligibleIncoming(production,route,{from:'sem-numero',timestamp:'1790000000'}),false);
});

test('RPC negativo e indisponibilidade de autorizacao impedem novo contato',async()=>{
  const previous=globalThis.fetch;
  const target='5511888888888';
  const message={from:target,timestamp:'1790000000'};
  try{
    globalThis.fetch=async(url)=>new Response('false',{status:200,headers:{'Content-Type':'application/json'}});
    assert.equal(await eligibleIncoming(production,route,message),false);
    globalThis.fetch=async()=>new Response('indisponivel',{status:503});
    await assert.rejects(()=>eligibleIncoming(production,route,message),/Eligibility unavailable/);
  }finally{globalThis.fetch=previous;}
});

test('resposta multicontato exige matricula e nunca ignora bloqueio global',async()=>{
  const previous=globalThis.fetch;
  const target='5511888888888';
  try{
    globalThis.fetch=async(url)=>{
      const targetUrl=String(url);
      if(targetUrl.includes('/kiara_contact_eligibility?'))return Response.json([{contact_wa_id:target}]);
      if(targetUrl.includes('/kiara_activation_control?'))return Response.json([{enabled:false,legacy_snapshot_verified:false}]);
      return Response.json([]);
    };
    assert.equal(await enrolledNewContact(production,route,target),true);
    assert.equal(await isAuthorizedToSend(production,route,target),false);
    assert.equal(await isAuthorizedToSend(production,route,'5511777777777'),false);
  }finally{globalThis.fetch=previous;}
});

test('configuracao e comandos de homologacao permanecem isolados',()=>{
  const stagingConfig=readFileSync(new URL('../staging/wrangler.toml',import.meta.url),'utf8');
  const code=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
  assert.match(stagingConfig,/KIARA_NEW_CONTACTS_ENABLED = "false"/);
  assert.match(stagingConfig,/KIARA_SYNC_ALL_CONTACTS = "false"/);
  assert.match(code,/if\(\!multiContactMode\(env\)\)return testContact/);
  assert.match(code,/const isReset = !multiContactMode\(env\)/);
  assert.match(code,/kiara_is_new_contact_eligible/);
});
