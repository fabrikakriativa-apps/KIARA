import test from 'node:test'
import assert from 'node:assert/strict'
import {mustEscalate} from '../src/worker.js'
test('cliente confuso ou frustrado é encaminhado',()=>{
 for(const text of ['Você não entendeu o que eu pedi','Já respondi isso','Estou confusa','Não foi isso','Vocês têm cabeceira?','Quero falar com uma pessoa']){
  assert.equal(mustEscalate(text),true,text)
 }
})
test('resposta curta ou mudança comum não força atendimento humano',()=>{
 for(const text of ['não','sim','talvez','pode ser outro tecido','quero controle de luminosidade','3,20 por 2,70','ainda não medi','qual a diferença?']){
  assert.equal(mustEscalate(text),false,text)
 }
})
