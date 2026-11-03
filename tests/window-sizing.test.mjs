import test from 'node:test';
import assert from 'node:assert/strict';
import {windowQuoteDimensions} from '../src/window-sizing.js';

test('medidas da janela na parede: duas laterais e altura 10 cm',()=>{
 const r=windowQuoteDimensions({width:1.50,height:1.20,mount:'wall'});
 assert.equal(r.ready,true);assert.equal(r.width,1.70);assert.equal(r.height,1.30);
 assert.equal(r.allowances.heightTotalCm,10);
});
test('instalação no teto: altura +50 cm em vez de +10 cm',()=>{
 const r=windowQuoteDimensions({width:1.50,height:1.20,mount:'ceiling'});
 assert.equal(r.ready,true);assert.equal(r.width,1.70);assert.equal(r.height,1.70);
 assert.equal(r.allowances.heightTotalCm,50);
});
test('rejeita tipo de instalação ou medidas desconhecidas',()=>{
 assert.equal(windowQuoteDimensions({width:1,height:2,mount:'unknown'}).ready,false);
 assert.equal(windowQuoteDimensions({width:'',height:2}).ready,false);
});
test('aceita parâmetros comerciais alterados',()=>{
 const r=windowQuoteDimensions({width:'1,20',height:'1,00',mount:'ceiling',sideAllowanceCm:12,ceilingHeightAllowanceCm:40});
 assert.equal(r.width,1.44);assert.equal(r.height,1.40);
});
