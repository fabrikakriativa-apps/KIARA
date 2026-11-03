import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {useAccess} from '../components/AuthorizedAccess'
import {calculateCurtainCategoryQuote} from '../lib/curtainCategoryMath'
import type {CurtainPriceSettings} from '../lib/curtainCategoryMath'

type Stored={settings:CurtainPriceSettings;status:string;revision:number}
const money=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const parse=(s:string)=>s.trim()===''?NaN:Number(s.trim().replace(',','.'))

export function KiaraApprovedSimulation({draftMode=false}:{draftMode?:boolean}){
 const access=useAccess()
 const [stored,setStored]=useState<Stored|null>(null)
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[refresh,setRefresh]=useState(0)
 const [width,setWidth]=useState(''),[height,setHeight]=useState(''),[quantity,setQuantity]=useState('1')
 const [year,setYear]=useState(''),[category,setCategory]=useState(''),[lining,setLining]=useState(''),[withLining,setWithLining]=useState(false)
 const [rail,setRail]=useState(''),[rails,setRails]=useState('1'),[install,setInstall]=useState(true)
 useEffect(()=>{
  if(!access||!supabase){setError('Acesso indisponível.');setLoading(false);return}
  let live=true;setLoading(true);setError('')
  void supabase.from('kiara_commercial_config').select('settings,status,revision')
   .eq('organization_id',access.organizationId).eq('product','cortina').maybeSingle().then(({data,error:e})=>{
    if(!live)return
    setStored(data as Stored|null)
    if(e)setError('Erro ao consultar configuração: '+e.message)
    if(data?.settings?.referenceYear)setYear(String(data.settings.referenceYear))
    setLoading(false)
   })
  return()=>{live=false}
 },[access?.organizationId,refresh])
 const permitted=Boolean(stored&&(stored.status==='approved'||draftMode&&access?.role==='admin'))
 const settings=permitted?stored!.settings:null
 const faces=[{width:parse(width),height:parse(height),quantity:Number(quantity),year:Number(year),category,includeInstallation:install},
  ...(withLining?[{width:parse(width),height:parse(height),quantity:Number(quantity),year:Number(year),category:lining,includeInstallation:install}]:[])]
 const quote=settings?calculateCurtainCategoryQuote(settings,faces,rail,Number(rails)):null
 return <section className="kiara-commercial-test-section">
  <h3>{draftMode?'Homologação comercial — cortinas':'Simulador interno — cortinas'}</h3>
  <p>Valores calculados exclusivamente pelos parâmetros comerciais do Supabase, por categoria e face de tecido. O trilho é contabilizado uma vez. Não envia mensagens ao WhatsApp.</p>
  {loading?<p>Carregando parâmetros…</p>:error?<p role="alert">{error}</p>:!permitted?
   <p role="status">Simulação indisponível: {stored?'configuração em rascunho':'configuração não cadastrada'}. Utilize a homologação dentro de Configurações com acesso de administrador.</p>:<>
    <p><strong>{stored?.status==='approved'?'Revisão aprovada para uso interno':'Rascunho — somente teste interno'}</strong> · revisão {stored?.revision}</p>
    <div className="kiara-pricing-form">
     <label>Categoria da frente<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Selecione</option>{settings!.categories.filter(x=>x.active!==false).map(x=><option key={x.name}>{x.name}</option>)}</select></label>
     <label>Composição<select value={withLining?'dupla':'simples'} onChange={e=>setWithLining(e.target.value==='dupla')}><option value="simples">Frente</option><option value="dupla">Frente + forro</option></select></label>
     {withLining&&<label>Categoria do forro<select value={lining} onChange={e=>setLining(e.target.value)}><option value="">Selecione</option>{settings!.categories.filter(x=>x.active!==false).map(x=><option key={x.name}>{x.name}</option>)}</select></label>}
     <label>Largura (m)<input value={width} onChange={e=>setWidth(e.target.value)} inputMode="decimal"/></label>
     <label>Altura (m)<input value={height} onChange={e=>setHeight(e.target.value)} inputMode="decimal"/></label>
     <label>Quantidade de conjuntos<input type="number" min="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
     <label>Trilho<select value={rail} onChange={e=>setRail(e.target.value)}><option value="">Selecione</option>{settings!.rails.filter(x=>x.active!==false).map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
     <label>Trilhos físicos por conjunto<input type="number" min="0" max="4" value={rails} onChange={e=>setRails(e.target.value)}/></label>
     <label>Ano de referência<input type="number" value={year} onChange={e=>setYear(e.target.value)}/></label>
     <label><input type="checkbox" checked={install} onChange={e=>setInstall(e.target.checked)}/> Incluir instalação por face</label>
    </div>
    {quote?.ready?<div>
     <p><strong>Pré-orçamento interno: {money(quote.sale)}</strong> — revisão humana obrigatória</p>
     {quote.faces.map((face,i)=><p key={i}>{i?'Forro':'Frente'}: {money(face.fabric)} tecido + {money(face.installation)} instalação</p>)}
     <p>Trilho: {money(quote.rails)} · Custo total: {money(quote.cost)} · Acréscimo: {quote.markupPercent}%.</p>
    </div>:<p role="status">{quote&&!quote.ready?quote.errors.join('. '):'Preencha os campos.'}</p>}
   </>}
  <button type="button" onClick={()=>setRefresh(n=>n+1)}>Recarregar parâmetros</button>
 </section>
}
