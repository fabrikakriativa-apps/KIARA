import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {useAccess} from '../components/AuthorizedAccess'

type Category={name:string;costPerM2:number;active?:boolean}
type ModelCost={category:string;model:string;position:'front'|'lining';costPerM2:number;active?:boolean}
type Rail={id:string;label:string;costPerMeter:number;active?:boolean}
type Settings={
 models:string[];technicalLimits:{maxWidth:number;maxHeight:number;maxQuantity:number};
 categories:Category[];modelCosts:ModelCost[];rails:Rail[];
 installation:{manualPerFace:number;motorPerFace:number};
 motorization:{finalSaleSurcharge:number};pricing:{markupPercent:number}
}
type Config={settings:Settings;status:string;revision:number}
type CalculationInput={
 settings:Settings;width:number;height:number;quantity:number;
 frontModel:string;frontCategory:string;liningCategory:string|null;
 railId:string;railsPerSet:number;includeInstallation:boolean;motorized:boolean
}
type Calculation={front:number;lining:number;rails:number;installation:number;cost:number;markup:number;motor:number;sale:number;frontSource:string;liningSource:string}
const money=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const parse=(v:string)=>v.trim()===''?NaN:Number(v.trim().replace(/\s/g,'').replace(',','.'))
const positive=(n:number)=>Number.isFinite(n)&&n>0
const round=(n:number)=>Math.round((n+Number.EPSILON)*100)/100

