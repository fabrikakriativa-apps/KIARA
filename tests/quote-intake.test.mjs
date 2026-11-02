import test from 'node:test';
import assert from 'node:assert/strict';
import {QUOTE_PRODUCTS,quoteMissing,quoteNextQuestion,quoteIntakePrompt} from '../src/quote-intake.js';

test('cortina requires model, measures, front fabric and lining decision',()=>{
 const values={ambiente:'Sala',modelo:'wave',largura:'3.3 m',altura:'2.6 m',tecido_frontal:'voil'};
 assert.deepEqual(quoteMissing('cortina',values),['forro_preferencia']);
 assert.match(quoteNextQuestion('cortina',values),/forro/i);
 assert.equal(quoteNextQuestion('cortina',{...values,forro_preferencia:'sem forro'}),null);
});
test('blind needs material and light control before quote',()=>{
 const values={ambiente:'Quarto',modelo:'rolo',largura:'1.5',altura:'2',controle_luz:'blackout'};
 assert.deepEqual(quoteMissing('persiana',values),['material_confirmado']);
 assert.match(quoteNextQuestion('persiana',values),/tecido ou material/);
});
test('unknown product triggers clarification and not fabricated quote',()=>{
 assert.deepEqual(quoteMissing('unknown',{}),['produto']);
 assert.match(quoteNextQuestion('unknown',{}),/cortina ou persiana/);
 assert.match(quoteIntakePrompt(),/NÃO crie estimativa com modelo indefinido/);
});
test('visual model choices have stable identifiers and do not include pricing',()=>{
 for(const type of ['cortina','persiana']){
  const models=QUOTE_PRODUCTS[type].models;
  assert.ok(models.length>=4);
  assert.equal(new Set(models.map(m=>m.id)).size,models.length);
  assert.ok(models.every(m=>!('price' in m)));
 }
});
test('personalized can differ from rapid without losing required fields',()=>{
 assert.match(quoteNextQuestion('cortina',{ambiente:'Sala'},'personalized'),/prefere ver as opções/);
 assert.match(quoteNextQuestion('cortina',{ambiente:'Sala'},'quick'),/escolher pelo estilo/);
});
