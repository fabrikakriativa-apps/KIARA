import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CONSULTATIVE_IDENTITY} from '../src/consultative-identity.js';
const worker=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');

test('Kiara consulta o contexto sem repetir as palavras do cliente',()=>{
 assert.match(worker,/NATURAL_REPLY_GUIDANCE/);
 assert.match(worker,/Não faça eco do que a pessoa acabou de informar/);
 assert.match(worker,/manter a claridade atual/);
 assert.match(worker,/NATURAL_REPLY_GUIDANCE,\s*'TRANSFERÊNCIA HUMANA:/);
 assert.match(CONSULTATIVE_IDENTITY,/Evite repetições, confirmações automáticas/);
});
test('mantém a confirmação técnica somente para ambiguidade e orçamento',()=>{
 assert.match(worker,/confirmação pontual só é necessária para resolver ambiguidade relevante/);
 assert.match(worker,/Não faça novas perguntas sobre informação já confirmada/);
 assert.match(CONSULTATIVE_IDENTITY,/no máximo uma pergunta útil por mensagem/);
 assert.match(CONSULTATIVE_IDENTITY,/recapitule brevemente/);
});
