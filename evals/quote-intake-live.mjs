// Avaliação isolada: sem Supabase, sem preços reais e sem WhatsApp.
import {normalizeQuoteItems} from '../src/quote-flow.js';
const key=process.env.OPENAI_API_KEY;
if(!key)throw Error('Credencial de IA indisponível');
const model=process.env.KIARA_EVAL_MODEL||'gpt-6-luna';
const settings={models:['Wave','Prega Macho','Franzida'],technicalLimits:{maxWidth:30,maxHeight:10,maxQuantity:20},
 categories:[{name:'LINHO / EFEITO LINHO - PREÇO MÉDIO',active:true},{name:'VOIL TEXTURIZADO - PREÇO MÉDIO',active:true},{name:'FORRO CONVENCIONAL - PREÇO MÉDIO',active:true}]};
const stories=[
 {id:'uma-cortina-confirmada',expectedReady:true,expectedItems:1,history:[
  {role:'user',content:'Quero um orçamento de cortina para a sala.'},
  {role:'assistant',content:'Vamos organizar as opções. Você já tem as medidas?'},
  {role:'user',content:'Sim. Escolhi cortina Wave em linho, sem forro, 3 metros de largura por 2,50 metros de altura. É um conjunto, manual.'}
 ]},
 {id:'dois-ambientes-confirmados',expectedReady:true,expectedItems:2,history:[
  {role:'user',content:'Quero cortinas para a sala e quarto.'},
  {role:'assistant',content:'Você já decidiu as características?'},
  {role:'user',content:'Sim. Para a sala, Wave em linho, 3,0 x 2,6 m, sem forro, um conjunto manual. Para o quarto, Prega Macho com voil texturizado e forro convencional, 2,5 x 2,7 m, um conjunto manual. São medidas em metros.'}
 ]},
 {id:'opcao-ainda-aberta',expectedReady:false,expectedItems:0,history:[
  {role:'user',content:'Ainda estou pensando em linho para a sala. Não tenho as medidas e não sei modelo nem forro. Só queria saber uma média.'}
 ]}
];
const prompt=[
 'Extração INTERNA de pré-orçamento. Não é mensagem para cliente. Retorne apenas JSON válido com a chave items (array de até 4 objetos).',
 'Cada objeto: product (cortina), environment (ambiente), model, width (m), height (m), quantity, frontCategory, backCategory (categoria ou Sem forro), drive (manual ou motorizada).',
 'Modelos aprovados: '+settings.models.join('; ')+'. Categorias comerciais: '+settings.categories.map(x=>x.name).join('; ')+'.',
 'Use apenas informações que o CLIENTE declarou e confirmou. Não trate sugestões da atendente como escolhas.',
 'Categorias comerciais podem representar o tecido informado pelo cliente (por exemplo linho), mas não suponha modelos, alturas, larguras, quantidades, forro ou motorização.',
 'Pode haver mais de um ambiente. Nunca leve medidas ou escolhas de um para outro. Se uma informação estiver indefinida, retorne null. Não invente nada.',
 'Saída: {"items":[...]}; sem markdown, texto adicional, valores monetários ou cálculo.'
].join('\n');
let fail=0;
for(const story of stories){
 const resp=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,instructions:prompt,input:story.history,max_output_tokens:1400,reasoning:{effort:'none'},store:false})});
 if(!resp.ok)throw Error('OpenAI '+resp.status);
 const d=await resp.json();
 const raw=(d.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
 let extracted;try{extracted=JSON.parse(raw)}catch{extracted={items:[]}}
 const outcome=normalizeQuoteItems(extracted,settings);
 const okay=outcome.ready===story.expectedReady&&(story.expectedReady?outcome.items.length===story.expectedItems:true);
 console.log(JSON.stringify({id:story.id,pass:okay,ready:outcome.ready,items:outcome.items?.map(x=>({environment:x.environment,model:x.model,width:x.width,height:x.height,frontCategory:x.frontCategory,backCategory:x.backCategory})),errors:outcome.errors}));
 if(!okay)fail++;
}
if(fail)throw Error('Falha em '+fail+' cenário(s) de extração de orçamento');
