// Referências exploratórias extraídas do arquivo de pré-orçamento fornecido em 02/11/2026.
// NÃO equivalem a preços de venda homologados ou à cotação atual da fábrica.
// Os valores de m² já contêm a confecção; nunca aplicar proporção novamente.
export const CATEGORY_COSTS=Object.freeze({
 'Blackout':{unit:68.8719,records:30,fabrics:16},
 'Decorativo':{unit:135.1923,records:4,fabrics:4},
 'Forro convencional':{unit:48.6041,records:9,fabrics:4},
 'Linho / efeito linho':{unit:107.4385,records:50,fabrics:13},
 'Voil leve':{unit:73.7221,records:1,fabrics:1},
 'Voil texturizado':{unit:86.6504,records:33,fabrics:12}
});
const PER_MODEL=Object.freeze({
 'Blackout|Franzida|front':{unit:57.9317,records:10},
 'Linho / efeito linho|Wave|front':{unit:118.5428,records:7},
 'Linho / efeito linho|Prega Macho|front':{unit:107.2898,records:25},
 'Voil texturizado|Prega Macho|front':{unit:72.4716,records:25}
});
export const RATIOS=Object.freeze({
 'front|Prega Macho':{ratio:3,records:75},
 'front|Wave':{ratio:2.5,records:17,variants:[2.2,2.5],note:'Padrão observado em todas as 17 amostras de 2026; histórico anterior frequentemente usa 2,2'},
 'front|Franzida':{ratio:1.5,records:24},
 'lining|Franzida':{ratio:1.5,records:10},
 'lining|Prega Macho':{ratio:3,records:2}
});
export const RAIL_REFERENCE=Object.freeze({
 'trilho_suico':{supplier:'Trilho Max Reforçado Branco',unit:11.5707,unverifiedMapping:true},
 'varao_trilho':{supplier:'Trilho Varao Branco',unit:35.1082,unverifiedMapping:false}
});
// Regra comercial da Fábrika: instalado é obrigatório e incluso no preço final.
export const CURTAIN_INSTALLATION_PER_FACE=Object.freeze({manual:60,motorizada:120});
export const CURTAIN_MOTOR_SALE_SURCHARGE=1400;
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
const allowedFront=new Set(['Wave','Prega Macho','Franzida']);
const allowedBack=new Set(['Blackout','Forro convencional',null,'Sem forro']);
function reference(category,model,layer){
 const baseline=CATEGORY_COSTS[category];
 if(!baseline)return null;
 const specific=PER_MODEL[category+'|'+model+'|'+layer];
 return {category,model,unit:specific?.unit??baseline.unit,
  sample:specific?.records??baseline.records,
  scope:specific?'modelo':'categoria',
  reliability:specific&&specific.records>=5?'model_reference':'exploratory',
  ...(layer==='lining'?{reliability:'exploratory'}:{})};
}
export function simulateCurtainQuote(input,config={}){
 const width=Number(input?.width),height=Number(input?.height),quantity=Number(input?.quantity??1);
 const model=input?.model,frontCategory=input?.frontCategory;
 const drive=input?.drive;
 const backCategory=input?.backCategory??'Sem forro';
 const errors=[],warnings=[];
 if(!Number.isFinite(width)||width<=0||width>30)errors.push('Largura inválida');
 if(!Number.isFinite(height)||height<=0||height>10)errors.push('Altura inválida');
 if(!Number.isInteger(quantity)||quantity<1||quantity>20)errors.push('Quantidade inválida');
 if(!allowedFront.has(model))errors.push('Modelo de cortina não reconhecido');
 if(!Object.hasOwn(CURTAIN_INSTALLATION_PER_FACE,drive))errors.push('Acionamento manual ou motorizado precisa ser identificado');
 if(!CATEGORY_COSTS[frontCategory])errors.push('Categoria frontal não reconhecida');
 if(!allowedBack.has(backCategory))errors.push('Categoria de forro não reconhecida');
 const railType=config.railType??null;
 if(!railType||!RAIL_REFERENCE[railType])errors.push('Trilho deve ser definido internamente');
 const rails=Number(config.rails);
 if(!Number.isInteger(rails)||rails<1||rails>4)errors.push('Número de trilhos requer validação técnica');
 // O custo de instalação é automático por camada/face, não informado pelo cliente.
 // quantity representa vãos/conjuntos idênticos, NÃO folhas de abertura.
 // Uma face = uma camada de tecido (frente ou forro), independentemente da abertura.
 if(config.installation!==undefined)errors.push('Custo de instalação é automático; não informar valor manual');
 const markup=Number(config.markup);
 if(!Number.isFinite(markup)||markup<0||markup>5)errors.push('Acréscimo comercial não aprovado');
 if(errors.length)return {ready:false,errors,customerPriceAllowed:false};
 const front=reference(frontCategory,model,'front');
 // O forro é tratado como camada independente, usualmente franzida; confirmar viabilidade.
 const lining=backCategory==='Sem forro'?null:reference(backCategory,'Franzida','lining');
 const area=width*height*quantity;
 const frontCost=round(area*front.unit);
 const liningCost=lining?round(area*lining.unit):0;
 const railReference=RAIL_REFERENCE[railType];
 const railCost=round(width*quantity*rails*railReference.unit);
 const layers=lining?2:1;
 const installationUnits=layers*quantity;
 const installationPerFace=CURTAIN_INSTALLATION_PER_FACE[drive];
 const install=round(installationUnits*installationPerFace);
 const supplierCost=round(frontCost+liningCost+railCost+install);
 const baseSale=round(supplierCost*(1+markup));
 const motorSurcharge=drive==='motorizada'?CURTAIN_MOTOR_SALE_SURCHARGE*quantity:0;
 // Adicional comercial fica APÓS o markup; não é um custo de instalação.
 const suggestedSale=round(baseSale+motorSurcharge);
 if(front.reliability!=='model_reference')warnings.push('Frente com custo por categoria, sem amostra suficiente do modelo.');
 if(lining)warnings.push('Forro: pouca amostra na posição posterior; valor exploratório.');
 if(railReference.unverifiedMapping)warnings.push('Confirmar correspondência do trilho suíço com o item do fornecedor.');
 warnings.push('Detalhes de abertura, folhas, trilhos e componentes ficam para visita técnica ou negociação avançada.');
 if(quantity>1)warnings.push('Quantidade representa conjuntos iguais; instalar por face de tecido, não por folhas de abertura.');
 if(drive==='motorizada')warnings.push('Viabilidade e quantidade técnica de motores serão confirmadas na visita; o pré-orçamento mantém adicional comercial por conjunto.');
 warnings.push('Valores históricos de 2026; confirmar custo atual e política comercial antes de enviar.');
 return {
  ready:true,customerPriceAllowed:false,reviewRequired:true,
  status:warnings.length?'internal_review':'internal_review',
  product:'cortina',area:round(area),layers,drive,
  composition:{model,frontCategory,backCategory,technicalRatios:{
    front:RATIOS['front|'+model]??null,
    lining:lining?RATIOS['lining|Franzida']:null
  }},
  references:{front,lining,rail:railReference},
  installationDetails:{basis:'faces_de_tecido',perFace:installationPerFace,units:installationUnits,includedInTotal:true},
  costs:{front:frontCost,lining:liningCost,rails:railCost,installation:install,total:supplierCost},
  markup,baseSale,motorSurcharge,internalSuggestedSale:suggestedSale,
  // Nunca apresentar custos internos como itens separados no orçamento ao cliente.
  customerQuote:{description:'Cortina sob medida, com instalação inclusa',total:suggestedSale},warnings
 };
}
