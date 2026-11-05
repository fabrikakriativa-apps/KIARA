import {formatApprovedEstimate} from './quote-presentation.js';

const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const clean=s=>typeof s==='string'?s.trim().slice(0,130):'';
const number=x=>typeof x==='number'?x:typeof x==='string'&&/^\d+(?:[.,]\d+)?$/.test(x.trim())?Number(x.replace(',','.')):NaN;
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
const userEvidence=(snippet,history)=>normalize(snippet).length>=3&&history.some(x=>x.role==='user'&&normalize(x.content).includes(normalize(snippet)));

export function normalizeBlindItems(raw,settings,history=[]){
 const errors=[],items=[];
 if(!raw||!Array.isArray(raw.items)||!raw.items.length||raw.items.length>4)
  return {ready:false,errors:['Um a quatro itens necessários'],items};
 const categories=(settings.categories||[]).filter(x=>x.active!==false);
 for(const [i,row] of raw.items.entries()){
  const prefix='Item '+(i+1)+': ';
  if(row?.product!=='persiana'){errors.push(prefix+'produto não é persiana');continue}
  const model=categories.find(x=>normalize(x.name)===normalize(row.model));
  if(!model){errors.push(prefix+'modelo não confirmado');continue}
  const width=number(row.width),height=number(row.height),quantity=number(row.quantity);
  if(!(width>0&&width<=(settings.maxWidth||30))||!(height>0&&height<=(settings.maxHeight||10)))
   errors.push(prefix+'medidas não confirmadas');
  if(!Number.isInteger(quantity)||quantity<1||quantity>(settings.maxQuantity||20))
   errors.push(prefix+'quantidade não confirmada');
  const dimensionScope=row.dimensionScope;
  if(!['total','per_piece'].includes(dimensionScope))errors.push(prefix+'confirme se as medidas são totais ou por peça');
  if(!['selected','reference'].includes(row.basis))errors.push(prefix+'separar escolha da referência de orçamento');
  if(!userEvidence(row.evidence,history))errors.push(prefix+'falta evidência na fala do cliente');
  const label=clean(row.description);
  if(!label||/preço médio|custo|markup|etc|\/.*\//i.test(label))errors.push(prefix+'descrição comercial inválida');
  const environment=clean(row.environment);
  if(environment.length<2)errors.push(prefix+'ambiente não confirmado');
  if(row.drive!=='manual')errors.push(prefix+'motorização exige orçamento específico');
  // Exclusões não são equivalências: tela solar não equivale a blackout.
  const user=normalize(row.evidence);
  if(/blackout|bloquear (?:toda|totalmente) a luz/.test(user)&&!/blackout/.test(normalize(model.name)))
   errors.push(prefix+'blackout não pode ser precificado como tela solar');
  if(/screen/.test(normalize(model.name))&&/screen/.test(user)&&!/[135]\s*%/.test(user))
   errors.push(prefix+'percentual de abertura da tela solar não escolhido');
  if(errors.length&&errors[errors.length-1]?.startsWith(prefix))continue;
  items.push({product:'persiana',environment,model:model.name,width,height,quantity,dimensionScope,
    drive:'manual',modelDecision:{kind:row.basis,evidence:clean(row.evidence),description:label},
    installation:'included'});
 }
 return {ready:errors.length===0&&items.length===raw.items.length,errors,items};
}
export function calculateBlindQuote(items,settings,revision){
 const errors=[],details=[];
 if(settings?.methodology!=='blind_average_m2_v1')errors.push('Método de persianas não configurado');
 if(!(settings?.markupPercent>=0&&settings.markupPercent<=500))errors.push('Markup inválido');
 if(!(settings?.installationPerPiece>=0))errors.push('Instalação inválida');
 if(settings?.installationIncluded!==true)errors.push('A inclusão da instalação não foi autorizada');
 if(errors.length)return {ready:false,errors,customerPriceAllowed:false,reviewRequired:true};
 for(const item of items){
  const model=settings.categories?.find(x=>x.active!==false&&x.name===item.model);
  if(!model||!(model.adjustedCostPerM2>0)){errors.push(item.environment+': custo médio não disponível');continue}
  const area=item.width*item.height*(item.dimensionScope==='per_piece'?item.quantity:1);
  const adjusted=area*model.adjustedCostPerM2;
  const sale=round(adjusted*(1+settings.markupPercent/100));
  details.push({environment:item.environment,model:item.model,area:round(area),cost:round(adjusted),
    unitAdjustedCost:model.adjustedCostPerM2,internalInstallationCost:round(item.quantity*settings.installationPerPiece),
    internalSuggestedSale:sale,quantity:item.quantity,dimensionScope:item.dimensionScope});
 }
 return {ready:errors.length===0&&details.length===items.length,errors,items:details,
  total:round(details.reduce((a,x)=>a+x.internalSuggestedSale,0)),
  internalInstallationCost:round(details.reduce((a,x)=>a+x.internalInstallationCost,0)),
  customerPriceAllowed:false,reviewRequired:true,
  warning:'A instalação é custo interno apresentado em separado na planilha; não somar duas vezes ao preço sugerido.'};
}
export function buildInternalBlindBudget({items,preview,sourceMessageId,revision,configStatus}){
 return {
  product:'persiana',item:items.length===1?'Persiana sob medida':'Persianas sob medida',
  environment:items.map(x=>x.environment).join('; '),
  dimensions:items.map(x=>x.environment+': '+x.width+'m x '+x.height+'m').join('; '),
  items,pricing:preview,price_brl:preview.ready?String(preview.total.toFixed(2)):null,
  configuration_revision:revision,configuration_status:configStatus,
  source_message_id:sourceMessageId,test_only:true,customer_price_allowed:false,review_required:true
 };
}
export function approvedBlindQuoteText(budget){
 if(!budget||budget.review_required!==true||budget.customer_price_allowed!==false||
   !Array.isArray(budget.items)||!budget.items.length)throw Error('Orçamento não validado');
 const items=budget.items.map(x=>({
  product:'persiana',model:x.model,
  fabric:x.modelDecision?.description||'',
  quantity:x.quantity,width:x.width,height:x.height,
  dimensionScope:x.dimensionScope,installation:'included'
 }));
 return formatApprovedEstimate({product:'persiana',items,total:budget.price_brl});
}
export function blindSummary(items){
 return items.map(x=>x.environment+': persiana '+x.modelDecision.description+
  ', '+x.quantity+' '+(x.quantity===1?'peça':'peças')+
  ', '+x.width.toLocaleString('pt-BR')+' × '+x.height.toLocaleString('pt-BR')+' m '+
  (x.dimensionScope==='total'?'no total':'por peça')+
  (x.modelDecision.kind==='reference'?' (referência para estimativa)':'')).join('\n');
}
