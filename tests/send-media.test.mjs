import test from 'node:test';
import assert from 'node:assert/strict';
import {requestedFinishImages,chooseFinishImages} from '../src/media-reference.js';
import {sendKiaraImage} from '../src/send-media.js';
const org='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const ref={id:'img',product:'cortina',model:'Wave',title:'Cortina Wave',active:true,storage_path:org+'/wave.jpg'};
test('não envia catálogo ou imagem sem pedido visual e modelo',()=>{
 assert.deepEqual(requestedFinishImages('Quero uma cortina na sala'),[]);
 assert.deepEqual(requestedFinishImages('Me mande todas as fotos'),[]);
 assert.deepEqual(requestedFinishImages('Pode mostrar a wave?'),['Wave']);
 assert.equal(chooseFinishImages('Pode mostrar a wave?',[ref]).length,1);
});
test('reconhece variações de escrita dos modelos sem sugerir catálogo',()=>{
 assert.deepEqual(requestedFinishImages('Pode mostrar a franzida?'),['Prega franzida']);
 assert.deepEqual(requestedFinishImages('Quero ver préga franzída e wave'),['Prega franzida','Wave']);
 assert.deepEqual(requestedFinishImages('Me mostra prega-macho?'),['Prega macho']);
 assert.deepEqual(requestedFinishImages('Quero comparar todas as cortinas'),[]);
});
test('não envia imagens inativas',()=>{
 assert.equal(chooseFinishImages('Quero imagem wave',[{...ref,active:false}]).length,0);
});
test('não consulta rede se controle humano negar',async()=>{
 let calls=0;
 const sent=await sendKiaraImage({env:{SUPABASE_ORGANIZATION_ID:org},route:{phoneId:'phone',token:'mock'},to:'5511999999999',reference:ref,
  guard:async()=>false,request:async()=>{calls++;throw Error('network')}}); 
 assert.equal(sent,null);assert.equal(calls,0);
});
test('bloqueia mídia de outra organização sem baixar',async()=>{
 await assert.rejects(()=>sendKiaraImage({env:{SUPABASE_ORGANIZATION_ID:org},reference:{...ref,storage_path:'outro/wave.jpg'}}),/organização/);
});
test('envia por ID de mídia, sem expor token ou URL privada ao WhatsApp',async()=>{
 const calls=[],env={SUPABASE_ORGANIZATION_ID:org,SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'mock-key'};
 const request=async(url,options)=>{calls.push({url,options});if(String(url).includes('/storage/'))return new Response(new Blob(['fake-jpg'],{type:'image/jpeg'}),{headers:{'Content-Type':'image/jpeg'}});if(String(url).endsWith('/media'))return Response.json({id:'123456'});return Response.json({messages:[{id:'wamid1'}]});};
 const sent=await sendKiaraImage({env,route:{phoneId:'123',token:'meta-token'},to:'5511999999999',reference:ref,request,guard:async()=>true});
 assert.equal(sent,'wamid1');assert.equal(calls.length,3);
 assert.equal(calls[1].options.body.get('messaging_product'),'whatsapp');
 const body=JSON.parse(calls[2].options.body);
 assert.equal(body.image.id,'123456');assert.equal(body.type,'image');assert.equal(body.image.link,undefined);
});

test('intervenção humana após carregar imagem impede o envio à Meta',async()=>{
 let calls=0,allowed=true;
 const env={SUPABASE_ORGANIZATION_ID:org,SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'private'};
 const request=async(url)=>{
  calls++;
  if(String(url).includes('/storage/')){allowed=false;return new Response(new Blob(['x'],{type:'image/jpeg'}),{headers:{'Content-Type':'image/jpeg'}})}
  throw Error('Não deveria alcançar Meta');
 };
 const result=await sendKiaraImage({env,route:{phoneId:'123',token:'meta-test'},to:'5511999999999',reference:ref,
  guard:async()=>allowed,request});
 assert.equal(result,null);assert.equal(calls,1);
});
