import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8').replace("import { quoteIntakePrompt } from './quote-intake.js';",readFileSync(new URL('../src/quote-intake.js',import.meta.url),'utf8').replaceAll('export ','')).replace("import { simulateCurtainQuote } from './quote-pricing.js';",readFileSync(new URL('../src/quote-pricing.js',import.meta.url),'utf8').replaceAll('export ','')).replace("import { normalizeCurtainIntake, extractConversationInstructions } from './quote-conversation.js';",readFileSync(new URL('../src/quote-conversation.js',import.meta.url),'utf8').replaceAll('export ','')).replace("import { commercialConversationRules } from './commercial-guidance.js';",readFileSync(new URL('../src/commercial-guidance.js',import.meta.url),'utf8').replaceAll('export ',''));
const qualification=readFileSync(new URL('../src/customer-qualification.js',import.meta.url),'utf8').replaceAll('export ','');
const qualificationAI=readFileSync(new URL('../src/qualification-ai.js',import.meta.url),'utf8').replaceAll('export ','');
const identityModule=readFileSync(new URL('../src/consultative-identity.js',import.meta.url),'utf8').replaceAll('export ','');
const productModule=readFileSync(new URL('../src/product-knowledge.js',import.meta.url),'utf8').replaceAll('export ','');
const usable=source.replace("import { CONSULTATIVE_IDENTITY } from './consultative-identity.js';",identityModule).replace("import { PRODUCT_KNOWLEDGE } from './product-knowledge.js';",productModule).replace("import {blankQualification,mergeQualification,evaluateCustomerQualification,qualificationQuestion,containsCommercialPrice} from './customer-qualification.js';",qualification).replace("import {validateExtractedQualification,qualificationExtractionInstructions} from './qualification-ai.js';",qualificationAI).replace("import {chooseFinishImages,requestedFinishImages} from './media-reference.js';",'const chooseFinishImages=()=>[]; const requestedFinishImages=()=>[];').replace("import {sendKiaraImage} from './send-media.js';",'const sendKiaraImage=async()=>null;');
const instrumented=usable.replace('export default {','export const __audio={receiveMessage,consumeMessage,downloadAudio,transcribeAudio,assessAudio,handleAudioJob};\nexport default {');
if(instrumented===source)throw Error('Worker export not found');
const {__audio}=await import('data:text/javascript;base64,'+Buffer.from(instrumented).toString('base64'));
const wa='5511999999999',mid='message-voice-1',aid='123456789012';
const route={source:'easy',phoneId:'phone',token:'media-token',allowed:wa};
const message={id:mid,type:'audio',from:wa,timestamp:'1793635200',audio:{id:aid,mime_type:'audio/ogg; codecs=opus'}};
const value={contacts:[]};
function setup({mode='review',assessment=true,badMedia=false,lowConfidence=false}={}){
 const kv=new Map(),queue=[],calls=[],sent=[],modelInputs=[];
 const env={
  KIARA_AUDIO_MODE:mode,KIARA_SYNC_ENABLED:'false',KIARA_GUIDANCE_ENABLED:'false',
  KIARA_CONTROL_ENABLED:'false',KIARA_KNOWLEDGE_ENABLED:'false',
  OPENAI_API_KEY:'test-openai',EASY_ACCESS_TOKEN:'media-token',EASY_PHONE_NUMBER_ID:'phone',
  TEST_ALLOWED_WA_ID:wa,CONVERSAS:{
   get:async(key,type)=>{const value=kv.get(key);if(!value)return null;return type==='json'?JSON.parse(value):value},
   put:async(key,value)=>{kv.set(key,String(value))},delete:async key=>kv.delete(key)
  },
  KIARA_QUEUE:{send:async job=>queue.push(job)}
 };
 const original=globalThis.fetch;
 globalThis.fetch=async(input,init={})=>{
  const url=new URL(input);calls.push(url.toString());
  if(url.hostname==='graph.facebook.com'&&url.pathname.endsWith('/'+aid)){
   return Response.json({
    file_size:2048,mime_type:'audio/ogg; codecs=opus',
    url:badMedia?'https://attacker.example/audio':'https://lookaside.fbsbx.com/whatsapp_business/attachments?id=123'
   });
  }
  if(url.hostname==='lookaside.fbsbx.com'){
   return new Response(new Uint8Array([79,103,103,83,0,1,2,3]),{
    headers:{'content-length':'8','content-type':'audio/ogg'}
   });
  }
  if(url.pathname==='/v1/audio/transcriptions'){
   assert.equal(init.method,'POST');
   assert.equal(init.body.get('model'),'gpt-4o-mini-transcribe');
   assert.equal(init.body.get('response_format'),'json');
   return Response.json({text:'Quero saber se posso instalar persiana próxima ao fogão na cozinha.',
    logprobs:[{logprob:lowConfidence?-1.8:-0.1}]});
  }
  if(url.pathname==='/v1/responses'){
   const body=JSON.parse(init.body);modelInputs.push(body);
   if(body.instructions.startsWith('Você faz triagem conservadora')){
    return Response.json({output:[{content:[{type:'output_text',
     text:JSON.stringify({human:assessment,reason:assessment?'Dúvida técnica de segurança':'Pedido claro'})}]}]});
   }
   return Response.json({output:[{content:[{type:'output_text',
    text:'Pode me enviar uma foto do ambiente para a equipe avaliar?'}]}]});
  }
  if(url.hostname==='graph.facebook.com'&&url.pathname.endsWith('/phone/messages')){
   sent.push(JSON.parse(init.body));
   return Response.json({messages:[{id:'sent-voice'}]});
  }
  throw Error('Unexpected HTTP request '+url);
 };
 return {env,kv,queue,calls,sent,modelInputs,restore(){globalThis.fetch=original}};
}
async function scenario(options,fn){const x=setup(options);try{await fn(x)}finally{x.restore()}}
test('audio feature is opt-in; off never creates queue or downloads media',async()=>scenario({mode:'off'},async x=>{
 await __audio.receiveMessage(x.env,route,message,value);
 assert.equal(x.queue.length,0);
 assert.equal(x.calls.length,0);
}));
test('review mode pauses immediately; queues audio, transcribes, never sends WhatsApp',async()=>scenario({mode:'review'},async x=>{
 await __audio.receiveMessage(x.env,route,message,value);
 assert.equal(x.queue.length,1);
 assert.equal(x.queue[0].kind,'audio');
 assert.equal(x.queue[0].audioId,aid);
 assert.equal(x.kv.get('easy:'+wa+':human'),'1');
 await __audio.consumeMessage(x.env,x.queue[0]);
 assert.equal(x.sent.length,0);
 assert.equal(x.modelInputs.length,0,'Review mode should not call the classifier');
 const cached=JSON.parse(x.kv.get('easy:audio-transcript:'+mid));
 assert.match(cached.text,/persiana/);
 assert.match(x.kv.get('easy:audio-human:'+mid),/revisão humana/);
}));
test('reply mode escalates technical uncertainty instead of guessing',async()=>scenario({mode:'reply',assessment:true},async x=>{
 await __audio.receiveMessage(x.env,route,message,value);
 await __audio.consumeMessage(x.env,x.queue[0]);
 assert.equal(x.sent.length,0);
 assert.equal(x.modelInputs.length,1);
 assert.equal(x.kv.get('easy:'+wa+':human'),'1');
 assert.match(x.kv.get('easy:audio-human:'+mid),/Dúvida técnica/);
}));
test('low confidence transcription routes human without calling decision model',async()=>scenario({mode:'reply',lowConfidence:true},async x=>{
 await __audio.receiveMessage(x.env,route,message,value);
 await __audio.consumeMessage(x.env,x.queue[0]);
 assert.equal(x.sent.length,0);
 assert.equal(x.modelInputs.length,0);
 assert.equal(x.kv.get('easy:'+wa+':human'),'1');
}));
test('clear audio can follow existing text reply pipeline, never sends voice',async()=>scenario({mode:'reply',assessment:false},async x=>{
 await __audio.receiveMessage(x.env,route,message,value);
 await __audio.consumeMessage(x.env,x.queue[0]);
 assert.equal(x.sent.length,1);
 assert.equal(x.sent[0].type,'text');
 assert.equal(x.modelInputs.length,2);
 assert.match(x.modelInputs[1].input[0].content,/Áudio transcrito/);
}));
test('media host is restricted; invalid source causes human handoff without external download',async()=>scenario({mode:'reply',badMedia:true},async x=>{
 await __audio.receiveMessage(x.env,route,message,value);
 await __audio.consumeMessage(x.env,x.queue[0]);
 assert.equal(x.sent.length,0);
 assert.equal(x.kv.get('easy:'+wa+':human'),'1');
 assert.ok(!x.calls.some(url=>url.startsWith('https://attacker.example')));
}));
test('repeated audio job reuses cached transcript instead of retranscribing',async()=>scenario({mode:'review'},async x=>{
 await __audio.receiveMessage(x.env,route,message,value);
 await __audio.consumeMessage(x.env,x.queue[0]);
 await __audio.consumeMessage(x.env,x.queue[0]);
 assert.equal(x.calls.filter(url=>url.endsWith('/v1/audio/transcriptions')).length,1);
 assert.equal(x.sent.length,0);
}));
