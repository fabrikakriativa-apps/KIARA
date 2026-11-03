// Curadoria de imagens: retorno de metadados internos, SEM enviar mídia.
// Uma comparação só apresenta no máximo 2 imagens e exige pedido contextual.
const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const models=['prega macho','prega franzida','wave'];
export function selectCurtainFinishReferences({requested=false,modelsRequested=[],references=[]}={}){
 if(!requested||!Array.isArray(modelsRequested)||!Array.isArray(references))return [];
 const allowed=[...new Set(modelsRequested.map(normalize))].filter(x=>models.includes(x)).slice(0,2);
 if(!allowed.length)return [];
 const picked=[];
 for(const model of allowed){
  const reference=references.find(ref=>ref?.active===true&&ref?.product==='cortina'&&normalize(ref.model)===model&&
   typeof ref.storage_path==='string'&&ref.storage_path.length>0);
  if(reference)picked.push({id:reference.id,model:reference.model,title:reference.title,storage_path:reference.storage_path});
 }
 return picked;
}
