import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');

test('transferência só depois de verificar mensagem mais recente',()=>{
 const start=source.indexOf("if(answer.includes('<<ENCAMINHAR_HUMANO>>'))");
 const check=source.indexOf("latest.latestId!==targetId",start);
 const handoff=source.indexOf("await humanRoute(env,route,sender,targetId,'A Kiara solicitou análise humana')",start);
 assert.ok(start>0&&check>start&&handoff>check);
});

test('informação comum de condomínio e fotos não deve causar transferência automática',()=>{
 assert.match(source,/const routine=.*condom\[ií\]nio/);
 assert.match(source,/routine&&!explicitHuman&&!risk/);
 assert.match(source,/Pode enviar uma foto da varanda quando conseguir/);
 assert.match(source,/não conhecer modelos\/medidas/);
});

test('preserva bloqueios para pedido humano ou situação de risco',()=>{
 assert.match(source,/const explicitHuman=mustEscalate\(inputText\)/);
 assert.match(source,/const risk=.*inc\[eê\]ndio/);
 assert.match(source,/if\(routine&&!explicitHuman&&!risk\)/);
});
