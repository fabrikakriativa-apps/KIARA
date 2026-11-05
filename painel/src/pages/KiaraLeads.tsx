import {useEffect,useMemo,useState} from 'react'
import {BarChart3,ExternalLink,RefreshCcw,Search,Users} from 'lucide-react'
import {useAccess} from '../components/AuthorizedAccess'
import {supabase} from '../lib/supabase'
import {prospectingUrl,sendKiaraToProspecting} from '../lib/kiaraProspecting'
import './KiaraLeads.css'

type ChatLead={
 id:string;contact_name:string|null;contact_phone:string;
 origin:string|null;campaign:string|null;last_interaction_at:string;
 lead_opportunity_id:string|null
}
type Opportunity={id:string;name:string;commercial_phase:string|null;stage:string;updated_at:string}

export function KiaraLeads(){
 const access=useAccess()
 const [chats,setChats]=useState<ChatLead[]>([])
 const [opportunities,setOpportunities]=useState<Record<string,Opportunity>>({})
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [search,setSearch]=useState('')
 const [refresh,setRefresh]=useState(0)
 const [promoting,setPromoting]=useState<string|null>(null)
 const [notice,setNotice]=useState('')
 useEffect(()=>{
  if(!supabase||!access){setLoading(false);return}
  let active=true
  const client=supabase,org=access.organizationId
  void (async()=>{
   setLoading(true)
   try{
    const {data,error:chatError}=await client.from('kiara_conversations')
     .select('id,contact_name,contact_phone,origin,campaign,last_interaction_at,lead_opportunity_id')
     .eq('organization_id',org).order('last_interaction_at',{ascending:false}).limit(500)
    if(chatError)throw chatError
    const list=(data||[]) as ChatLead[]
    const ids=[...new Set(list.map(x=>x.lead_opportunity_id).filter((v):v is string=>Boolean(v)))]
    let linked:Opportunity[]=[]
    if(ids.length){
     const {data:found,error:opError}=await client.from('sales_opportunities')
      .select('id,name,commercial_phase,stage,updated_at').eq('organization_id',org).in('id',ids)
     if(opError)throw opError
     linked=(found||[]) as Opportunity[]
    }
    if(active){setChats(list);setOpportunities(Object.fromEntries(linked.map(o=>[o.id,o])));setError('')}
   }catch(e){if(active)setError(e instanceof Error?e.message:'Não foi possível consultar os leads.')}
   finally{if(active)setLoading(false)}
  })()
  return()=>{active=false}
 },[access?.organizationId,refresh])
 async function promote(chat:ChatLead){
  if(!access||!chat.contact_phone||chat.lead_opportunity_id||promoting)return
  if(!window.confirm('Encaminhar este contato à Prospecção? O sistema verificará a existência de oportunidade para evitar duplicidade.'))return
  setPromoting(chat.id);setNotice('')
  try{
   const result=await sendKiaraToProspecting(access.organizationId,chat.id)
   setNotice(result.created?'Oportunidade criada e vinculada à conversa.':'Contato vinculado a uma oportunidade já existente.')
   setRefresh(n=>n+1)
  }catch(e){setNotice(e instanceof Error?e.message:'Não foi possível encaminhar à Prospecção.')}
  finally{setPromoting(null)}
 }
 const filtered=useMemo(()=>chats.filter(c=>[c.contact_name,c.contact_phone,c.origin,c.campaign].some(v=>(v||'').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))),[chats,search])
 const linked=chats.filter(c=>Boolean(c.lead_opportunity_id)).length
 const withCampaign=chats.filter(c=>Boolean(c.campaign)).length
 return <section className="kiara-leads-page">
  <header><div><h1>Leads e campanhas</h1><p>Os contatos vêm das conversas reais da Kiara. As oportunidades e fases comerciais são consultadas no SISTEMA.</p></div><button type="button" onClick={()=>setRefresh(v=>v+1)}><RefreshCcw size={16}/> Atualizar</button></header>
  <div className="kiara-leads-metrics">
   <article><Users size={20}/><small>Contatos sincronizados</small><strong>{chats.length}</strong></article>
   <article><BarChart3 size={20}/><small>Com origem de campanha</small><strong>{withCampaign}</strong></article>
   <article><ExternalLink size={20}/><small>Vinculados à Prospecção</small><strong>{linked}</strong></article>
   <article><Users size={20}/><small>Aguardando qualificação</small><strong>{chats.length-linked}</strong></article>
  </div>
  <div className="kiara-leads-panel"><div className="kiara-leads-filter"><label><Search size={17}/><input placeholder="Filtrar contato, origem ou campanha" value={search} onChange={e=>setSearch(e.target.value)}/></label><span>{filtered.length} registros</span></div>
   {error&&<p role="alert" className="kiara-leads-error">{error}</p>}
   {notice&&<p role="status" className="kiara-leads-notice">{notice}</p>}
   {loading?<p className="kiara-leads-empty">Carregando dados autorizados…</p>:filtered.length===0?<p className="kiara-leads-empty">Nenhum contato encontrado para este filtro.</p>:<div className="kiara-leads-table">
    <div className="kiara-leads-row header"><span>Contato</span><span>Campanha / origem</span><span>Prospecção</span><span>Último contato</span></div>
    {filtered.map(chat=>{const opportunity=chat.lead_opportunity_id?opportunities[chat.lead_opportunity_id]:null;return <div className="kiara-leads-row" key={chat.id}>
      <div><strong>{chat.contact_name||chat.contact_phone}</strong><small>{chat.contact_phone}</small></div>
      <div><strong>{chat.campaign||'Sem campanha'}</strong><small>{chat.origin||'Origem não informada'}</small></div>
      <div>{opportunity?<><span className="kiara-leads-linked">Vinculado</span><small>{opportunity.commercial_phase||opportunity.stage}</small><a target="_blank" rel="noopener noreferrer" href={prospectingUrl(opportunity.id)}>Abrir Prospecção <ExternalLink size={12}/></a></>:<><span className="kiara-leads-pending">Não enviado</span>{access?.role==='admin'||access?.role==='comercial'?
       <button type="button" className="kiara-leads-promote" disabled={Boolean(promoting)||!chat.contact_phone}
         onClick={()=>void promote(chat)}>{promoting===chat.id?'Encaminhando…':'Encaminhar à Prospecção'}</button>:null}</>}</div>
      <div><small>{new Date(chat.last_interaction_at).toLocaleString('pt-BR')}</small><a href={'?conversationId='+encodeURIComponent(chat.id)}>Ver conversa</a></div>
    </div>})}
   </div>}</div>
 </section>
}
