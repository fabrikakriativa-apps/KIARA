import {calculateCategoryCurtain} from './category-quote.js';
// Motor sem preços fixos: todos os custos e política comercial vêm de
// kiara_commercial_config (revisão aprovada pela Fábrika).
// O custo histórico por m² já incorpora a confecção: NÃO reaplicar proporção.
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
// Modelos e limites técnicos comerciais são configuráveis por organização.
const numeric=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function validateCurtainSettings(settings){
 const e=[];
 if(!settings||typeof settings!=='object'||Array.isArray(settings))return ['Configuração comercial não encontrada'];
 if(!Array.isArray(settings.categories)||!settings.categories.length)e.push('Categorias comerciais não configuradas');
 else for(const c of settings.categories){
  if(typeof c.name!=='string'||!c.name.trim()||!numeric(c.costPerM2,0.01,100000))e.push('Categoria com preço inválido');
 }
 if(!Array.isArray(settings.models)||!settings.models.length||settings.models.some(x=>typeof x!=='string'||!x.trim()))e.push('Modelos de cortina não configurados');
 if(!numeric(settings.technicalLimits?.maxWidth,0.01,30)||!numeric(settings.technicalLimits?.maxHeight,0.01,10)||!numeric(settings.technicalLimits?.maxQuantity,1,20))e.push('Limites técnicos não configurados');
 if(!Array.isArray(settings.rails)||!settings.rails.length)e.push('Trilhos não configurados');
 else for(const rail of settings.rails){
  if(typeof rail.id!=='string'||!rail.id.trim()||!numeric(rail.costPerMeter,0.01,100000))e.push('Trilho com custo inválido');
 }
 if(!numeric(settings.installation?.manualPerFace,0,10000))e.push('Instalação manual não configurada');
 if(!numeric(settings.installation?.motorPerFace,0,10000))e.push('Instalação motorizada não configurada');
 if(!numeric(settings.motorization?.finalSaleSurcharge,0,100000))e.push('Adicional comercial da motorização não configurado');
 if(!numeric(settings.pricing?.markupPercent,0,500))e.push('Acréscimo comercial não configurado');
 if(!Array.isArray(settings.ratios))e.push('Referências de proporção não configuradas');
 if(!Array.isArray(settings.modelCosts))e.push('Custos específicos de modelo não configurados');
 return e;
}
function priceReference(settings,category,model,position){
 const general=settings.categories.find(c=>c.name===category&&c.active!==false);
 if(!general)return null;
 const exact=settings.modelCosts.find(x=>x.category===category&&x.model===model&&x.position===position&&x.active!==false);
 const unit=exact?.costPerM2??general.costPerM2;
 const sample=exact?.records??general.records??0;
 return {category,model,unit,sample,scope:exact?'modelo':'categoria',
  reliability:position==='front'&&exact&&sample>=5?'model_reference':'exploratory'};
}
export function simulateCurtainQuote(input,config={}){
 if(config.pricing?.methodology==='commercial_categories_v1'){
  if(config.markup!==undefined||config.installation!==undefined)return {ready:false,errors:['Alteração comercial não autorizada'],customerPriceAllowed:false};
  return {...calculateCategoryCurtain({...input,railType:config.railType,rails:config.rails},config.pricing),configurationRevision:config.revision??null};
 }
 const errors=[],warnings=[];
 const settings=config.pricing;
 errors.push(...validateCurtainSettings(settings));
 if(errors.length)return {ready:false,errors,customerPriceAllowed:false};
 const width=Number(input?.width),height=Number(input?.height),quantity=Number(input?.quantity??1);
 if(!Number.isFinite(width)||width<=0||width>settings.technicalLimits.maxWidth)errors.push('Largura inválida');
 if(!Number.isFinite(height)||height<=0||height>settings.technicalLimits.maxHeight)errors.push('Altura inválida');
 if(!Number.isInteger(quantity)||quantity<1||quantity>settings.technicalLimits.maxQuantity)errors.push('Quantidade inválida');
 const model=input?.model,drive=input?.drive,frontCategory=input?.frontCategory;
 const backCategory=input?.backCategory;
 if(!settings.models.includes(model))errors.push('Modelo de cortina não configurado');
 if(!['manual','motorizada'].includes(drive))errors.push('Acionamento não confirmado');
 if(!settings.categories.some(c=>c.name===frontCategory&&c.active!==false))errors.push('Categoria frontal não configurada');
 if(backCategory!=='Sem forro'&&!settings.categories.some(c=>c.name===backCategory&&c.active!==false))errors.push('Forro não configurado');
 const rail=settings.rails.find(r=>r.id===config.railType&&r.active!==false);
 if(!rail)errors.push('Trilho não configurado ou inativo');
 const rails=Number(config.rails);
 if(!Number.isInteger(rails)||rails<1||rails>4)errors.push('Número de trilhos requer definição interna');
 // Margem, instalação, motor e referências só podem vir do documento aprovado.
 if(config.markup!==undefined||config.installation!==undefined)errors.push('Preço comercial deve vir somente da configuração aprovada');
 if(errors.length)return {ready:false,errors,customerPriceAllowed:false};
 const front=priceReference(settings,frontCategory,model,'front');
 const lining=backCategory==='Sem forro'?null:priceReference(settings,backCategory,'Franzida','lining');
 const area=width*height*quantity;
 const frontCost=round(area*front.unit),liningCost=lining?round(area*lining.unit):0;
 const railCost=round(width*quantity*rails*rail.costPerMeter);
 const layers=lining?2:1;
 const installationUnits=layers*quantity;
 const installationPerFace=drive==='motorizada'?settings.installation.motorPerFace:settings.installation.manualPerFace;
 const installationCost=round(installationUnits*installationPerFace);
 const totalCost=round(frontCost+liningCost+railCost+installationCost);
 const markup=settings.pricing.markupPercent/100;
 const baseSale=round(totalCost*(1+markup));
 const motorSurcharge=drive==='motorizada'?round(settings.motorization.finalSaleSurcharge*quantity):0;
 const internalSuggestedSale=round(baseSale+motorSurcharge);
 const ratios={front:settings.ratios.find(x=>x.position==='front'&&x.model===model)??null,
  lining:lining?settings.ratios.find(x=>x.position==='lining'&&x.model==='Franzida')??null:null};
 if(front.reliability!=='model_reference')warnings.push('Referência frontal exploratória; revisar amostra e composição');
 if(lining)warnings.push('Custo do forro depende de validação comercial');
 warnings.push('Aberturas, folhas e número técnico de motores ficam para visita técnica');
 if(drive==='motorizada')warnings.push('Verificar compatibilidade e número de acionamentos');
 return {
  ready:true,customerPriceAllowed:false,reviewRequired:true,status:'internal_review',
  product:'cortina',area:round(area),layers,drive,
  composition:{model,frontCategory,backCategory,technicalRatios:ratios},
  references:{front,lining,rail},configurationRevision:config.revision??null,
  installationDetails:{basis:'faces_de_tecido',perFace:installationPerFace,units:installationUnits,includedInTotal:true},
  costs:{front:frontCost,lining:liningCost,rails:railCost,installation:installationCost,total:totalCost},
  markup,baseSale,motorSurcharge,internalSuggestedSale,
  customerQuote:{description:'Cortina sob medida, com instalação inclusa',total:internalSuggestedSale},
  warnings
 };
}
