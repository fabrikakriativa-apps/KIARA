import {normalizeBlindItems,calculateBlindQuote} from '../src/blind-quote.js';
const settings={methodology:'blind_average_m2_v1',markupPercent:120,installationPerPiece:80,installationIncluded:true,maxWidth:30,maxHeight:10,maxQuantity:20,categories:[{name:'Rolô Blackout',adjustedCostPerM2:110.4,active:true},{name:'Rolô Screen 1%',adjustedCostPerM2:142.8,active:true},{name:'Rolô Screen 3%',adjustedCostPerM2:115.2,active:true},{name:'Rolô Screen 5%',adjustedCostPerM2:93.6,active:true}]};
const tests=[
 {id:'sacada-tres-pecas',ready:true,expected:2680.41,text:'Quero orçamento de três persianas rolô Screen 1% para minha sacada. A largura total da sacada é 2,70 metros e a altura 3,16 metros. São três peças manuais.'},
 {id:'tela-nao-definida',ready:false,text:'Preciso de 3 persianas pra sacada, mais privacidade, mas não sei qual tela. Vão todo 2,70 de largura por 3,16 de altura, manual.'},
 {id:'medida-indefinida',ready:false,text:'Preciso de três persianas Screen 1% de 2,70 por 3,16 metros para a sacada, mas não sei se essa medida é de cada peça ou da janela inteira.'}
];
const instructions=[
 'Extração INTERNA de persianas, apenas JSON com items (até quatro).',
 'Campos: product="persiana",environment,model,width,height,quantity,dimensionScope ("total" ou "per_piece"),drive,basis ("selected" ou "reference"),evidence,description,dimensionEvidence,scopeEvidence.',
 'Modelos disponíveis: '+settings.categories.map(x=>x.name).join('; ')+'. Model deve ser um nome idêntico dessa lista.',
 'evidence é trecho LITERAL da mensagem do cliente que justifica o tipo/percentual da tela; description é nome comercial curto, sem código interno.',
 'dimensionEvidence é trecho LITERAL com números e medidas; scopeEvidence é trecho LITERAL que indique vão, janela, sacada inteira, total, cada peça ou por peça.',
 'Se o escopo da medida é incerto, dimensionScope null; se porcentagem Screen não foi escolhida, model null. Nunca presumir Screen 1% por privacidade.',
 'Reconhecer três peças como quantity 3 e medidas 2,70 e 3,16 em metros. Acionamento manual apenas quando dito.',
 'Se cliente escolheu explicitamente modelo e percentual, basis selected; se apenas opção aproximada, reference. Não inventar. Saída JSON puro.'
].join('\n');
let fail=0;
for(const scenario of tests){
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',
  headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({model:process.env.KIARA_EVAL_MODEL||'gpt-6-luna',instructions,input:[{role:'user',content:scenario.text}],max_output_tokens:1200,reasoning:{effort:'none'},store:false})});
 if(!response.ok)throw Error('API '+response.status);
 const obj=await response.json();
 const raw=(obj.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
 let result;try{result=JSON.parse(raw)}catch{result={items:[]}}
 const normalized=normalizeBlindItems(result,settings,[{role:'user',content:scenario.text}]);
 const preview=normalized.ready?calculateBlindQuote(normalized.items,settings,1):null;
 const passed=normalized.ready===scenario.ready&&(!scenario.expected||preview?.total===scenario.expected);
 console.log(JSON.stringify({scenario:scenario.id,passed,ready:normalized.ready,total:preview?.total,errors:normalized.errors,raw:result.items?.map(x=>({model:x.model,dimensionScope:x.dimensionScope,dimensionEvidence:x.dimensionEvidence,scopeEvidence:x.scopeEvidence}))}));
 if(!passed)fail++;
}
if(fail)throw Error('Falha em '+fail+' cenários de persiana');
