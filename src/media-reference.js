import {selectCurtainFinishReferences} from './reference-selection.js';
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
export function requestedFinishImages(text){
 const input=normalize(text);
 if(!/(foto|imagem|mostr|ver |compar|diferen|visualiz)/.test(input))return [];
 const modelPatterns=[
  {name:'Prega macho',pattern:/\bprega[\s-]+macho\b/},
  {name:'Prega franzida',pattern:/\b(?:prega[\s-]+)?franzida\b/},
  {name:'Wave',pattern:/\bwave\b/}
 ];
 return modelPatterns.map(entry=>({name:entry.name,pos:input.search(entry.pattern)}))
  .filter(entry=>entry.pos>=0).sort((a,b)=>a.pos-b.pos).slice(0,2).map(entry=>entry.name);
}
export function chooseFinishImages(text,rows){
 return selectCurtainFinishReferences({requested:true,modelsRequested:requestedFinishImages(text),references:rows});
}

/** Seleção segura para solicitações visuais de produtos aprovados.
 * Nunca interpreta uma menção simples como autorização de envio.
 * Mantém no máximo duas fotos e não fornece URL privada ao modelo.
 */
export function chooseProductImages(text,rows=[]){
 const input=normalize(text);
 const ask=/(foto|fotos|imagem|imagens|mostr|ver |visualiz|exempl|opco|opç|modelos|compar)/.test(input);
 if(!ask||!Array.isArray(rows))return [];
 const eligible=rows.filter(x=>x&&x.active===true&&['produto','composicao','modelo_confeccao'].includes(x.category)
  &&['cortina','persiana'].includes(x.product)&&typeof x.storage_path==='string'&&x.storage_path.length>0);
 if(!eligible.length)return [];
 const curtains=/\b(cortina|cortinas|tecido|linho|voil|gaze|wave|prega)\b/.test(input);
 const blinds=/\b(persiana|persianas|rolo|rol[oô]|romana|double vision|madeira|silonew|vig blind)\b/.test(input);
 const product=curtains&&!blinds?'cortina':blinds&&!curtains?'persiana':null;
 const terms=[
   ['gaze de linho',/gaze/],['linho fresh',/fresh/],['linho morea',/morea/],
   ['linho',/linho/],['blackout',/blackout/],['semi-blackout',/semi.?blackout/],
   ['wave',/\bwave\b/],['prega macho',/prega macho/],['prega franzida',/franzid/],
   ['romana',/romana/],['madeira',/madeira/],['rolo',/rol[oô]/],
   ['1%',/1\s*%/],['3%',/3\s*%/],['composicao',/composi[cç][aã]o/]
 ].filter(([,re])=>re.test(input)).map(([t])=>t);
 const score=x=>{
  const name=normalize([x.model,x.title].join(' '));
  let points=0;
  if(product&&x.product!==product)return -1000;
  for(const term of terms){
   if(name.includes(term))points+=term==='linho'?8:15;
  }
  if(!terms.length&&x.category==='produto')points+=3;
  if(terms.length&&points===0)return -1000;
  if(x.category==='modelo_confeccao'&&!/prega|wave|confecc|modelo/.test(input))points-=5;
  return points;
 };
 const sorted=eligible.map(x=>({x,score:score(x)})).filter(a=>a.score>=0)
   .sort((a,b)=>b.score-a.score||String(a.x.title).localeCompare(String(b.x.title),'pt-BR'));
 const seen=new Set();
 return sorted.filter(({x})=>{const k=normalize(x.model);if(seen.has(k))return false;seen.add(k);return true;})
   .slice(0,2).map(({x})=>({id:x.id,model:x.model,title:x.title,storage_path:x.storage_path,product:x.product}));
}
