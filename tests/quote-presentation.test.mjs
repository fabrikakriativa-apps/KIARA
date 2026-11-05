import test from 'node:test';
import assert from 'node:assert/strict';
import {formatApprovedEstimate} from '../src/quote-presentation.js';

const blind={product:'persiana',total:2680.41,items:[{
  product:'persiana',model:'Rolô Screen 1%',fabric:'Tela Solar Screen 1%',
  quantity:3,width:2.7,height:3.16,installation:'included',dimensionScope:'total'
}]};
test('padrão comercial de persiana acompanha o modelo aprovado',()=>{
 const t=formatApprovedEstimate(blind);
 assert.match(t,/✨ \*FÁBRIKA KRIATIVA \| ORÇAMENTO PRÉVIO\*/);
 assert.match(t,/🪟 \*PERSIANA ROLÔ SCREEN 1%\*/);
 assert.match(t,/3 peças/);
 assert.match(t,/2,70 m × 3,16 m/);
 assert.match(t,/Tela Solar Screen 1%/);
 assert.match(t,/R\$ 2\.680,41/);
 assert.match(t,/PIX ou cartão/);
 assert.match(t,/6x sem juros/);
 assert.match(t,/valores médios/);
 assert.doesNotMatch(t,/preço médio|categoria comercial|markup/i);
});
test('modelo cortina usa o mesmo padrão sem expor o código da categoria',()=>{
 const t=formatApprovedEstimate({product:'cortina',total:1534.55,items:[{
  product:'cortina',model:'Wave',fabric:'Linho',lining:'Microfibra convencional',
  quantity:1,width:3,height:2.6,installation:'included',dimensionScope:'each'
 }]});
 assert.match(t,/🪟 \*CORTINA WAVE\*/);
 assert.match(t,/\*Forro:\* Microfibra convencional/);
 assert.match(t,/R\$ 1\.534,55/);
 assert.doesNotMatch(t,/preço médio|morea|categoria comercial/i);
});
test('não aceitar categorias técnicas como nomes de tecido',()=>{
 assert.throws(()=>formatApprovedEstimate({...blind,items:[{...blind.items[0],fabric:'LINHO / EFEITO LINHO (MOREA / FRESH) - PREÇO MÉDIO'}]}),/Composição comercial indefinida/);
});
test('não inventa instalação, medidas, quantidade ou valor',()=>{
 assert.throws(()=>formatApprovedEstimate({...blind,items:[{...blind.items[0],installation:'unknown'}]}),/Instalação/);
 assert.throws(()=>formatApprovedEstimate({...blind,total:0}),/Valor/);
 assert.throws(()=>formatApprovedEstimate({...blind,items:[{...blind.items[0],quantity:null}]}),/Composição/);
});
