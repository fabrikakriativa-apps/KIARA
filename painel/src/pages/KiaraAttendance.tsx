import { useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, Bot, CalendarDays, ChevronRight, Clock3, ClipboardCheck, ExternalLink, Filter, Hand, Headset, MessageCircle, MessageCircleMore, MoreVertical, PauseCircle, RefreshCcw, Search, Send, ShieldAlert, Sparkles, UserRound, UserRoundCheck } from 'lucide-react'
import type { KiaraConversation, KiaraMessage } from '../lib/kiaraMetrics'
import { supabase } from '../lib/supabase'
import { commandKiara, kiaraControlConfigured, readKiaraControl, type KiaraOperatorAction } from '../lib/kiaraControl'
import { useAccess } from '../components/AuthorizedAccess'
import { formatLeadResponseTime, leadResponseStats, leadAwaitingResponseMs, leadLastInboundMs } from '../lib/kiaraMetrics'
import { KiaraCoaching } from './KiaraCoaching'
import { kiaraCoachConfigured, readKiaraHold, setKiaraHold } from '../lib/kiaraCoachingControl'
import {sendKiaraToProspecting,prospectingUrl} from '../lib/kiaraProspecting'
import {kiaraHumanMessageConfigured,sendKiaraHumanMessage} from '../lib/kiaraHumanMessage'
import type {ReportMode,Period} from './KiaraOverview'
import './KiaraAttendance.css'
import './KiaraVisual.css'

const labels: Record<KiaraConversation['status'], string> = {
  ai: 'Kiara atendendo', waiting_human: 'Aguardando humano',
  human: 'Atendimento assumido', no_interaction: 'Sem interação',
}
const dateOnly = (iso: string) => iso.slice(0, 10)

