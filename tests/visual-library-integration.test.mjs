import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseProductImages} from '../src/media-reference.js';
import {readFileSync} from 'node:fs';
const org='11111111-1111-4111-8111-111111111111';
const images=[
 {id:'a',product:'cortina',category:'produto',model:'Gaze de linho',title:'Gaze de linho',active:true,storage_path:org+'/a.jpg'},
 {id:'b',product:'cortina',category:'produto',model:'Linho Fresh',title:'Linho Fresh',active:true,storage_path:org+'/b.jpg'},
 {id:'c',product:'persiana',category:'produto',model:'Romana blackout',title:'Romana blackout',active:true,storage_path:org+'/c.jpg'},
 {id:'d',product:'persiana',category:'produto',model:'Madeira horizontal',title:'Madeira horizontal',active:true,storage_path:org+'/d.jpg'},
 {id:'e',product:'persiana',category:'produto',model:'Rolô tela 1%',title:'Rolô 1% off-white',active:false,storage_path:org+'/e.jpg'}
];
test('sem intenção visual não envia imagens',()=>assert.deepEqual(chooseProductImages('Quero orçamento de cortina',images),[]));
test('pedido de exemplos usa apenas fotos aprovadas de cortinas',()=>{
 const r=chooseProductImages('Me mostre opções de cortinas',images);
 assert.ok(r.length>0&&r.length<=2);
 assert.ok(r.every(x=>x.product==='cortina'));
});
test('pedido de persianas não envia cortinas e descarta inativas',()=>{
 const r=chooseProductImages('Me mostre modelos de persianas',images);
 assert.ok(r.length>0&&r.length<=2);
 assert.ok(r.every(x=>x.product==='persiana'&&x.id!=='e'));
});
test('pedido explícito de modelo seleciona a imagem pertinente',()=>{
 const r=chooseProductImages('Tem imagem de romana blackout?',images);
 assert.equal(r[0]?.id,'c');
});
test('não usa imagens externas ao cadastro e preserva travas no Worker',()=>{
 const w=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
 assert.match(w,/sender !== digits\(route.allowed\)/);
 assert.match(w,/await guard\(\)/);
 assert.match(w,/KIARA_MEDIA_ENABLED/);
 assert.match(w,/active=is.true/);
});

test('pedido curto de imagem pode usar o assunto da última resposta',()=>{
 const r=chooseProductImages('Você pode mostrar fotos?',images,'Para cortinas, a gaze de linho tem aparência leve.');
 assert.ok(r.length>0);
 assert.ok(r.every(x=>x.product==='cortina'));
});
test('assunto ambíguo não provoca envio de fotos aleatórias',()=>{
 assert.deepEqual(chooseProductImages('Me mostre fotos',images,'A cortina e a persiana são duas possibilidades.'),[]);
});
