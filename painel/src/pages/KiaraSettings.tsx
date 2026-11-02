import {useEffect,useState} from 'react'
import {ArrowLeft,ArrowRight,BookOpen,BrainCircuit,Bot,Calculator,CheckCircle2,Cloud,FileText,LockKeyhole,PlugZap,Settings2,ShieldCheck,Users,Workflow} from 'lucide-react'
import {useAccess} from '../components/AuthorizedAccess'
import {supabase} from '../lib/supabase'
import {kiaraControlConfigured,readKiaraControl} from '../lib/kiaraControl'
import {KiaraCommercialSettings} from './KiaraCommercialSettings'
import type {KiaraSection} from './KiaraOverview'
import './KiaraSettings.css'

type Section='ai'|'rules'|'knowledge'|'budgets'|'integrations'|'permissions'|'learning'|'security'
type Item={id:Section;title:string;description:string;icon:typeof Bot}
const items:Item[]=[
 {id:'ai',title:'Atendimento da IA',description:'Ative, pause e defina o comportamento da Kiara.',icon:Bot},
 {id:'rules',title:'Regras e roteiros',description:'Mensagens, qualificação, horários e direcionamentos.',icon:Workflow},
 {id:'knowledge',title:'Base de conhecimento',description:'Produtos, políticas, prazos, garantias e diferenciais.',icon:BookOpen},
 {id:'budgets',title:'Orçamentos',description:'Tabelas, composições, valores e validação de envio.',icon:Calculator},
 {id:'integrations',title:'Integrações',description:'WhatsApp, Supabase, CRM e outras conexões.',icon:PlugZap},
 {id:'permissions',title:'Permissões e acesso',description:'Usuários, perfis e níveis de permissão.',icon:Users},
 {id:'learning',title:'Aprendizado e melhoria',description:'Acompanhe interações e ajuste respostas da Kiara.',icon:BrainCircuit},
 {id:'security',title:'Segurança',description:'Controle de envio, limites, logs e backup.',icon:ShieldCheck},
]
const navigation:Partial<Record<Section,KiaraSection>>={
 rules:'guidance',knowledge:'guidance',learning:'guidance'
}
export function KiaraSettings({onNavigate}:{onNavigate:(section:KiaraSection)=>void}){
 const access=useAccess()
 const [selected,setSelected]=useState<Section|null>(null)
 const [aiState,setAiState]=useState<'checking'|'active'|'paused'|'unavailable'>('checking')
 const [people,setPeople]=useState<{user_id:string;role:string}[]>([])
 const [error,setError]=useState('')
 useEffect(()=>{
  if(!access||!supabase)return
  let mounted=true
  void supabase.from('memberships').select('user_id,role').eq('organization_id',access.organizationId).eq('active',true).then(({data,error:e})=>{
   if(!mounted)return
   if(e)setError('Não foi possível consultar os acessos autorizados.')
   else setPeople((data||[]) as {user_id:string;role:string}[])
  })
  return()=>{mounted=false}
 },[access?.organizationId])
 useEffect(()=>{
  if(selected!=='ai')return
  if(!kiaraControlConfigured){setAiState('unavailable');return}
  let mounted=true
  setAiState('checking')
  void readKiaraControl().then(result=>{if(mounted)setAiState(result.enabled?'active':'paused')}).catch(()=>{if(mounted)setAiState('unavailable')})
  return()=>{mounted=false}
 },[selected])
 const selectedItem=items.find(x=>x.id===selected)
 function open(item:Item){
  if(navigation[item.id]){onNavigate(navigation[item.id]!);return}
  setSelected(item.id)
 }
 return <section className="kiara-settings">
  <header className="kiara-settings-heading">
   <div className="kiara-settings-heading-icon"><Settings2 size={21}/></div>
   <div><h1>Configurações</h1><p>Personalize a Kiara, gerencie integrações e defina as regras do atendimento.</p></div>
  </header>
  {!selected?<div className="kiara-settings-grid">
   {items.map(item=><button type="button" key={item.id} className="kiara-settings-tile" onClick={()=>open(item)}>
    <span className="kiara-settings-tile-icon"><item.icon size={21}/></span>
    <span className="kiara-settings-tile-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
    <ArrowRight size={15} className="kiara-settings-arrow"/>
   </button>)}
  </div>:<div className="kiara-settings-detail">
   <button type="button" className="kiara-settings-back" onClick={()=>setSelected(null)}><ArrowLeft size={16}/> Todas as configurações</button>
   <div className="kiara-settings-detail-title">{selectedItem&&<selectedItem.icon size={23}/>}<h2>{selectedItem?.title}</h2></div>
   {selected==='budgets'&&<KiaraCommercialSettings/>}
   {selected==='ai'&&<div className="kiara-settings-info">
    <h3>Estado atual do atendimento</h3>
    <p>{aiState==='checking'?'Consultando o estado da Kiara…':aiState==='active'?'Kiara ativa, conforme a consulta autenticada ao servidor.':aiState==='paused'?'Kiara pausada, conforme a consulta autenticada ao servidor.':'Controle operacional indisponível ou ainda não configurado.'}</p>
    <p>Os comandos para pausar e retomar a Kiara permanecem nos painéis Visão geral e Conversas e só funcionam após autorização do servidor.</p>
    <button type="button" onClick={()=>onNavigate('conversations')}>Abrir controles de atendimento <ArrowRight size={15}/></button>
   </div>}
   {selected==='integrations'&&<div className="kiara-settings-info">
    <h3>Conexões do painel</h3>
    <div className="kiara-settings-status"><Cloud size={19}/><div><strong>Supabase</strong><small>{supabase?'Cliente configurado neste painel.':'Cliente não configurado neste painel.'}</small></div></div>
    <div className="kiara-settings-status"><PlugZap size={19}/><div><strong>WhatsApp Business</strong><small>Acompanhamento de mensagens sincronizadas na área Conversas. O estado da integração externa exige verificação específica no Worker.</small></div></div>
    <div className="kiara-settings-status"><FileText size={19}/><div><strong>Prospecção (CRM)</strong><small>Vínculo de oportunidades acessível pelo atendimento de cada contato.</small></div></div>
    <button type="button" onClick={()=>onNavigate('conversations')}>Abrir conversas <ArrowRight size={15}/></button>
   </div>}
   {selected==='permissions'&&<div className="kiara-settings-info">
    <h3>Acesso autorizado</h3>
    <p>Seu perfil neste painel: <strong>{access?.role==='admin'?'Administrador':access?.role==='comercial'?'Comercial':access?.role||'Não identificado'}</strong>.</p>
    {error?<p role="alert">{error}</p>:<p>{people.length} usuário(s) ativo(s) com associação registrada à organização.</p>}
    <div className="kiara-settings-status"><Users size={19}/><div><strong>Controle de permissões</strong><small>As permissões são aplicadas no Supabase. Esta tela consulta os vínculos, mas não altera nem concede acesso.</small></div></div>
   </div>}
   {selected==='security'&&<div className="kiara-settings-info">
    <h3>Proteções do atendimento</h3>
    <div className="kiara-settings-status"><LockKeyhole size={19}/><div><strong>Login autenticado</strong><small>O painel exige sessão válida e participação autorizada na organização.</small></div></div>
    <div className="kiara-settings-status"><ShieldCheck size={19}/><div><strong>Revisão de orçamentos</strong><small>O envio automático permanece desabilitado durante a homologação.</small></div></div>
    <div className="kiara-settings-status"><CheckCircle2 size={19}/><div><strong>Comandos protegidos</strong><small>Assumir, devolver e pausar dependem de autorização confirmada pelo servidor.</small></div></div>
    <p>Auditoria detalhada, limites e rotinas de backup precisam ser verificados individualmente antes de apresentarmos controles editáveis nesta área.</p>
   </div>}
  </div>}
 </section>
}
