// Motor comercial por categoria; valores vêm SOMENTE das configurações da organização.
// O custo por m² já é histórico de confecção. Modelo e proporção não alteram preço.
const money=n=>Math.round((n+Number.EPSILON)*100)/100;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function calculateCategoryCurtain(input,settings){
 const errors=[];
 if(settings?.methodology!=='commercial_categories_v1')errors.push('Metodologia não configurada');
 const width=Number(input?.width),height=Number(input?.height),quantity=Number(input?.quantity??1);
 const year=Number(input?.year??settings?.referenceYear??2026);
 if(!(width>0&&width<=(settings?.technicalLimits?.maxWidth||30)))errors.push('Largura inválida');
 if(!(height>0&&height<=(settings?.technicalLimits?.maxHeight||10)))errors.push('Altura inválida');
 if(!Number.isInteger(quantity)||quantity<1||quantity>(settings?.technicalLimits?.maxQuantity||20))errors.push('Quantidade inválida');
 if(!Number.isInteger(year)||year<2022||year>2100)errors.push('Ano inválido');
 const category=settings?.categories?.find(c=>c.name===input?.frontCategory&&c.active!==false);
 if(!category||!finite(category.costPerM2)||category.costPerM2<=0)errors.push('Categoria inválida');
 const rail=settings?.rails?.find(r=>r.id===input?.railType&&r.active!==false);
 if(!rail||!finite(rail.costPerMeter)||rail.costPerMeter<0)errors.push('Trilho inválido');
 const rails=Number(input?.rails??1);
 if(!Number.isInteger(rails)||rails<0||rails>4)errors.push('Quantidade de trilhos inválida');
 const installationPerFace=settings?.installation?.manualPerFace;
 if(!finite(installationPerFace)||installationPerFace<0)errors.push('Instalação inválida');
 const markupPercent=settings?.pricing?.markupPercent,annual=settings?.annualAdjustmentPercent??0;
 if(!finite(markupPercent)||markupPercent<0||markupPercent>500)errors.push('Markup inválido');
 if(!finite(annual)||annual<=-100||annual>100)errors.push('Reajuste inválido');
 if(category&&(year<Number(category.baseYear||settings.referenceYear)))errors.push('Ano anterior à referência do tecido');
 if(rail&&(year<Number(rail.baseYear||settings.referenceYear)))errors.push('Ano anterior à referência do trilho');
 if(errors.length)return {ready:false,errors,customerPriceAllowed:false};
 const area=width*height*quantity;
 const fabricUnit=category.costPerM2*Math.pow(1+annual/100,year-Number(category.baseYear||settings.referenceYear));
 const railUnit=rail.costPerMeter*Math.pow(1+annual/100,year-Number(rail.baseYear||settings.referenceYear));
 const front=area*fabricUnit,track=width*quantity*rails*railUnit;
 const installation=input?.includeInstallation===false?0:quantity*installationPerFace;
 const cost=front+track+installation;
 const total=money(cost*(1+markupPercent/100));
 return {ready:true,customerPriceAllowed:false,reviewRequired:true,status:'internal_review',
  product:'cortina',methodology:settings.methodology,area:money(area),layers:1,
  composition:{model:input?.model||null,frontCategory:category.name,backCategory:'Sem forro'},
  references:{front:{category:category.name,unit:fabricUnit,sample:category.records||0,scope:'categoria'},rail},
  costs:{front:money(front),lining:0,rails:money(track),installation:money(installation),total:money(cost)},
  markup:markupPercent/100,baseSale:total,motorSurcharge:0,internalSuggestedSale:total,
  customerQuote:{description:'Cortina sob medida — estimativa interna',total},
  warnings:['Modelo e proporção não alteram a média histórica','Valor preliminar sujeito à conferência humana']};
}
