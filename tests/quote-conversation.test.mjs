import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCurtainIntake,extractConversationInstructions} from '../src/quote-conversation.js';
import {simulateCurtainQuote} from '../src/quote-pricing.js';
const completed={product:'cortina',environment:'Sala',model:'wave',width:3.2,height:2.6,quantity:1,frontCategory:'Voil texturizado',backCategory:'Blackout',drive:'motorizada'};
test('confirmed conversation fields produce private curtain simulation',()=>{
 const normalized=normalizeCurtainIntake(completed);
 assert.equal(normalized.ready,true);
 const quote=simulateCurtainQuote(normalized.intake,{railType:'varao_trilho',rails:2,markup:1.2});
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
  const result=normalizeCurtainIntake(input);
  assert.equal(result.ready,false,field);
  assert.ok(result.errors.length>0);
 }
});
test('no multiple-item approximation and no exposed technical questions',()=>{
 assert.equal(normalizeCurtainIntake({...completed,product:null}).ready,false);
 assert.match(extractConversationInstructions(),/MAIS DE UM ambiente/);
 assert.match(extractConversationInstructions(),/NUNCA folhas/);
});
test('no guessed opening pieces or motor count',()=>{
 const normalized=normalizeCurtainIntake({...completed,opening:'central',motorCount:4});
 assert.equal(normalized.ready,true);
 assert.equal(Object.hasOwn(normalized.intake,'opening'),false);
 assert.equal(Object.hasOwn(normalized.intake,'motorCount'),false);
});
