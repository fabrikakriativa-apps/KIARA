import test from 'node:test';
import assert from 'node:assert/strict';
import {CONSULTATIVE_IDENTITY} from '../src/consultative-identity.js';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
test('cliente e orientação acima do formulário',()=>{assert.match(CONSULTATIVE_IDENTITY,/Não transforme o atendimento em roteiro/);assert.match(CONSULTATIVE_IDENTITY,/[Mm]uitas respostas não precisam terminar com pergunta/);});
test('nome discreto e sem reapresentação',()=>{assert.match(CONSULTATIVE_IDENTITY,/usar o nome da pessoa continuamente/);assert.match(CONSULTATIVE_IDENTITY,/não finja ser humana/);});
test('proteção de orçamento independe do estilo',()=>{assert.match(worker,/evaluateCustomerQualification\(profile\)\.qualified/);assert.match(worker,/isAuthorizedToSend/);});
