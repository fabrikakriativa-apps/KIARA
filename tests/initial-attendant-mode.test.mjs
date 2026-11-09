import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
const a=worker.indexOf('const initialMode=env=>'),b=worker.indexOf('async function humanRoute(',a);
assert.ok(a>0&&b>a);
const source=worker.slice(a,b);
const {initialMode,regionStatus,isBusinessHours,humanTransferNotice,initialModeRouting}=Function(
 "const MEMORY_TTL=604800; const digits=x=>String(x).replace(/\\D/g,''); const quoteStateKey=(r,s)=>r.source+':budget-flow:'+s;"+
 "const expressesQuoteIntent=t=>/orçamento|quanto custa|valor|preço/i.test(t);"+
 "const requestedBudgetProduct=(t,h)=>/persiana/i.test(t+' '+h.map(x=>x.content).join(' '))?'persiana':/cortina/i.test(t+' '+h.map(x=>x.content).join(' '))?'cortina':null;"+
 source+";return {initialMode,regionStatus,isBusinessHours,humanTransferNotice,initialModeRouting};"
)();
const env=()=>({KIARA_INITIAL_ATTENDANT_MODE:'true',KIARA_STAGING_LIVE_ENABLED:'true',KIARA_STAGING_PROVIDER:'easy',KIARA_SYNC_ALL_CONTACTS:'false',CONVERSAS:{get:async()=>null,put:async()=>{}}});
const route={source:'easy'};
test('modo opera apenas no worker isolado de homologação',()=>{
 assert.equal(initialMode(env()),true);
 assert.equal(initialMode({...env(),KIARA_SYNC_ALL_CONTACTS:'true'}),false);
 assert.equal(initialMode({...env(),KIARA_STAGING_LIVE_ENABLED:'false'}),false);
});
test('cidades da região metropolitana são reconhecidas e fora dela exige revisão',()=>{
 for(const c of ['Santo André','São Paulo','São Lourenço da Serra','Vargem Grande Paulista','Embu das Artes'])assert.equal(regionStatus(c),'covered',c);
 assert.equal(regionStatus('Campinas'),'needs_review');
 assert.equal(regionStatus(''),'missing');
});
test('horário usa timezone de São Paulo e nunca promete amanhã cegamente',()=>{
 assert.equal(isBusinessHours(new Date('2026-11-09T14:00:00Z')),true);
 assert.equal(isBusinessHours(new Date('2026-11-08T14:00:00Z')),false);
 assert.match(humanTransferNotice(new Date('2026-11-08T14:00:00Z')),/próximo período de atendimento/);
});
test('persiana simples segue orçamento rápido',async()=>{
 const e=env();let stored=null;e.CONVERSAS.put=async(k,v)=>stored=v;
 const result=await initialModeRouting(e,route,'5511999999999','Quero orçamento de persiana rolô',[],{city:'São Caetano do Sul'});
 assert.equal(result,null);assert.equal(stored,'quick');
});
test('dúvidas e serviço de reforma vão para humano',async()=>{
 const e=env();
 assert.match(await initialModeRouting(e,route,'1','Como funciona a persiana?',[],{city:'Santo André'}),/personalizada/);
 assert.match(await initialModeRouting(e,route,'1','Quero reformar sofá',[],{city:'Santo André'}),/consultivo|fora/);
});
test('cidade não atendida pede validação humana em vez de recusar',async()=>{
 assert.match(await initialModeRouting(env(),route,'1','Quero orçamento de persiana',[],{city:'Campinas'}),/validar viabilidade/);
});
test('cliente com triagem rápida pode responder os dados faltantes',async()=>{
 const e=env();e.CONVERSAS.get=async(k)=>k.includes('quick-intent')?'quick':null;
 assert.equal(await initialModeRouting(e,route,'1','5,10 x 2,41',[],{city:'Santo André'}),null);
});

test('opção orçamento rápido é aceita sem escolher modelo na mesma mensagem',async()=>{
 const e=env();let stored=null;e.CONVERSAS.put=async(k,v)=>stored=v;
 assert.equal(await initialModeRouting(e,route,'1','Quero um orçamento rápido',[],{city:''}),null);
 assert.equal(stored,'quick');
});
test('código do fluxo reconhece intenção rápida armazenada sem exigir expressão de preço',()=>{
 assert.match(worker,/\(initialMode\(env\) && \(await env.CONVERSAS.get\(quickIntentKey\(route,sender\)\)\)==='quick'\)/);
});

test('pedido de cortina segue orçamento rápido, sem transferência indevida',async()=>{
 const e=env();let stored=null;e.CONVERSAS.put=async(k,v)=>stored=v;
 const response=await initialModeRouting(e,route,'1','Quero orçamento de cortina para a sala',[],{city:'Santo André'});
 assert.equal(response,null);assert.equal(stored,'quick');
});
test('cliente pode iniciar orçamento de cortina em linguagem livre',async()=>{
 const e=env();let stored=null;e.CONVERSAS.put=async(k,v)=>stored=v;
 const response=await initialModeRouting(e,route,'1','Preciso de cortinas wave para o quarto',[],{city:'São Paulo'});
 assert.equal(response,null);assert.equal(stored,'quick');
});
test('outros serviços permanecem para atendimento humano',async()=>{
 const response=await initialModeRouting(env(),route,'1','Preciso de reforma de sofá',[],{city:'Diadema'});
 assert.match(response,/fora do orçamento rápido/);
});
test('cálculo das duas linhas permanece ligado às calculadoras validadas',()=>{
 assert.match(worker,/state.product==='persiana'\?await extractBlindBudgetItems\(env,history,config.settings\):await extractBudgetItems\(env,history,config.settings\)/);
 assert.match(worker,/calculateBlindQuote\(state.items,config.settings,config.revision\)/);
 assert.match(worker,/calculateQuotePreview\(state.items,config.settings,config.revision/);
 assert.match(worker,/status:'pending_review'/);
});
