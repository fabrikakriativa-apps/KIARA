import test from 'node:test';
import assert from 'node:assert/strict';
import {CONSULTATIVE_IDENTITY} from '../src/consultative-identity.js';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
test('cliente e orientação acima do formulário',()=>{assert.match(CONSULTATIVE_IDENTITY,/Não é convencer alguém a comprar/);assert.match(CONSULTATIVE_IDENTITY,/não precisa sempre perguntar/);});
test('nome discreto e sem reapresentação',()=>{assert.match(CONSULTATIVE_IDENTITY,/Use o primeiro nome com discrição/);assert.match(CONSULTATIVE_IDENTITY,/não volte a se apresentar/);});
test('proteção de orçamento independe do estilo',()=>{assert.match(worker,/evaluateCustomerQualification\(profile\)\.qualified/);assert.match(worker,/isAuthorizedToSend/);});
