import test from 'node:test';
import assert from 'node:assert/strict';
import {CONSULTATIVE_IDENTITY} from '../src/consultative-identity.js';

test('Kiara não repete como confirmação aquilo que o cliente acabou de informar',()=>{
 assert.match(CONSULTATIVE_IDENTITY,/não precisa ouvir de volta aquilo que acabou de dizer/);
 assert.match(CONSULTATIVE_IDENTITY,/NÃO comece toda resposta com/);
 assert.match(CONSULTATIVE_IDENTITY,/manter a claridade atual/);
 assert.match(CONSULTATIVE_IDENTITY,/não por ecoar a fala do cliente/);
});
test('confirma apenas dados ambíguos de orçamento e não recapitula por hábito',()=>{
 assert.match(CONSULTATIVE_IDENTITY,/quando houver ambiguidade que mude medidas, modelo, quantidade, segurança, preço/);
 assert.match(CONSULTATIVE_IDENTITY,/Confirme somente quando houver ambiguidade/);
 assert.match(CONSULTATIVE_IDENTITY,/no máximo uma pergunta útil por mensagem/);
});
