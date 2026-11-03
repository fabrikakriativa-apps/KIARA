import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteIntakePrompt} from '../src/quote-intake.js';
import {commercialConversationRules} from '../src/commercial-guidance.js';

test('voil é face frontal, não tecido obrigatório',()=>{
 const prompt=quoteIntakePrompt();
 assert.match(prompt,/VOIL identifica a posição\/face frontal/);
 assert.match(prompt,/qualquer tecido adequado/);
 assert.match(prompt,/PERSIANA atrás na função do forro/);
});
test('persiana não é segunda face de tecido',()=>{
 const prompt=quoteIntakePrompt();
 assert.match(prompt,/produtos distintos/);
 assert.match(prompt,/apenas uma face de tecido/);
});
test('orientação comercial aprovada reforça regra da face voil',()=>{
 const text=commercialConversationRules([{product:'cortina',status:'approved',settings:{models:['Wave'],categories:[{name:'Linho',active:true}]}}]);
 assert.match(text,/face frontal da cortina é chamada VOIL/);
 assert.match(text,/qualquer outro tecido/);
});
