// A IA interpreta a fala livremente; o sistema verifica a origem da evidência.
// "referência" é uma hipótese comercial para estimativa, nunca escolha do cliente.
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const evidenceInUser=(quote,history)=>{
 const phrase=normalize(quote);
 return phrase.length>=3&&Array.isArray(history)&&history.some(m=>m?.role==='user'&&normalize(m.content).includes(phrase));
};
const safeDescription=s=>typeof s==='string'&&s.trim().length>=3&&s.trim().length<=100&&
 !/preço médio|categoria comercial|markup|custo por m²|morea\s*\/\s*fresh|\betc\b/i.test(s);
export function assessCategoryEvidence(row,userHistory){
 const result={ready:true,errors:[],basis:{}};
 for(const [key,category] of [['front','frontCategory'],['back','backCategory']]){
  if(key==='back'&&row.backCategory==='Sem forro')continue;
  const basis=row[key+'Basis'],evidence=row[key+'Evidence'],label=row[key+'Description'];
  if(!['selected','reference'].includes(basis)){
   result.errors.push(key+': falta distinguir escolha de referência comercial');continue;
  }
  if(!evidenceInUser(evidence,userHistory)){
   result.errors.push(key+': informação não localizada na fala do cliente');continue;
  }
  if(!safeDescription(label)){
   result.errors.push(key+': descrição comercial ausente ou técnica');continue;
  }
  result.basis[key]={kind:basis,description:label.trim(),evidence:evidence.trim(),category:row[category]};
 }
 result.ready=result.errors.length===0;
 return result;
}
export function commercialDescription(reference,fallback=''){
 if(reference?.kind==='reference'){
  return reference.description+' (referência para estimativa)';
 }
 return reference?.description||fallback;
}
