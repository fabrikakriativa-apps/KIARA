import test from 'node:test';
import assert from 'node:assert/strict';
import {expressesQuoteIntent,confirmsQuoteSummary,normalizeQuoteItems,summarizeQuoteItems,calculateQuotePreview,buildInternalBudget,approvedQuoteText} from '../src/quote-flow.js';
const settings={methodology:'commercial_categories_v1',referenceYear:2026,annualAdjustmentPercent:0,
 models:['Wave'],categories:[{name:'LINHO',costPerM2:100,baseYear:2026,active:true},{name:'FORRO',costPerM2:45,baseYear:2026,active:true}],
 rails:[{id:'trilho_03',label:'Trilho Max Reforçado Branco',costPerMeter:12,baseYear:2026,active:true}],
 installation:{manualPerFace:60},pricing:{markupPercent:120},
 technicalLimits:{maxWidth:30,maxHeight:10,maxQuantity:20}};
const sala={product:'cortina',environment:'Sala',model:'Wave',width:3,height:2.5,quantity:1,frontCategory:'LINHO',backCategory:'Sem forro',drive:'manual'};
const quarto={...sala,environment:'Quarto',width:2.5};
test('pedido de orçamento inicia o fluxo, sem ser confundido com conversa comum',()=>{
 assert.equal(expressesQuoteIntent('Pode preparar o orçamento?'),true);
 assert.equal(expressesQuoteIntent('Quanto fica essa cortina?'),true);
 assert.equal(expressesQuoteIntent('Quero saber mais sobre o linho'),false);
 assert.equal(confirmsQuoteSummary('Tudo certo'),true);
});
test('duas composições preservam ambientes e medidas',()=>{
 const x=normalizeQuoteItems({items:[sala,quarto]},settings);
 assert.equal(x.ready,true);
 const summary=summarizeQuoteItems(x.items);
 assert.match(summary,/Sala/);
 assert.match(summary,/Quarto/);
 assert.match(summary,/2,5/);
});
test('não calcula com suposições, modelo ausente ou categoria inexistente',()=>{
 assert.equal(normalizeQuoteItems({items:[{...sala,model:null}]},settings).ready,false);
 assert.equal(normalizeQuoteItems({items:[{...sala,frontCategory:'gaze'}]},settings).ready,false);
 assert.equal(normalizeQuoteItems({items:[{...sala,environment:'Sala'},{...sala,environment:'Sala'}]},settings).ready,false);
});
test('cálculo interno nunca autoriza envio automático',()=>{
 const x=normalizeQuoteItems({items:[sala]},settings);
 const total=calculateQuotePreview(x.items,settings,3,{railType:'trilho_03',rails:1});
 assert.equal(total.ready,true);
 assert.equal(total.customerPriceAllowed,false);
 assert.equal(total.reviewRequired,true);
 assert.ok(total.total>0);
 const budget=buildInternalBudget({items:x.items,preview:total,sourceMessageId:'wamid-test',revision:3,configStatus:'draft',railType:'trilho_03'});
 assert.equal(budget.customer_price_allowed,false);
 assert.equal(budget.test_only,true);
 assert.equal(budget.configuration_status,'draft');
 assert.match(approvedQuoteText(budget),/Valor estimado/);
});
test('não divulga valor inválido nem gera orçamento sem trilho',()=>{
 const x=normalizeQuoteItems({items:[sala]},settings);
 assert.equal(calculateQuotePreview(x.items,settings,3,{railType:'inexistente'}).ready,false);
 assert.throws(()=>approvedQuoteText({items:[sala],price_brl:'900',review_required:false,customer_price_allowed:false}),/não validado/);
});
