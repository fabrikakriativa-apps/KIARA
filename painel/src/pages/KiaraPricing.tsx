import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {useAccess} from '../components/AuthorizedAccess'

type Rule={id:string;category:string;description:string;composition:string;unit:string;unit_price:number;min_charge:number;active:boolean}
const currency=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const parseBR=(v:string)=>{const s=v.trim().replace(/\s/g,'');return Number(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s)}
export function KiaraPricing(){
 const access=useAccess()
 const [items,setItems]=useState<Rule[]>([]),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState('')
 const [category,setCategory]=useState('cortina'),[name,setName]=useState(''),[composition,setComposition]=useState(''),[unit,setUnit]=useState('m2'),[price,setPrice]=useState(''),[minimum,setMinimum]=useState('0')
 const [selected,setSelected]=useState(''),[width,setWidth]=useState(''),[height,setHeight]=useState(''),[quantity,setQuantity]=useState('1')
 useEffect(()=>{
  if(!access||!supabase)return
  let alive=true
  void supabase.from('kiara_pricing_rules').select('id,category,description,composition,unit,unit_price,min_charge,active').eq('organization_id',access.organizationId).order('created_at',{ascending:false}).then(({data,error})=>{
   if(alive){if(error)setFeedback('Falha ao carregar referências.');else setItems((data||[]) as Rule[])}
  })
  return()=>{alive=false}
 },[access?.organizationId,revision])
 async function save(e:React.FormEvent){
  e.preventDefault()
  if(!access||!supabase||access.role!=='admin'||busy)return
  const p=parseBR(price),m=parseBR(minimum)
  if(!Number.isFinite(p)||p<=0||!Number.isFinite(m)||m<0){setFeedback('Informe valores válidos.');return}
  setBusy(true)
  const {error}=await supabase.from('kiara_pricing_rules').insert({
   organization_id:access.organizationId,category,description:name.trim(),composition:composition.trim(),
   unit,unit_price:p,min_charge:m,active:false,created_by:access.userId
  })
  setBusy(false)
  if(error)setFeedback(error.message)
  else{setFeedback('Composição registrada, inicialmente inativa.');setName('');setComposition('');setPrice('');setRevision(n=>n+1)}
 }
 async function toggle(rule:Rule){
  if(!supabase||!access||access.role!=='admin')return
  setBusy(true)
  const {error}=await supabase.from('kiara_pricing_rules').update({active:!rule.active,updated_at:new Date().toISOString()}).eq('organization_id',access.organizationId).eq('id',rule.id)
  setBusy(false)
  if(error)setFeedback(error.message);else setRevision(n=>n+1)
 }
 const rule=items.find(x=>x.id===selected&&x.active)
 const w=parseBR(width),h=parseBR(height),q=Number(quantity)
 const valid=rule&&w>0&&w<=50&&Number.isInteger(q)&&q>=1&&q<=100&&(rule.unit==='linear'||h>0&&h<=20)
 const units=rule?.unit==='m2'?w*h:w
 const estimated=valid&&rule?Math.round(Math.max(Number(rule.min_charge),units*Number(rule.unit_price))*q*100)/100:null
 return <section className="kiara-management-card kiara-pricing"><h2>Referências comerciais e pré-orçamento</h2>
 <p>Cadastre o preço de venda da composição completa, informando o que está incluído. Frente e forro podem ser cadastrados separadamente. Nenhum preço desta tela é enviado ao cliente.</p>
 <h3>Composições cadastradas</h3>
 {items.length===0?<p>Nenhuma referência cadastrada.</p>:items.map(rule=><div className="kiara-pricing-line" key={rule.id}><div><strong>{rule.description}</strong><small>{rule.category} · {rule.composition} · {currency(Number(rule.unit_price))}/{rule.unit==='m2'?'m²':'m linear'}</small></div><span>{rule.active?'Ativa para simulação':'Inativa'}</span>{access?.role==='admin'&&<button type="button" disabled={busy} onClick={()=>void toggle(rule)}>{rule.active?'Desativar':'Ativar'}</button>}</div>)}
 {access?.role==='admin'&&<form className="kiara-pricing-form" onSubmit={e=>void save(e)}><h3>Nova composição</h3>
 <label>Produto<select value={category} onChange={e=>setCategory(e.target.value)}><option value="cortina">Cortina</option><option value="persiana">Persiana</option></select></label>
 <label>Nome<input required minLength={3} maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Voil wave"/></label>
 <label>O que está incluído<input required minLength={2} maxLength={160} value={composition} onChange={e=>setComposition(e.target.value)} placeholder="Ex.: frente + trilho + instalação"/></label>
 <label>Unidade<select value={unit} onChange={e=>setUnit(e.target.value)}><option value="m2">m²</option><option value="linear">Metro linear</option></select></label>
 <label>Preço de venda/unidade (R$)<input required value={price} onChange={e=>setPrice(e.target.value)} placeholder="Informe o valor real"/></label>
 <label>Mínimo por peça (R$)<input required value={minimum} onChange={e=>setMinimum(e.target.value)}/></label>
 <button type="submit" disabled={busy}>Salvar referência</button></form>}
 <div className="kiara-pricing-form"><h3>Simulador interno — uma peça por vez</h3>
 <label>Composição<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Selecione</option>{items.filter(x=>x.active).map(x=><option key={x.id} value={x.id}>{x.description} — {x.composition}</option>)}</select></label>
 <label>Largura (m)<input value={width} onChange={e=>setWidth(e.target.value)} placeholder="3,30"/></label>
 {rule?.unit==='m2'&&<label>Altura (m)<input value={height} onChange={e=>setHeight(e.target.value)} placeholder="2,65"/></label>}
 <label>Quantidade<input type="number" min="1" max="100" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
 {estimated!==null&&<p className="kiara-pricing-estimate"><strong>{currency(estimated)}</strong> · simulação interna, sujeita a conferência</p>}
 </div>
 <small>Não considera consumo de tecido, perdas, franzimento ou acessórios que não estejam incluídos na referência cadastrada. Não utiliza IA nem dispara mensagens.</small>
 {feedback&&<p role="status">{feedback}</p>}
 </section>
}
