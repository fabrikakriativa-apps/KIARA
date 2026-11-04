import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8').replace("import { quoteIntakePrompt } from './quote-intake.js';",readFileSync(new URL('../src/quote-intake.js',import.meta.url),'utf8').replaceAll('export ','')).replace("import { simulateCurtainQuote } from './quote-pricing.js';",readFileSync(new URL('../src/quote-pricing.js',import.meta.url),'utf8').replaceAll('export ','')).replace("import { normalizeCurtainIntake, extractConversationInstructions } from './quote-conversation.js';",readFileSync(new URL('../src/quote-conversation.js',import.meta.url),'utf8').replaceAll('export ','')).replace("import { commercialConversationRules } from './commercial-guidance.js';",readFileSync(new URL('../src/commercial-guidance.js',import.meta.url),'utf8').replaceAll('export ',''));
const qualification=readFileSync(new URL('../src/customer-qualification.js',import.meta.url),'utf8').replaceAll('export ','');
const usable=source.replace("import {blankQualification,mergeQualification,evaluateCustomerQualification,extractQualification,qualificationQuestion,containsCommercialPrice} from './customer-qualification.js';",qualification).replace("import {chooseFinishImages,requestedFinishImages} from './media-reference.js';",'const chooseFinishImages=()=>[]; const requestedFinishImages=()=>[];').replace("import {sendKiaraImage} from './send-media.js';",'const sendKiaraImage=async()=>null;');
const instrumented=usable.replace('export default {','export const __knowledge={cachedApprovedKnowledge,refreshApprovedKnowledge,getGuidance,generateReply};\nexport default {');
assert.notEqual(instrumented,source);
const {__knowledge}=await import('data:text/javascript;base64,'+Buffer.from(instrumented).toString('base64'));
const org='0e398095-cc22-421b-ae34-7bf0df8ad7b2';
const proposed='Quando o cliente solicitar persiana próxima ao fogão, peça foto e distância aproximada. Sem confirmação técnica, encaminhe à equipe e não afirme segurança ou resistência.';
const key='kiara:approved-knowledge:'+org;
const route={source:'easy',phoneId:'phone'};
function harness({enabled=true,snapshot,hang=false}={}){
 const store=new Map(snapshot?[ [key,snapshot] ]:[]);
 const reads=[];
 const env={
  KIARA_KNOWLEDGE_ENABLED:enabled?'true':'false',
  KIARA_GUIDANCE_ENABLED:'false',
  SUPABASE_URL:'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY:'server-side-mock',
  SUPABASE_ORGANIZATION_ID:org,
  OPENAI_API_KEY:'model-mock',
  CONVERSAS:{
   get:async(k,type)=>{reads.push(k);if(hang)return new Promise(()=>{});
    const item=store.get(k);
    return type==='json'?item??null:item??null;
   },
   put:async(k,value)=>store.set(k,JSON.parse(value))
  }
 };
 return {env,store,reads};
}
test('approved rule enters reply prompt from KV without querying Supabase',async()=>{
 const x=harness({snapshot:{fetchedAt:Date.now(),rules:[proposed]}});
 const original=globalThis.fetch;
 let calls=0,modelBody=null;
 globalThis.fetch=async(url,init)=>{
  const uri=new URL(url);
  assert.equal(uri.hostname,'api.openai.com','No Supabase lookup in customer reply path');
  calls++;
  modelBody=JSON.parse(init.body);
  return Response.json({output:[{content:[{type:'output_text',text:'Para avaliar, poderia enviar foto da janela e distância aproximada do fogão? A equipe verificará a indicação técnica.'}]}]});
 };
 try{
  const guidance=await __knowledge.getGuidance(x.env,route,'5511999999999');
  assert.match(guidance,/distância aproximada/);
  assert.match(guidance,/não afirme segurança/);
  const answer=await __knowledge.generateReply(x.env,[{role:'user',content:'Tenho uma persiana perto do fogão, é seguro instalar?'}],guidance);
  assert.match(modelBody.instructions,/distância aproximada/);
  assert.equal(calls,1);
  assert.match(answer,/equipe verificará/);
  assert.equal(x.reads.length,1);
 }finally{globalThis.fetch=original;}
});
test('flag disabled never exposes approved knowledge',async()=>{
 const x=harness({enabled:false,snapshot:{fetchedAt:Date.now(),rules:[proposed]}});
 assert.equal(await __knowledge.getGuidance(x.env,route,'5511999999999'),'');
 assert.equal(x.reads.length,0);
});
test('stale snapshot is not passed to model',async()=>{
 const x=harness({snapshot:{fetchedAt:Date.now()-11*60*1000,rules:[proposed]}});
 assert.equal(await __knowledge.getGuidance(x.env,route,'5511999999999'),'');
});
test('slow KV read stops waiting within reply bound, with no network fetch',async()=>{
 const x=harness({hang:true});const start=Date.now();
 assert.equal(await __knowledge.getGuidance(x.env,route,'5511999999999'),'');
 assert.ok(Date.now()-start<700,'KV read must timeout promptly');
});
test('background refresh only loads approved global guidance',async()=>{
 const x=harness();
 const original=globalThis.fetch;
 const paths=[];
 globalThis.fetch=async(url,opts)=>{
  const uri=new URL(url);paths.push(uri);
  assert.equal(opts.method,'GET');
  assert.equal(uri.hostname,'example.supabase.co');
  assert.equal(uri.searchParams.get('scope'),'eq.global');
  assert.equal(uri.searchParams.get('status'),'eq.approved');
  assert.equal(uri.searchParams.get('organization_id'),'eq.'+org);
  return Response.json([{instruction:proposed,created_at:'2026-11-02T00:00:00Z'}]);
 };
 try{
  await __knowledge.refreshApprovedKnowledge(x.env);
  assert.equal(paths.length,1);
  assert.deepEqual(x.store.get(key).rules,[proposed]);
  assert.match(await __knowledge.getGuidance(x.env,route,'5511999999999'),/não afirme segurança/);
  await __knowledge.refreshApprovedKnowledge(x.env);
  assert.equal(paths.length,1,'Fresh cache avoids second network request');
 }finally{globalThis.fetch=original;}
});
test('knowledge disabled prevents background refresh as well',async()=>{
 const x=harness({enabled:false});const original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Unexpected network')};
 try{await __knowledge.refreshApprovedKnowledge(x.env);assert.equal(x.store.size,0)}
 finally{globalThis.fetch=original}
});
