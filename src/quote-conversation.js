// Parser conservador para transformar conversa em parâmetros de orçamento.
// Os valores precisam ser explicitamente confirmados pelo cliente: nunca inferir categoria.
export const CURTAIN_MODELS=Object.freeze({'wave':'Wave','prega macho':'Prega Macho','franzida':'Franzida'});
export const DRIVE_MODES=Object.freeze({'manual':'manual','motorizada':'motorizada'});
export const LINING_TYPES=Object.freeze({'sem forro':'Sem forro','blackout':'Blackout','forro convencional':'Forro convencional'});
// As categorias comerciais são carregadas do banco; não há lista de preços no código.
const n=v=>typeof v==='number'?v:typeof v==='string'&&/^\d+(?:[.,]\d+)?$/.test(v.trim())?Number(v.replace(',','.')):NaN;
const clean=v=>typeof v==='string'?v.trim().slice(0,180):'';
export function normalizeCurtainIntake(raw,settings={}){
 const errors=[],out={};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {ready:false,errors:['Dados de atendimento ausentes'],intake:null};
 if(raw.product!=='cortina')errors.push('O cálculo por categoria ainda está restrito a cortinas');
 out.product='cortina';
 out.environment=clean(raw.environment);
 if(out.environment.length<2)errors.push('Ambiente não confirmado');
 out.model=CURTAIN_MODELS[clean(raw.model).toLowerCase()]??null;
 if(!out.model)errors.push('Modelo de cortina não confirmado');
 out.width=n(raw.width);out.height=n(raw.height);
 if(!Number.isFinite(out.width)||out.width<=0||out.width>30)errors.push('Largura aproximada ausente');
 if(!Number.isFinite(out.height)||out.height<=0||out.height>10)errors.push('Altura aproximada ausente');
 const categories=(settings.categories||[]).filter(x=>x.active!==false).map(x=>x.name);
 out.frontCategory=categories.find(x=>x.toLowerCase()===clean(raw.frontCategory).toLowerCase())??null;
 if(!out.frontCategory)errors.push('Categoria comercial frontal não confirmada');
 out.backCategory=clean(raw.backCategory).toLowerCase()==='sem forro'?'Sem forro':
  categories.find(x=>x.toLowerCase()===clean(raw.backCategory).toLowerCase())??null;
 if(!out.backCategory)errors.push('Quantidade ou tipo de tecidos não confirmados');
 out.drive=DRIVE_MODES[clean(raw.drive).toLowerCase()]??null;
 if(!out.drive)errors.push('Acionamento manual ou motorizado não confirmado');
 const quantity=raw.quantity===undefined?null:n(raw.quantity);
 out.quantity=Number.isInteger(quantity)&&quantity>=1&&quantity<=20?quantity:null;
 if(!out.quantity)errors.push('Quantidade de vãos/conjuntos não confirmada');
 return {ready:errors.length===0,errors,intake:out};
}
export function extractConversationInstructions(settings={}){
 const categories=(settings.categories||[]).filter(x=>x.active!==false).map(x=>x.name);
 return 'Extraia SOMENTE informações explicitamente fornecidas ou confirmadas pelo CLIENTE sobre UMA cortina. '+
 'Responda APENAS com JSON puro contendo product, environment, model, width, height, quantity, frontCategory, backCategory, drive. '+
 'model precisa ser wave, prega macho ou franzida. Categorias comerciais válidas (incluindo frente e forro): '+categories.join(', ')+'. '+
 'backCategory precisa ser Sem forro ou uma categoria comercial da lista. '+
 'drive precisa ser manual ou motorizada. Para informações desconhecidas use null; NUNCA adivinhe ou use valores técnicos. '+
 'width e height são metros, apenas quando informados com unidade clara; em centímetros converta para metros. '+
 'quantity é quantidade de vãos/conjuntos, NUNCA folhas de abertura nem camadas de tecido. '+
 'Se houver MAIS DE UM ambiente ou mais de uma composição, retorne product:null (requer separação manual). '+
 'Se houver ambiguidade, não suponha; use null. Não inclua preço, motor, instalação ou margem.';
}
