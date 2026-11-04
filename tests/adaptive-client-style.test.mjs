import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
test('orientações de adaptação não classificam clientes de forma rígida',()=>{
 assert.match(code,/Observe a intenção, urgência, dúvidas/);
 assert.match(code,/não rotule pessoas com perfis fixos/);
 assert.match(code,/podem mudar/);
});
test('benefícios devem surgir naturalmente mesmo sem solicitação explícita',()=>{
 assert.match(code,/Mesmo quando o cliente não perguntar, apresente de modo discreto benefícios relevantes/);
 assert.match(code,/não um discurso obrigatório em cada mensagem/);
 assert.match(code,/Acolhimento não exige mensagens compridas/);
});
test('rapidez e comparação de preço não autorizam preço fictício nem pressão',()=>{
 assert.match(code,/sem inventar valores/);
 assert.match(code,/Nunca pressione com medo, culpa/);
 assert.match(code,/qualquer acompanhamento deve seguir as regras específicas/);
});
test('proteções comerciais continuam independentes da linguagem',()=>{
 assert.match(code,/containsCommercialPrice\(answer\)/);
 assert.match(code,/evaluateCustomerQualification\(profile\)\.qualified/);
 assert.match(code,/isAuthorizedToSend\(env, route, sender\)/);
});
