// Avaliação somente de texto. Não conecta WhatsApp ou bancos, nem envia mensagens.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { CONSULTATIVE_IDENTITY } from '../src/consultative-identity.js';
import { PRODUCT_KNOWLEDGE } from '../src/product-knowledge.js';
import { OPERATIONAL_POLICY } from '../src/operational-policy.js';
const scenarios=JSON.parse(readFileSync(new URL('./consultative-scenarios.json',import.meta.url),'utf8')).cases;
const previous=execFileSync('git',['show','1b61c1fb6f296a3a55216e60697e61172d5d29bf:src/worker.js'],{encoding:'utf8'});
const oldMatch=previous.match(/const INSTRUCTIONS = `([\s\S]*?)`;/);
if(!oldMatch)throw Error('Prompt antigo indisponível no commit fixado');
const baseline=oldMatch[1].replace(/\\n/g,'\n')+
  '\nIdentificação: primeiro nome no início, nome completo e cidade/bairro antes de orçamento, sem formulário.\n'+
  'Quando a pessoa estiver indecisa, oriente sem impor escolha; não recite o histórico.\n'+
  'Em caso de frustração persistente, pedir apoio humano. Não inventar valores.';
const revised=[CONSULTATIVE_IDENTITY,PRODUCT_KNOWLEDGE,OPERATIONAL_POLICY,
  'Identificação: solicite o primeiro nome cedo se não informado; nome completo, bairro e cidade são necessários antes de apresentar valores, sem interromper orientação útil.'].join('\n\n');
const key=process.env.OPENAI_API_KEY;
if(!key){console.log('COMPARAÇÃO NÃO EXECUTADA: OPENAI_API_KEY ausente no ambiente isolado.');process.exit(78);}
const model=process.env.KIARA_EVAL_MODEL||'gpt-6-luna';
const extract=(d)=>(d.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n').trim();
async function call(instructions,history){
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,instructions,input:history.map(([role,content])=>({role,content})),max_output_tokens:450,reasoning:{effort:'none'},store:false})});
 if(!r.ok)throw Error('OpenAI '+r.status+' '+(await r.text()).slice(0,160));
 const text=extract(await r.json());
 if(!text)throw Error('Resposta vazia');
 return text;
}
const out={evaluated_at:new Date().toISOString(),model,comparison:'baseline extraída do código pré-refatoração vs arquitetura centralizada',notice:'Comparação de geração real, avaliação qualitativa humana ainda necessária',cases:[]};
for(const scenario of scenarios){
 const old=await call(baseline,scenario.history);
 const newer=await call(revised,scenario.history);
 out.cases.push({id:scenario.id,expected:scenario.expected,history:scenario.history,old,new:newer});
 console.log('Concluído',scenario.id);
}
writeFileSync('evals/compare-results.json',JSON.stringify(out,null,2));
console.log('Comparação concluída, total de cenários',out.cases.length);

// Segunda rodada: observar preservação de contexto e perguntas únicas.
