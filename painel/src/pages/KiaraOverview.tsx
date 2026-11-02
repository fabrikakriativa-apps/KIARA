import {useEffect,useState} from 'react'
import {Bot,Headset,UserRound,Clock3,ClipboardCheck,MessageCircleMore,ChevronRight,RefreshCcw,Activity,BookOpen} from 'lucide-react'
import {supabase} from '../lib/supabase'
import {useAccess} from '../components/AuthorizedAccess'
import './KiaraOverview.css'
export type KiaraSection='dashboard'|'conversations'|'leads'|'guidance'|'budgets'|'performance'|'settings'
export type ConversationStatus='all'|'ai'|'waiting_human'|'human'|'no_interaction'
type Jump=(section:KiaraSection,options?:{status?:ConversationStatus;budgetFilter?:'pending_review'|'all';conversationId?:string})=>void
type Preview={id:string;contact_name:string|null;contact_phone:string|null;status:string;last_interaction_at:string|null}
type Budget={id:string;conversation_id:string;created_at:string;customer_message:string}
type Counts={ai:number;waiting_human:number;human:number;no_interaction:number;budgets:number;all:number}
const empty:Counts={ai:0,waiting_human:0,human:0,no_interaction:0,budgets:0,all:0}
const statusLabel:Record<Exclude<ConversationStatus,'all'>,string>={ai:'IA atendendo',waiting_human:'Aguardando humano',human:'Assumidas',no_interaction:'Sem interação'}
export function KiaraOverview({onNavigate}:{onNavigate:Jump}){
 const access=useAccess(),[counts,setCounts]=useState<Counts>(empty),[recent,setRecent]=useState<Preview[]>([]),[budgets,setBudgets]=useState<Budget[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0)
 useEffect(()=>{
  if(!supabase||!access)return
  let live=true
  const client=supabase,org=access.organizationId
  void (async()=>{
   setLoading(true)
   try {
    const statuses=['ai','waiting_human','human','no_interaction'] as const
    const [all,...results]=await Promise.all([
     client.from('kiara_conversations').select('id',{head:true,count:'exact'}).eq('organization_id',org),
     ...statuses.map(status=>client.from('kiara_conversations').select('id',{head:true,count:'exact'}).eq('organization_id',org).eq('status',status)),
     client.from('kiara_budget_drafts').select('id',{head:true,count:'exact'}).eq('organization_id',org).eq('status','pending_review'),
     client.from('kiara_conversations').select('id,contact_name,contact_phone,status,last_interaction_at').eq('organization_id',org).order('last_interaction_at',{ascending:false}).limit(6),
     client.from('kiara_budget_drafts').select('id,conversation_id,created_at,customer_message').eq('organization_id',org).eq('status','pending_review').order('created_at',{ascending:true}).limit(5)
    ])
    if(all.error||results.some(r=>r.error))throw Error('Falha nas consultas')
    if(!live)return
    const next:Counts={...empty,all:all.count??0,budgets:results[4].count??0}
    statuses.forEach((status,index)=>{next[status]=results[index].count??0})
    setCounts(next)
    setRecent((results[5].data||[]) as Preview[])
    setBudgets((results[6].data||[]) as Budget[])
    setError('')
   }catch {if(live)setError('Não foi possível carregar todos os indicadores. Use Atualizar para tentar novamente.')}
   finally{if(live)setLoading(false)}
  })()
  return()=>{live=false}
 },[access?.organizationId,revision])
 useEffect(()=>{
  const tick=window.setInterval(()=>{if(document.visibilityState==='visible')setRevision(n=>n+1)},90000)
  return()=>window.clearInterval(tick)
 },[])
 const cards=[
  {key:'ai' as const,label:'IA atendendo',caption:'conversas com a Kiara',value:counts.ai,Icon:MessageCircleMore,tone:'green'},
  {key:'waiting_human' as const,label:'Aguardando humano',caption:'precisam de atenção',value:counts.waiting_human,Icon:UserRound,tone:'amber'},
  {key:'human' as const,label:'Assumidas',caption:'atendimentos humanos',value:counts.human,Icon:Headset,tone:'blue'},
  {key:'no_interaction' as const,label:'Sem interação',caption:'sem atividade registrada',value:counts.no_interaction,Icon:Clock3,tone:'gray'}
 ]
 return <section className="kiara-overview">
  <header className="kiara-overview-heading"><div><h1>Visão geral</h1><p>Acompanhe o atendimento, identifique pendências e acesse diretamente o que precisa de atenção.</p></div><button type="button" onClick={()=>setRevision(n=>n+1)} disabled={loading}><RefreshCcw size={17}/> Atualizar</button></header>
  {error&&<p role="alert" className="kiara-overview-error">{error}</p>}
  <div className="kiara-overview-kpis" aria-label="Indicadores e atalhos dos atendimentos">
   {cards.map(({key,label,caption,value,Icon,tone})=><button type="button" className="kiara-overview-kpi" key={key} disabled={loading&&counts.all===0} onClick={()=>onNavigate('conversations',{status:key})} aria-label={label+': '+value+'. Abrir conversas filtradas'}>
    <span className={'kiara-overview-kpi-icon '+tone}><Icon size={25}/></span><span className="kiara-overview-kpi-body"><span className="kiara-overview-label">{label}</span><strong>{loading&&counts.all===0?'…':value}</strong><small>{caption}</small></span><ChevronRight className="kiara-overview-card-arrow" size={19}/>
   </button>)}
   <button type="button" className="kiara-overview-kpi kiara-overview-budget" disabled={loading&&counts.all===0} onClick={()=>onNavigate('budgets',{budgetFilter:'pending_review'})} aria-label={'Orçamentos pendentes: '+counts.budgets+'. Abrir fila de aprovação'}>
    <span className="kiara-overview-kpi-icon orange"><ClipboardCheck size={25}/></span><span className="kiara-overview-kpi-body"><span className="kiara-overview-label">Orçamentos pendentes</span><strong>{loading&&counts.all===0?'…':counts.budgets}</strong><small>aguardando sua aprovação</small></span><ChevronRight className="kiara-overview-card-arrow" size={19}/>
   </button>
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
  <p className="kiara-overview-note">Indicadores calculados no Supabase para toda a organização. Histórico e mensagens são carregados somente ao acessar as conversas. O painel mostra apenas o que foi sincronizado pelo WhatsApp.</p>
 </section>
}
