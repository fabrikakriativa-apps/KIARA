// A IA identifica informações espontaneamente; o código valida evidências,
// sem tentar compreender frases usando expressões regulares de nomes/bairros.
// Somente textos do cliente são fontes válidas para dados pessoais.
const KEYS=['firstName','lastName','neighborhood','city'];
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
const clean=s=>typeof s==='string'?s.trim().replace(/\s+/g,' ').slice(0,90):'';
export function validateExtractedQualification(candidate,history=[],current={}){
 const fields={};
 const customer=history.filter(m=>m.role==='user').map(m=>String(m.content||''));
 const existing={...current};
 if(!candidate || typeof candidate!=='object')return fields;
 for(const key of KEYS){
  if(clean(existing[key]))continue;
  const item=candidate[key];
  const value=clean(item?.value);
  const evidence=clean(item?.evidence);
  if(!value || !evidence || value.length<2 || value.length>80)continue;
  // Exige prova textual. A IA pode interpretar o contexto, mas não inventar dados.
  if(!customer.some(t=>norm(t).includes(norm(evidence))))continue;
  if(!norm(evidence).includes(norm(value)))continue;
  if(/[\d@<>]/.test(value))continue;
  fields[key]=value;
 }
 return fields;
}
export function qualificationExtractionInstructions(){
 return [
  'Você extrai dados fornecidos pelo CLIENTE em uma conversa de WhatsApp.',
  'Interprete livremente a linguagem natural e o contexto das perguntas anteriores.',
  'Extraia primeiro nome, sobrenome, bairro e cidade da instalação, se explicitamente informados.',
  'Uma resposta curta como "Ana" após "Como posso te chamar?" é o primeiro nome.',
  'Se disser todos os dados em uma frase, identifique todos, sem exigir ordem.',
  'Não deduza sobrenome a partir do perfil, cidade pelo DDD, ou dados do endereço da loja.',
  'Não confunda ambiente, tecido, modelo ou marca com nome, bairro ou cidade.',
  'Se uma informação estiver ausente ou ambígua, retorne valor e evidência vazios.',
  'O campo evidence deve ser um trecho exato de uma mensagem do CLIENTE, não do assistente.',
  'Responda somente JSON válido com firstName,lastName,neighborhood,city,',
  'cada um como objeto {"value":"...","evidence":"..."}; sem comentários.'
 ].join('\n');
}
