import test from 'node:test';
import assert from 'node:assert/strict';
import {mustEscalate} from '../src/worker.js';

test('pedido humano explícito, assunto fora de escopo e frustração reiterada são encaminhados',()=>{
 for(const text of ['Já expliquei várias vezes','Não consegue me ajudar de jeito nenhum','Vocês têm cabeceira?','Quero falar com uma pessoa']){
  assert.equal(mustEscalate(text),true,text);
 }
});
test('dúvida técnica, correção pontual ou pedido de explicação não silenciam a Kiara',()=>{
 for(const text of ['não entendi, o que seria bem escurecido?','Você não entendeu o que eu pedi','Já respondi isso','Estou confusa','Não foi isso','não','sim','talvez','pode ser outro tecido','quero controle de luminosidade','3,20 por 2,70','ainda não medi','qual a diferença?']){
  assert.equal(mustEscalate(text),false,text);
 }
});
