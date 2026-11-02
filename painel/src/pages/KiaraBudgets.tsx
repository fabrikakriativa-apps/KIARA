import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {useAccess} from '../components/AuthorizedAccess'
import type {Period} from './KiaraOverview'
import {KiaraBudgetDraftForm} from './KiaraBudgetDraftForm'

type Draft={id:string;conversation_id:string;structured_budget:Record<string,unknown>;customer_message:string;status:string;created_at:string;review_note:string|null;sent_at:string|null}
export function KiaraBudgets({initialFilter='all',reportPeriod=null}:{initialFilter?:'all'|'pending_review'|'sent';reportPeriod?:Period|null}){
 const access=useAccess(),[filter,setFilter]=useState<'all'|'pending_review'|'sent'>(initialFilter),[drafts,setDrafts]=useState<Draft[]>([]),[mode,setMode]=useState('manual'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[note,setNote]=useState<Record<string,string>>({})
 useEffect(()=>{if(!supabase||!access)return;let live=true;const client=supabase;void (async()=>{
  const [settings,queue]=await Promise.all([
   client.from('kiara_budget_settings').select('approval_mode').eq('organization_id',access.organizationId).maybeSingle(),
   (filter==='sent'?client.from('kiara_budget_drafts').select('id,conversation_id,structured_budget,customer_message,status,created_at,review_note,sent_at').eq('organization_id',access.organizationId).eq('status','sent').gte('sent_at',reportPeriod?.start||'1970-01-01T00:00:00Z').lt('sent_at',reportPeriod?.end||'9999-01-01T00:00:00Z').order('sent_at',{ascending:false}).limit(200):client.from('kiara_budget_drafts').select('id,conversation_id,structured_budget,customer_message,status,created_at,review_note,sent_at').eq('organization_id',access.organizationId).order('created_at',{ascending:false}).limit(200))
  ])
  if(!live)return
  if(settings.error||queue.error){setError('Não foi possível carregar as configurações ou a fila.');return}
  setMode(settings.data?.approval_mode||'manual');setDrafts((queue.data||[]) as Draft[]);setError('')
 })();return()=>{live=false}},[access?.organizationId,refresh,filter,reportPeriod?.start,reportPeriod?.end])
 async function review(id:string,decision:'approved'|'rejected'){
  if(!supabase||access?.role!=='admin'||busy)return
  if(!window.confirm(decision==='approved'?'Aprovar este orçamento? Isso NÃO o envia automaticamente ao cliente.':'Rejeitar este orçamento para correção?'))return
  setBusy(true);setError('')
  const {error:e}=await supabase.rpc('kiara_review_budget',{p_draft_id:id,p_decision:decision,p_note:note[id]||null})
  setBusy(false);if(e)setError(e.message);else setRefresh(n=>n+1)
 }
 async function setApprovalMode(value:'manual'|'automatic'){
  if(!supabase||access?.role!=='admin'||busy)return
  if(value==='automatic'){setError('Envio automático ainda bloqueado: exige validação do Worker e dos testes de homologação.');return}
  setBusy(true)
  const {error:e}=await supabase.from('kiara_budget_settings').upsert({organization_id:access.organizationId,approval_mode:'manual',updated_by:access.userId,updated_at:new Date().toISOString()},{onConflict:'organization_id'})
  setBusy(false);if(e)setError(e.message);else{setMode('manual');setRefresh(n=>n+1)}
 }
 return <section className="kiara-management"><h1>Orçamentos para aprovação</h1><p>Todo orçamento estruturado precisa ser conferido antes do envio. Aprovar a proposta não dispara mensagens no WhatsApp nesta etapa de homologação.</p>
 <div className="kiara-management-card"><h2>Modo de envio</h2><label><input type="radio" checked={mode==='manual'} onChange={()=>void setApprovalMode('manual')}/> Exigir minha aprovação</label><label><input type="radio" checked={mode==='automatic'} disabled onChange={()=>{}}/> Envio automático (disponível após homologação)</label><small>O servidor precisa aplicar esse bloqueio antes da ativação em produção. Nenhum envio automático foi liberado por esta tela.</small></div>
 <KiaraBudgetDraftForm onCreated={()=>{setFilter('pending_review');setRefresh(n=>n+1)}}/>
 <h2>Fila de revisão</h2><label>Exibir <select aria-label="Filtrar orçamentos" value={filter} onChange={e=>setFilter(e.target.value as 'all'|'pending_review'|'sent')}><option value="pending_review">Aguardando aprovação</option><option value="sent">Enviados ao cliente</option><option value="all">Todos os orçamentos</option></select></label>{error&&<p role="alert">{error}</p>}<button onClick={()=>setRefresh(n=>n+1)}>Atualizar fila</button>
 {drafts.filter(d=>(filter==='all'||d.status===filter)&&(filter!=='sent'||!reportPeriod||(d.sent_at!==null&&d.sent_at>=reportPeriod.start&&d.sent_at<reportPeriod.end))).length===0?<p>{filter==='pending_review'?'Nenhum orçamento aguardando aprovação.':filter==='sent'?'Nenhum orçamento enviado registrado neste período.':'Nenhum orçamento estruturado registrado na fila ainda.'}</p>:drafts.filter(d=>(filter==='all'||d.status===filter)&&(filter!=='sent'||!reportPeriod||(d.sent_at!==null&&d.sent_at>=reportPeriod.start&&d.sent_at<reportPeriod.end))).map(d=><article className="kiara-management-card" key={d.id}><strong>{d.status==='pending_review'?'Aguardando aprovação':d.status}</strong><small>{new Date(d.created_at).toLocaleString('pt-BR')}</small><p><strong>Mensagem proposta ao cliente</strong></p><p style={{whiteSpace:'pre-wrap'}}>{d.customer_message||'Mensagem não preenchida'}</p><details><summary>Dados estruturados</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(d.structured_budget,null,2)}</pre></details>
 {d.status==='pending_review'&&access?.role==='admin'&&<><label>Observação ou motivo da correção<textarea value={note[d.id]||''} onChange={e=>setNote(n=>({...n,[d.id]:e.target.value}))} maxLength={1000}/></label><div className="kiara-management-actions"><button disabled={busy} onClick={()=>void review(d.id,'approved')}>Aprovar orçamento</button><button disabled={busy} onClick={()=>void review(d.id,'rejected')}>Rejeitar para correção</button></div></>}</article>)}
 </section>
}
