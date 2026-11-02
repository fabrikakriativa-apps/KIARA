import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCurtainIntake,extractConversationInstructions} from '../src/quote-conversation.js';
import {simulateCurtainQuote} from '../src/quote-pricing.js';
const completed={product:'cortina',environment:'Sala',model:'wave',width:3.2,height:2.6,quantity:1,frontCategory:'Voil texturizado',backCategory:'Blackout',drive:'motorizada'};
const approved={models:['Wave','Prega Macho','Franzida'],technicalLimits:{maxWidth:30,maxHeight:10,maxQuantity:20},categories:[{name:'Voil texturizado'},{name:'Blackout'}]};
test('confirmed conversation fields produce private curtain simulation',()=>{
 const normalized=normalizeCurtainIntake(completed,approved);
 assert.equal(normalized.ready,true);
 const quote=simulateCurtainQuote(normalized.intake,{
  railType:'varao_trilho',rails:2,
  pricing:{
   models:['Wave','Prega Macho','Franzida'],technicalLimits:{maxWidth:30,maxHeight:10,maxQuantity:20},
   categories:[{name:'Voil texturizado',costPerM2:86.6504},{name:'Blackout',costPerM2:68.8719}],
   modelCosts:[],ratios:[],rails:[{id:'varao_trilho',costPerMeter:35.1082}],
   installation:{manualPerFace:60,motorPerFace:120},
   motorization:{finalSaleSurcharge:1400},pricing:{markupPercent:120}
  }
 });
 assert.equal(quote.ready,true);
 assert.equal(quote.layers,2);
 assert.equal(quote.drive,'motorizada');
 assert.equal(quote.costs.installation,240);
 assert.equal(quote.motorSurcharge,1400);
 assert.equal(quote.customerPriceAllowed,false);
});
test('missing preferences prevent speculative price',()=>{
 for(const field of ['frontCategory','backCategory','model','drive','width','quantity']){
  const input={...completed,[field]:null};
  const result=normalizeCurtainIntake(input,approved);
  assert.equal(result.ready,false,field);
  assert.ok(result.errors.length>0);
 }
});
test('no multiple-item approximation and no exposed technical questions',()=>{
 assert.equal(normalizeCurtainIntake({...completed,product:null},approved).ready,false);
 assert.match(extractConversationInstructions(approved),/MAIS DE UM ambiente/);
 assert.match(extractConversationInstructions(approved),/NUNCA folhas/);
});
test('no guessed opening pieces or motor count',()=>{
 const normalized=normalizeCurtainIntake({...completed,opening:'central',motorCount:4},approved);
 assert.equal(normalized.ready,true);
 assert.equal(Object.hasOwn(normalized.intake,'opening'),false);
 assert.equal(Object.hasOwn(normalized.intake,'motorCount'),false);
});
