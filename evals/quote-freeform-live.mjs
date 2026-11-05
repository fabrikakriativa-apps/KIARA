import {normalizeQuoteItems} from '../src/quote-flow.js';
const key=process.env.OPENAI_API_KEY;
if(!key)throw Error('Credencial de IA indisponível');
const settings={models:['Wave','Prega Macho','Franzida'],enforceEvidence:true,
 technicalLimits:{maxWidth:30,maxHeight:10,maxQuantity:20},
 categories:[
 {name:'LINHO / EFEITO LINHO (MOREA / FRESH LINHO / GAIA / ETC) - PREÇO MÉDIO',active:true},
 {name:'VOIL LEVE - PREÇO MÉDIO',active:true},
 {name:'VOIL TEXTURIZADO (FLAME BALI / BORA BORA / PIPA / ETC) - PREÇO MÉDIO',active:true},
 {name:'FORRO CONVENCIONAL (MICROFIBRA / VOIL CRISTAL) - PREÇO MÉDIO',active:true},
 {name:'BLACKOUT FOSCO 70% - PREÇO MÉDIO',active:true},
 {name:'BLACKOUT 100% DUPLA FACE - PREÇO MÉDIO',active:true}
 ]};
const scenarios=[
 {id:'linho-explicito',expected:true,user:'Quero o orçamento de uma cortina wave em linho para a sala. Um conjunto manual, 3 metros por 2 metros e meio, sem forro.'},
 {id:'linguagem-informal',expected:false,user:'Preciso de algo bem levinho, mas que o povo de fora não me veja. É pra sala, não medi ainda. O que você sugere?'},
 {id:'forro-ambiguo',expected:false,user:'Cortina de linho franzida para o quarto, 3.0 x 2.60 metros, um conjunto manual, forro microfibra com alguma porcentagem de blackout.'},
 {id:'material-especificado',expected:true,user:'Para o quarto escolhi franzida com gaze de linho na frente e microfibra convencional no forro. A medida é 2,50 metros de largura por 2,70 metros de altura. Uma cortina manual.'},
 {id:'blackout-sem-percentual',expected:false,user:'Tenho 3 metros por 2,60 e quero cortina wave de linho no quarto com algum blackout, tanto faz a porcentagem. Uma peça manual.'}
];
const model=process.env.KIARA_EVAL_MODEL||'gpt-6-luna';
const categories=settings.categories.map(x=>x.name);
const instructions=[
'Extração INTERNA de pré-orçamento; responda apenas JSON com items (array de até 4).',
'Campos por item: product="cortina",environment,model,width,height,quantity,frontCategory,backCategory,drive e frontBasis/backBasis ("selected" escolha expressa, ou "reference" hipótese média para estimativa).',
'Adicione frontEvidence/backEvidence: TRECHO LITERAL do cliente comprovando a escolha ou necessidade; frontDescription/backDescription: texto comercial curto e claro, sem códigos internos.',
'Modelos: '+settings.models.join('; ')+'. Categorias aprovadas: '+categories.join('; ')+'.',
'Se o cliente descreve apenas objetivo estético ou funcional, pode propor uma categoria como reference, mas jamais marque selected. Caso múltiplas referências muito diferentes sejam possíveis, deixe categoria null para esclarecer.',
'Reconheça expressões explícitas comuns: sem forro -> backCategory=Sem forro; uma cortina/um conjunto/uma peça -> quantity=1. Preserve o nome exato do material declarado no frontDescription (ex.: gaze de linho).',
   'Entenda medidas faladas naturalmente: 3 metros por 2 metros e meio significa largura 3,00 e altura 2,50 em metros; "dois e setenta" com unidade e contexto claro significa 2,70. Não troque largura e altura quando não indicadas.',
'Se o cliente disser blackout sem definir percentual e houver opções 70% e 100%, deixe backCategory null; não escolha arbitrariamente.',
'Não suponha modelo, medidas, quantidade, forro, motorização ou percentuais de bloqueio; se faltar dado, null. Não trate uma sugestão sua como decisão do cliente.',
'Use somente fatos presentes na mensagem do CLIENTE. Nunca mostre preço nem lista de categorias ao cliente. Saída JSON puro.'
].join('\n');
let failures=0;
for(const scenario of scenarios){
 const input=[{role:'user',content:scenario.user}];
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',
  headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
  body:JSON.stringify({model,instructions,input,max_output_tokens:1700,reasoning:{effort:'none'},store:false})});
 if(!response.ok)throw Error('Erro de modelo '+response.status);
 const d=await response.json();
 const text=(d.output||[]).flatMap(o=>o.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
 let result;try{result=JSON.parse(text)}catch{result={items:[]}}
 const verdict=normalizeQuoteItems(result,settings,scenario.user,input);
 const pass=verdict.ready===scenario.expected;
 console.log(JSON.stringify({scenario:scenario.id,pass,ready:verdict.ready,basis:verdict.items?.map(x=>x.frontDecision?.kind),missing:verdict.errors?.length,errors:verdict.errors,extracted:result.items?.map(x=>({model:x.model,frontCategory:x.frontCategory,backCategory:x.backCategory,frontBasis:x.frontBasis,backBasis:x.backBasis,frontEvidence:x.frontEvidence,backEvidence:x.backEvidence,frontDescription:x.frontDescription,backDescription:x.backDescription}))}));
 if(!pass)failures++;
}
if(failures)throw Error('Falhas de compreensão em '+failures+' cenário(s)');