export function KiaraAttendance({initialStatus='all',initialConversationId=null,reportMode=null,reportPeriod=null,onNavigateBudgets}:{initialStatus?:string;initialConversationId?:string|null;reportMode?:ReportMode|null;reportPeriod?:Period|null;onNavigateBudgets?:()=>void}) {
  const [activeReportMode,setActiveReportMode]=useState<ReportMode|null>(reportMode)
  // V1: interface segura, sem simular dados como se viessem do WhatsApp.
  // As conversas serão carregadas pelo serviço autenticado da Kiara na próxima etapa.
  const access = useAccess()
  const [conversations, setConversations] = useState<KiaraConversation[]>([])
  const [statusCounts,setStatusCounts]=useState({ai:0,waiting_human:0,human:0,budgets:0})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [humanText,setHumanText]=useState('')
  const [humanSending,setHumanSending]=useState(false)
  const [humanFeedback,setHumanFeedback]=useState('')
  const [humanSent,setHumanSent]=useState(false)
  const [promotionBusy,setPromotionBusy]=useState(false)
  const [promotionFeedback,setPromotionFeedback]=useState('')
  const [opportunityPhase,setOpportunityPhase]=useState('')
  const [detailTab,setDetailTab]=useState<'summary'|'qualification'|'budget'|'notes'>('summary')
  const [contactBudgets,setContactBudgets]=useState<{id:string;status:string;created_at:string;customer_message:string;structured_budget:unknown}[]>([])
  const [contactNotes,setContactNotes]=useState<{id:string;body:string;created_at:string}[]>([])
  const [noteDraft,setNoteDraft]=useState('')
  const [noteBusy,setNoteBusy]=useState(false)
  const [detailError,setDetailError]=useState('')
  const [detailsRevision,setDetailsRevision]=useState(0)
  useEffect(()=>{setHumanText('');setHumanFeedback('');setHumanSent(false)},[selectedId])
  useEffect(()=>{
    setDetailTab('summary')
    setNoteDraft('')
    setContactNotes([])
    setContactBudgets([])
    setDetailError('')
  },[selectedId])
  useEffect(()=>{
    if(!access||!supabase||!selectedId)return
    let live=true
    const client=supabase
    void Promise.all([
      client.from('kiara_budget_drafts').select('id,status,created_at,customer_message,structured_budget').eq('organization_id',access.organizationId).eq('conversation_id',selectedId).order('created_at',{ascending:false}).limit(50),
      client.from('kiara_conversation_notes').select('id,body,created_at').eq('organization_id',access.organizationId).eq('conversation_id',selectedId).order('created_at',{ascending:false}).limit(100)
    ]).then(([budgets,notes])=>{
      if(!live)return
      if(budgets.error||notes.error){setDetailError('Não foi possível carregar todos os detalhes.');return}
      setContactBudgets((budgets.data||[]) as typeof contactBudgets)
      setContactNotes((notes.data||[]) as typeof contactNotes)
      setDetailError('')
    })
    return()=>{live=false}
  },[selectedId,access?.organizationId,detailsRevision])
  async function saveContactNote(){
    if(!supabase||!access||!selectedId||!noteDraft.trim()||noteBusy)return
    setNoteBusy(true);setDetailError('')
    const {error}=await supabase.from('kiara_conversation_notes').insert({
      organization_id:access.organizationId,
      conversation_id:selectedId,
      body:noteDraft.trim().slice(0,3000),
      created_by:access.userId
    })
    setNoteBusy(false)
    if(error){setDetailError('Não foi possível salvar a nota.');return}
    setNoteDraft('')
    setDetailsRevision(v=>v+1)
  }

  const [refresh, setRefresh] = useState(0)
  const [conversationLimit,setConversationLimit]=useState(100)
  const [messageLimit,setMessageLimit]=useState(100)
  const [coachingMessage, setCoachingMessage] = useState<KiaraMessage|null>(null)
  const [showCoaching,setShowCoaching] = useState(false)
  const [holdReady,setHoldReady] = useState(false)
  const [replyHeld,setReplyHeld] = useState(false)
  const [holdBusy,setHoldBusy] = useState(false)
  const [holdFeedback,setHoldFeedback] = useState('')
  useEffect(()=>{
    setHoldReady(false);setReplyHeld(false)
    if(!selectedId || !kiaraCoachConfigured || !access || !['admin','comercial'].includes(access.role)) return
    let cancelled=false
    void readKiaraHold(selectedId).then(result=>{if(!cancelled){setReplyHeld(result.held);setHoldReady(result.writable!==false);setHoldFeedback('')}})
      .catch(()=>{if(!cancelled)setHoldFeedback('Segurar resposta ainda não está habilitado no servidor.')})
    return ()=>{cancelled=true}
  },[selectedId,access?.organizationId,access?.role,refresh])
  const toggleHold=async()=>{
    if(!selectedId || !holdReady || holdBusy) return
    setHoldBusy(true);setHoldFeedback('')
    try{
      const result=await setKiaraHold(selectedId,!replyHeld)
      setReplyHeld(result.held)
      setHoldFeedback(result.held?'Simulação: próxima resposta marcada como retida no KV de testes.':'Simulação: retenção retirada do KV de testes. Nada foi alterado no WhatsApp.')
    }catch(err){setHoldFeedback(err instanceof Error?err.message:'Não foi possível confirmar a alteração.')}
    finally{setHoldBusy(false)}
  }
  useEffect(()=>{
    if(!supabase||!access||!['admin','comercial'].includes(access.role))return
    let cancelled=false
    const client=supabase,org=access.organizationId
    void Promise.all([
      ...(['ai','waiting_human','human'] as const).map(status=>client.from('kiara_conversations').select('id',{count:'exact',head:true}).eq('organization_id',org).eq('status',status)),
      client.from('kiara_budget_drafts').select('id',{count:'exact',head:true}).eq('organization_id',org).eq('status','pending_review')
    ]).then(res=>{
      if(cancelled)return
      if(res.some(x=>x.error)){setError('Não foi possível atualizar todos os indicadores.');return}
      setStatusCounts({ai:res[0].count??0,waiting_human:res[1].count??0,human:res[2].count??0,budgets:res[3].count??0})
    })
    return()=>{cancelled=true}
  },[access?.organizationId,access?.role,refresh])
  const openStatusCard=(next:'ai'|'waiting_human'|'human')=>{
    setActiveReportMode(null)
    setStatus(next)
    setConversationLimit(100)
  }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState('')
  const [controlReady, setControlReady] = useState(false)
  const [kiaraEnabled, setKiaraEnabled] = useState(false)
  const [controlSimulated, setControlSimulated] = useState(false)
  const [controlBusy, setControlBusy] = useState(false)
  const [controlFeedback, setControlFeedback] = useState('')
  useEffect(() => {
    if (!kiaraControlConfigured || !access || !['admin','comercial'].includes(access.role)) return
    let cancelled=false
    void readKiaraControl().then(result=>{if(!cancelled){setControlReady(true);setKiaraEnabled(result.enabled);setControlSimulated(result.simulated===true);setControlFeedback('')}})
      .catch(()=>{if(!cancelled){setControlReady(false);setControlFeedback('Controle operacional indisponível. Nenhuma ação foi habilitada.')}})
    return ()=>{cancelled=true}
  },[access?.organizationId,access?.role,refresh])
  const runCommand = async (action:KiaraOperatorAction,id?:string) => {
    if(!controlReady || controlBusy) return
    if(action==='pause_all' && !window.confirm(controlSimulated?'SIMULAÇÃO: pausar somente o estado do KV de homologação? Nada será pausado no WhatsApp.':'Parar todas as respostas automáticas da Kiara, inclusive as que estiverem na fila?')) return
    if(action==='resume_all' && !window.confirm(controlSimulated?'SIMULAÇÃO: reativar somente o estado do KV de homologação? Nada será reativado no WhatsApp.':'Reativar o atendimento automático da Kiara para conversas liberadas?')) return
    setControlBusy(true);setControlFeedback('')
    try {
      await commandKiara(action,id)
      if(action==='pause_all') setKiaraEnabled(false)
      if(action==='resume_all') setKiaraEnabled(true)
      setControlFeedback(controlSimulated?'Simulação registrada no KV de homologação. Nenhuma conversa real foi alterada.':'Comando confirmado pelo servidor.')
      setRefresh(value=>value+1)
    } catch(error){setControlFeedback(error instanceof Error ? error.message : 'Não foi possível confirmar a alteração.')}
    finally{setControlBusy(false)}
  }
  // Atualiza somente enquanto este módulo está montado e a aba visível.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') { setNowMs(Date.now());setRefresh(value => value + 1) }
    }, 90_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    if (!supabase || !access || !['admin','comercial'].includes(access.role)) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        let scopedIds:string[]|null=null
        if(activeReportMode&&reportPeriod){
          const {data:ids,error:idError}=await supabase!.rpc('kiara_dashboard_conversation_ids',{
            p_org_id:access.organizationId,p_start:reportPeriod.start,p_end:reportPeriod.end,
            p_kind:activeReportMode,p_limit:1000
          })
          if(idError)throw idError
          scopedIds=(ids||[]).map((x:{conversation_id:string})=>x.conversation_id)
        }
        let query=supabase!.from('kiara_conversations')
          .select('id,contact_name,contact_phone,status,origin,campaign,region,last_interaction_at,created_at,lead_opportunity_id,handoff_reason')
          .eq('organization_id',access.organizationId)
        if(scopedIds!==null)query=query.in('id',scopedIds.length?scopedIds:['00000000-0000-0000-0000-000000000000'])
        const {data,error:fetchError}=await query.order('last_interaction_at',{ascending:false}).range(0,conversationLimit-1)
        if (fetchError) throw fetchError
        const mapped: KiaraConversation[] = (data ?? []).map(row => ({
          id: row.id, name: row.contact_name, phone: row.contact_phone||'',leadOpportunityId:row.lead_opportunity_id,handoffReason:row.handoff_reason,
          status: row.status as KiaraConversation['status'], origin: row.origin,
          campaign: row.campaign, region: row.region, lastInteractionAt: row.last_interaction_at||row.created_at,
          messages: []
        }))
        if (!cancelled) {
          setConversations(previous => mapped.map(item => ({...item, messages: previous.find(old => old.id === item.id)?.messages ?? []})))
          setSelectedId(current => current && mapped.some(item=>item.id===current) ? current : mapped.find(item=>item.id===(initialConversationId||new URLSearchParams(window.location.search).get('conversationId')))?.id??mapped.find(item=>initialStatus==='all'||item.status===initialStatus)?.id??null)
          setError('')
        }
      } catch {
        if (!cancelled) setError('Ainda não foi possível consultar as conversas. A estrutura do banco deve ser revisada e ativada antes da sincronização.')
      } finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [access?.organizationId, access?.role, refresh,conversationLimit,activeReportMode,reportPeriod?.start,reportPeriod?.end])
  useEffect(() => {
    if (!selectedId || !access || !supabase) return
    let cancelled = false
    const loadMessages = async () => {
      setMessagesLoading(true)
      setMessagesError('')
      const { data, error: fetchError } = await supabase!.from('kiara_messages')
        .select('id,direction,sender,occurred_at,text_body')
        .eq('organization_id',access.organizationId)
        .eq('conversation_id',selectedId)
        .order('occurred_at',{ascending:false}).range(0,messageLimit-1)
      if (cancelled) return
      setMessagesLoading(false)
      if (fetchError) { setMessagesError('Não foi possível atualizar as mensagens desta conversa.'); return }
      const messages: KiaraMessage[] = (data??[]).map(row=>({id:row.id,direction:row.direction,sender:row.sender,createdAt:row.occurred_at,text:row.text_body||'[Mensagem não textual]'})).reverse()
      setConversations(current=>current.map(item=>item.id===selectedId?{...item,messages}:item))
    }
    void loadMessages()
    return ()=>{cancelled=true}
  },[selectedId,access?.organizationId,refresh,messageLimit])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(initialStatus)
  const [period,setPeriod] = useState<'all'|'7d'|'30d'>('all')
  const [showAdvancedFilters,setShowAdvancedFilters] = useState(false)
  const [campaignFilter, setCampaignFilter] = useState('all')
  const [regionFilter, setRegionFilter] = useState('all')
  const campaigns = useMemo(() => [...new Set(conversations.map(item => item.campaign).filter((value): value is string => Boolean(value)))].sort(), [conversations])
  const regions = useMemo(() => [...new Set(conversations.map(item => item.region).filter((value): value is string => Boolean(value)))].sort(), [conversations])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const selected = conversations.find(item => item.id === selectedId) ?? null
  useEffect(()=>{
    setOpportunityPhase('')
    if(!selected?.leadOpportunityId||!access||!supabase)return
    let active=true
    void supabase.from('sales_opportunities').select('stage,commercial_phase').eq('organization_id',access.organizationId).eq('id',selected.leadOpportunityId).maybeSingle().then(({data})=>{
      if(active&&data)setOpportunityPhase(data.commercial_phase||data.stage||'')
    })
    return ()=>{active=false}
  },[selected?.leadOpportunityId,access?.organizationId,refresh])
  const promote=async()=>{
    if(!selected||!access||promotionBusy)return
    if(!window.confirm('Enviar este contato para Prospecção? O sistema verificará registros existentes pelo telefone antes de criar uma oportunidade.'))return
    setPromotionBusy(true);setPromotionFeedback('')
    try{
      const result=await sendKiaraToProspecting(access.organizationId,selected.id)
      setConversations(list=>list.map(c=>c.id===selected.id?{...c,leadOpportunityId:result.opportunity_id}:c))
      setPromotionFeedback(result.created?'Oportunidade criada e vinculada na Prospecção.':'Contato vinculado a uma oportunidade já existente, sem duplicidade.')
      setRefresh(n=>n+1)
    }catch(e){setPromotionFeedback(e instanceof Error?e.message:'Não foi possível enviar à Prospecção.')}
    finally{setPromotionBusy(false)}
  }
  const sendHuman=async()=>{
    if(!selected||selected.status!=='human'||!humanText.trim()||humanSending||!kiaraHumanMessageConfigured)return
    setHumanSending(true);setHumanFeedback('');setHumanSent(false)
    try{
      const result=await sendKiaraHumanMessage(selected.id,humanText)
      setHumanSent(true)
      setHumanText('')
      setHumanFeedback(result.synchronized
        ?'Mensagem enviada por '+result.senderName+'.'
        :'Mensagem enviada por '+result.senderName+', mas o histórico ainda não confirmou a sincronização. Não repita antes de verificar no WhatsApp.')
      setRefresh(n=>n+1)
    }catch(err){setHumanFeedback(err instanceof Error?err.message:'Não foi possível confirmar o envio.')}
    finally{setHumanSending(false)}
  }
  const filtered = useMemo(() => conversations.filter(item => {
    const query = search.trim().toLocaleLowerCase('pt-BR')
    return (!query || [item.name, item.phone, item.campaign, item.origin, item.region].some(value => (value || '').toLocaleLowerCase('pt-BR').includes(query)))
      && (status === 'all' || item.status === status)
      && (period==='all' || (Number.isFinite(Date.parse(item.lastInteractionAt)) && Date.parse(item.lastInteractionAt)>=nowMs-(period==='7d'?7:30)*86400000))
      && (campaignFilter === 'all' || item.campaign === campaignFilter)
      && (regionFilter === 'all' || item.region === regionFilter)
      && (!from || dateOnly(item.lastInteractionAt) >= from)
      && (!to || dateOnly(item.lastInteractionAt) <= to)
  }), [conversations, search, status, period, nowMs, campaignFilter, regionFilter, from, to])
  useEffect(()=>{
    if(!filtered.some(item=>item.id===selectedId))setSelectedId(filtered[0]?.id??null)
  },[filtered,selectedId])
  const count = (key: KiaraConversation['status']) => conversations.filter(item => item.status === key).length
  const stats = selected ? leadResponseStats(selected.messages) : null
  const pendingMs = selected ? leadAwaitingResponseMs(selected.messages, nowMs) : null
  const lastInboundMs = selected ? leadLastInboundMs(selected.messages, nowMs) : null
  const waLink = selected ? `https://wa.me/${selected.phone.replace(/\D/g, '')}` : ''

  return <section className="kiara-page kiara-visual-v2">
    <header className="kiara-page-head">
      <div className="kiara-title-group">
        <span className="kiara-title-spark"><Sparkles size={27}/></span>
        <div><h1>Conversas</h1>
          <p>Consulte o histórico, filtre os atendimentos e intervenha quando necessário.</p></div>
      </div>
      <div className="kiara-head-actions">
        <label className="kiara-head-search"><Search size={18}/><input aria-label="Buscar contato, campanha ou região" placeholder="Buscar contato, campanha ou região..." value={search} onChange={event=>setSearch(event.target.value)}/></label>
        <button type="button" className="kiara-top-refresh" onClick={()=>setRefresh(value=>value+1)} aria-label="Atualizar dados" title="Atualizar dados"><RefreshCcw size={18}/></button>
      </div>
    </header>

    {activeReportMode&&<div className="kiara-conversation-filter-chip"><Filter size={16}/> Indicador: <strong>{activeReportMode==='started'?'Conversas iniciadas':activeReportMode==='ad_unanswered'?'Sem interação após anúncio':'Atendimento humano'}</strong><button type="button" onClick={()=>{setActiveReportMode(null);setConversationLimit(100)}}>Ver todas as conversas</button></div>}
    {status!=='all'&&<div className="kiara-conversation-filter-chip"><Filter size={16}/> Exibindo somente: <strong>{labels[status as KiaraConversation['status']]||status}</strong><button type="button" onClick={()=>setStatus('all')}>Limpar filtro</button></div>}
    <div className="kiara-conversations-toolbar">
      <div className="kiara-control-card">
        <div className="kiara-avatar" aria-label="Avatar oficial da Kiara"><img src={import.meta.env.BASE_URL+'kiara-avatar.webp'} alt="Kiara, atendente virtual da Fábrika Kriativa" /></div>
        <div className="kiara-control-copy">
          <div className="kiara-name-line"><h2><Sparkles size={20}/> Kiara</h2><span className={controlReady && kiaraEnabled?'kiara-live-pill':'kiara-preview-badge'}><span className="kiara-pill-dot"/> {controlReady ? (controlSimulated ? (kiaraEnabled ? 'Simulação ativa' : 'Simulação pausada') : (kiaraEnabled ? 'Kiara ativa' : 'Kiara pausada')) : 'Controle em homologação'}</span></div>
          <p>{controlSimulated ? 'AMBIENTE DE TESTES: os botões simulam ações no KV separado. Não alteram o WhatsApp nem o estado das conversas reais.' : 'Sua atendente digital acolhe, qualifica e direciona os leads da Fábrika Kriativa.'}</p>

          {controlFeedback&&<small role="status">{controlFeedback}</small>}
        </div>
          <div className="kiara-hero-actions">
            <button type="button" className="kiara-hero-pause" disabled={!controlReady || controlBusy || !kiaraEnabled} onClick={()=>void runCommand('pause_all')}><PauseCircle size={18}/> Pausar Kiara</button>
            <button type="button" className="kiara-hero-assume" disabled={!selected || !controlReady || controlBusy || selected.status==='human'} onClick={()=>selected&&void runCommand('assume',selected.id)}><UserRoundCheck size={18}/> Assumir conversa</button>
            <button type="button" className="kiara-hero-return" disabled={!selected || !controlReady || controlBusy || selected.status==='ai'} onClick={()=>selected&&void runCommand('return_to_ai',selected.id)}><RefreshCcw size={18}/> Devolver à Kiara</button>
            {controlReady && !kiaraEnabled && <button type="button" className="kiara-hero-return" disabled={controlBusy || access?.role!=='admin'} onClick={()=>void runCommand('resume_all')}><RefreshCcw size={18}/> Reativar</button>}
          </div>
      </div>
      <div className="kiara-conversation-shortcuts" aria-label="Indicadores e filtros rápidos">
        <button type="button" className={'kiara-shortcut-card green'+(status==='ai'?' selected':'')} onClick={()=>openStatusCard('ai')} aria-pressed={status==='ai'}>
          <span className="kiara-shortcut-icon"><MessageCircleMore size={17}/></span><span className="kiara-shortcut-copy"><strong>IA atendendo</strong><b>{statusCounts.ai}</b><small>Conversas com a Kiara</small></span><ChevronRight size={13} className="kiara-shortcut-arrow"/>
        </button>
        <button type="button" className={'kiara-shortcut-card amber'+(status==='waiting_human'?' selected':'')} onClick={()=>openStatusCard('waiting_human')} aria-pressed={status==='waiting_human'}>
          <span className="kiara-shortcut-icon"><UserRound size={17}/></span><span className="kiara-shortcut-copy"><strong>Aguardando humano</strong><b>{statusCounts.waiting_human}</b><small>Precisam de atenção</small></span><ChevronRight size={13} className="kiara-shortcut-arrow"/>
        </button>
        <button type="button" className={'kiara-shortcut-card blue'+(status==='human'?' selected':'')} onClick={()=>openStatusCard('human')} aria-pressed={status==='human'}>
          <span className="kiara-shortcut-icon"><Headset size={17}/></span><span className="kiara-shortcut-copy"><strong>Assumidas</strong><b>{statusCounts.human}</b><small>Atendimento humano</small></span><ChevronRight size={13} className="kiara-shortcut-arrow"/>
        </button>
        <button type="button" className="kiara-shortcut-card orange" onClick={onNavigateBudgets} disabled={!onNavigateBudgets} aria-label={'Orçamentos pendentes: '+statusCounts.budgets+'. Abrir aprovação'}>
          <span className="kiara-shortcut-icon"><ClipboardCheck size={17}/></span><span className="kiara-shortcut-copy"><strong>Orçamentos pendentes</strong><b>{statusCounts.budgets}</b><small>Aguardando sua aprovação</small></span><ChevronRight size={13} className="kiara-shortcut-arrow"/>
        </button>
      </div>
    </div>

    <div className="kiara-workspace">
      <div className="kiara-list-card">
        <div className="kiara-list-header-v3">
          <div className="kiara-list-tabs" role="group" aria-label="Filtrar conversas por atendimento">
            {([
              ['all','Todas',conversations.length],
              ['ai','IA',statusCounts.ai],
              ['waiting_human','Humano',statusCounts.waiting_human],
              ['human','Assumidas',statusCounts.human]
            ] as const).map(([key,label,total])=><button
              type="button" key={key} className={status===key?'active':''}
              aria-pressed={status===key} onClick={()=>setStatus(key)}>
              {label} <span>({total})</span>
            </button>)}
          </div>
          <div className="kiara-list-search-row">
            <label className="kiara-list-search"><Search size={16}/>
              <input type="search" aria-label="Buscar contato, campanha ou região"
                placeholder="Buscar contato ou mensagem…" value={search}
                onChange={e=>setSearch(e.target.value)}/>
            </label>
            <div className="kiara-list-filter-wrap">
              <button type="button" className={'kiara-list-filter-trigger'+(showAdvancedFilters?' active':'')}
                aria-label="Filtros da lista" aria-expanded={showAdvancedFilters}
                aria-controls="kiara-list-filter-panel"
                onClick={()=>setShowAdvancedFilters(v=>!v)}><Filter size={17}/></button>
              {showAdvancedFilters&&<div className="kiara-list-filter-popover" id="kiara-list-filter-panel">
                <strong>Filtrar conversas</strong>
                <label>Período<select aria-label="Selecionar período" value={period} onChange={e=>setPeriod(e.target.value as 'all'|'7d'|'30d')}>
                  <option value="all">Todo o histórico</option><option value="7d">Últimos 7 dias</option><option value="30d">Últimos 30 dias</option>
                </select></label>
                <label>Status<select aria-label="Filtrar por status" value={status} onChange={e=>setStatus(e.target.value)}>
                  <option value="all">Todos os status</option>{Object.entries(labels).map(([key,value])=><option key={key} value={key}>{value}</option>)}
                </select></label>
                <label>Campanha<select aria-label="Filtrar por campanha" value={campaignFilter} onChange={e=>setCampaignFilter(e.target.value)}>
                  <option value="all">Todas as campanhas</option>{campaigns.map(v=><option key={v} value={v}>{v}</option>)}
                </select></label>
                <label>Região<select aria-label="Filtrar por região" value={regionFilter} onChange={e=>setRegionFilter(e.target.value)}>
                  <option value="all">Todas as regiões</option>{regions.map(v=><option key={v} value={v}>{v}</option>)}
                </select></label>
                <div className="kiara-list-date-grid">
                  <label>De<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
                  <label>Até<input type="date" min={from||undefined} value={to} onChange={e=>setTo(e.target.value)}/></label>
                </div>
                <div className="kiara-list-filter-actions">
                  <button type="button" onClick={()=>{setPeriod('all');setStatus('all');setCampaignFilter('all');setRegionFilter('all');setFrom('');setTo('')}}>Limpar</button>
                  <button type="button" onClick={()=>setShowAdvancedFilters(false)}>Concluir</button>
                </div>
              </div>}
            </div>
          </div>
          <span className="kiara-list-count">{filtered.length} conversa{filtered.length===1?'':'s'} encontrada{filtered.length===1?'':'s'}</span>
        </div>
        {error&&<p role="alert" className="kiara-data-error">{error}</p>}
        <div className="kiara-lead-table-header" aria-hidden="true"><span>Contato</span><span>Origem / Campanha</span><span>Região</span><span>Status</span><span>Última interação</span><span/></div>
        {filtered.length===0?<div className="kiara-empty"><MessageCircle size={34}/><strong>{conversations.length?'Nenhuma conversa corresponde aos filtros':'Nenhum atendimento sincronizado ainda'}</strong><p>{conversations.length?'Experimente outro período ou remova os filtros.':'Os contatos aparecerão aqui à medida que forem sincronizados pelo WhatsApp. Nenhum contato fictício é exibido.'}</p></div>:
        <div className="kiara-lead-list">{filtered.map(item=><button type="button" key={item.id} className={selected?.id===item.id?'selected':''} onClick={()=>{setSelectedId(item.id);setMessageLimit(100);setCoachingMessage(null)}} aria-label={'Abrir conversa de '+(item.name||item.phone)}>
          <span className="kiara-lead-contact"><span className="kiara-initial">{(item.name||item.phone).slice(0,2).toUpperCase()}</span><span className="kiara-lead-main"><strong>{item.name||item.phone}</strong><small>{item.phone}</small></span></span>
          <span className="kiara-lead-origin"><strong>{item.campaign||item.origin||'Não identificada'}</strong><small>{item.origin||'Sem origem registrada'}</small></span>
          <span className="kiara-lead-region">{item.region||'Não informada'}</span>
          <span className={`kiara-status ${item.status}`}><span className="kiara-status-dot"/>{labels[item.status]}</span>
          <span className="kiara-lead-date">{new Date(item.lastInteractionAt).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
          <ChevronRight size={17} className="kiara-lead-chevron"/>
        </button>)}</div>}
        {conversations.length>=conversationLimit&&<button type="button" disabled={loading} onClick={()=>setConversationLimit(v=>v+100)}>Carregar mais conversas</button>}
        <div className="kiara-list-bottom"><span>Atualização automática a cada 90 segundos com a aba visível; histórico carregado sob demanda</span><button type="button" disabled={loading} onClick={()=>setRefresh(v=>v+1)}><RefreshCcw size={15}/> Atualizar</button></div>
      </div>

      <aside className="kiara-conversation-card">
        <div className="kiara-conversation-head">
          <div className="kiara-chat-person">
            <span className="kiara-chat-person-avatar">{selected?(selected.name||selected.phone).slice(0,2).toUpperCase():<MessageCircle size={19}/>}</span>
            <div><h2>{selected ? selected.name||selected.phone : 'Selecione uma conversa'}</h2><p>{selected?.phone||'Espelhamento do WhatsApp Business'}</p></div>
          </div>
          <div className="kiara-chat-head-actions">
            {selected&&<a href={waLink} target="_blank" rel="noopener noreferrer" aria-label="Abrir contato no WhatsApp" title="Abrir WhatsApp"><ExternalLink size={18}/></a>}
            <button type="button" aria-label="Atualizar mensagens" title="Atualizar mensagens" onClick={()=>setRefresh(n=>n+1)}><MoreVertical size={20}/></button>
          </div>
        </div>
        {selected?.status==='waiting_human'&&selected.handoffReason&&
         <p className="kiara-data-error" role="status"><strong>Motivo do encaminhamento:</strong> {selected.handoffReason}</p>}
        {selected?.campaign&&<div className="kiara-campaign-banner"><span><MessageCircleMore size={18}/> Lead vindo de campanha</span><strong>{selected.campaign}</strong><small>{selected.origin||'Origem não identificada'}{selected.region?' · '+selected.region:''}</small></div>}
        {selected&&<div className="kiara-prospect-strip">
          <div><strong>{selected.leadOpportunityId?'Vinculada à Prospecção':'Qualificar como oportunidade'}</strong>
          <small>{selected.leadOpportunityId?(opportunityPhase?'Fase comercial: '+opportunityPhase:'Histórico e oportunidade vinculados pelo Supabase.'):'Após a qualificação, envie o contato ao funil comercial sem duplicar o cadastro.'}</small></div>
          {selected.leadOpportunityId?<a href={prospectingUrl(selected.leadOpportunityId)} target="_blank" rel="noopener noreferrer">Abrir Prospecção <ExternalLink size={15}/></a>:
            <button type="button" disabled={promotionBusy||!access||!['admin','comercial'].includes(access.role)} onClick={()=>void promote()}>{promotionBusy?'Vinculando…':'Enviar à Prospecção'}</button>}
          {promotionFeedback&&<p role="status">{promotionFeedback}</p>}
        </div>}
        {messagesError && <p className="kiara-data-error" role="alert">{messagesError}</p>}
        {selected&&selected.messages.length>=messageLimit&&<button type="button" disabled={messagesLoading} onClick={()=>setMessageLimit(v=>v+100)}>Carregar mensagens anteriores</button>}
        <div className="kiara-chat" aria-label="Histórico da conversa">
          {messagesLoading && <p className="kiara-chat-loading" role="status">Atualizando mensagens…</p>}
          {!selected ? <div className="kiara-chat-placeholder"><MessageCircle size={34}/><p>As mensagens recebidas, respostas da Kiara e intervenções humanas aparecerão aqui.</p></div> :
          selected.messages.length===0 && !messagesLoading ? <div className="kiara-chat-placeholder"><MessageCircle size={26}/><p>Sem mensagens registradas para esta conversa.</p></div> : selected.messages.map(msg=><div key={msg.id} className={`kiara-bubble ${msg.direction}`}><span>{msg.text}</span><small>{msg.sender === 'kiara' ? 'Kiara · ' : msg.sender === 'human' ? 'Equipe · ' : ''}{new Date(msg.createdAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small>{msg.sender==='kiara'&&<button type="button" className="kiara-correct-msg" onClick={()=>{setCoachingMessage(msg);setShowCoaching(true)}}><Sparkles size={13}/> Corrigir resposta</button>}</div>)}
        </div>
        <div className="kiara-message-composer" aria-label="Resposta humana identificada">
          <span className="kiara-composer-emoticon">☺</span>
          <input type="text" value={humanText} maxLength={3000}
            disabled={!selected||selected.status!=='human'||!kiaraHumanMessageConfigured||humanSending||humanSent}
            placeholder={!kiaraHumanMessageConfigured?'Envio humano disponível após habilitação do Worker':selected?.status==='human'?'Escreva sua resposta (seu nome será incluído automaticamente)':'Assuma a conversa para responder'}
            aria-label="Mensagem do atendente"
            onChange={event=>setHumanText(event.target.value)}
            onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();void sendHuman()}}}/>
          <button type="button" disabled={!selected||selected.status!=='human'||!humanText.trim()||humanSending||humanSent||!kiaraHumanMessageConfigured}
            title="Enviar como usuário logado" aria-label="Enviar resposta humana" onClick={()=>void sendHuman()}><Send size={18}/></button>
        </div>
        {humanFeedback&&<p className="kiara-human-send-feedback" role="status">{humanFeedback}</p>}
        {humanSent&&<button type="button" className="kiara-human-next-message" onClick={()=>{setHumanSent(false);setHumanFeedback('')}}>Escrever outra mensagem</button>}
      </aside>
      <aside className="kiara-conversation-details" aria-label="Detalhes e ações do atendimento">
        <div className="kiara-detail-tabs" role="tablist" aria-label="Detalhes da conversa">
          {([
            ['summary','Resumo'],['qualification','Qualificação'],['budget','Orçamento'],['notes','Notas']
          ] as const).map(([key,label])=><button type="button" key={key} role="tab"
            id={'kiara-tab-'+key} aria-selected={detailTab===key} aria-controls="kiara-detail-panel"
            className={detailTab===key?'active':''} onClick={()=>setDetailTab(key)}>{label}</button>)}
        </div>
        <div className="kiara-details-scroll" role="tabpanel" id="kiara-detail-panel" aria-labelledby={'kiara-tab-'+detailTab}>
          {detailError&&<p role="alert" className="kiara-data-error">{detailError}</p>}
          {detailTab==='summary'&&<>
            <section className="kiara-details-section">
            <h3>Informações do contato</h3>
            <dl>
              <div><dt>Nome</dt><dd>{selected?.name||'Não informado'}</dd></div>
              <div><dt>WhatsApp</dt><dd>{selected?.phone||'Não informado'}</dd></div>
              <div><dt>Origem</dt><dd>{selected?.origin||'Não identificada'}</dd></div>
              <div><dt>Campanha</dt><dd>{selected?.campaign||'Não informada'}</dd></div>
              <div><dt>Região</dt><dd>{selected?.region||'Não informada'}</dd></div>
            </dl>
          </section>
          
            <section className="kiara-details-section kiara-details-response">
            <h3>Tempo de resposta</h3>
            <div className="kiara-time-card">
          <span><Clock3 size={16}/> Tempo médio de resposta do lead</span>
          <strong>{formatLeadResponseTime(stats?.averageMs??null)}</strong>
          <small>{stats?.samples ? `Calculado com ${stats.samples} resposta(s) do cliente após mensagem da loja (últimas 100 mensagens sincronizadas).` : 'Aparecerá quando houver respostas registradas.'}</small>
          <div className="kiara-time-divider"/>
          <span><Clock3 size={16}/> {pendingMs !== null ? 'Aguardando resposta do lead há' : 'Última mensagem do cliente'}</span>
          <strong>{pendingMs !== null ? formatLeadResponseTime(pendingMs) : lastInboundMs !== null ? `há ${formatLeadResponseTime(lastInboundMs)}` : 'Sem dados'}</strong>
          <small>{pendingMs !== null ? 'Contagem desde a última mensagem enviada pela Kiara ou pela equipe.' : 'O cliente não tem uma resposta pendente à última mensagem da loja.'}</small>
        </div>
          </section>

          </>}
          {detailTab==='qualification'&&<>
            <section className="kiara-details-section">
            <h3>Qualificação comercial</h3>
            <dl>
              <div><dt>Prospecção</dt><dd>{selected?.leadOpportunityId ? 'Oportunidade vinculada' : 'Ainda não vinculada'}</dd></div>
              {selected?.leadOpportunityId&&<div><dt>Fase comercial</dt><dd>{opportunityPhase||'Não informada'}</dd></div>}
            </dl>
          </section>
          
            <section className="kiara-details-section"><h3>Dados coletados</h3><p>Consulte as necessidades, ambientes, modelos e medidas informados no histórico da conversa. Campos não identificados permanecem sem preenchimento até a validação.</p></section>
          </>}
          {detailTab==='budget'&&<section className="kiara-details-section">
            <h3>Orçamentos da conversa</h3>
            {!selected?<p>Selecione uma conversa para consultar os orçamentos.</p>:contactBudgets.length===0?<p>Nenhum orçamento estruturado registrado para este contato.</p>:contactBudgets.map(b=><article className="kiara-detail-budget" key={b.id}>
              <strong>{b.status==='pending_review'?'Aguardando aprovação':b.status==='sent'?'Enviado':b.status==='approved'?'Aprovado':b.status==='rejected'?'Rejeitado':b.status}</strong>
              <small>{new Date(b.created_at).toLocaleString('pt-BR')}</small>
              <p>{b.customer_message}</p>
            </article>)}
            <p>As aprovações e revisões permanecem na área Regras de orçamento.</p>
          </section>}
          {detailTab==='notes'&&<section className="kiara-details-section kiara-private-notes">
            <h3>Notas internas</h3>
            <p>As notas são privadas da equipe e não são enviadas ao cliente nem utilizadas como instruções da Kiara.</p>
            <label htmlFor="kiara-note-input">Nova nota</label>
            <textarea id="kiara-note-input" rows={3} maxLength={3000} value={noteDraft} disabled={!selected||noteBusy}
              placeholder="Registre informações importantes sobre este atendimento…"
              onChange={e=>setNoteDraft(e.target.value)}/>
            <button type="button" onClick={()=>void saveContactNote()} disabled={!selected||!noteDraft.trim()||noteBusy}>{noteBusy?'Salvando…':'Salvar nota'}</button>
            {contactNotes.length===0?<p>Nenhuma nota registrada.</p>:contactNotes.map(n=><article key={n.id} className="kiara-private-note"><small>{new Date(n.created_at).toLocaleString('pt-BR')}</small><p>{n.body}</p></article>)}
          </section>}
        </div>
        <div className="kiara-details-actions">
          <h3>Ações</h3>
          <div className="kiara-coach-toggle">
            <button type="button" className="kiara-details-guide" onClick={()=>setShowCoaching(value=>!value)} disabled={!selected}><Sparkles size={17}/> {showCoaching?'Fechar orientação':'Orientar Kiara'} <span>Interno</span></button>
            <div className="kiara-coach-control">
              <button type="button" disabled={!selected || !holdReady || holdBusy} className={replyHeld?'kiara-hold-on':''} onClick={()=>void toggleHold()}>
                <PauseCircle size={17}/>{replyHeld?'Liberar (teste)':'Segurar resposta (teste)'}
              </button>
              {replyHeld&&<strong className="kiara-hold-warning">Retenção simulada nesta conversa — WhatsApp não foi pausado</strong>}
              {holdFeedback&&<small role="status">{holdFeedback}</small>}
            </div>
          </div>
          <div className="kiara-chat-actions">
            <button type="button" disabled={!selected || !controlReady || controlBusy || selected.status==='human'} onClick={()=>selected && void runCommand('assume',selected.id)}><Hand size={16}/> Assumir</button>
            <button type="button" disabled={!selected || !controlReady || controlBusy || selected.status==='ai'} onClick={()=>selected && void runCommand('return_to_ai',selected.id)}><RefreshCcw size={16}/> Devolver à Kiara</button>
          </div>
          {showCoaching&&<div className="kiara-details-coaching"><KiaraCoaching conversationId={selectedId} selectedMessage={coachingMessage} clearSelectedMessage={()=>setCoachingMessage(null)}/></div>}
          <p className="kiara-security"><ShieldAlert size={15}/> Comandos disponíveis somente após autorização do servidor.</p>
        </div>
      </aside>
    </div>
    <p className="kiara-footnote"><Activity size={15}/> O espelhamento depende de mensagens sincronizadas pelo Worker; a autorização dos comandos também depende da configuração segura do servidor.</p>
  </section>
}
