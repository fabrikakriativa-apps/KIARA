import test from 'node:test';
import assert from 'node:assert/strict';
import {CONSULTATIVE_IDENTITY} from '../src/consultative-identity.js';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
test('adaptação sem classificação rígida',()=>{assert.match(CONSULTATIVE_IDENTITY,/não rotule o cliente/i);assert.match(CONSULTATIVE_IDENTITY,/breve com quem tem pressa/);});
test('benefícios relevantes, sem venda agressiva',()=>{assert.match(CONSULTATIVE_IDENTITY,/benefício útil/);assert.match(CONSULTATIVE_IDENTITY,/não transforme toda resposta em discurso de vendas/);});
test('limites comerciais continuam independentes',()=>{assert.match(worker,/containsCommercialPrice\(answer\)/);assert.match(worker,/isAuthorizedToSend\(env, route, sender\)/);});
