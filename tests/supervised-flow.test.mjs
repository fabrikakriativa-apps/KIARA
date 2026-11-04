import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8').replace("import { quoteIntakePrompt } from './quote-intake.js';",readFileSync(new URL('../src/quote-intake.js',import.meta.url),'utf8').replaceAll('export ','')).replace("import { simulateCurtainQuote } from './quote-pricing.js';",readFileSync(new URL('../src/quote-pricing.js',import.meta.url),'utf8').replaceAll('export ','')).replace("import { normalizeCurtainIntake, extractConversationInstructions } from './quote-conversation.js';",readFileSync(new URL('../src/quote-conversation.js',import.meta.url),'utf8').replaceAll('export ','')).replace("import { commercialConversationRules } from './commercial-guidance.js';",readFileSync(new URL('../src/commercial-guidance.js',import.meta.url),'utf8').replaceAll('export ',''));
const qualification=readFileSync(new URL('../src/customer-qualification.js',import.meta.url),'utf8').replaceAll('export ','');
const qualificationAI=readFileSync(new URL('../src/qualification-ai.js',import.meta.url),'utf8').replaceAll('export ','');
const identityModule=readFileSync(new URL('../src/consultative-identity.js',import.meta.url),'utf8').replaceAll('export ','');
const productModule=readFileSync(new URL('../src/product-knowledge.js',import.meta.url),'utf8').replaceAll('export ','');
const usable=source.replace("import { CONSULTATIVE_IDENTITY } from './consultative-identity.js';",identityModule).replace("import { PRODUCT_KNOWLEDGE } from './product-knowledge.js';",productModule).replace("import {blankQualification,mergeQualification,evaluateCustomerQualification,qualificationQuestion,containsCommercialPrice} from './customer-qualification.js';",qualification).replace("import {validateExtractedQualification,qualificationExtractionInstructions} from './qualification-ai.js';",qualificationAI).replace("import {chooseFinishImages,requestedFinishImages} from './media-reference.js';",'const chooseFinishImages=()=>[]; const requestedFinishImages=()=>[];').replace("import {sendKiaraImage} from './send-media.js';",'const sendKiaraImage=async()=>null;');
const instrumented=usable.replace('export default {','export const __suite = {consumeMessage,coachingRequest};\nexport default {');
if(instrumented===source)throw new Error('Worker export was not found');
const {__suite}=await import('data:text/javascript;base64,'+Buffer.from(instrumented).toString('base64'));

const org='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const conversationId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const phone='5511999999999';
const incoming={whatsapp_message_id:'w-1',direction:'incoming',sender:'customer',text_body:'Preciso de persiana na cozinha e cortina na sala',occurred_at:'2026-11-02T00:00:00Z',created_at:'2026-11-02T00:00:00Z'};
const validOrigin='https://fabrikakriativa-apps.github.io';
const bearer='Bearer '+ 'a'.repeat(100);

