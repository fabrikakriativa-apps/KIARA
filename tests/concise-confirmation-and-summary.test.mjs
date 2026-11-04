import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
const intake=readFileSync(new URL('../src/quote-intake.js',import.meta.url),'utf8');

test('não exige confirmação ou eco em cada resposta',()=>{
 assert.match(worker,/não narre o cadastro a cada resposta/i);
 assert.match(worker,/Confirme em voz alta apenas quando houver ambiguidade/);
 assert.match(worker,/A informação deve ser registrada sem ser narrada/);
});
test('antes de orçamento apresenta resumo único e apenas com dados confirmados',()=>{
 assert.match(worker,/UMA síntese breve das especificações efetivamente definidas/);
 assert.match(worker,/agrupada por ambiente e produto/);
 assert.match(worker,/Diferencie os dados definidos dos ainda pendentes/);
 assert.match(intake,/Antes de encaminhar a estimativa, apresente UMA breve recapitulação/);
 assert.match(intake,/Não faça resumos repetidos a cada mensagem/);
});
test('preserva limites de segurança comercial',()=>{
 assert.match(worker,/containsCommercialPrice\(answer\)/);
 assert.match(worker,/evaluateCustomerQualification\(profile\)\.qualified/);
 assert.match(worker,/isAuthorizedToSend\(env, route, sender\)/);
});
