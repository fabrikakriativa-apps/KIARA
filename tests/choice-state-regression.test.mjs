import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const w=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
const q=readFileSync(new URL('../src/quote-intake.js',import.meta.url),'utf8');
test('propostas não equivalem a decisões confirmadas',()=>{assert.match(w,/escolha explicitamente confirmada/);assert.match(w,/mudança de intenção do cliente tem prioridade/);});
test('não avançar automaticamente à medição',()=>{assert.match(w,/Oriente antes de coletar medidas adicionais/);assert.match(w,/não passe automaticamente para medidas/);});
test('resumo distingue escolhas e sugestões',()=>{assert.match(q,/preferências ainda em avaliação/);assert.match(w,/necessidade definida/);});
test('proteções de preço e controle permanecem',()=>{assert.match(w,/containsCommercialPrice/);assert.match(w,/isAuthorizedToSend/);});
