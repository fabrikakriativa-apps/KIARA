import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCategoryEvidence,commercialDescription} from '../src/quote-category-evidence.js';
import {normalizeQuoteItems} from '../src/quote-flow.js';

const settings={enforceEvidence:true,models:['Wave'],
 categories:[{name:'LINHO / EFEITO LINHO - PREÇO MÉDIO',active:true},{name:'VOIL LEVE - PREÇO MÉDIO',active:true}],
 technicalLimits:{maxWidth:30,maxHeight:10,maxQuantity:20}};
const row={product:'cortina',environment:'Sala',model:'Wave',width:3,height:2.5,quantity:1,drive:'manual',
 frontCategory:'LINHO / EFEITO LINHO - PREÇO MÉDIO',frontBasis:'selected',
 frontEvidence:'quero linho',frontDescription:'Linho',backCategory:'Sem forro'};
test('categoria só pode usar evidência de mensagem do cliente',()=>{
 const history=[{role:'user',content:'Para a sala quero linho, Wave, 3 por 2,50, sem forro.'}];
 assert.equal(normalizeQuoteItems({items:[row]},settings,'',history).ready,true);
 assert.equal(normalizeQuoteItems({items:[{...row,frontEvidence:'quero linho'}]},settings,'',[{role:'assistant',content:'Quero linho'}]).ready,false);
});
test('intenção vaga pode gerar referência, nunca escolha presumida',()=>{
 const row2={...row,frontCategory:'VOIL LEVE - PREÇO MÉDIO',
  frontBasis:'reference',frontEvidence:'quero algo leve',frontDescription:'Tecido leve e translúcido'};
 const result=normalizeQuoteItems({items:[row2]},settings,'',[{role:'user',content:'quero algo leve para a sala'}]);
 assert.equal(result.ready,true);
 assert.equal(result.items[0].frontDecision.kind,'reference');
 assert.equal(commercialDescription(result.items[0].frontDecision),'Tecido leve e translúcido (referência para estimativa)');
});
test('sem indicação de referência ou escolha exige esclarecimento',()=>{
 const history=[{role:'user',content:'quero algo leve'}];
 const result=assessCategoryEvidence({...row,frontEvidence:'quero algo leve',frontBasis:null},history);
 assert.equal(result.ready,false);
});
test('descrição nunca aceita nome técnico da categoria',()=>{
 const history=[{role:'user',content:'quero linho'}];
 const result=assessCategoryEvidence({...row,frontDescription:'LINHO / EFEITO LINHO - PREÇO MÉDIO'},history);
 assert.equal(result.ready,false);
});
