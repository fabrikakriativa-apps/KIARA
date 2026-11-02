import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateCurtainQuote,CATEGORY_COSTS,RATIOS} from '../src/quote-pricing.js';
const input={width:2.5,height:2.7,quantity:1,model:'Wave',frontCategory:'Linho / efeito linho',backCategory:'Blackout'};
const cfg={railType:'varao_trilho',rails:2,installation:60,markup:1.2};
test('two fabric faces have separate costs and installation charged once',()=>{
 const q=simulateCurtainQuote(input,cfg);
 assert.equal(q.ready,true);
 assert.equal(q.layers,2);
 assert.equal(q.area,6.75);
 assert.equal(q.costs.front,800.16);
 assert.equal(q.costs.lining,464.89);
 assert.equal(q.costs.rails,175.54);
 assert.equal(q.costs.installation,60);
 assert.equal(q.costs.total,1500.59);
 assert.equal(q.internalSuggestedSale,3301.30);
 assert.equal(q.customerPriceAllowed,false);
 assert.equal(q.reviewRequired,true);
});
test('one fabric omits back cost and avoids unnecessary questions',()=>{
 const q=simulateCurtainQuote({...input,backCategory:'Sem forro'}, {...cfg,rails:1});
 assert.equal(q.layers,1);
 assert.equal(q.costs.lining,0);
 assert.equal(q.costs.installation,60);
 assert.equal(q.customerPriceAllowed,false);
});
test('fabric ratio is metadata only and does not multiply unit reference',()=>{
 const q=simulateCurtainQuote(input,cfg);
 assert.equal(q.composition.technicalRatios.front.ratio,2.2);
 assert.equal(q.costs.front,Math.round(q.area*q.references.front.unit*100)/100);
 assert.equal(RATIOS['front|Prega Macho'].ratio,3);
});
test('invalid or unapproved technical inputs block calculation',()=>{
 assert.equal(simulateCurtainQuote({...input,width:-1},cfg).ready,false);
 assert.equal(simulateCurtainQuote({...input,model:'Ilhós'},cfg).ready,false);
 assert.equal(simulateCurtainQuote(input,{...cfg,rails:undefined}).ready,false);
 assert.equal(simulateCurtainQuote(input,{...cfg,markup:undefined}).ready,false);
 assert.equal(simulateCurtainQuote(input,{...cfg,railType:'manual'}).ready,false);
});
test('decorative fabric is represented with low confidence',()=>{
 const q=simulateCurtainQuote({...input,frontCategory:'Decorativo'},cfg);
 assert.equal(CATEGORY_COSTS.Decorativo.records,4);
 assert.equal(q.references.front.reliability,'exploratory');
 assert.ok(q.warnings.length>0);
});
