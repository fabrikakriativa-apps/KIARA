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
