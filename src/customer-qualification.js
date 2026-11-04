// Qualificação mínima para atendimento comercial por WhatsApp.
// Não presume identidade a partir do nome do perfil do WhatsApp.
const customerClean = value => String(value || '').replace(/\s+/g,' ').trim();
const customerLetters = /^[\p{L}][\p{L}'-]{1,39}$/u;
const customerLabels = /^(?:oi|ol[aá]|bom dia|boa tarde|boa noite|sim|n[aã]o|quero|preciso|cortina|persiana|or[cç]amento|obrigad[oa]|teste)$/iu;
const customerProper = value => customerLetters.test(value) && !customerLabels.test(value);
const withName = raw => {
  const words = customerClean(raw).split(' ').filter(Boolean);
  if (words.length<1 || words.length>4 || !words.every(customerProper)) return null;
  return { firstName:words[0],...(words.length>1?{lastName:words.slice(1).join(' ')}:{}) };
};
export function blankQualification(){return {firstName:'',lastName:'',neighborhood:'',city:''};}
export function mergeQualification(current, incoming){
  const out={...blankQualification(),...(current||{})};
  for(const key of ['firstName','lastName','neighborhood','city']){
    if(typeof incoming?.[key]==='string' && customerClean(incoming[key]))out[key]=customerClean(incoming[key]).slice(0,80);
  }
  return out;
}
export function evaluateCustomerQualification(profile){
  const p=mergeQualification(null,profile);
  return {qualified:Boolean(p.firstName&&p.lastName&&p.neighborhood&&p.city),
    missing:['firstName','lastName','neighborhood','city'].filter(key=>!p[key])};
}
export function extractQualification(message,{expectingFirstName=false,expectingLastName=false,expectingNeighborhood=false,expectingCity=false}={}){
  const text=customerClean(message).replace(/[.!?]+$/,'');
  const result={};
  if(!text || text.length>200)return result;
  const explicit=text.match(/(?:me chamo|meu nome (?:é|e)|pode me chamar de|sou(?: a| o)?)[\s:]+([\p{L}'-]+(?:\s+[\p{L}'-]+){0,3})/iu);
  if(explicit) Object.assign(result,withName(explicit[1])||{});
  else if(expectingFirstName){
    const candidate=text.match(/^(?:é |e |me chamo |sou )?([\p{L}'-]+(?:\s+[\p{L}'-]+){0,2})$/iu);
    if(candidate)Object.assign(result,withName(candidate[1])||{});
  }else if(expectingLastName){
    const name=withName(text);
    if(name)result.lastName=customerClean(text);
  }
  const bairro=text.match(/(?:bairro|no bairro|moro no|moro na)\s+([\p{L}0-9 .'-]{2,60}?)(?=\s*(?:[,;]|\s+(?:e\s+)?(?:cidade|em\s+|munic[ií]pio))|$)/iu);
  const cidade=text.match(/(?:cidade(?:\s+de)?|munic[ií]pio(?:\s+de)?|moro em\s+|fica em\s+)([\p{L} .'-]{2,60})(?:$|[,;])/iu);
  if(bairro)result.neighborhood=customerClean(bairro[1]);
  else if(expectingNeighborhood && /^[\p{L}][\p{L}0-9 .'-]{1,59}$/u.test(text))result.neighborhood=text;
  if(cidade)result.city=customerClean(cidade[1]);
  else if(expectingCity && /^[\p{L}][\p{L} .'-]{1,59}$/u.test(text))result.city=text;
  return result;
}
export function qualificationQuestion(profile,{initial=false}={}){
  const p=mergeQualification(null,profile);
  if(!p.firstName)return initial?'Olá! Sou a Kiara, assistente digital da Fábrika Kriativa. 😊 Como posso te chamar?':'Como posso te chamar?';
  if(!p.lastName)return 'Obrigada! E qual é seu sobrenome?';
  if(!p.neighborhood)return 'Em qual bairro será o atendimento?';
  if(!p.city)return 'E em qual cidade fica esse bairro?';
  return null;
}
export function containsCommercialPrice(text){
  return /R\$\s*\d|(?:a partir de|valor estimado|preço estimado)\s*[:\-]?\s*\d/iu.test(String(text||''));
}
