import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');

test('dúvidas pedem explicação consultiva antes de coleta de dados',()=>{
  assert.match(worker,/ATENDIMENTO CONSULTIVO — PRIORIDADE/);
  assert.match(worker,/vantagens e eventuais limitações/);
  assert.match(worker,/Não se limite a explicar diferenças técnicas/);
  assert.match(worker,/CONSULTORIA ANTES DE QUALIFICAÇÃO/);
  assert.match(worker,/não retome automaticamente o questionário/);
});
test('teto x parede deve explicar benefícios sem pressionar decisão',()=>{
  assert.match(worker,/teto costuma valorizar a altura/);
  assert.match(worker,/parede pode ser indicada/);
  assert.match(worker,/viabilidade depende de medidas, estrutura e obstáculos/);
  assert.match(worker,/sem simplesmente repetir "teto ou parede\?"/);
});
test('não remove guardrails de preço e interrupção humana',()=>{
  assert.match(worker,/containsCommercialPrice\(answer\)/);
  assert.match(worker,/evaluateCustomerQualification\(profile\)\.qualified/);
  assert.match(worker,/isAuthorizedToSend\(env, route, sender\)/);
  assert.match(worker,/readHold\(env, route, sender\)/);
});
