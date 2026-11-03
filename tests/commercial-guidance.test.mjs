import test from 'node:test';
import assert from 'node:assert/strict';
import {commercialConversationRules} from '../src/commercial-guidance.js';

test('não permite rascunhos na orientação',()=>{
 assert.equal(commercialConversationRules([{product:'persiana',status:'draft',settings:{defaults:{model:'Rolô',color:'Off-white',openness:'1%'}}}]),'');
});
test('sem dados comerciais, não inventa padrões',()=>{
 assert.equal(commercialConversationRules([{product:'persiana',status:'approved',settings:{defaults:{}}}]),'');
});
test('sacada exige convenção, interiores não',()=>{
 const text=commercialConversationRules([{product:'persiana',status:'approved',settings:{defaults:{model:'Rolô',color:'Off-white',openness:'1%'},technicalLimits:{minimumManualWidth:.25,minimumMotorWidth:.72},models:[{costPerM2:200}]}}]);
 assert.match(text,/SACADA\/VARANDA/);
 assert.match(text,/quarto, sala/);
 assert.match(text,/0.25 m/);
 assert.doesNotMatch(text,/200/);
});
test('cortina: forro Franzida e instalação por face, sem custos',()=>{
 const text=commercialConversationRules([{product:'cortina',status:'approved',settings:{models:['Wave','Franzida'],categories:[{name:'Voil leve',costPerM2:123}],installation:{manualPerFace:60}}}]);
 assert.match(text,/forro como Franzida/);
 assert.match(text,/duas faces/);
 assert.doesNotMatch(text,/123|60/);
});
