import test from 'node:test';
import assert from 'node:assert/strict';
import {CONSULTATIVE_IDENTITY} from '../src/consultative-identity.js';
import {readFileSync} from 'node:fs';
const intake=readFileSync(new URL('../src/quote-intake.js',import.meta.url),'utf8');
test('eco repetido não é necessário',()=>{assert.match(CONSULTATIVE_IDENTITY,/Registre silenciosamente/);assert.match(CONSULTATIVE_IDENTITY,/Evite ecoar as respostas/);});
test('resumo uma vez, por ambiente e sem suposições',()=>{assert.match(CONSULTATIVE_IDENTITY,/recapitule uma única vez/);assert.match(CONSULTATIVE_IDENTITY,/por ambiente/);assert.match(intake,/especificações CONFIRMADAS/);});
