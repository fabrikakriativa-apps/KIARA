import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateCurtainQuote,validateCurtainSettings} from '../src/quote-pricing.js';
const pricing={
 models:['Wave','Prega Macho','Franzida'],technicalLimits:{maxWidth:30,maxHeight:10,maxQuantity:20},
 categories:[
  {name:'Linho / efeito linho',costPerM2:107.4385,records:50},
  {name:'Blackout',costPerM2:68.8719,records:30},
  {name:'Decorativo',costPerM2:135.1923,records:4}
 ],
 modelCosts:[{category:'Linho / efeito linho',model:'Wave',position:'front',costPerM2:118.5428,records:7}],
 ratios:[{position:'front',model:'Wave',ratio:2.5},{position:'lining',model:'Franzida',ratio:1.5}],
 rails:[{id:'varao_trilho',costPerMeter:35.1082}],
 installation:{manualPerFace:60,motorPerFace:120},
 motorization:{finalSaleSurcharge:1400},
 pricing:{markupPercent:120}
};
const input={width:2.5,height:2.7,quantity:1,model:'Wave',frontCategory:'Linho / efeito linho',backCategory:'Blackout',drive:'manual'};
const cfg={railType:'varao_trilho',rails:2,pricing,revision:3};
test('no approved pricing means no quote',()=>{
 const quote=simulateCurtainQuote(input,{railType:'varao_trilho',rails:2});
 assert.equal(quote.ready,false);
 assert.equal(quote.customerPriceAllowed,false);
});
test('installation charges per fabric face and no price goes to customer automatically',()=>{
 const quote=simulateCurtainQuote(input,cfg);
 assert.equal(quote.ready,true);
 assert.equal(quote.costs.front,800.16);
 assert.equal(quote.costs.lining,464.89);
 assert.equal(quote.costs.rails,175.54);
 assert.equal(quote.costs.installation,120);
 assert.equal(quote.costs.total,1560.59);
 assert.equal(quote.internalSuggestedSale,3433.30);
 assert.equal(quote.configurationRevision,3);
 assert.equal(quote.customerPriceAllowed,false);
});
test('motorized surcharge is added after markup',()=>{
 const q=simulateCurtainQuote({...input,drive:'motorizada'},cfg);
 assert.equal(q.costs.installation,240);
 assert.equal(q.baseSale,3697.30);
 assert.equal(q.motorSurcharge,1400);
 assert.equal(q.internalSuggestedSale,5097.30);
});
test('updated configuration modifies price without changing code',()=>{
 const changed={...pricing,
  installation:{manualPerFace:75,motorPerFace:160},
  motorization:{finalSaleSurcharge:1900},
  pricing:{markupPercent:115}
 };
 const manual=simulateCurtainQuote(input,{...cfg,pricing:changed});
 const motor=simulateCurtainQuote({...input,drive:'motorizada'},{...cfg,pricing:changed});
 assert.equal(manual.costs.installation,150);
 assert.equal(motor.costs.installation,320);
 assert.equal(motor.motorSurcharge,1900);
 assert.notEqual(manual.internalSuggestedSale,3433.30);
});
test('commercial overrides cannot be passed by the caller',()=>{
 assert.equal(simulateCurtainQuote(input,{...cfg,markup:2}).ready,false);
 assert.equal(simulateCurtainQuote(input,{...cfg,installation:5}).ready,false);
});
test('opening configuration does not affect installation face count',()=>{
 const q1=simulateCurtainQuote({...input,opening:'central'},cfg);
 const q2=simulateCurtainQuote({...input,opening:'lateral'},cfg);
 assert.equal(q1.costs.installation,q2.costs.installation);
});
test('invalid configuration must be rejected',()=>{
 assert.ok(validateCurtainSettings({...pricing,installation:{manualPerFace:null,motorPerFace:120}}).length);
 assert.equal(simulateCurtainQuote({...input,model:'Ilhós'},cfg).ready,false);
 assert.equal(simulateCurtainQuote({...input,frontCategory:'Ausente'},cfg).ready,false);
});
