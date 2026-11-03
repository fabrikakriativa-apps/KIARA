import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateCurtainQuote} from '../src/quote-pricing.js';
const settings={
 methodology:'commercial_categories_v1',referenceYear:2026,annualAdjustmentPercent:0,
 models:['Wave','Prega Macho','Franzida'],technicalLimits:{maxWidth:30,maxHeight:10,maxQuantity:20},
 categories:[{name:'Voil texturizado',costPerM2:72.4716,baseYear:2026,records:33,active:true}],
 rails:[{id:'varao',label:'Trilho Varao Branco',costPerMeter:35.1082,baseYear:2026,active:true},{id:'sem',label:'Sem trilho',costPerMeter:0,baseYear:2026,active:true}],
 installation:{manualPerFace:60,motorPerFace:120},pricing:{markupPercent:120},
 motorization:{finalSaleSurcharge:1400},modelCosts:[],ratios:[]
};
const source={width:2.1,height:2.45,quantity:1,frontCategory:'Voil texturizado',model:'Wave',drive:'manual',backCategory:'Sem forro'};
test('reproduz a planilha comercial em uma face',()=>{
 const q=simulateCurtainQuote(source,{pricing:settings,railType:'varao',rails:1});
 assert.equal(q.ready,true);assert.equal(q.internalSuggestedSale,1114.51);
 assert.equal(q.costs.front,372.87);assert.equal(q.costs.rails,73.73);
 assert.equal(q.costs.installation,60);assert.equal(q.customerPriceAllowed,false);
});
test('modelo não altera a média agregada',()=>{
 const values=['Wave','Prega Macho','Franzida'].map(model=>simulateCurtainQuote({...source,model},{pricing:settings,railType:'varao',rails:1}).internalSuggestedSale);
 assert.deepEqual(values,[1114.51,1114.51,1114.51]);
});
test('sem trilho custa zero e instalação por face é separada',()=>{
 const quote=simulateCurtainQuote({...source,width:2.65,height:2.68},{pricing:settings,railType:'sem',rails:1});
 assert.equal(quote.costs.rails,0);assert.equal(quote.costs.installation,60);
});
test('configuração é editável e reajuste usa o ano-base',()=>{
 const changed={...settings,annualAdjustmentPercent:5};
 const q=simulateCurtainQuote({...source,year:2027},{pricing:changed,railType:'varao',rails:1});
 assert.ok(q.internalSuggestedSale>1114.51);
});
test('valores incompletos não resultam em preço',()=>{
 const invalid=simulateCurtainQuote({...source,width:0},{pricing:settings,railType:'varao',rails:1});
 assert.equal(invalid.customerPriceAllowed,false);assert.equal(invalid.ready,false);
});
