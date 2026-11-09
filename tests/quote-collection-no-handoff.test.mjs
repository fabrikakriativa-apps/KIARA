import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
const start=worker.indexOf('function nextBlindBudgetQuestion(');
const end=worker.indexOf('async function quoteFlowStep(',start);
assert.ok(start>0&&end>start);
const helper=worker.slice(start,end);
const fn=Function(helper+'return nextBlindBudgetQuestion')();

test('sem quantidade, Kiara pergunta quantas peças serão instaladas',()=>{
 const history=[{role:'user',content:'Quero uma persiana rolô para minha varanda'},{role:'user',content:'5,10 x 2,41'},{role:'user',content:'largura total'},{role:'user',content:'Jardim, em Santo André'}];
 assert.match(fn(['Item 1: modelo não confirmado'],history),/Quantas persianas/);
});
test('quantidade declarada não é ignorada e avança para escolha de tecido',()=>{
 const history=[{role:'user',content:'4 persianas no total'}];
 assert.match(fn(['Item 1: modelo não confirmado'],history),/tela solar/);
});
test('confirma acionamento antes de calcular se pedido é motorizado',()=>{
 assert.match(fn(['Item 1: acionamento não confirmado'],[{role:'user',content:'3 peças'}]),/manuais ou motorizadas/);
});
test('não afirma que há orçamento pendente sem rascunho registrado',()=>{
 assert.match(worker,/NUNCA diga que o orçamento foi encaminhado à equipe/);
 assert.match(worker,/if\(!extracted.ready\)return \{kind:'collecting',missing:extracted.errors/);
 assert.match(worker,/status:'pending_review'/);
});
