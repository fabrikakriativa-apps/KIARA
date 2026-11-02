import {useState} from 'react'
import {Activity,BookOpen,ChartNoAxesCombined,LayoutDashboard,LogOut,MessagesSquare,Settings2,Sparkles,Users,Calculator} from 'lucide-react'
import {KiaraAttendance} from './pages/KiaraAttendance'
import {KiaraLeads} from './pages/KiaraLeads'
import {KiaraBudgets} from './pages/KiaraBudgets'
import {KiaraOverview,type KiaraSection,type ConversationStatus,type ReportMode,type Period,type KiaraNavigation} from './pages/KiaraOverview'
import {KiaraLearning} from './pages/KiaraLearning'
import './pages/KiaraManagement.css'
import {supabase} from './lib/supabase'
const entries=[{key:'dashboard',label:'Visão geral',icon:LayoutDashboard},{key:'conversations',label:'Conversas',icon:MessagesSquare},{key:'leads',label:'Leads e campanhas',icon:Users},{key:'guidance',label:'Instruções e aprendizados',icon:BookOpen},{key:'budgets',label:'Regras de orçamento',icon:Calculator},{key:'performance',label:'Desempenho',icon:ChartNoAxesCombined},{key:'settings',label:'Configurações',icon:Settings2}] as const
export function App(){
 const [active,setActive]=useState<(typeof entries)[number]['key']>('dashboard')
 const [conversationStatus,setConversationStatus]=useState<ConversationStatus>('all')
 const [conversationId,setConversationId]=useState<string|null>(null)
 const [budgetFilter,setBudgetFilter]=useState<'all'|'pending_review'|'sent'>('all')
 const [reportMode,setReportMode]=useState<ReportMode|null>(null)
 const [reportPeriod,setReportPeriod]=useState<Period|null>(null)
 const [navigationVersion,setNavigationVersion]=useState(0)
 const navigate=(section:KiaraSection,options?:KiaraNavigation)=>{
  if(section==='conversations') {setConversationStatus(options?.status??'all');setConversationId(options?.conversationId??null);setReportMode(options?.reportMode??null);setReportPeriod(options?.period??null)}
  if(section==='budgets'){setBudgetFilter(options?.budgetFilter??'all');setReportPeriod(options?.period??null)}
  setNavigationVersion(v=>v+1);setActive(section)
 }
 const section=entries.find(e=>e.key===active)??entries[0]
 return <div className="kiara-standalone-shell"><aside className="kiara-standalone-sidebar">
 <div className="kiara-standalone-brand"><span><Sparkles/></span><div><strong>Kiara</strong><small>Fábrika Kriativa</small></div></div>
 <div className="kiara-standalone-nav-title">CENTRAL DE ATENDIMENTO</div>
 <nav aria-label="Navegação da Kiara">{entries.map(entry=><button type="button" key={entry.key} className={active===entry.key?'active':''} onClick={()=>navigate(entry.key)}><entry.icon size={19}/>{entry.label}</button>)}</nav>
 <div className="kiara-standalone-footer"><span><Activity size={15}/> Ambiente independente</span><button type="button" onClick={()=>void supabase?.auth.signOut()}><LogOut size={17}/> Sair</button></div>
 </aside><main className="kiara-standalone-content">{active==='dashboard'?<KiaraOverview onNavigate={navigate}/>:active==='conversations'?<KiaraAttendance key={'conversations-'+navigationVersion} initialStatus={conversationStatus} initialConversationId={conversationId} reportMode={reportMode} reportPeriod={reportPeriod} onNavigateBudgets={()=>navigate('budgets',{budgetFilter:'pending_review'})}/>:active==='leads'?<KiaraLeads/>:active==='guidance'?<KiaraLearning/>:active==='budgets'?<KiaraBudgets key={'budgets-'+navigationVersion} initialFilter={budgetFilter} reportPeriod={reportPeriod}/>:<section className="kiara-placeholder"><section><section.icon size={28}/><h1>{section.label}</h1><p>Área reservada para a configuração da Kiara. Nenhum dado demonstrativo ou ação operacional é apresentado como real.</p><button onClick={()=>setActive('dashboard')}>Voltar à visão geral</button></section></section>}</main></div>
}
