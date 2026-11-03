import {selectCurtainFinishReferences} from './reference-selection.js';
export function requestedFinishImages(text){
 const s=String(text||'').toLowerCase();
 if(!/(foto|imagem|mostr|ver |compar|diferen)/.test(s))return [];
 const found=[];
 for(const [word,model] of [['prega macho','Prega macho'],['prega franzida','Prega franzida'],['wave','Wave']]){
  const pos=s.indexOf(word);if(pos>=0)found.push({pos,model});
 }
 return found.sort((a,b)=>a.pos-b.pos).slice(0,2).map(x=>x.model);
}
export function chooseFinishImages(text,rows){
 return selectCurtainFinishReferences({requested:true,modelsRequested:requestedFinishImages(text),references:rows});
}
