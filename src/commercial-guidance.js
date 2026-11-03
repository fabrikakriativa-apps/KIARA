// Regras comerciais aprovadas para orientar a coleta; nunca expor custos ao modelo.
const clean=value=>typeof value==='string'?value.replace(/[\r\n<>]/g,' ').trim().slice(0,70):'';
export function commercialConversationRules(rows){
 const approved=Array.isArray(rows)?rows.filter(x=>x&&x.status==='approved'&&x.settings&&typeof x.settings==='object'):[];
 const sections=[];
 for(const row of approved){
  const s=row.settings;
  if(row.product==='cortina'){
   const models=Array.isArray(s.models)?s.models.map(clean).filter(Boolean).slice(0,15):[];
   const categories=Array.isArray(s.categories)?s.categories.filter(x=>x?.active!==false).map(x=>clean(x.name)).filter(Boolean).slice(0,25):[];
   if(!models.length||!categories.length)continue;
   sections.push('CORTINAS (configuração aprovada): modelos disponíveis: '+models.join(', ')+'. Categorias comerciais: '+categories.join(', ')+'. Para frente e forro, sempre tratar o forro como Franzida. A instalação é por FACE de tecido: frente + forro são duas faces. Não calcular preços nesta conversa; encaminhar orçamento para a ferramenta interna e revisão humana.');
  }
  if(row.product==='persiana'){
   const defaults=s.defaults||{};
   const t=s.technicalLimits||{};
   const model=clean(defaults.model),color=clean(defaults.color),openness=clean(defaults.openness);
   if(!model||!color||!openness)continue;
   const minimumManual=Number(t.minimumManualWidth),minimumMotor=Number(t.minimumMotorWidth);
   sections.push('PERSIANAS (configuração aprovada): primeiro identificar o AMBIENTE. Somente para SACADA/VARANDA de prédio perguntar sobre regras do condomínio para modelo, cor e instalação; para quarto, sala e outros ambientes internos, não pressupor tais restrições. Quando o cliente desconhecer as regras da SACADA, considerar provisoriamente '+model+', '+color+', abertura '+openness+' e transpassada, sujeito a confirmação. Para janela, medidas aproximadas com 10 cm de cada lado. Em montagem transpassada, 10 cm de cada lado de cada folha, sem contar margens duas vezes. Para varanda, pedir medidas separadas da frente e lateral e distinguir vidro piso-teto de vidro sobre guarda-corpo. Largura mínima manual '+(Number.isFinite(minimumManual)?minimumManual:'a confirmar')+' m e motorizada '+(Number.isFinite(minimumMotor)?minimumMotor:'a confirmar')+' m. Não inferir quantidade de folhas nem calcular preços na conversa. Pedir apenas UMA informação de cada vez.');
  }
 }
 return sections.join('\n\n');
}
