import { useEffect, useState } from 'react'
import { BookOpen, Check, CircleHelp, Lightbulb, MessageSquareText, ShieldCheck, Sparkles, X, Search, Pencil, PowerOff, RotateCcw, ChevronDown } from 'lucide-react'
import { useAccess } from '../components/AuthorizedAccess'
import type { KiaraMessage } from '../lib/kiaraMetrics'
import { supabase } from '../lib/supabase'

type Guidance = {
 id:string; instruction:string; scope:'global'|'conversation'; kind:'instruction'|'correction';
 status:'recorded'|'pending_review'|'approved'|'archived'; created_at:string; message_id:string|null; created_by:string
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
 const [search,setSearch]=useState('')
 const [statusFilter,setStatusFilter]=useState('all')
 const [expanded,setExpanded]=useState<string|null>(null)
 const [editing,setEditing]=useState<string|null>(null)
 const [editText,setEditText]=useState('')
 const [visibleCount,setVisibleCount]=useState(15)
 const canRead=Boolean(supabase && access && ['admin','comercial'].includes(access.role))
 useEffect(()=>{
  if(!canRead || !access || !supabase) return
  let cancelled=false
  void (async()=>{
   const {data,error}=await supabase.from('kiara_guidance')
    .select('id,instruction,scope,kind,status,created_at,message_id,created_by')
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
  if(!globalOnly && scope==='conversation' && !conversationId){setFeedback('Selecione uma conversa.');return}
  setBusy(true);setFeedback('')
  const {error}=globalOnly&&access.role==='admin'
    ?await supabase.rpc('kiara_manage_global_guidance',{
      p_organization_id:access.organizationId,p_action:'create',p_instruction:instruction
     })
    :await supabase.from('kiara_guidance').insert({
      organization_id:access.organizationId,
      conversation_id:!globalOnly&&scope==='conversation'?conversationId:null,
      message_id:!globalOnly&&scope==='conversation' && selectedMessage?.sender==='kiara'?selectedMessage.id:null,
      scope:globalOnly?'global':scope,kind:!globalOnly&&selectedMessage?'correction':'instruction',
      instruction,status:globalOnly||scope==='global'?'pending_review':'recorded',
      created_by:access.userId
     })
  if(error)setFeedback('Não foi possível salvar. Verifique suas permissões e tente novamente.')
  else {
   setText('');clearSelectedMessage();setRefresh(n=>n+1)
   setFeedback(globalOnly&&access.role==='admin'?'Orientação aprovada e salva. Ficará disponível quando a leitura operacional estiver habilitada.':globalOnly||scope==='global'?'Orientação enviada para revisão.':'Orientação registrada. A aplicação automática ainda não está habilitada.')
  }
  setBusy(false)
 }
 async function manageGuidance(action:'edit'|'archive'|'restore',g:Guidance){
  if(!supabase||!access||access.role!=='admin'||busy)return
  if(action==='edit' && editText.trim().length<5){setFeedback('Escreva pelo menos 5 caracteres.');return}
  if(action==='archive'&&!window.confirm('Desativar esta orientação? Ela deixará de integrar as regras aprovadas.'))return
  setBusy(true);setFeedback('')
  const {error}=await supabase.rpc('kiara_manage_global_guidance',{
   p_organization_id:access.organizationId,p_action:action,
   p_guidance_id:g.id,p_instruction:action==='edit'?editText.trim():null
  })
  setBusy(false)
  if(error)setFeedback(error.message)
  else{setFeedback(action==='edit'?'Alteração salva.':action==='archive'?'Orientação desativada.':'Orientação reativada.');setEditing(null);setRefresh(n=>n+1)}
 }
 const filteredGuidance=saved.filter(g=>g.scope==='global')
  .filter(g=>statusFilter==='all'||g.status===statusFilter)
  .filter(g=>g.instruction.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR').trim()))
 async function review(id:string,decision:'approve'|'archive'){
  if(!supabase || !access || access.role!=='admin' || busy) return
  setBusy(true);setFeedback('')
  const {error}=await supabase.rpc('kiara_review_guidance',{org_id:access.organizationId,guidance_id:id,decision})
  if(error)setFeedback('Não foi possível revisar o aprendizado.')
  else {setFeedback(decision==='approve'?'Aprendizado aprovado na biblioteca; aplicação na IA ainda pendente.':'Sugestão arquivada.');setRefresh(n=>n+1)}
  setBusy(false)
 }
 return <section className="kiara-coaching" aria-label="Orientações da Kiara">
  <div className="kiara-coach-heading"><div><h3><Sparkles size={18}/> {globalOnly?'Orientações gerais da Kiara':'Orientar Kiara'}</h3><p>{globalOnly?'Registre orientações gerais, consulte e atualize sua base de conhecimento.':'Notas internas para conduzir melhor os atendimentos.'}</p></div><span>Privado</span></div>
  <div className="kiara-coach-tabs" role="tablist">
   <button type="button" role="tab" aria-selected={tab==='guide'} className={tab==='guide'?'active':''} onClick={()=>setTab('guide')}><MessageSquareText size={15}/> Orientar</button>
   <button type="button" role="tab" aria-selected={tab==='library'} className={tab==='library'?'active':''} onClick={()=>setTab('library')}><BookOpen size={15}/> {globalOnly?'Base de conhecimento':'Aprendizados'} <span>{saved.filter(x=>x.scope==='global'&&x.status==='pending_review').length}</span></button>
  </div>
  {tab==='guide'? <div className="kiara-coach-form">
   {selectedMessage && <div className="kiara-coach-reference"><span><Lightbulb size={14}/> Corrigindo resposta da Kiara</span><p>{selectedMessage.text.slice(0,200)}{selectedMessage.text.length>200?'…':''}</p><button type="button" onClick={clearSelectedMessage} aria-label="Remover seleção"><X size={16}/></button></div>}
   <label htmlFor="kiara-coach-text">{globalOnly?'Qual regra geral você deseja propor?':selectedMessage?'Como ela deveria ter respondido?':'O que você deseja orientar?'}</label>
   <textarea id="kiara-coach-text" placeholder={globalOnly?'Ex.: ao falar de persianas, pergunte se o objetivo é privacidade, controle de luz ou ambos.':selectedMessage?'Explique o que corrigir na resposta selecionada…':'Ex.: neste atendimento, destaque a diferença entre privacidade e bloqueio de luz.'} value={text} onChange={e=>setText(e.target.value)} maxLength={2000} rows={3}/>
   {!globalOnly&&<div className="kiara-coach-scopes">
    <label><input type="radio" name="kiara-guidance-scope" checked={scope==='conversation'} disabled={!conversationId} onChange={()=>setScope('conversation')}/> Nesta conversa</label>
    <label><input type="radio" name="kiara-guidance-scope" checked={scope==='global'} onChange={()=>setScope('global')}/> Sugerir regra geral</label>
   </div>}
   <p className="kiara-coach-helper"><CircleHelp size={14}/>{globalOnly?'Suas orientações são aprovadas ao salvar. Outras sugestões continuam sujeitas à revisão. A leitura pelo Worker exige ativação operacional.':scope==='global'?'Regras gerais sugeridas exigem aprovação antes do uso.':'Esta nota fica vinculada à conversa e não é enviada ao cliente. A aplicação automática ainda está em desenvolvimento.'}</p>
   <button type="button" className="kiara-coach-submit" onClick={()=>void save()} disabled={busy||!canRead||!text.trim()||(!globalOnly&&scope==='conversation'&&!conversationId)}>{busy?'Salvando…':globalOnly&&access?.role==='admin'?'Salvar orientação':globalOnly||scope==='global'?'Enviar para revisão':'Registrar orientação'}</button>
   {!globalOnly&&saved.filter(g=>g.scope==='conversation'&&g.status==='recorded').length>0 && <div className="kiara-coach-saved"><strong>Orientações desta conversa</strong>{saved.filter(g=>g.scope==='conversation'&&g.status==='recorded').slice(0,5).map(g=><div key={g.id}><span>Registrada</span>{g.instruction}</div>)}</div>}
  </div>:<div className="kiara-coach-library">
    <div className="kiara-knowledge-tools">
     <label className="kiara-knowledge-search"><Search size={16}/><input type="search" value={search} onChange={e=>{setSearch(e.target.value);setVisibleCount(15)}} placeholder="Buscar por palavras da orientação…" aria-label="Buscar na base de conhecimento"/></label>
     <select aria-label="Filtrar orientações por situação" value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setVisibleCount(15)}}>
      <option value="all">Todas</option><option value="approved">Ativas</option><option value="pending_review">Em revisão</option><option value="archived">Desativadas</option>
     </select>
    </div>
    <p className="kiara-knowledge-results">{filteredGuidance.length} orientação{filteredGuidance.length===1?'':'ões'} encontrada{filteredGuidance.length===1?'':'s'} · {saved.filter(g=>g.scope==='global'&&g.status==='approved').length} ativa(s)</p>
    {filteredGuidance.length===0?<div className="kiara-coach-no-items">Nenhuma orientação encontrada.</div>:
     filteredGuidance.slice(0,visibleCount).map(g=><article className="kiara-knowledge-entry" key={g.id}>
      <button className="kiara-knowledge-entry-heading" type="button" aria-expanded={expanded===g.id} onClick={()=>setExpanded(v=>v===g.id?null:g.id)}>
       <span className={'kiara-coach-state '+g.status}>{g.status==='approved'?'Ativa':g.status==='pending_review'?'Aguardando aprovação':'Desativada'}</span>
       <span className="kiara-knowledge-preview">{g.instruction}</span>
       <small>{new Date(g.created_at).toLocaleDateString('pt-BR')}</small><ChevronDown size={16}/>
      </button>
      {expanded===g.id&&<div className="kiara-knowledge-expanded">
       {editing===g.id?<><textarea value={editText} maxLength={2000} onChange={e=>setEditText(e.target.value)} rows={4}/><div className="kiara-coach-review">
        <button type="button" disabled={busy||editText.trim().length<5} onClick={()=>void manageGuidance('edit',g)}><Check size={14}/> Salvar alterações</button>
        <button type="button" disabled={busy} onClick={()=>setEditing(null)}>Cancelar</button>
       </div></>:<p>{g.instruction}</p>}
       {access?.role==='admin'&&editing!==g.id&&<div className="kiara-coach-review">
        {g.status==='pending_review'?<>
          <button type="button" disabled={busy} onClick={()=>void review(g.id,'approve')}><Check size={14}/> Aprovar</button>
          <button type="button" disabled={busy} onClick={()=>void review(g.id,'archive')}><X size={14}/> Arquivar</button>
         </>:<>
          <button type="button" disabled={busy} onClick={()=>{setEditing(g.id);setEditText(g.instruction)}}><Pencil size={14}/> Editar</button>
          {g.status==='approved'
           ?<button type="button" disabled={busy} onClick={()=>void manageGuidance('archive',g)}><PowerOff size={14}/> Desativar</button>
           :<button type="button" disabled={busy} onClick={()=>void manageGuidance('restore',g)}><RotateCcw size={14}/> Reativar</button>}
         </>}
       </div>}
      </div>}
     </article>)}
    {filteredGuidance.length>visibleCount&&<button className="kiara-knowledge-more" type="button" onClick={()=>setVisibleCount(n=>n+15)}>Mostrar mais {Math.min(15,filteredGuidance.length-visibleCount)}</button>}
   </div>}
  {feedback && <p className="kiara-coach-feedback" role="status">{feedback}</p>}
 </section>
}
