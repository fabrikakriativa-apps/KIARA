import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {useAccess} from '../components/AuthorizedAccess'

type Contact={id:string;contact_name:string|null;contact_phone:string|null}
const initial={conversationId:'',environment:'',item:'',dimensions:'',material:'',details:'',price:'',message:''}
export function KiaraBudgetDraftForm({onCreated}:{onCreated:()=>void}){
 const access=useAccess(),[contacts,setContacts]=useState<Contact[]>([]),[form,setForm]=useState(initial),[saving,setSaving]=useState(false),[error,setError]=useState(''),[open,setOpen]=useState(false)
 useEffect(()=>{
  if(!access||!supabase||!open)return
  let live=true
  void supabase.from('kiara_conversations').select('id,contact_name,contact_phone').eq('organization_id',access.organizationId).order('last_interaction_at',{ascending:false}).limit(200).then(({data,error:e})=>{
   if(!live)return
   if(e)setError('Não foi possível consultar os contatos.');else setContacts((data||[]) as Contact[])
  })
  return()=>{live=false}
 },[access?.organizationId,open])
 const set=(name:keyof typeof initial,value:string)=>setForm(f=>({...f,[name]:value}))
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault()
  if(!supabase||!access||saving)return
  const normalizedPrice=form.price.trim().replace(/\s/g,'').replace(/\./g,'').replace(',','.')
  const price=Number(normalizedPrice)
  if(!Number.isFinite(price)||price<=0){setError('Informe um valor positivo para conferência.');return}
  if(!form.conversationId){setError('Selecione a conversa correspondente.');return}
  setSaving(true);setError('')
  const budget={environment:form.environment.trim(),item:form.item.trim(),dimensions:form.dimensions.trim(),material:form.material.trim(),details:form.details.trim(),price_brl:price.toFixed(2),currency:'BRL',source:'manual_draft'}
  const {error:e}=await supabase.rpc('kiara_create_budget_draft',{p_org_id:access.organizationId,p_conversation_id:form.conversationId,p_budget:budget,p_customer_message:form.message.trim()})
  setSaving(false)
  if(e){setError(e.message);return}
  setForm(initial);setOpen(false);onCreated()
 }
 if(!access||!['admin','comercial'].includes(access.role))return null
 return <section className="kiara-management-card"><div className="kiara-draft-header"><div><h2>Novo orçamento para revisão</h2><p>Registre uma proposta já calculada, sem enviar mensagem ao cliente.</p></div><button type="button" onClick={()=>setOpen(x=>!x)}>{open?'Fechar':'Criar rascunho'}</button></div>
 {open&&<form className="kiara-draft-form" onSubmit={e=>void submit(e)}>
 <label>Conversa do cliente<select required value={form.conversationId} onChange={e=>set('conversationId',e.target.value)}><option value="">Selecione o contato</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.contact_name||c.contact_phone||'Contato sem nome'} · {c.contact_phone||''}</option>)}</select></label>
 <label>Ambiente<input required minLength={2} value={form.environment} onChange={e=>set('environment',e.target.value)} placeholder="Ex.: Sala"/></label>
 <label>Produto / serviço<input required minLength={3} value={form.item} onChange={e=>set('item',e.target.value)} placeholder="Ex.: Cortina wave"/></label>
 <label>Medidas informadas<input required minLength={3} value={form.dimensions} onChange={e=>set('dimensions',e.target.value)} placeholder="Ex.: 3,30 m L × 2,65 m A"/></label>
 <label>Tecido / material<input value={form.material} onChange={e=>set('material',e.target.value)} placeholder="Ex.: Voil de linho, com forro"/></label>
 <label>Composição e observações<textarea value={form.details} onChange={e=>set('details',e.target.value)} rows={3} placeholder="Trilho, acabamento, instalação e outras informações já confirmadas"/></label>
 <label>Valor total informado (R$)<input required inputMode="decimal" value={form.price} onChange={e=>set('price',e.target.value)} placeholder="Ex.: 3.150,00"/></label>
 <label>Mensagem estruturada proposta ao cliente<textarea required minLength={15} maxLength={5000} rows={5} value={form.message} onChange={e=>set('message',e.target.value)} placeholder="Texto completo para conferência antes de qualquer envio"/></label>
 {error&&<p role="alert">{error}</p>}
 <button type="submit" disabled={saving}>{saving?'Registrando…':'Salvar na fila de aprovação'}</button>
 <small>O registro permanece como aguardando aprovação. Não gera cálculo, não autoriza nem envia mensagens pelo WhatsApp.</small>
 </form>}</section>
}
