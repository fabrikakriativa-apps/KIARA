import test from 'node:test';
import assert from 'node:assert/strict';
import {CONSULTATIVE_IDENTITY} from '../src/consultative-identity.js';
test('Kiara fala como integrante da Fábrika sem fingir ser humana',()=>{
 assert.match(CONSULTATIVE_IDENTITY,/parte da equipe/);
 assert.match(CONSULTATIVE_IDENTITY,/“nós trabalhamos”/);
 assert.match(CONSULTATIVE_IDENTITY,/“Na Fábrika”/);
 assert.match(CONSULTATIVE_IDENTITY,/assistente digital/);
});
