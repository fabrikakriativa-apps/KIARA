import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {useAccess} from '../components/AuthorizedAccess'

type Category={name:string;active?:boolean;adjustedCostPerM2:number;rawCostPerM2?:number;tier?:string}
type Settings={methodology:string;categories:Category[];markupPercent:number;installationPerPiece:number;installationMotorPerPiece?:number;installationIncluded:boolean}
type Saved={settings:Settings;status:string;revision:number}
const money=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const parse=(s:string)=>s.trim()===''?NaN:Number(s.trim().replace(',','.'))
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100

/** Prévia INTERNA da mesma metodologia blind_average_m2_v1 usada no Worker. */
export function KiaraBlindCommercialPreview(){
 const access=useAccess()
 const [saved,setSaved]=useState<Saved|null>(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [category,setCategory]=useState('')
 const [width,setWidth]=useState('')
 const [height,setHeight]=useState('')
 const [quantity,setQuantity]=useState('1')
 const [scope,setScope]=useState<'total'|'per_piece'>('total')
 const [drive,setDrive]=useState<'manual'|'motorizada'>('manual')
 useEffect(()=>{
  if(!supabase||!access){setError('Acesso indisponível.');setLoading(false);return}
  let active=true
  void supabase.from('kiara_commercial_config').select('settings,status,revision')
   .eq('organization_id',access.organizationId).eq('product','persiana').maybeSingle()
   .then(({data,error:e})=>{
    if(!active)return
    if(e)setError('Não foi possível consultar a configuração comercial.')
    else setSaved(data as Saved|null)
    setLoading(false)
   })
  return()=>{active=false}
 },[access?.organizationId])
 if(loading)return <p>Carregando precificação de persianas…</p>
 if(error)return <p role="alert">{error}</p>
 const s=saved?.settings
 if(!s||s.methodology!=='blind_average_m2_v1')return <p role="alert">Configuração comercial por categorias ainda não disponível.</p>
 const models=(s.categories||[]).filter(x=>x.active!==false)
 const chosen=models.find(x=>x.name===category)
 const w=parse(width),h=parse(height),q=Number(quantity)
 const valid=!!chosen&&Number.isFinite(w)&&w>0&&w<=30&&Number.isFinite(h)&&h>0&&h<=10&&Number.isInteger(q)&&q>=1&&q<=20&&
  Number.isFinite(s.installationPerPiece)&&s.installationPerPiece>=0&&
  Number.isFinite(s.markupPercent)&&s.markupPercent>=0&&s.markupPercent<=500&&s.installationIncluded===true
 const area=valid?w*h*(scope==='per_piece'?q:1):0
 const material=valid?area*chosen!.adjustedCostPerM2:0
 const installation=valid?q*s.installationPerPiece:0
 const price=valid?round((material+installation)*(1+s.markupPercent/100)):null
 return <section className="kiara-blinds-panel">
  <h3>Persianas — categorias comerciais vigentes</h3>
  <p>A configuração abaixo vem do Supabase, conforme a calculadora de homologação. A simulação é exclusivamente interna, não envia mensagens e sempre exige revisão humana.</p>
  <p><strong>Estado:</strong> {saved?.status==='approved'?'Aprovada':'Rascunho — uso somente em homologação'} · Revisão {saved?.revision}</p>
  <p><strong>Instalação manual:</strong> {money(s.installationPerPiece)} por unidade · <strong>Motorizada:</strong> {money(s.installationMotorPerPiece??150)} por unidade (somente atendimento humano).</p>
  <p><strong>Acréscimo comercial:</strong> {s.markupPercent}% · Instalação inclusa na composição antes do acréscimo.</p>
  <h4>Categorias comerciais</h4>
  <ul>{models.map(x=><li key={x.name}>{x.name} — custo ajustado {money(x.adjustedCostPerM2)}/m² {x.tier?' · '+x.tier:''}</li>)}</ul>
  <h4>Simulação interna — apenas persianas manuais</h4>
  <div className="kiara-pricing-form">
   <label>Categoria<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Selecione</option>{models.map(x=><option key={x.name} value={x.name}>{x.name}</option>)}</select></label>
   <label>Largura (m)<input inputMode="decimal" value={width} onChange={e=>setWidth(e.target.value)}/></label>
   <label>Altura (m)<input inputMode="decimal" value={height} onChange={e=>setHeight(e.target.value)}/></label>
   <label>Quantidade de peças<input type="number" min="1" max="20" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
   <label>As medidas são<select value={scope} onChange={e=>setScope(e.target.value as 'total'|'per_piece')}><option value="total">Do vão inteiro / total</option><option value="per_piece">De cada peça</option></select></label>
   <label>Acionamento<select value={drive} onChange={e=>setDrive(e.target.value as 'manual'|'motorizada')}><option value="manual">Manual</option><option value="motorizada">Motorizada</option></select></label>
  </div>
  {drive==='motorizada'?<p role="status"><strong>Atendimento humano obrigatório.</strong> A Kiara não calcula nem apresenta preços de motorizadas.</p>:
   price===null?<p role="status">Selecione a categoria e informe medidas, quantidade e escopo válidos.</p>:
   <div><p><strong>Estimativa interna: {money(price)}</strong> — depende de aprovação humana.</p>
    <p>Material: {money(material)} · Instalação: {money(installation)} ({q} × {money(s.installationPerPiece)}) · Acréscimo: {s.markupPercent}%.</p>
    <p>Área considerada: {round(area).toLocaleString('pt-BR')} m². A divisão das folhas, limites técnicos e características do local devem ser validados antes da proposta.</p>
   </div>}
  <small>Não substitui a triagem da conversa: nome, localização, produto, modelo/categoria, medidas e escopo, quantidade e acionamento precisam ser confirmados. Não autoriza preço automático ao cliente.</small>
 </section>
}
