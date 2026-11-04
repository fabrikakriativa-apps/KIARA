import test from 'node:test';
import assert from 'node:assert/strict';
import {CONSULTATIVE_IDENTITY} from '../src/consultative-identity.js';
import {PRODUCT_KNOWLEDGE} from '../src/product-knowledge.js';
import {readFileSync} from 'node:fs';
const w=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
test('consulta antes de pedir escolha imediata',()=>{assert.match(CONSULTATIVE_IDENTITY,/ofereça uma sugestão fundamentada/);assert.match(CONSULTATIVE_IDENTITY,/preserve a liberdade de escolha/);});
test('teto e parede descrevem efeitos e limites técnicos',()=>{assert.match(PRODUCT_KNOWLEDGE,/teto tende a alongar visualmente/);assert.match(PRODUCT_KNOWLEDGE,/parede pode ser adequada/);assert.match(PRODUCT_KNOWLEDGE,/viabilidade depende/);});
test('regras de preço e intervenção mantidas',()=>{assert.match(w,/containsCommercialPrice\(answer\)/);assert.match(w,/readHold\(env, route, sender\)/);});
