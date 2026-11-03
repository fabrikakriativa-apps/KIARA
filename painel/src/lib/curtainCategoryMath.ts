// Fórmula comercial de cortinas: mesma regra do Worker de homologação.
// Esta função é apenas uma simulação interna; não autoriza preço ao cliente.
export type CategoryPrice={name:string;costPerM2:number;baseYear?:number;active?:boolean;records?:number}
export type RailPrice={id:string;label:string;costPerMeter:number;baseYear?:number;active?:boolean;records?:number}
export type CurtainPriceSettings={
 methodology:string;referenceYear:number;annualAdjustmentPercent:number;
 categories:CategoryPrice[];rails:RailPrice[];
 technicalLimits:{maxWidth:number;maxHeight:number;maxQuantity:number};
 installation:{manualPerFace:number};pricing:{markupPercent:number}
}
export type FaceInput={width:number;height:number;quantity:number;category:string;year:number;includeInstallation:boolean}
export type FaceResult={ready:true;area:number;fabric:number;installation:number;cost:number;category:string;sample:number}
export type QuoteResult={ready:true;faces:FaceResult[];rails:number;cost:number;sale:number;markupPercent:number;customerPriceAllowed:false;reviewRequired:true}
 |{ready:false;errors:string[];customerPriceAllowed:false}
const money=(n:number)=>Math.round((n+Number.EPSILON)*100)/100
const valid=(n:number)=>Number.isFinite(n)
export function calculateCurtainCategoryQuote(settings:CurtainPriceSettings,faces:FaceInput[],railId:string,railQuantity:number):QuoteResult{
 const errors:string[]=[]
 if(settings?.methodology!=='commercial_categories_v1')errors.push('Metodologia inválida')
 if(!Array.isArray(faces)||!faces.length||faces.length>2)errors.push('É necessário informar uma ou duas faces')
 if(!Number.isInteger(railQuantity)||railQuantity<0||railQuantity>4)errors.push('Quantidade de trilhos inválida')
 const annual=settings?.annualAdjustmentPercent??0,markup=settings?.pricing?.markupPercent
 if(!valid(annual)||annual<=-100||annual>100)errors.push('Reajuste inválido')
 if(!valid(markup)||markup<0||markup>500)errors.push('Acréscimo inválido')
 const rail=settings?.rails?.find(x=>x.id===railId&&x.active!==false)
 if(!rail||!valid(rail.costPerMeter)||rail.costPerMeter<0)errors.push('Trilho não configurado')
 if(railQuantity===0&&rail&&rail.costPerMeter!==0)errors.push('Selecione Sem Trilho para quantidade zero')
 const details:FaceResult[]=[]
 for(const item of faces||[]){
  const c=settings?.categories?.find(x=>x.name===item.category&&x.active!==false)
  if(!c||!valid(c.costPerM2)||c.costPerM2<=0){errors.push('Categoria inválida');continue}
  if(!valid(item.width)||item.width<=0||item.width>settings.technicalLimits.maxWidth||
    !valid(item.height)||item.height<=0||item.height>settings.technicalLimits.maxHeight||
    !Number.isInteger(item.quantity)||item.quantity<1||item.quantity>settings.technicalLimits.maxQuantity){
    errors.push('Medidas ou quantidade inválidas');continue
  }
  const baseYear=c.baseYear??settings.referenceYear
  if(!Number.isInteger(item.year)||item.year<baseYear||item.year>2100){errors.push('Ano incompatível com a categoria');continue}
  const unit=c.costPerM2*Math.pow(1+annual/100,item.year-baseYear)
  const area=item.width*item.height*item.quantity
  const installation=item.includeInstallation?item.quantity*settings.installation.manualPerFace:0
  details.push({ready:true,area:money(area),fabric:money(area*unit),installation:money(installation),
   cost:area*unit+installation,category:c.name,sample:c.records||0})
 }
 if(details.length!==faces?.length)return {ready:false,errors,customerPriceAllowed:false}
 if(!rail||errors.length)return {ready:false,errors,customerPriceAllowed:false}
 // Trilho compartilhado pela composição: nunca duplicado automaticamente por face.
 const first=faces[0]
 if(faces.length===2&&(faces[1].width!==first.width||faces[1].quantity!==first.quantity||faces[1].year!==first.year))
  errors.push('Faces com larguras, quantidades ou anos diferentes exigem orçamento separado')
 const railYear=rail.baseYear??settings.referenceYear
 if(first.year<railYear)errors.push('Ano anterior ao ano-base do trilho')
 const railCost=first.width*first.quantity*railQuantity*rail.costPerMeter*Math.pow(1+annual/100,first.year-railYear)
 if(!valid(railCost)||railCost<0)errors.push('Custo do trilho inválido')
 if(errors.length)return {ready:false,errors,customerPriceAllowed:false}
 const cost=details.reduce((sum,face)=>sum+face.cost,0)+railCost
 return {ready:true,faces:details,rails:money(railCost),cost:money(cost),
  sale:money(cost*(1+markup/100)),markupPercent:markup,customerPriceAllowed:false,reviewRequired:true}
}
