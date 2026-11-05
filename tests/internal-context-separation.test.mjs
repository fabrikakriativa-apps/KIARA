import test from 'node:test';import assert from 'node:assert/strict';
import {CONSULTATIVE_IDENTITY} from '../src/consultative-identity.js';
test('Kiara separa regras internas do texto destinado ao cliente',()=>{
 assert.match(CONSULTATIVE_IDENTITY,/Dados internos, pendências de cadastro/);
 assert.match(CONSULTATIVE_IDENTITY,/NÃO os anuncie nem explique preventivamente/);
 assert.match(CONSULTATIVE_IDENTITY,/sem mencionar regras internas/);
});