// A referência de custo por m² já inclui a confecção e não recebe outro multiplicador.
function costByFace(settings:Settings,category:string,model:string,position:'front'|'lining'){
 const base=settings.categories.find(c=>c.name===category&&c.active!==false&&positive(Number(c.costPerM2)))
 if(!base)return null
 const special=settings.modelCosts.find(c=>c.category===category&&c.model===model&&c.position===position&&c.active!==false&&positive(Number(c.costPerM2)))
 return {unit:Number(special?.costPerM2??base.costPerM2),source:special?'modelo + categoria':'média da categoria'}
}
function calculate(input:CalculationInput):Calculation|null{
 const {settings,width,height,quantity,frontModel,frontCategory,liningCategory,railId,railsPerSet,includeInstallation,motorized}=input
 const limit=settings.technicalLimits
 if(!limit||!positive(width)||!positive(height)||width>limit.maxWidth||height>limit.maxHeight||!Number.isInteger(quantity)||quantity<1||quantity>limit.maxQuantity)return null
 if(!settings.models.includes(frontModel)||liningCategory!==null&&!settings.models.includes('Franzida'))return null
 if(!Number.isInteger(railsPerSet)||railsPerSet<0||railsPerSet>4)return null
 const frontCost=costByFace(settings,frontCategory,frontModel,'front')
 const liningCost=liningCategory===null?null:costByFace(settings,liningCategory,'Franzida','lining')
 if(!frontCost||liningCategory!==null&&!liningCost)return null
 const rail=railsPerSet===0?null:settings.rails.find(r=>r.id===railId&&r.active!==false&&positive(Number(r.costPerMeter)))
 if(railsPerSet>0&&!rail)return null
 const {installation,motorization,pricing}=settings
 if(![installation.manualPerFace,installation.motorPerFace,motorization.finalSaleSurcharge,pricing.markupPercent].every(n=>Number.isFinite(n)&&n>=0)||pricing.markupPercent>500)return null
 const area=width*height*quantity
 const front=area*frontCost.unit
 const lining=area*(liningCost?.unit??0)
 // Trilhos e instalação são definidos para o conjunto, não para cada tecido.
 const rails=width*Number(rail?.costPerMeter??0)*railsPerSet*quantity
 const installationCost=includeInstallation?quantity*(motorized?installation.motorPerFace:installation.manualPerFace):0
 const cost=front+lining+rails+installationCost
 const markup=cost*pricing.markupPercent/100
 const motor=motorized?motorization.finalSaleSurcharge*quantity:0
 return {front,lining,rails,installation:installationCost,cost,markup,motor,sale:round(cost+markup+motor),frontSource:frontCost.source,liningSource:liningCost?.source??''}
}
export function KiaraApprovedSimulation({draftMode=false}:{draftMode?:boolean}){
 const access=useAccess()
 const [config,setConfig]=useState<Config|null>(null)
 const [loading,setLoading]=useState(true),[error,setError]=useState('')
 const [refresh,setRefresh]=useState(0)
 const [withLining,setWithLining]=useState(false)
 const [model,setModel]=useState('')
 const [frontCategory,setFrontCategory]=useState('')
 const [liningCategory,setLiningCategory]=useState('Forro convencional')
 const [rail,setRail]=useState('')
 const [width,setWidth]=useState(''),[height,setHeight]=useState('')
 const [quantity,setQuantity]=useState('1'),[railQuantity,setRailQuantity]=useState('1')
 const [motorized,setMotorized]=useState(false),[installation,setInstallation]=useState(true)
 useEffect(()=>{
  if(!supabase||!access){setLoading(false);setError('Supabase ou acesso não configurado.');return}
  let live=true
  setLoading(true);setError('');setConfig(null)
  void supabase.from('kiara_commercial_config').select('settings,status,revision')
   .eq('organization_id',access.organizationId).eq('product','cortina').maybeSingle()
   .then(({data,error:e})=>{
    if(!live)return
    setLoading(false)
    if(e)setError('Falha ao consultar configurações comerciais: '+e.message)
    else setConfig(data as Config|null)
   })
  return()=>{live=false}
 },[access?.organizationId,refresh])
 const approved=config?.status==='approved'
 const eligible=Boolean(config&&(approved||draftMode&&access?.role==='admin'))
 const settings=eligible?config!.settings:null
 const categories=settings?.categories.filter(c=>c.active!==false&&positive(Number(c.costPerM2)))||[]
 const rails=settings?.rails.filter(r=>r.active!==false&&positive(Number(r.costPerMeter)))||[]
 const models=settings?.models.filter(Boolean)||[]
 const w=parse(width),h=parse(height),q=Number(quantity),rq=Number(railQuantity)
 const calculation=settings?calculate({
  settings,width:w,height:h,quantity:q,frontModel:model,frontCategory,
  liningCategory:withLining?liningCategory:null,
  railId:rail,railsPerSet:rq,includeInstallation:installation,motorized
 }):null
 const dimensionalException=Boolean(settings&&((positive(w)&&w>settings.technicalLimits.maxWidth)||(positive(h)&&h>settings.technicalLimits.maxHeight)||(Number.isFinite(q)&&q>settings.technicalLimits.maxQuantity)))
 return <section className="kiara-management-card">
  <h2>{draftMode?'Teste de precificação — cortinas':'Simulador de cortinas — parâmetros aprovados'}</h2>
  <p>Composição completa, em um único cálculo. Frente e forro têm custos separados; trilhos, instalação e motorização são cobrados por conjunto. Não cria propostas nem envia mensagens pelo WhatsApp.</p>
  {loading?<p>Consultando configurações comerciais…</p>:error?<p role="alert">{error}</p>:!eligible?
   <p role="status">Cálculo bloqueado: {config?'a revisão '+config.revision+' está em rascunho':'não existe configuração comercial'} aprovada para cortinas. O teste de rascunho está disponível somente ao administrador em Configurações → Orçamentos.</p>:
   <div className="kiara-pricing-form">
    <p><strong>{approved?'Configuração aprovada':'TESTE — RASCUNHO, NÃO APROVADO'}:</strong> revisão {config!.revision}</p>
    <label>Composição<select value={withLining?'with-lining':'front'} onChange={e=>setWithLining(e.target.value==='with-lining')}><option value="front">Somente frente</option><option value="with-lining">Frente + forro</option></select></label>
    <label>Modelo da frente<select value={model} onChange={e=>setModel(e.target.value)}><option value="">Selecione</option>{models.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    <label>Categoria do tecido da frente<select value={frontCategory} onChange={e=>setFrontCategory(e.target.value)}><option value="">Selecione</option>{categories.map(x=><option key={x.name} value={x.name}>{x.name}</option>)}</select></label>
    {withLining&&<label>Categoria do forro<select value={liningCategory} onChange={e=>setLiningCategory(e.target.value)}><option value="">Selecione</option>{categories.map(x=><option key={x.name} value={x.name}>{x.name}</option>)}</select><small>Modelo do forro: Franzida (fixo no pré-orçamento).</small></label>}
    <label>Largura (m)<input value={width} onChange={e=>setWidth(e.target.value)} inputMode="decimal" placeholder="3,30"/></label>
    <label>Altura (m)<input value={height} onChange={e=>setHeight(e.target.value)} inputMode="decimal" placeholder="2,65"/></label>
    <label>Quantidade de conjuntos<input type="number" min="1" max={settings!.technicalLimits.maxQuantity} value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
    <label>Tipo de trilho<select value={rail} onChange={e=>setRail(e.target.value)}><option value="">Selecione o trilho</option>{rails.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
    <label>Quantidade de trilhos por conjunto<input type="number" min="0" max="4" value={railQuantity} onChange={e=>setRailQuantity(e.target.value)}/><small>Informe o total para frente e forro; o sistema não duplica por tecido.</small></label>
    <label><input type="checkbox" checked={installation} onChange={e=>setInstallation(e.target.checked)}/> Incluir instalação por conjunto</label>
    <label><input type="checkbox" checked={motorized} onChange={e=>setMotorized(e.target.checked)}/> Motorizada</label>
    {!calculation?<p role="status">{dimensionalException?'Medidas ou quantidade fora do limite. Encaminhar para atendimento personalizado.':'Informe modelo, categorias, medidas e trilhos válidos para calcular. Composições não cadastradas exigem avaliação personalizada.'}</p>:
    <div>
     <p><strong>{money(calculation.sale)}</strong> · {draftMode?'TESTE INTERNO, SEM VALIDADE COMERCIAL':'estimativa interna, não aprovada para envio'}</p>
     <details><summary>Memória de cálculo</summary><dl>
      <dt>Área por face</dt><dd>{(w*h*q).toLocaleString('pt-BR',{maximumFractionDigits:3})} m²</dd>
      <dt>Frente ({calculation.frontSource})</dt><dd>{money(calculation.front)}</dd>
      {withLining&&<><dt>Forro Franzida ({calculation.liningSource})</dt><dd>{money(calculation.lining)}</dd></>}
      <dt>Trilhos ({rq} por conjunto)</dt><dd>{money(calculation.rails)}</dd>
      <dt>Instalação (uma por conjunto)</dt><dd>{money(calculation.installation)}</dd>
      <dt>Custo total</dt><dd>{money(calculation.cost)}</dd>
      <dt>Acréscimo comercial ({settings!.pricing.markupPercent}%)</dt><dd>{money(calculation.markup)}</dd>
      <dt>Adicional final de motorização</dt><dd>{money(calculation.motor)}</dd>
     </dl></details>
    </div>}
    <small>Custos por m² já incluem confecção e não são multiplicados pela proporção. O forro é sempre Franzida neste pré-orçamento. Confira trilhos e valores mínimos antes de aprovar uma proposta. Resultados experimentais não autorizam envio ao cliente.</small>
   </div>}
  <button type="button" onClick={()=>setRefresh(x=>x+1)}>Recarregar configurações</button>
 </section>
}
