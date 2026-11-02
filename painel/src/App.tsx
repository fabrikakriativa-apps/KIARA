import {useState} from 'react'
import {Activity,BookOpen,ChartNoAxesCombined,LayoutDashboard,LogOut,MessagesSquare,Settings2,Sparkles,Users,Calculator} from 'lucide-react'
import {KiaraAttendance} from './pages/KiaraAttendance'
import {KiaraLeads} from './pages/KiaraLeads'
import {supabase} from './lib/supabase'
const entries=[{key:'dashboard',label:'Visão geral',icon:LayoutDashboard},{key:'conversations',label:'Conversas',icon:MessagesSquare},{key:'leads',label:'Leads e campanhas',icon:Users},{key:'guidance',label:'Instruções e aprendizados',icon:BookOpen},{key:'budgets',label:'Regras de orçamento',icon:Calculator},{key:'performance',label:'Desempenho',icon:ChartNoAxesCombined},{key:'settings',label:'Configurações',icon:Settings2}] as const
export function App(){
 const [active,setActive]=useState<(typeof entries)[number]['key']>('dashboard')
 const section=entries.find(e=>e.key===active)??entries[0]
 return <div className="kiara-standalone-shell"><aside className="kiara-standalone-sidebar">
 <div className="kiara-standalone-brand"><span><Sparkles/></span><div><strong>Kiara</strong><small>Fábrika Kriativa</small></div></div>
 <div className="kiara-standalone-nav-title">CENTRAL DE ATENDIMENTO</div>
 <nav aria-label="Navegação da Kiara">{entries.map(entry=><button type="button" key={entry.key} className={active===entry.key?'active':''} onClick={()=>setActive(entry.key)}><entry.icon size={19}/>{entry.label}</button>)}</nav>
 <div className="kiara-standalone-footer"><span><Activity size={15}/> Ambiente independente</span><button type="button" onClick={()=>void supabase?.auth.signOut()}><LogOut size={17}/> Sair</button></div>
 </aside><main className="kiara-standalone-content">{active==='dashboard'||active==='conversations'?<KiaraAttendance/>:active==='leads'?<KiaraLeads/>:<section className="kiara-placeholder"><section><section.icon size={28}/><h1>{section.label}</h1><p>Área reservada para a configuração da Kiara. Nenhum dado demonstrativo ou ação operacional é apresentado como real.</p><button onClick={()=>setActive('dashboard')}>Voltar à visão geral</button></section></section>}</main></div>
}
