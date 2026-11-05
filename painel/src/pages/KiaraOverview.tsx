import {useEffect,useMemo,useState} from 'react'
import {Bot,Headset,UserRound,ClipboardCheck,MessageCircleMore,ChevronRight,RefreshCcw,Activity,BookOpen,PauseCircle,FileCheck2,MessageCircleOff,CalendarDays} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useAccess} from '../components/AuthorizedAccess'
import {commandKiara,kiaraControlConfigured,readKiaraControl} from '../lib/kiaraControl'
import './KiaraOverview.css'

export type KiaraSection='dashboard'|'conversations'|'leads'|'guidance'|'budgets'|'performance'|'settings'
export type ConversationStatus='all'|'ai'|'waiting_human'|'human'|'no_interaction'
export type ReportMode='started'|'ad_unanswered'|'human'
export type Period={start:string;end:string}
export type KiaraNavigation={status?:ConversationStatus;budgetFilter?:'pending_review'|'sent'|'all';conversationId?:string;reportMode?:ReportMode;period?:Period}
type Jump=(section:KiaraSection,options?:KiaraNavigation)=>void
type Preview={id:string;contact_name:string|null;contact_phone:string|null;status:string;last_interaction_at:string|null}
type Budget={id:string;conversation_id:string;created_at:string;customer_message:string}
type Counts={ai:number;waiting_human:number;human:number;no_interaction:number;budgets:number;all:number}
type Report={started:number;ad_unanswered:number;budgets_sent:number;human:number}
const empty:Counts={ai:0,waiting_human:0,human:0,no_interaction:0,budgets:0,all:0}
const emptyReport:Report={started:0,ad_unanswered:0,budgets_sent:0,human:0}
const statusLabel:Record<Exclude<ConversationStatus,'all'>,string>={ai:'IA atendendo',waiting_human:'Aguardando humano',human:'Assumidas',no_interaction:'Sem interação'}
function localDay(date:Date){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');return y+'-'+m+'-'+d}
function getPeriod(preset:string,from:string,to:string):Period|null{
 const now=new Date()
 if(preset==='custom'){
  if(!from||!to||from>to)return null
  const start=new Date(from+'T00:00:00')
  const end=new Date(to+'T00:00:00');end.setDate(end.getDate()+1)
  if(!Number.isFinite(start.valueOf())||!Number.isFinite(end.valueOf()))return null
  return {start:start.toISOString(),end:end.toISOString()}
 }
 const n=preset==='30d'?30:7
 return {start:new Date(now.getTime()-n*86400000).toISOString(),end:now.toISOString()}
}
export function KiaraOverview({onNavigate}:{onNavigate:Jump}){
 const access=useAccess()
 const [counts,setCounts]=useState<Counts>(empty),[report,setReport]=useState<Report>(emptyReport)
 const [recent,setRecent]=useState<Preview[]>([]),[budgets,setBudgets]=useState<Budget[]>([])
 const [error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0)
 const [preset,setPreset]=useState('7d'),[from,setFrom]=useState(''),[to,setTo]=useState('')
 const [controlReady,setControlReady]=useState(false),[kiaraEnabled,setKiaraEnabled]=useState(false),[controlBusy,setControlBusy]=useState(false),[controlFeedback,setControlFeedback]=useState('')
 const period=useMemo(()=>getPeriod(preset,from,to),[preset,from,to,revision])
 useEffect(()=>{
  if(!supabase||!access||!period){setLoading(false);return}
  let live=true;const client=supabase,org=access.organizationId
  void (async()=>{
   setLoading(true)
   try{
    const statuses=['ai','waiting_human','human','no_interaction'] as const
    const [all,...results]=await Promise.all([
     client.from('kiara_conversations').select('id',{head:true,count:'exact'}).eq('organization_id',org),
     ...statuses.map(status=>client.from('kiara_conversations').select('id',{head:true,count:'exact'}).eq('organization_id',org).eq('status',status)),
     client.from('kiara_budget_drafts').select('id',{head:true,count:'exact'}).eq('organization_id',org).eq('status','pending_review'),
     client.from('kiara_conversations').select('id,contact_name,contact_phone,status,last_interaction_at').eq('organization_id',org).order('last_interaction_at',{ascending:false}).limit(6),
     client.from('kiara_budget_drafts').select('id,conversation_id,created_at,customer_message').eq('organization_id',org).eq('status','pending_review').order('created_at',{ascending:true}).limit(5),
     client.rpc('kiara_dashboard_metrics',{p_org_id:org,p_start:period.start,p_end:period.end})
    ])
    if(all.error||results.some(r=>r.error))throw Error('Falha nas consultas do painel')
    if(!live)return
    const next:Counts={...empty,all:all.count??0,budgets:results[4].count??0}
    statuses.forEach((status,index)=>{next[status]=results[index].count??0})
    setCounts(next)
    setRecent((results[5].data||[]) as Preview[])
    setBudgets((results[6].data||[]) as Budget[])
    const stats=results[7].data as Partial<Report>|null
    setReport({started:Number(stats?.started??0),ad_unanswered:Number(stats?.ad_unanswered??0),budgets_sent:Number(stats?.budgets_sent??0),human:Number(stats?.human??0)})
    setError('')
   }catch{if(live)setError('Não foi possível carregar os indicadores. Confira a atualização do banco e tente novamente.')}
   finally{if(live)setLoading(false)}
  })();return()=>{live=false}
 },[access?.organizationId,period?.start,period?.end,revision])
 useEffect(()=>{
  if(!kiaraControlConfigured||!access)return
  let live=true
  void readKiaraControl().then(r=>{if(live){setControlReady(true);setKiaraEnabled(r.enabled)}}).catch(()=>{if(live)setControlReady(false)})
  return()=>{live=false}
 },[access?.organizationId,revision])
 useEffect(()=>{
  const tick=window.setInterval(()=>{if(document.visibilityState==='visible')setRevision(n=>n+1)},90000)
  return()=>window.clearInterval(tick)
 },[])
 async function pause(){
  if(!controlReady||!kiaraEnabled||controlBusy||access?.role!=='admin')return
  if(!window.confirm('Pausar todas as respostas automáticas da Kiara?'))return
  setControlBusy(true);setControlFeedback('')
  try{await commandKiara('pause_all');setKiaraEnabled(false);setControlFeedback('Kiara pausada pelo servidor.')}
  catch(e){setControlFeedback(e instanceof Error?e.message:'Não foi possível pausar a Kiara.')}
  finally{setControlBusy(false)}
 }
 const reportCards=[
  {key:'started' as const,label:'Conversas iniciadas',detail:'Novas conversas no período',count:report.started,Icon:MessageCircleMore,tone:'blue',type:'conversation' as const},
  {key:'ad_unanswered' as const,label:'Sem interação',detail:'Anúncio sem nova mensagem do cliente',count:report.ad_unanswered,Icon:MessageCircleOff,tone:'amber',type:'conversation' as const},
  {key:'budgets_sent' as const,label:'Orçamentos enviados',detail:'Envio efetivamente registrado',count:report.budgets_sent,Icon:FileCheck2,tone:'green',type:'budget' as const},
  {key:'human' as const,label:'Atendimento humano',detail:'Conversas com resposta da equipe',count:report.human,Icon:Headset,tone:'purple',type:'conversation' as const}
 ]
 const statusCards=[
  {key:'ai' as const,label:'IA atendendo',caption:'conversas com a Kiara',value:counts.ai,Icon:MessageCircleMore,tone:'green'},
  {key:'waiting_human' as const,label:'Aguardando humano',caption:'precisam de atenção',value:counts.waiting_human,Icon:UserRound,tone:'amber'},
  {key:'human' as const,label:'Assumidas',caption:'atendimentos sob controle humano',value:counts.human,Icon:Headset,tone:'blue'}
 ]
 const visitReport=(key:typeof reportCards[number]['key'])=>{
  if(!period)return
  if(key==='budgets_sent')onNavigate('budgets',{budgetFilter:'sent',period})
  else onNavigate('conversations',{status:'all',reportMode:key,period})
 }
 return <section className="kiara-overview">
  <header className="kiara-overview-heading"><div><h1>Visão geral</h1><p>Acompanhe os resultados e acesse rapidamente o que precisa de atenção.</p></div><button type="button" onClick={()=>setRevision(n=>n+1)} disabled={loading}><RefreshCcw size={17}/> Atualizar</button></header>
  {error&&<p role="alert" className="kiara-overview-error">{error}</p>}
  <div className="kiara-overview-hero-row">
   <section className="kiara-overview-hero">
    <img className="kiara-overview-avatar" src={import.meta.env.BASE_URL+'kiara-avatar.webp'} alt="Kiara, atendente virtual da Fábrika Kriativa, sorrindo com camiseta preta FK"/>
    <div className="kiara-overview-hero-copy"><div className="kiara-overview-name"><h2>✦ Kiara</h2><span className={'kiara-overview-status '+(controlReady&&kiaraEnabled?'active':'idle')}>{controlReady?(kiaraEnabled?'● Kiara ativa':'● Kiara pausada'):'Controle em homologação'}</span></div>
    <p>Sua atendente IA que acolhe, qualifica e direciona os leads da Fábrika Kriativa — 24h por dia. 💜</p>
    <div className="kiara-overview-hero-buttons"><button type="button" disabled={!controlReady||!kiaraEnabled||controlBusy||access?.role!=='admin'} onClick={()=>void pause()}><PauseCircle size={16}/> Pausar Kiara</button><button type="button" onClick={()=>onNavigate('conversations',{status:'all'})}><MessageCircleMore size={16}/> Abrir conversas</button><button type="button" onClick={()=>onNavigate('budgets',{budgetFilter:'pending_review'})}><ClipboardCheck size={16}/> Ver orçamentos</button></div>
    {controlFeedback&&<small role="status">{controlFeedback}</small>}</div>
   </section>
   <section className="kiara-overview-funnel"><div className="kiara-overview-funnel-heading"><h2>Resumo dos atendimentos</h2><label><CalendarDays size={15}/><select aria-label="Período dos indicadores" value={preset} onChange={e=>setPreset(e.target.value)}><option value="7d">Últimos 7 dias</option><option value="30d">Últimos 30 dias</option><option value="custom">Personalizado</option></select></label></div>
    {preset==='custom'&&<div className="kiara-overview-date-range"><label>De <input type="date" value={from} onChange={e=>setFrom(e.target.value)} max={to||localDay(new Date())}/></label><label>Até <input type="date" value={to} onChange={e=>setTo(e.target.value)} min={from||undefined} max={localDay(new Date())}/></label></div>}
    {!period?<p className="kiara-overview-empty">Selecione um período válido.</p>:
    <div className="kiara-overview-report-cards">{reportCards.map(({key,label,detail,count,Icon,tone})=><button type="button" key={key} className={'kiara-overview-report-card '+tone} onClick={()=>visitReport(key)} disabled={loading} aria-label={label+': '+count+'. Abrir registros filtrados'}><span><Icon size={18}/>{label}</span><strong>{loading?'…':count}</strong><small>{detail}</small></button>)}</div>}
   </section>
  </div>
  <div className="kiara-overview-kpis" aria-label="Situação atual e ações pendentes">
   {statusCards.map(({key,label,caption,value,Icon,tone})=><button type="button" className="kiara-overview-kpi" key={key} onClick={()=>onNavigate('conversations',{status:key})}><span className={'kiara-overview-kpi-icon '+tone}><Icon size={25}/></span><span className="kiara-overview-kpi-body"><span className="kiara-overview-label">{label}</span><strong>{loading?'…':value}</strong><small>{caption}</small></span><ChevronRight className="kiara-overview-card-arrow" size={19}/></button>)}
   <button type="button" className="kiara-overview-kpi kiara-overview-budget" onClick={()=>onNavigate('budgets',{budgetFilter:'pending_review'})}><span className="kiara-overview-kpi-icon orange"><ClipboardCheck size={25}/></span><span className="kiara-overview-kpi-body"><span className="kiara-overview-label">Orçamentos pendentes</span><strong>{loading?'…':counts.budgets}</strong><small>aguardando sua aprovação</small></span><ChevronRight className="kiara-overview-card-arrow" size={19}/></button>
  </div>
  <div className="kiara-overview-columns">
   <section className="kiara-overview-panel"><div className="kiara-overview-panel-title"><h2><ClipboardCheck size={19}/> Aprovações prioritárias</h2><button onClick={()=>onNavigate('budgets',{budgetFilter:'pending_review'})}>Ver fila <ChevronRight size={15}/></button></div>
    {budgets.length===0?<p className="kiara-overview-empty">Nenhum orçamento aguardando aprovação.</p>:budgets.map(b=><button className="kiara-overview-line" key={b.id} onClick={()=>onNavigate('budgets',{budgetFilter:'pending_review'})}><span><strong>Orçamento aguardando revisão</strong><small>{new Date(b.created_at).toLocaleString('pt-BR')} · {b.customer_message?.slice(0,90)||'Proposta estruturada'}</small></span><ChevronRight size={17}/></button>)}
   </section>
   <section className="kiara-overview-panel"><div className="kiara-overview-panel-title"><h2><Activity size={19}/> Atendimentos recentes</h2><button onClick={()=>onNavigate('conversations',{status:'all'})}>Todas as conversas <ChevronRight size={15}/></button></div>
    {recent.length===0?<p className="kiara-overview-empty">Nenhuma conversa sincronizada.</p>:recent.map(c=><button className="kiara-overview-line" key={c.id} onClick={()=>onNavigate('conversations',{status:'all',conversationId:c.id})}><span><strong>{c.contact_name||c.contact_phone||'Contato sem nome'}</strong><small>{statusLabel[c.status as Exclude<ConversationStatus,'all'>]||c.status} · {c.last_interaction_at?new Date(c.last_interaction_at).toLocaleString('pt-BR'):'Sem data'}</small></span><ChevronRight size={17}/></button>)}
   </section>
  </div>
  <div className="kiara-overview-actions"><button onClick={()=>onNavigate('conversations',{status:'all'})}><Bot size={17}/> Abrir central de conversas</button><button onClick={()=>onNavigate('guidance')}><BookOpen size={17}/> Revisar aprendizados</button></div>
  <p className="kiara-overview-note">Indicadores limitados a registros sincronizados. “Sem interação” considera um contato vindo de anúncio com somente uma mensagem recebida, sem continuidade. Orçamentos enviados dependem de confirmação do envio gravada no sistema.</p>
 </section>
}
