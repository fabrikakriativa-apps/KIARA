import test from 'node:test';
import assert from 'node:assert/strict';
import {selectCurtainFinishReferences} from '../src/reference-selection.js';

const references=[
 {id:'a',product:'cortina',model:'Prega macho',title:'Prega macho',storage_path:'org/a.jpg',active:true},
 {id:'b',product:'cortina',model:'Prega franzida',title:'Franzida',storage_path:'org/b.jpg',active:true},
 {id:'c',product:'cortina',model:'Wave',title:'Wave',storage_path:'org/c.jpg',active:false},
 {id:'d',product:'persiana',model:'Wave',title:'Errada',storage_path:'org/d.jpg',active:true},
];
test('não sugere mídia sem pedido contextual',()=>{
 assert.deepEqual(selectCurtainFinishReferences({modelsRequested:['Prega macho'],references}),[]);
});
test('seleciona apenas referência ativa e do produto correto',()=>{
 const found=selectCurtainFinishReferences({requested:true,modelsRequested:['Prega macho','Wave'],references});
 assert.equal(found.length,1);assert.equal(found[0].id,'a');
});
test('máximo duas imagens e sem catálogo completo',()=>{
 const found=selectCurtainFinishReferences({requested:true,modelsRequested:['Prega macho','Prega franzida','Wave'],references});
 assert.deepEqual(found.map(x=>x.id),['a','b']);
});
test('suporta acentos no nome do modelo',()=>{
 assert.equal(selectCurtainFinishReferences({requested:true,modelsRequested:['préga franzída'],references})[0].id,'b');
});