function setup(options={}){
  let held=false, human=Boolean(options.human), modelCalls=0;
  const queued=[], sent=[], modelRequests=[], events=[];
  const memory=new Map(human?[['easy:'+phone+':human','1']]:[]);
  const db={messages:[incoming],guidance:[{scope:'global',instruction:'Não prometa datas.',status:'approved'},{scope:'conversation',instruction:'Oriente sobre a persiana da cozinha e a cortina da sala.',status:'recorded'}]};
  const env={
    KIARA_SYNC_ENABLED:'true', KIARA_HOLD_ENABLED:'true', KIARA_GUIDANCE_ENABLED:'true', KIARA_CONTROL_ENABLED:'false',
    KIARA_DASHBOARD_ORIGIN:validOrigin, SUPABASE_URL:'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY:'dummy-server-side',
    SUPABASE_ORGANIZATION_ID:org, EASY_PHONE_NUMBER_ID:'12345',EASY_ACCESS_TOKEN:'dummy-easy',
    TEST_ALLOWED_WA_ID:phone, OPENAI_API_KEY:'dummy-openai',
    CONVERSAS:{get:async key=>memory.get(key)||null,put:async(key,value)=>memory.set(key,value),delete:async key=>memory.delete(key)},
    KIARA_QUEUE:{send:async (job)=>{queued.push(job);events.push('queued');}}
  };
  const original=globalThis.fetch;
  globalThis.fetch=async (input,init={})=>{
    const u=new URL(input);
    if(u.pathname==='/auth/v1/user') return options.invalidSession?Response.json({error:'Invalid'}, {status:401}):Response.json({id:'operator'});
    if(u.pathname.endsWith('/rpc/kiara_set_reply_hold')){
      if(options.forbiddenRpc)return Response.json({error:'forbidden'},{status:403});
      const requested=JSON.parse(init.body).new_hold;
      const changed=requested!==held;held=requested;
      events.push(requested?'hold':'release');
      return Response.json({ok:true,held,changed,status:human?'human':'ai'});
    }
    if(u.pathname.endsWith('/kiara_conversations')){
      if(options.unavailable)return Response.json({message:'db down'},{status:503});
      if(init.method==='PATCH'||init.method==='POST')return new Response(null,{status:204});
      if(u.searchParams.get('select')==='reply_held')return Response.json([{reply_held:held}]);
      return Response.json([{id:conversationId,status:human?'human':'ai',source:'easy',contact_wa_id:phone,phone_number_id:'12345'}]);
    }
    if(u.pathname.endsWith('/kiara_guidance')){
      if(options.unavailable)return Response.json({message:'db down'},{status:503});
      const scope=u.searchParams.get('scope')?.replace('eq.','');
      return Response.json(db.guidance.filter(g=>g.scope===scope).map(g=>({instruction:g.instruction,created_at:'2026-11-02T00:00:00Z'})));
    }
    if(u.pathname.endsWith('/kiara_messages')){
      if(init.method==='POST')return new Response(null,{status:204});
      return Response.json([...db.messages].reverse());
    }
    if(u.hostname==='api.openai.com'){
      modelCalls++;
      const body=JSON.parse(init.body);modelRequests.push(body);events.push('model');
      if(options.holdDuringGeneration)held=true;
      return Response.json({output:[{content:[{type:'output_text',text:'Posso orientar sobre os dois ambientes.'}]}]});
    }
    if(u.hostname==='graph.facebook.com'){
      sent.push(JSON.parse(init.body));events.push('whatsapp');
      return Response.json({messages:[{id:'out-1'}]});
    }
    throw Error('Unexpected mock API '+u);
  };
  return {env,queued,sent,events,modelRequests,db,get held(){return held},get modelCalls(){return modelCalls},setHuman(value){human=value;if(value)memory.set('easy:'+phone+':human','1');else memory.delete('easy:'+phone+':human')},restore(){globalThis.fetch=original}};
}
const job={source:'easy',sender:phone,messageId:'w-1',input:incoming.text_body};
const request=(action,opts={})=>new Request('https://staging.example/kiara/coach',{method:'POST',headers:{Origin:opts.origin??validOrigin,Authorization:opts.auth??bearer,'content-type':'application/json'},body:JSON.stringify({action,conversationId})});
async function withScenario(opts,cb){const a=setup(opts);try{await cb(a)}finally{a.restore()}}

test('supervised flow: hold, private guidance, release, answer exactly once',async()=>withScenario({},async a=>{
  const hold=await __suite.coachingRequest(request('hold'),a.env);
  assert.equal(hold.status,200);
  assert.equal(a.held,true);
  await __suite.consumeMessage(a.env,job);
  assert.equal(a.modelCalls,0);
  assert.equal(a.sent.length,0);

  const release=await __suite.coachingRequest(request('release'),a.env);
  assert.equal(release.status,200);
  assert.equal(a.held,false);
  assert.equal(a.queued.length,1);
  assert.equal(a.queued[0].messageId,'w-1');

  await __suite.consumeMessage(a.env,a.queued[0]);
  assert.equal(a.modelCalls,1);
  assert.equal(a.sent.length,1);
  assert.match(a.modelRequests[0].instructions,/Não prometa datas/);
  assert.match(a.modelRequests[0].instructions,/persiana da cozinha e a cortina da sala/);
  assert.equal(a.sent[0].text.body,'Posso orientar sobre os dois ambientes.');
  assert.doesNotMatch(a.sent[0].text.body,/Não prometa datas|Oriente sobre/);
  await __suite.consumeMessage(a.env,a.queued[0]);
  assert.equal(a.sent.length,1);
  assert.deepEqual(a.events.filter(x=>x==='whatsapp'),['whatsapp']);
}));

