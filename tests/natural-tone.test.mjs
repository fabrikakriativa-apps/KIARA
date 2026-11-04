import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const w=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
test('atendimento prioriza orientação em vez de questionário',()=>{
 assert.match(w,/Ajudar o cliente a encontrar a solução adequada/);
 assert.match(w,/A conversa não é um formulário/);
 assert.match(w,/não é obrigatório perguntar em todas as respostas/);
 assert.match(w,/Priorize dúvidas, explicações e escolhas/);
});
test('nome é usado com discrição e sem repetir apresentação',()=>{
 assert.match(w,/Use o primeiro nome com discrição/);
 assert.match(w,/Não repita sua apresentação como Kiara/);
 assert.match(w,/Evite chamar o cliente pelo nome em respostas consecutivas/);
});
test('continuam limites comerciais de preço e controle humano',()=>{
 assert.match(w,/containsCommercialPrice\(answer\)/);
 assert.match(w,/evaluateCustomerQualification\(profile\)\.qualified/);
 assert.match(w,/isAuthorizedToSend\(env, route, sender\)/);
});
