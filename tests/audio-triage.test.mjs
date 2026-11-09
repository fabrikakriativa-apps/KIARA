import test from 'node:test';
import assert from 'node:assert/strict';
import {AUDIO_REVIEW_INSTRUCTIONS,precheckAudioTranscript} from '../src/audio-triage.js';

test('pedido normal sobre renovar persianas passa da pré-triagem para conversa consultiva',()=>{
 const text='Bom dia, tudo bem? Eu estou querendo trocar as persianas da minha varanda. Queria colocar algo mais moderno, mais bacana.';
 assert.equal(precheckAudioTranscript({text,lowConfidence:false}),null);
 assert.match(AUDIO_REVIEW_INSTRUCTIONS,/human=false para pedidos comerciais comuns/);
 assert.match(AUDIO_REVIEW_INSTRUCTIONS,/queria trocar as persianas da varanda/);
 assert.match(AUDIO_REVIEW_INSTRUCTIONS,/uma pergunta de cada vez/);
});
test('áudio incompreensível é encaminhado para revisão humana',()=>{
 assert.equal(precheckAudioTranscript({text:'inaudível',lowConfidence:true}).human,true);
 assert.equal(precheckAudioTranscript({text:'[inaudível] quero uma persiana',lowConfidence:false}).human,true);
 assert.equal(precheckAudioTranscript({text:'Oi',lowConfidence:false}).human,true);
});
test('cliente sem medidas pode ser atendido e consultado',()=>{
 assert.equal(precheckAudioTranscript({text:'Queria saber o preço, mas ainda não tenho as medidas.',lowConfidence:false}),null);
 assert.match(AUDIO_REVIEW_INSTRUCTIONS,/Medidas, modelos e valores desconhecidos ou incertos exigem PERGUNTAR/);
});
