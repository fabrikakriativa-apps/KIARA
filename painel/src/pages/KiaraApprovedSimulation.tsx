import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {useAccess} from '../components/AuthorizedAccess'

type Category={name:string;costPerM2:number;active?:boolean}
type ModelCost={category:string;model:string;position:string;costPerM2:number;active?:boolean}
type Rail={id:string;label:string;costPerMeter:number;active?:boolean}
type Settings={
 models:string[];technicalLimits:{maxWidth:number;maxHeight:number;maxQuantity:number};
 categories:Category[];modelCosts:ModelCost[];rails:Rail[];
 installation:{manualPerFace:number;motorPerFace:number};
 motorization:{finalSaleSurcharge:number};pricing:{markupPercent:number}
}
type Config={settings:Settings;status:string;revision:number}
const money=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const parse=(text:string)=>Number(text.trim().replace(/\s/g,'').replace(',','.'))
const positive=(n:number)=>Number.isFinite(n)&&n>0

export function KiaraApprovedSimulation({draftMode=false}:{draftMode?:boolean}){
 const access=useAccess()
 const [config,setConfig]=useState<Config|null>(null)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [refresh,setRefresh]=useState(0)
 const [position,setPosition]=useState<'front'|'lining'>('front')
 const [model,setModel]=useState('')
 const [category,setCategory]=useState('')
 const [rail,setRail]=useState('')
 const [width,setWidth]=useState('')
 const [height,setHeight]=useState('')
 const [quantity,setQuantity]=useState('1')
 const [railQuantity,setRailQuantity]=useState('1')
 const [motorized,setMotorized]=useState(false)
 const [installation,setInstallation]=useState(true)
 useEffect(()=>{
  if(!supabase||!access){setLoading(false);setError('Supabase ou acesso não configurado.');return}
  let live=true
  setLoading(true);setError('');setConfig(null)
  void supabase.from('kiara_commercial_config')
   .select('settings,status,revision')
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
 const currentModel=position==='lining'?(models.includes('Franzida')?'Franzida':''):models.includes(model)?model:''
 const currentCategory=categories.find(x=>x.name===category)
 const currentRail=rails.find(x=>x.id===rail)
 const w=parse(width),h=parse(height),q=Number(quantity),rq=Number(railQuantity)
 const limit=settings?.technicalLimits
 const dimensionsValid=Boolean(limit&&positive(w)&&positive(h)&&w<=limit.maxWidth&&h<=limit.maxHeight&&Number.isInteger(q)&&q>=1&&q<=limit.maxQuantity)
 const railsValid=Number.isInteger(rq)&&rq>=0&&rq<=4&&(!rq||Boolean(currentRail))
 const costsValid=Boolean(settings&&Number.isFinite(settings.pricing.markupPercent)&&settings.pricing.markupPercent>=0&&settings.pricing.markupPercent<=500&&Number.isFinite(settings.installation.manualPerFace)&&settings.installation.manualPerFace>=0&&Number.isFinite(settings.installation.motorPerFace)&&settings.installation.motorPerFace>=0&&Number.isFinite(settings.motorization.finalSaleSurcharge)&&settings.motorization.finalSaleSurcharge>=0)
 const valid=Boolean(eligible&&dimensionsValid&&railsValid&&costsValid&&currentModel&&currentCategory)
 const specific=settings?.modelCosts.find(x=>x.active!==false&&x.model===currentModel&&x.category===category&&x.position===position&&positive(Number(x.costPerM2)))
 // Custos históricos por m² já contemplam confecção: não aplicar proporção novamente.
 const fabricUnitCost=Number(specific?.costPerM2??currentCategory?.costPerM2??0)
 const faceCost=valid?w*h*fabricUnitCost*q:0
 const railCost=valid&&currentRail?w*Number(currentRail.costPerMeter)*rq*q:0
 const installationCost=valid&&installation?q*(motorized?settings!.installation.motorPerFace:settings!.installation.manualPerFace):0
 const costTotal=faceCost+railCost+installationCost
 const saleBeforeMotor=costTotal*(1+Number(settings?.pricing.markupPercent||0)/100)
 const motorSurcharge=valid&&motorized?Number(settings!.motorization.finalSaleSurcharge)*q:0
 const suggested=valid?Math.round((saleBeforeMotor+motorSurcharge)*100)/100:null
 return <section className="kiara-management-card">
  <h2>{draftMode?'Teste de precificação — cortinas':'Simulador de cortinas — parâmetros aprovados'}</h2>
  <p>{draftMode?'Prévia experimental da revisão salva no Supabase, inclusive em rascunho. Não modifica dados, não aprova valores e não envia WhatsApp.':'Simulação interna, uma face por vez. Busca os custos e acréscimos na revisão aprovada do Supabase. Não cria orçamento, não grava proposta e não envia WhatsApp.'}</p>
  {loading?<p>Consultando configurações comerciais…</p>:error?<p role="alert">{error}</p>:!eligible?
   <p role="status">Cálculo bloqueado: {config?'a revisão '+config.revision+' permanece como rascunho':'não existe configuração comercial'} aprovada para cortinas. Revise e aprove em Configurações → Orçamentos antes de simular.</p>:
   <div className="kiara-pricing-form">
    <p><strong>{approved?'Configuração aprovada':'TESTE — RASCUNHO, NÃO APROVADO'}:</strong> revisão {config!.revision}</p>
    <label>Face<select value={position} onChange={e=>setPosition(e.target.value as 'front'|'lining')}><option value="front">Frente / face única</option><option value="lining">Forro</option></select></label>
    <label>Modelo de confecção<select value={currentModel} disabled={position==='lining'} onChange={e=>setModel(e.target.value)}><option value="">Selecione</option>{models.map(x=><option key={x} value={x}>{x}</option>)}</select>{position==='lining'&&<small>Forro sempre franzido no pré-orçamento. Outros acabamentos somente após avaliação personalizada.</small>}</label>
    <label>Categoria de tecido<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Selecione</option>{categories.map(x=><option key={x.name} value={x.name}>{x.name}</option>)}</select></label>
    <label>Largura (m)<input value={width} onChange={e=>setWidth(e.target.value)} inputMode="decimal" placeholder="3,30"/></label>
    <label>Altura (m)<input value={height} onChange={e=>setHeight(e.target.value)} inputMode="decimal" placeholder="2,65"/></label>
    <label>Quantidade de faces iguais<input type="number" min="1" max={limit?.maxQuantity||1} value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
    <label>Trilho<select value={rail} onChange={e=>setRail(e.target.value)}><option value="">Sem trilho / selecione</option>{rails.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
    <label>Trilhos por face<input type="number" min="0" max="4" value={railQuantity} onChange={e=>setRailQuantity(e.target.value)}/></label>
    <label><input type="checkbox" checked={installation} onChange={e=>setInstallation(e.target.checked)}/> Incluir instalação</label>
    <label><input type="checkbox" checked={motorized} onChange={e=>setMotorized(e.target.checked)}/> Motorizada</label>
    {!valid?<p role="status">Selecione modelo e tecido e informe medidas válidas dentro dos limites cadastrados. Se incluir trilhos, selecione o tipo.</p>:
    <div>
     <p><strong>{money(suggested!)}</strong> · {draftMode?'TESTE INTERNO, SEM VALIDADE COMERCIAL':'estimativa interna, não aprovada para envio'}</p>
     <details><summary>Memória de cálculo</summary><dl>
      <dt>Custo da face ({specific?'modelo + categoria':'média da categoria'})</dt><dd>{money(faceCost)}</dd>
      <dt>Trilhos</dt><dd>{money(railCost)}</dd>
      <dt>Instalação</dt><dd>{money(installationCost)}</dd>
      <dt>Custo acumulado</dt><dd>{money(costTotal)}</dd>
      <dt>Acréscimo comercial ({settings!.pricing.markupPercent}%)</dt><dd>{money(saleBeforeMotor-costTotal)}</dd>
      <dt>Adicional final de motorização</dt><dd>{money(motorSurcharge)}</dd>
     </dl></details>
    </div>}
    <small>Custos por m² incluem confecção. Proporções técnicas não multiplicam esses custos. A composição completa de frente + forro exige simular cada face e revisar a soma. Consulte também as regras de valores mínimos antes de fechar preços.</small>
   </div>}
  <button type="button" onClick={()=>setRefresh(x=>x+1)}>Recarregar configurações</button>
 </section>
}