test('repeated release does not duplicate queue entries',async()=>withScenario({},async a=>{
  await __suite.coachingRequest(request('hold'),a.env);
  const first=await __suite.coachingRequest(request('release'),a.env);
  const second=await __suite.coachingRequest(request('release'),a.env);
  assert.equal(first.status,200);assert.equal(second.status,200);assert.equal(a.queued.length,1);
}));

test('origin mismatch refuses hold without mutation',async()=>withScenario({},async a=>{
  const result=await __suite.coachingRequest(request('hold',{origin:'https://stranger.example'}),a.env);
  assert.equal(result.status,403);assert.equal(a.held,false);assert.equal(a.queued.length,0);
}));

test('invalid Supabase session refuses hold',async()=>withScenario({invalidSession:true},async a=>{
  const result=await __suite.coachingRequest(request('hold'),a.env);
  assert.equal(result.status,401);assert.equal(a.held,false);
}));

test('RPC authorization refuses hold',async()=>withScenario({forbiddenRpc:true},async a=>{
  const result=await __suite.coachingRequest(request('hold'),a.env);
  assert.equal(result.status,403);assert.equal(a.held,false);
}));

test('invalid action never enqueues or sends',async()=>withScenario({},async a=>{
  const result=await __suite.coachingRequest(request('reset_everyone'),a.env);
  assert.equal(result.status,400);assert.equal(a.queued.length,0);assert.equal(a.sent.length,0);
}));

test('human takeover prevents model after release',async()=>withScenario({},async a=>{
  await __suite.coachingRequest(request('hold'),a.env);
  a.setHuman(true);
  const result=await __suite.coachingRequest(request('release'),a.env);
  assert.equal(result.status,200);
  assert.equal(a.queued.length,0);
  await __suite.consumeMessage(a.env,job);
  assert.equal(a.modelCalls,0);assert.equal(a.sent.length,0);
}));

test('hold during generation prevents WhatsApp transmission',async()=>withScenario({holdDuringGeneration:true},async a=>{
  await __suite.consumeMessage(a.env,job);
  assert.equal(a.modelCalls,1);assert.equal(a.sent.length,0);assert.equal(a.held,true);
}));

test('database outage blocks reply rather than sending without control',async()=>withScenario({unavailable:true},async a=>{
  await assert.rejects(()=>__suite.consumeMessage(a.env,job));
  assert.equal(a.modelCalls,0);assert.equal(a.sent.length,0);
}));

test('coaching endpoint disabled by flag cannot mutate state',async()=>withScenario({},async a=>{
  a.env.KIARA_HOLD_ENABLED='false';
  const res=await __suite.coachingRequest(request('hold'),a.env);
  assert.equal(res.status,503);assert.equal(a.held,false);
}));

test('two customer topics retained in one model context',async()=>withScenario({},async a=>{
  a.db.messages.push({whatsapp_message_id:'w-2',direction:'incoming',sender:'customer',text_body:'A cortina da sala será de voil',occurred_at:'2026-11-02T00:01:00Z',created_at:'2026-11-02T00:01:00Z'});
  await __suite.consumeMessage(a.env,{...job,messageId:'w-2'});
  assert.equal(a.modelCalls,1);
  assert.equal(a.sent.length,1);
  const input=a.modelRequests[0].input.filter(x=>x.role==='user').map(x=>x.content).join(' ');
  assert.match(input,/persiana na cozinha/);
  assert.match(input,/cortina da sala será de voil/);
}));
