import { useEffect, useState } from 'react'
import { BookOpen, Check, CircleHelp, Lightbulb, MessageSquareText, ShieldCheck, Sparkles, X } from 'lucide-react'
import { useAccess } from '../components/AuthorizedAccess'
import type { KiaraMessage } from '../lib/kiaraMetrics'
import { supabase } from '../lib/supabase'

type Guidance = {
 id:string; instruction:string; scope:'global'|'conversation'; kind:'instruction'|'correction';
 status:'recorded'|'pending_review'|'approved'|'archived'; created_at:string; message_id:string|null
}
type Props = { conversationId:string|null; selectedMessage:KiaraMessage|null; clearSelectedMessage:()=>void; globalOnly?:boolean }

export function KiaraCoaching({conversationId, selectedMessage, clearSelectedMessage, globalOnly=false}:Props) {
 const access=useAccess()
 const [tab,setTab]=useState<'guide'|'library'>('guide')
 const [text,setText]=useState('')
 const [scope,setScope]=useState<'conversation'|'global'>(globalOnly?'global':'conversation')
 const [saved,setSaved]=useState<Guidance[]>([])
 const [busy,setBusy]=useState(false)
 const [feedback,setFeedback]=useState('')
 const [refresh,setRefresh]=useState(0)
 const canRead=Boolean(supabase && access && ['admin','comercial'].includes(access.role))
 useEffect(()=>{
  if(!canRead || !access || !supabase) return
  let cancelled=false
  void (async()=>{
   const {data,error}=await supabase.from('kiara_guidance')
    .select('id,instruction,scope,kind,status,created_at,message_id')
    .eq('organization_id',access.organizationId)
    .or(conversationId?`scope.eq.global,conversation_id.eq.${conversationId}`:'scope.eq.global')
    .order('created_at',{ascending:false}).limit(100)
   if(!cancelled){if(error)setFeedback('Não foi possível carregar as orientações.');else setSaved((data??[]) as Guidance[])}
  })()
  return ()=>{cancelled=true}
 },[canRead,access?.organizationId,conversationId,refresh])
 useEffect(()=>{if(selectedMessage){setTab('guide');setScope('conversation');setText('')}} ,[selectedMessage?.id])
 async function save(){
  if(!supabase || !access || !canRead || busy) return
  const instruction=text.trim()
  if(instruction.length<5 || instruction.length>2000){setFeedback('Escreva uma orientação entre 5 e 2.000 caracteres.');return}
  if(scope==='conversation' && !conversationId){setFeedback('Selecione uma conversa.');return}
  setBusy(true);setFeedback('')
  const {error}=await supabase.from('kiara_guidance').insert({
   organization_id:access.organizationId,
   conversation_id:scope==='conversation'?conversationId:null,
   message_id:scope==='conversation' && selectedMessage?.sender==='kiara'?selectedMessage.id:null,
   scope,kind:selectedMessage?'correction':'instruction',
   instruction,status:scope==='global'?'pending_review':'recorded',
   created_by:access.userId
  })
  if(error)setFeedback('Não foi possível salvar. Verifique suas permissões e tente novamente.')
  else {
   setText('');clearSelectedMessage();setRefresh(n=>n+1)
   setFeedback(scope==='global'?'Aprendizado enviado para revisão. Ainda não é usado pela IA.':'Orientação registrada. A aplicação automática ainda não está habilitada.')
  }
  setBusy(false)
 }
 async function review(id:string,decision:'approve'|'archive'){
  if(!supabase || !access || access.role!=='admin' || busy) return
  setBusy(true);setFeedback('')
  const {error}=await supabase.rpc('kiara_review_guidance',{org_id:access.organizationId,guidance_id:id,decision})
  if(error)setFeedback('Não foi possível revisar o aprendizado.')
  else {setFeedback(decision==='approve'?'Aprendizado aprovado na biblioteca; aplicação na IA ainda pendente.':'Sugestão arquivada.');setRefresh(n=>n+1)}
  setBusy(false)
 }
 return <section className="kiara-coaching" aria-label="Orientações da Kiara">
  <div className="kiara-coach-heading"><div><h3><Sparkles size={18}/> Orientar Kiara</h3><p>Notas internas para conduzir melhor os atendimentos.</p></div><span>Privado</span></div>
  <div className="kiara-coach-tabs" role="tablist">
   <button type="button" role="tab" aria-selected={tab==='guide'} className={tab==='guide'?'active':''} onClick={()=>setTab('guide')}><MessageSquareText size={15}/> Orientar</button>
   <button type="button" role="tab" aria-selected={tab==='library'} className={tab==='library'?'active':''} onClick={()=>setTab('library')}><BookOpen size={15}/> Aprendizados <span>{saved.filter(x=>x.scope==='global'&&x.status==='pending_review').length}</span></button>
  </div>
  {tab==='guide'? <div className="kiara-coach-form">
   {selectedMessage && <div className="kiara-coach-reference"><span><Lightbulb size={14}/> Corrigindo resposta da Kiara</span><p>{selectedMessage.text.slice(0,200)}{selectedMessage.text.length>200?'…':''}</p><button type="button" onClick={clearSelectedMessage} aria-label="Remover seleção"><X size={16}/></button></div>}
   <label htmlFor="kiara-coach-text">{selectedMessage?'Como ela deveria ter respondido?':'O que você deseja orientar?'}</label>
   <textarea id="kiara-coach-text" placeholder={selectedMessage?'Explique o que corrigir na resposta selecionada…':'Ex.: neste atendimento, destaque a diferença entre privacidade e bloqueio de luz.'} value={text} onChange={e=>setText(e.target.value)} maxLength={2000} rows={3}/>
   <div className="kiara-coach-scopes">
    <label><input type="radio" name="kiara-guidance-scope" checked={scope==='conversation'} disabled={!conversationId} onChange={()=>setScope('conversation')}/> Nesta conversa</label>
    <label><input type="radio" name="kiara-guidance-scope" checked={scope==='global'} onChange={()=>setScope('global')}/> Sugerir regra geral</label>
   </div>
   <p className="kiara-coach-helper"><CircleHelp size={14}/>{scope==='global'?'Uma regra geral exige aprovação. Mesmo aprovada, só será usada depois de habilitarmos a leitura das orientações no Worker.':'Esta nota fica vinculada à conversa e não é enviada ao cliente. A aplicação automática ainda está em desenvolvimento.'}</p>
   <button type="button" className="kiara-coach-submit" onClick={()=>void save()} disabled={busy||!canRead||!text.trim()||(scope==='conversation'&&!conversationId)}>{busy?'Salvando…':scope==='global'?'Enviar para revisão':'Registrar orientação'}</button>
   {saved.filter(g=>g.scope==='conversation'&&g.status==='recorded').length>0 && <div className="kiara-coach-saved"><strong>Orientações desta conversa</strong>{saved.filter(g=>g.scope==='conversation'&&g.status==='recorded').slice(0,5).map(g=><div key={g.id}><span>Registrada</span>{g.instruction}</div>)}</div>}
  </div>:<div className="kiara-coach-library">
    <p><ShieldCheck size={14}/> Aprendizados aprovados ficam registrados, mas ainda não são consumidos pelo Worker.</p>
    {saved.filter(g=>g.scope==='global').length===0?<div className="kiara-coach-no-items">Nenhum aprendizado sugerido.</div>:
     saved.filter(g=>g.scope==='global').map(g=><article key={g.id}>
      <div><span className={`kiara-coach-state ${g.status}`}>{g.status==='approved'?'Aprovado':g.status==='pending_review'?'Aguardando aprovação':'Arquivado'}</span><small>{new Date(g.created_at).toLocaleDateString('pt-BR')}</small></div>
      <p>{g.instruction}</p>
      {g.status==='pending_review'&&access?.role==='admin'&&<div className="kiara-coach-review"><button disabled={busy} type="button" onClick={()=>void review(g.id,'approve')}><Check size={14}/> Aprovar</button><button disabled={busy} type="button" onClick={()=>void review(g.id,'archive')}><X size={14}/> Arquivar</button></div>}
     </article>)}
   </div>}
  {feedback && <p className="kiara-coach-feedback" role="status">{feedback}</p>}
 </section>
}
