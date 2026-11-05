/**
 * Formato comercial aprovado pela Fábrika Kriativa.
 * Não recebe custos de fornecedor, categorias internas ou instruções do modelo.
 * Usado somente após revisão e autorização de valor.
 */
const money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}).replace(/\u00a0/g,' ');
const measure=n=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const clean=s=>String(s||'').trim();
const safe=s=>clean(s).replace(/\*/g,'').replace(/[\r\n]+/g,' ').slice(0,110);
const forbidden=/preço médio|categoria comercial|custo por m²|markup|morea\s*\/\s*fresh|\betc\b/i;
const valid=s=>clean(s)&&!forbidden.test(String(s));
const units=(n,kind)=>Number(n)===1?'1 '+kind:' '+Number(n)+' '+(kind==='peça'?'peças':'conjuntos');
const notes='📌 *Sobre o orçamento:*\nEsta estimativa foi elaborada com base em valores médios dos materiais e da composição escolhida. Para chegarmos ao valor definitivo, é necessário refinar a seleção dos tecidos, acabamentos e demais especificações.';
const payment='💳 *Pagamento:* PIX ou cartão, com parcelamento em até 6x sem juros.';
function validate(data){
 if(!data||!['cortina','persiana'].includes(data.product))throw Error('Produto inválido');
 if(!Array.isArray(data.items)||!data.items.length||data.items.length>4)throw Error('Itens não definidos');
 if(!Number.isFinite(Number(data.total))||Number(data.total)<=0||Number(data.total)>1000000)throw Error('Valor inválido');
 for(const item of data.items){
  if(!valid(item.model)||!valid(item.fabric)||!(Number(item.quantity)>=1&&Number.isInteger(Number(item.quantity))))throw Error('Composição comercial indefinida');
  if(!(Number(item.width)>0&&Number(item.height)>0))throw Error('Medidas indefinidas');
  if(item.product&&item.product!==data.product)throw Error('Produtos misturados');
  if(!['included','excluded'].includes(item.installation))throw Error('Instalação não validada');
 }
}
export function formatApprovedEstimate(data){
 validate(data);
 const plural=data.product==='persiana'?'persianas':'cortinas';
 const heading=data.product==='persiana'?'PERSIANA':'CORTINA';
 let text='✨ *FÁBRIKA KRIATIVA | ORÇAMENTO PRÉVIO*\n\n'+
 'Preparamos uma estimativa inicial para suas '+plural+', considerando a composição abaixo. 😊';
 for(const item of data.items){
  text+='\n\n🪟 *'+heading+' '+safe(item.model).toLocaleUpperCase('pt-BR')+'*\n\n'+
   '• *Modelo:* '+safe(item.model)+'\n'+
   '• *Quantidade:* '+Number(item.quantity)+' '+(data.product==='persiana'?(Number(item.quantity)===1?'peça':'peças'):(Number(item.quantity)===1?'conjunto':'conjuntos'))+'\n'+
   '• *Medidas '+(item.dimensionScope==='total'?'totais':item.dimensionScope==='each'?'por peça':'aproximadas')+':* '+measure(item.width)+' m × '+measure(item.height)+' m\n'+
   '• *Tecido:* '+safe(item.fabric)+'\n';
  if(item.lining)text+='• *Forro:* '+safe(item.lining)+'\n';
  text+='• *Instalação:* '+(item.installation==='included'?'Inclusa':'Não inclusa');
 }
 text+='\n\n💰 *Valor estimado: '+money(data.total)+'*\n\n'+payment+'\n\n'+notes;
 return text;
}
