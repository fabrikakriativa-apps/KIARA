import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBlindItems,calculateBlindQuote} from '../src/blind-quote.js';
const config={methodology:'blind_average_m2_v1',markupPercent:120,installationPerPiece:80,installationIncluded:true,maxWidth:30,maxHeight:10,maxQuantity:20,categories:[{name:'Rolô Screen 1%',adjustedCostPerM2:142.8,active:true}]};
const item={product:'persiana',environment:'Sacada',model:'Rolô Screen 1%',width:2.7,height:3.16,quantity:3,dimensionScope:'total',drive:'manual',basis:'selected',evidence:'Screen 1%',description:'Tela Solar Screen 1%',dimensionEvidence:'2,70 por 3,16',scopeEvidence:'na sacada'};
test('planilha de persianas: 2,70 x 3,16 m, tres pecas, preco sugerido inclui instalacao R$ 3208,41',()=>{const p=normalizeBlindItems({items:[item]},config,[{role:'user',content:'3 peças de persiana Screen 1% na sacada 2,70 por 3,16 metros no total'}]);assert.equal(p.ready,true);const x=calculateBlindQuote(p.items,config,1);assert.equal(x.ready,true);assert.equal(x.total,3208.41);assert.equal(x.internalInstallationCost,240);assert.equal(x.customerPriceAllowed,false);});
test('medidas por peça e totais se diferenciam',()=>{const a=calculateBlindQuote([{...item,width:0.9,dimensionScope:'per_piece'}],config,1);const b=calculateBlindQuote([item],config,1);assert.equal(a.total,b.total)});
test('não permite modelo sem referência nem adivinha dimensão',()=>{assert.equal(normalizeBlindItems({items:[{...item,model:'Rolô Screen 3%'}]},config,[{role:'user',content:'Screen 1%'}]).ready,false);assert.equal(normalizeBlindItems({items:[{...item,dimensionScope:null}]},config,[{role:'user',content:'Screen 1%'}]).ready,false)});
test('instalação manual entra uma vez na base e segue o markup da organização',()=>{
 const manual=calculateBlindQuote([{
  product:'persiana',environment:'Sacada',model:'Rolô Screen 1%',width:2.7,height:3.16,
  quantity:3,dimensionScope:'total',drive:'manual'
 }],config,2);
 assert.equal(manual.ready,true);
 assert.equal(manual.items[0].internalInstallationCost,240);
 assert.equal(manual.items[0].internalSuggestedSale,3208.41);
 assert.equal(manual.total,3208.41);
 assert.equal(manual.customerPriceAllowed,false);
 assert.equal(manual.reviewRequired,true);
});
test('motorizada não recebe preço e exige atendimento humano, mesmo se tentar pular a triagem',()=>{
 const motor=calculateBlindQuote([{
  product:'persiana',environment:'Sala',model:'Rolô Screen 1%',width:2,height:2,
  quantity:1,dimensionScope:'total',drive:'motorizada'
 }],config,2);
 assert.equal(motor.ready,false);
 assert.equal(motor.customerPriceAllowed,false);
 assert.equal(motor.reviewRequired,true);
});
