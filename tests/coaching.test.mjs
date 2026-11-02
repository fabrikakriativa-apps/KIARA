import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../src/worker.js', import.meta.url),'utf8');
const testable=source.replace('export default {','export const __test={consumeMessage,coachingRequest,readHold,getGuidance,pendingCustomerBatch};\nexport default {');
if(testable===source)throw Error('Worker entrypoint not found');
const {__test}=await import('data:text/javascript;base64,'+Buffer.from(testable).toString('base64'));
const wa='5511999999999',cid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',org='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const input=[{whatsapp_message_id:'m1',direction:'incoming',sender:'customer',text_body:'Persiana para cozinha e cortina para sala',occurred_at:'2026-11-02T00:00:00Z',created_at:'2026-11-02T00:00:00Z'}];
const job={source:'easy',sender:wa,messageId:'m1',input:input[0].text_body};
function scenario(opts={}){
 let held=opts.held??false,modelCalls=0,waCalls=0,queue=[],sent=[],models=[];
 const kv=new Map(opts.paused?[['easy:'+wa+':human','1']]:[]);
 const env={KIARA_SYNC_ENABLED:'true',KIARA_HOLD_ENABLED:'true',KIARA_GUIDANCE_ENABLED:opts.guidance===false?'false':'true',KIARA_CONTROL_ENABLED:'false',SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'mock-secret',SUPABASE_ORGANIZATION_ID:org,EASY_PHONE_NUMBER_ID:'phone',EASY_ACCESS_TOKEN:'unused',TEST_ALLOWED_WA_ID:wa,OPENAI_API_KEY:'unused',KIARA_DASHBOARD_ORIGIN:'https://fabrikakriativa-apps.github.io',CONVERSAS:{get:async(k)=>kv.get(k)||null,put:async(k,v)=>kv.set(k,v),delete:async(k)=>kv.delete(k)},KIARA_QUEUE:{send:async(v)=>queue.push(v)}};
 const original=globalThis.fetch;
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url);
  if(u.hostname==='api.openai.com'){modelCalls++;models.push(JSON.parse(options.body));if(opts.holdDuringModel)held=true;return Response.json({output:[{content:[{type:'output_text',text:'Entendi os dois ambientes.'}]}]})}
  if(u.hostname==='graph.facebook.com'){waCalls++;sent.push(JSON.parse(options.body));return Response.json({messages:[{id:'sent'+waCalls}]})}
  if(u.pathname==='/auth/v1/user')return Response.json({id:'user'});
  if(u.pathname.endsWith('/rpc/kiara_set_reply_hold')){const a=JSON.parse(options.body);const changed=held!==a.new_hold;held=a.new_hold;return Response.json({ok:true,held,changed,status:'ai'})}
  if(u.pathname.endsWith('/kiara_conversations')){if(opts.dbError)return new Response('unavailable',{status:503});if(['POST','PATCH'].includes(options.method))return new Response(null,{status:204});if(u.searchParams.get('select')==='reply_held')return Response.json([{reply_held:held}]);return Response.json([{id:cid,status:'ai',source:'easy',contact_wa_id:wa,phone_number_id:'phone'}])}
  if(u.pathname.endsWith('/kiara_guidance')){if(opts.dbError)return new Response('unavailable',{status:503});return Response.json([{instruction:u.searchParams.get('scope')==='eq.global'?'Não prometa prazos.':'Considere cozinha e sala.',created_at:'2026-11-02T00:00:00Z'}])}
  if(u.pathname.endsWith('/kiara_messages')){if(options.method==='POST')return new Response(null,{status:204});return Response.json(input)}
  throw Error('Unexpected HTTP mock '+url);
 };
 return {env,queue,sent,models,get held(){return held},get modelCalls(){return modelCalls},get waCalls(){return waCalls},restore(){globalThis.fetch=original}};
}
async function run(opts,check){const x=scenario(opts);try{await check(x)}finally{x.restore()}}
test('hold blocks generation and WhatsApp',async()=>run({held:true},async x=>{await __test.consumeMessage(x.env,job);assert.equal(x.modelCalls,0);assert.equal(x.waCalls,0)}));
test('private guidance enters the model only',async()=>run({},async x=>{await __test.consumeMessage(x.env,job);assert.equal(x.modelCalls,1);assert.equal(x.waCalls,1);assert.match(x.models[0].instructions,/Considere cozinha e sala/);assert.match(x.models[0].instructions,/Não prometa prazos/);assert.equal(x.sent[0].text.body,'Entendi os dois ambientes.')}));
test('hold during generation prevents send',async()=>run({holdDuringModel:true},async x=>{await __test.consumeMessage(x.env,job);assert.equal(x.modelCalls,1);assert.equal(x.waCalls,0)}));
test('human takeover still blocks sending',async()=>run({paused:true},async x=>{await __test.consumeMessage(x.env,job);assert.equal(x.waCalls,0)}));
test('database failure fails closed with hold enabled',async()=>run({dbError:true},async x=>{await assert.rejects(__test.consumeMessage(x.env,job));assert.equal(x.waCalls,0)}));
test('releasing twice queues the latest pending job once',async()=>run({held:true},async x=>{
 const req=()=>new Request('https://example.workers.dev/kiara/coach',{method:'POST',headers:{Origin:x.env.KIARA_DASHBOARD_ORIGIN,Authorization:'Bearer '+'a'.repeat(100),'Content-Type':'application/json'},body:JSON.stringify({conversationId:cid,action:'release'})});
 const a=await __test.coachingRequest(req(),x.env);assert.equal(a.status,200);assert.equal(x.held,false);assert.equal(x.queue.length,1);assert.equal(x.queue[0].messageId,'m1');
 const b=await __test.coachingRequest(req(),x.env);assert.equal(b.status,200);assert.equal(x.queue.length,1);
}));
