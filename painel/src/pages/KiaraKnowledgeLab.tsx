import {useEffect,useState} from 'react'
import {BrainCircuit,CalendarClock,CheckCircle2,Clock3,MessageSquareText,RefreshCcw,ShieldCheck,XCircle} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useAccess} from '../components/AuthorizedAccess'
import './KiaraKnowledgeLab.css'

type Run={id:string;kind:'manual'|'daily';topic:string;status:string;created_at:string;result:{commercial?:string;technical?:string;curator?:string}|null;error_message:string|null;input_tokens:number;output_tokens:number}
type Proposal={id:string;run_id:string;title:string;proposed_instruction:string;rationale:string|null;status:string;created_at:string}
type Settings={daily_enabled:boolean;daily_hour_brt:number;max_conversations_per_run:number;max_runs_per_day:number}
const defaults:Settings={daily_enabled:false,daily_hour_brt:8,max_conversations_per_run:20,max_runs_per_day:3}
const date=(v:string)=>new Date(v).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})
export function KiaraKnowledgeLab(){
 const access=useAccess()
 const [runs,setRuns]=useState<Run[]>([])
 const [proposals,setProposals]=useState<Proposal[]>([])
 const [settings,setSettings]=useState<Settings>(defaults)
 const [topic,setTopic]=useState('')
 const [selected,setSelected]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [reload,setReload]=useState(0)
 useEffect(()=>{
  if(!supabase||!access)return
  let alive=true
  const client=supabase
  void Promise.all([
   client.from('kiara_lab_runs').select('id,kind,topic,status,created_at,result,error_message,input_tokens,output_tokens').eq('organization_id',access.organizationId).order('created_at',{ascending:false}).limit(50),
   client.from('kiara_lab_proposals').select('id,run_id,title,proposed_instruction,rationale,status,created_at').eq('organization_id',access.organizationId).order('created_at',{ascending:false}).limit(100),
   client.from('kiara_lab_settings').select('daily_enabled,daily_hour_brt,max_conversations_per_run,max_runs_per_day').eq('organization_id',access.organizationId).maybeSingle()
  ]).then(([a,b,c])=>{
   if(!alive)return
   if(a.error||b.error||c.error){setError('Não foi possível consultar todo o laboratório.');return}
   const fetched=(a.data||[]) as Run[]
   setRuns(fetched);setProposals((b.data||[]) as Proposal[])
   if(c.data)setSettings(c.data as Settings)
   setSelected(old=>old&&fetched.some(x=>x.id===old)?old:(fetched[0]?.id||''))
  })
  return()=>{alive=false}
 },[access?.organizationId,reload])
 async function createDiscussion(event:React.FormEvent){
  event.preventDefault()
  if(!access||!supabase||busy||topic.trim().length<10)return
  setBusy(true);setError('');setNotice('')
  if(!window.confirm('Iniciar o debate com os especialistas agora? A análise utiliza a API de IA e pode gerar custo por tokens.')){setBusy(false);return}
  const {data:created,error:e}=await supabase.from('kiara_lab_runs').insert({
   organization_id:access.organizationId,
   kind:'manual',topic:topic.trim(),created_by:access.userId,status:'queued'
  }).select('id').single()
  if(e||!created){setBusy(false);setError(e?.message||'Não foi possível registrar a discussão.');return}
  setTopic('')
  setSelected(created.id)
  setNotice('Discussão registrada. Executando os pareceres comercial, técnico e de curadoria…')
  setReload(n=>n+1)
  const {data:answer,error:callError}=await supabase.functions.invoke('kiara-lab-run',{body:{run_id:created.id}})
  setBusy(false)
  if(callError||answer?.error){
   setError(String(answer?.error||callError?.message||'Falha ao iniciar análise.'))
   setNotice('Discussão salva. Se ainda estiver na fila, use “Executar debate” na lista abaixo.')
  }else{setNotice('Análise concluída. Confira o parecer dos especialistas e a sugestão de conhecimento.')}
  setReload(n=>n+1)
 }
 async function saveSettings(){
  if(!supabase||!access||access.role!=='admin'||busy)return
  setBusy(true);setError('');setNotice('')
  const {error:e}=await supabase.from('kiara_lab_settings').upsert({
   organization_id:access.organizationId,...settings,updated_at:new Date().toISOString()
  })
  setBusy(false)
  if(e)setError(e.message)
  else setNotice('Preferências da análise diária salvas com sucesso.')
 }
 async function executeRun(run:Run){
  if(!supabase||!access||busy||run.status!=='queued'||run.kind!=='manual')return
  if(!window.confirm('Executar três análises por IA? Esta operação poderá consumir tokens pagos quando a credencial do modelo estiver configurada.'))return
  setBusy(true);setError('');setNotice('Consultando os especialistas…')
  const {data,error:e}=await supabase.functions.invoke('kiara-lab-run',{body:{run_id:run.id}})
  setBusy(false)
  if(e||data?.error){
   setError(String(data?.error||e?.message||'Não foi possível executar a discussão.'))
   setNotice('')
  }else{setNotice('Discussão concluída. Consulte os pareceres e revise as sugestões.')}
  setReload(n=>n+1)
 }
  async function review(p:Proposal,status:'approved'|'rejected'){
  if(!supabase||!access||access.role!=='admin'||busy)return
  setBusy(true);setError('');setNotice('')
  const {data,error:e}=await supabase.rpc('kiara_lab_review_proposal',{p_id:p.id,p_status:status})
  setBusy(false)
  if(e||!data)setError(e?.message||'Não foi possível concluir a revisão.')
  else{setNotice(status==='approved'?'Sugestão aprovada e registrada. A publicação na base operacional requer etapa separada.':'Sugestão rejeitada.');setReload(n=>n+1)}
 }
 const active=runs.find(x=>x.id===selected)
 return <section className="kiara-lab">
  <header className="kiara-lab-title"><BrainCircuit size={24}/><div><h2>Laboratório de Conhecimento</h2><p>Kiara, especialista comercial, especialista técnico e curadoria. Toda nova regra exige sua aprovação.</p></div><button type="button" aria-label="Atualizar laboratório" onClick={()=>setReload(n=>n+1)}><RefreshCcw size={17}/></button></header>
  <div className="kiara-lab-grid">
   <form className="kiara-lab-panel" onSubmit={e=>void createDiscussion(e)}>
    <h3><MessageSquareText size={18}/> Iniciar discussão manual</h3>
    <p>Apresente uma dúvida, situação de atendimento, objeção ou produto para avaliação conjunta.</p>
    <textarea required minLength={10} maxLength={1500} value={topic} onChange={e=>setTopic(e.target.value)} rows={4} placeholder="Ex.: Como a Kiara deve orientar um cliente que procura persiana para cozinha com privacidade, mas sem escurecer o ambiente?"/>
    <button type="submit" disabled={busy||topic.trim().length<10}>{busy?'Analisando…':'Iniciar debate com especialistas'}</button>
    <small>O tema será registrado e analisado pelos três especialistas. Os pareceres ficarão disponíveis abaixo; nenhuma orientação será publicada sem aprovação.</small>
   </form>
   <section className="kiara-lab-panel">
    <h3><CalendarClock size={18}/> Análise diária</h3>
    <p>Revisão em lotes das conversas recentes, com limite de volume e sugestões para aprovação.</p>
    <label className="kiara-lab-checkbox"><input type="checkbox" checked={settings.daily_enabled} disabled={access?.role!=='admin'} onChange={e=>setSettings(x=>({...x,daily_enabled:e.target.checked}))}/> Solicitar análise todos os dias</label>
    <label>Horário (Brasília)<select value={settings.daily_hour_brt} disabled={access?.role!=='admin'} onChange={e=>setSettings(x=>({...x,daily_hour_brt:Number(e.target.value)}))}>{[6,7,8,9,10,12,18,20].map(h=><option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}</select></label>
    <label>Conversas por análise<select value={settings.max_conversations_per_run} disabled={access?.role!=='admin'} onChange={e=>setSettings(x=>({...x,max_conversations_per_run:Number(e.target.value)}))}>{[5,10,20,30,40].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
    <button type="button" disabled={busy||access?.role!=='admin'} onClick={()=>void saveSettings()}>Salvar preferências</button>
    <small><ShieldCheck size={14}/> Agendador diário conectado e protegido. Para executar, a chave OPENAI_API_KEY precisa estar salva nas Edge Function Secrets do Supabase. Nenhum orçamento é enviado automaticamente.</small>
   </section>
  </div>
  {error&&<p className="kiara-lab-error" role="alert">{error}</p>}
  {notice&&<p className="kiara-lab-notice" role="status">{notice}</p>}
  <div className="kiara-lab-history">
   <section className="kiara-lab-panel">
    <h3>Discussões e análises</h3>
    {runs.length===0?<p>Nenhuma discussão registrada.</p>:<div className="kiara-lab-run-list">{runs.map(r=><div key={r.id} className={'kiara-lab-run-entry'+(selected===r.id?' active':'')}>
     <button type="button" className="kiara-lab-run-select" onClick={()=>setSelected(r.id)}>
      <strong>{r.topic}</strong>
      <span>{r.kind==='manual'?'Manual':'Diária'} · {date(r.created_at)} · {r.status==='completed'?'Concluída':r.status==='running'?'Analisando':r.status==='failed'?'Falhou':'Na fila'}</span>
     </button>
     {r.kind==='manual'&&r.status==='queued'&&<button type="button" className="kiara-lab-run-start" disabled={busy} onClick={()=>{setSelected(r.id);void executeRun(r)}}>Executar debate</button>}
    </div>)}</div>}
   </section>
   <section className="kiara-lab-panel">
    <h3>Resultado da discussão</h3>
    {!active?<p>Selecione uma análise para consultar as conclusões.</p>:<>
     <p><strong>{active.topic}</strong></p>
     {active.status==='queued'&&active.kind==='manual'&&<button type="button" disabled={busy} onClick={()=>void executeRun(active)}>Executar debate com especialistas</button>}
     <small><Clock3 size={13}/> {date(active.created_at)} · {active.status} · {active.input_tokens+active.output_tokens} tokens registrados</small>
     {active.error_message&&<p className="kiara-lab-error">{active.error_message}</p>}
     {active.result?.commercial&&<article><strong>Agente Comercial</strong><p>{active.result.commercial}</p></article>}
     {active.result?.technical&&<article><strong>Agente Técnico</strong><p>{active.result.technical}</p></article>}
     {active.result?.curator&&<article><strong>Curadoria</strong><p>{active.result.curator}</p></article>}
     {!active.result&&<p>Sem conclusão registrada. Discussões pendentes não geram regras automaticamente.</p>}
    </>}
   </section>
  </div>
  <section className="kiara-lab-panel"><h3>Conhecimentos propostos para aprovação</h3>
   {proposals.length===0?<p>Ainda não existem sugestões geradas pelos agentes.</p>:proposals.map(p=><article className="kiara-lab-proposal" key={p.id}>
    <strong>{p.title}</strong><span>{p.status==='pending_review'?'Aguardando aprovação':p.status==='approved'?'Aprovada':'Rejeitada'}</span>
    <p>{p.proposed_instruction}</p>{p.rationale&&<small>{p.rationale}</small>}
    {p.status==='pending_review'&&access?.role==='admin'&&<div>
     <button type="button" disabled={busy} onClick={()=>void review(p,'approved')}><CheckCircle2 size={15}/> Aprovar</button>
     <button type="button" disabled={busy} onClick={()=>void review(p,'rejected')}><XCircle size={15}/> Rejeitar</button>
    </div>}
   </article>)}
  </section>
 </section>
}
