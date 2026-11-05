import {normalizeCurtainIntake} from './quote-conversation.js';
import {simulateCurtainQuote} from './quote-pricing.js';

const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function expressesQuoteIntent(text){
 const s=normalize(text);
 return /\b(?:orcament\w*|preco|precificacao|estimativa|cotacao|valor(?:es)?|quanto custa|quanto fica|quanto sai)\b/.test(s);
}
export function confirmsQuoteSummary(text){
 const s=normalize(text).trim();
 return /^(?:(?:sim|isso|correto|confirmo|esta certo|tudo certo)(?:[,.! ]+(?:pode seguir|pode preparar|pode fazer))?|pode seguir|pode preparar|pode fazer)[.!\s]*$/.test(s);
}
export function cancelsQuoteSummary(text){
 return /\b(?:alterar|corrigir|mudar|nao|desist|rever|espera)\b/.test(normalize(text));
}
const cleaned=s=>typeof s==='string'?s.trim().slice(0,140):'';
const num=n=>typeof n==='number'?n:typeof n==='string'&&/^\d+(?:[.,]\d+)?$/.test(n.trim())?Number(n.replace(',','.')):NaN;
export function normalizeQuoteItems(raw,settings,customerText=''){
 if(!raw||!Array.isArray(raw.items)||!raw.items.length||raw.items.length>4)return {ready:false,errors:['O orçamento precisa de 1 a 4 itens confirmados']};
 const items=[],errors=[];
 for(const [index,row] of raw.items.entries()){
  const {ready,intake,errors:e}=normalizeCurtainIntake(row,settings);
  if(!ready){errors.push('Item '+(index+1)+': '+e.join('; '));continue;}
  if(ambiguousLiningRequest(customerText,intake.backCategory)){errors.push('Item '+(index+1)+': confirmar o tipo e o controle de luz do forro');continue;}
  if(intake.drive!=='manual'){errors.push('Item '+(index+1)+': motorização exige análise manual');continue;}
  items.push(intake);
 }
 const names=items.map(x=>normalize(x.environment));
 if(new Set(names).size!==names.length)errors.push('Há dois itens para o mesmo ambiente; separar as composições manualmente');
 return {ready:errors.length===0,items,errors};
}
// Categorias comerciais são exclusivamente referências de cálculo.
// A conversa usa nomes curtos e compreensíveis, sem amostras, códigos ou "preço médio".
export function customerFabricLabel(category,position='front',originalText=''){
 const cat=normalize(category);
 const said=normalize(originalText);
 if(cat==='sem forro')return 'sem forro';
 if(cat.includes('linho'))return said.includes('linho')?'linho':'tecido com efeito de linho';
 if(cat.includes('voil texturizado'))return 'voil texturizado';
 if(cat.includes('voil leve'))return 'voil leve';
 if(cat.includes('tecido decorativo'))return 'tecido decorativo';
 if(cat.includes('blackout fosco 70'))return 'blackout 70%';
 if(cat.includes('blackout 100'))return 'blackout 100%';
 if(cat.includes('forro convencional'))return said.includes('microfibra')?'forro de microfibra':'forro convencional';
 return position==='lining'?'forro a confirmar':'tecido a confirmar';
}
export function ambiguousLiningRequest(text,backCategory){
 const t=normalize(text),c=normalize(backCategory);
 // Um pedido de microfibra com blackout não equivale a microfibra convencional.
 if(/microfibra/.test(t)&&/blackout|bloqueio de luz/.test(t)&&c.includes('forro convencional'))return true;
 // Grau de blackout mencionado sem definição não equivale a 70% ou 100%.
 if(/blackout/.test(t)&&/(alguma porcentagem|qualquer porcentagem|ate 70|até 70|nao sei quanto|não sei quanto)/.test(t))return true;
 return false;
}
export function summarizeQuoteItems(items,customerText=''){
 return items.map((x,i)=>[
  (i+1)+'. '+x.environment+': cortina '+x.model.toLocaleLowerCase('pt-BR'),
  x.width.toLocaleString('pt-BR')+' × '+x.height.toLocaleString('pt-BR')+' m',
  'tecido '+customerFabricLabel(x.frontCategory,'front',customerText),
  x.backCategory==='Sem forro'?'sem forro':'com '+customerFabricLabel(x.backCategory,'lining',customerText),
  x.quantity===1?'um conjunto':x.quantity+' conjuntos'
 ].join(', ')).join('\n');
}
export function calculateQuotePreview(items,settings,revision,options={}){
 const rail=String(options.railType||'');
 const rails=Number(options.rails||1);
 if(!settings||settings.methodology!=='commercial_categories_v1')
  return {ready:false,errors:['Metodologia comercial não disponível']};
 if(!settings.rails?.some(x=>x.id===rail&&x.active!==false))
  return {ready:false,errors:['Trilho deve ser selecionado e conferido pelo orçamento interno']};
 const quoted=[],errors=[];
 for(const item of items){
  const input=item.backCategory==='Sem forro'
   ?{...item}
   :{...item,faces:[{category:item.frontCategory},{category:item.backCategory}]};
  const result=simulateCurtainQuote(input,{pricing:settings,railType:rail,rails,revision});
  if(!result.ready){errors.push(item.environment+': '+(result.errors||[]).join('; '));continue;}
  quoted.push({environment:item.environment,input:item,result});
 }
 return {ready:errors.length===0&&quoted.length===items.length,items:quoted,
  total:Math.round(quoted.reduce((n,x)=>n+x.result.internalSuggestedSale,0)*100)/100,
  errors,customerPriceAllowed:false,reviewRequired:true};
}
export function buildInternalBudget({items,preview,sourceMessageId,revision,configStatus,railType}){
 return {
  item:items.length===1?'Cortina sob medida':'Cortinas sob medida',
  environment:items.map(x=>x.environment).join('; '),
  dimensions:items.map(x=>x.environment+': '+x.width+'m x '+x.height+'m').join('; '),
  items,pricing:preview,price_brl:preview.ready?String(preview.total.toFixed(2)):null,
  configuration_revision:revision,configuration_status:configStatus,
  rail_type_for_review:railType,source_message_id:sourceMessageId,
  test_only:true,customer_price_allowed:false,review_required:true
 };
}
export function approvedQuoteText(budget){
 if(!budget||budget.review_required!==true||budget.customer_price_allowed!==false||!Array.isArray(budget.items))
  throw Error('Orçamento não validado');
 const amount=Number(budget.price_brl);
 if(!Number.isFinite(amount)||amount<=0||amount>1000000)throw Error('Preço não revisável');
 return 'Preparamos sua estimativa de cortinas com base nas especificações que alinhamos. 😊\n\n'+
  summarizeQuoteItems(budget.items)+'\n\nValor estimado: '+
  amount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})+
  '\n\nA confirmação final depende das medidas e condições verificadas na visita técnica.';
}
