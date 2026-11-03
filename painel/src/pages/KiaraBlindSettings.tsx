import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {useAccess} from '../components/AuthorizedAccess'

type BlindModel={id:string;name:string;costPerM2:number|null;minCost:number|null;active:boolean}
type BlindSettings={
 version:number
 models:BlindModel[]
 technicalLimits:{maxPieceWidth:number;maxPieceHeight:number;maxPieces:number;overlapCm:number}
 installation:{manualPerPiece:number|null;motorPerPiece:number|null}
 motorization:{saleSurchargePerPiece:number|null}
 pricing:{markupPercent:number|null}
 notes:string
}
type Saved={settings:BlindSettings;revision:number;status:string}
const initial=():BlindSettings=>({
 version:1,models:[],
 technicalLimits:{maxPieceWidth:2.4,maxPieceHeight:2.7,maxPieces:20,overlapCm:10},
 installation:{manualPerPiece:null,motorPerPiece:null},
 motorization:{saleSurchargePerPiece:null},pricing:{markupPercent:null},notes:''
})
const real=(n:number|null)=>n!==null&&Number.isFinite(n)&&n>=0
const numeric=(v:string):number|null=>v.trim()===''?null:Number(v)
const fmt=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
function validate(settings:BlindSettings){
 const errors:string[]=[]
 const t=settings.technicalLimits
 if(!Number.isFinite(t.maxPieceWidth)||t.maxPieceWidth<=0||!Number.isFinite(t.maxPieceHeight)||t.maxPieceHeight<=0)errors.push('Informe limites de largura e altura válidos.')
 if(!Number.isInteger(t.maxPieces)||t.maxPieces<1||!Number.isFinite(t.overlapCm)||t.overlapCm<0)errors.push('Confira a quantidade de peças e a sobreposição.')
 if(settings.models.length===0)errors.push('Cadastre pelo menos um modelo de persiana.')
 if(settings.models.some(m=>!m.id.trim()||!m.name.trim()||!real(m.costPerM2)||!real(m.minCost)||m.costPerM2===0))errors.push('Cada modelo precisa de código, nome, custo por m² e custo mínimo válidos.')
 if(new Set(settings.models.map(m=>m.id.trim())).size!==settings.models.length)errors.push('Os códigos dos modelos não podem se repetir.')
 const values=[settings.installation.manualPerPiece,settings.installation.motorPerPiece,settings.motorization.saleSurchargePerPiece,settings.pricing.markupPercent]
 if(values.some(v=>!real(v)))errors.push('Preencha instalação, motorização e acréscimo comercial.')
 if((settings.pricing.markupPercent??0)>500)errors.push('Acréscimo comercial acima do limite de validação.')
 return errors
}
export function KiaraBlindSettings(){
 const access=useAccess(),admin=access?.role==='admin'
 const [data,setData]=useState<BlindSettings>(initial)
 const [stored,setStored]=useState<Saved|null>(null)
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false)
 const [dirty,setDirty]=useState(false),[notice,setNotice]=useState('')
 const [refresh,setRefresh]=useState(0)
 const [modelId,setModelId]=useState(''),[width,setWidth]=useState(''),[height,setHeight]=useState(''),[pieces,setPieces]=useState('1'),[motorized,setMotorized]=useState(false)
 useEffect(()=>{
  if(!access||!supabase){setLoading(false);return}
  let alive=true;setLoading(true)
  void supabase.from('kiara_commercial_config').select('settings,status,revision')
   .eq('organization_id',access.organizationId).eq('product','persiana').maybeSingle()
   .then(({data:row,error})=>{
    if(!alive)return
    setLoading(false)
    if(error){setNotice(error.message);return}
    const existing=row as Saved|null
    setStored(existing)
    setData(existing?.settings||initial())
    setDirty(false);setNotice('')
   })
  return()=>{alive=false}
 },[access?.organizationId,refresh])
 const change=(next:BlindSettings)=>{setData(next);setDirty(true)}
 const numberField=(value:number|null,update:(n:number|null)=>void)=>(
  <input type="number" min="0" step="0.01" disabled={!admin} value={value??''} onChange={e=>update(numeric(e.target.value))} placeholder="A definir"/>
 )
 async function save(){
  if(!supabase||!access||!admin||saving)return
  const problems=validate(data)
  if(problems.length){setNotice(problems.join(' '));return}
  setSaving(true);setNotice('')
  const query=supabase.from('kiara_commercial_config')
  const payload={organization_id:access.organizationId,product:'persiana',settings:data,status:'draft'}
  const response=stored?
   await query.update({settings:data,status:'draft'}).eq('organization_id',access.organizationId).eq('product','persiana').eq('revision',stored.revision):
   await query.insert(payload)
  setSaving(false)
  if(response.error){setNotice('Não foi possível salvar: '+response.error.message);return}
  setNotice('Rascunho salvo. Nenhuma precificação automática foi habilitada.')
  setRefresh(n=>n+1)
 }
 const model=data.models.find(x=>x.id===modelId&&x.active)
 const w=Number(width.replace(',','.')),h=Number(height.replace(',','.')),qty=Number(pieces)
 const t=data.technicalLimits
 const dimensionsValid=width.trim()!==''&&height.trim()!==''&&w>0&&h>0&&w<=t.maxPieceWidth&&h<=t.maxPieceHeight&&Number.isInteger(qty)&&qty>=1&&qty<=t.maxPieces
 const ready=Boolean(model&&dimensionsValid&&validate(data).length===0&&!dirty&&stored&&stored.status==='draft')
 const base=ready?Math.max(w*h*(model!.costPerM2||0),model!.minCost||0)*qty:0
 const installationCost=ready?qty*(motorized?data.installation.motorPerPiece||0:data.installation.manualPerPiece||0):0
 const addedMotor=ready&&motorized?qty*(data.motorization.saleSurchargePerPiece||0):0
 const sale=ready?Math.round(((base+installationCost)*(1+(data.pricing.markupPercent||0)/100)+addedMotor)*100)/100:null
 return <section className="kiara-blinds-panel">
  <h3>Persianas — configurações comerciais</h3>
  <p>Parâmetros independentes das cortinas. Valores comerciais devem ser informados e salvos como rascunho antes de qualquer simulação.</p>
  {loading?<p>Carregando configurações…</p>:<>
   <p><strong>Estado:</strong> {stored?.status==='approved'?'Aprovada (revisão existente)':stored?'Rascunho':'Sem configuração'} · Revisão {stored?.revision??'—'}{dirty?' · alterações não salvas':''}</p>
   <h4>Limites técnicos</h4>
   <div className="kiara-pricing-form">
    <label>Largura máxima de cada peça (m)<input type="number" min="0.01" step="0.01" disabled={!admin} value={data.technicalLimits.maxPieceWidth} onChange={e=>change({...data,technicalLimits:{...t,maxPieceWidth:Number(e.target.value)}})}/></label>
    <label>Altura máxima de cada peça (m)<input type="number" min="0.01" step="0.01" disabled={!admin} value={t.maxPieceHeight} onChange={e=>change({...data,technicalLimits:{...t,maxPieceHeight:Number(e.target.value)}})}/></label>
    <label>Máximo de peças por orçamento<input type="number" min="1" step="1" disabled={!admin} value={t.maxPieces} onChange={e=>change({...data,technicalLimits:{...t,maxPieces:Number(e.target.value)}})}/></label>
    <label>Sobreposição de referência (cm)<input type="number" min="0" step="1" disabled={!admin} value={t.overlapCm} onChange={e=>change({...data,technicalLimits:{...t,overlapCm:Number(e.target.value)}})}/></label>
   </div>
   <p>Vãos acima da largura máxima exigem divisão em peças e revisão humana. A sobreposição é informativa nesta etapa; não é somada automaticamente ao cálculo.</p>
   <h4>Modelos e custos</h4>
   {data.models.map((item,i)=><div className="kiara-pricing-form kiara-commercial-row kiara-commercial-row--rail" key={i}>
    <label>Código<input disabled={!admin} value={item.id} onChange={e=>change({...data,models:data.models.map((x,j)=>j===i?{...x,id:e.target.value}:x)})}/></label>
    <label>Modelo<input disabled={!admin} value={item.name} onChange={e=>change({...data,models:data.models.map((x,j)=>j===i?{...x,name:e.target.value}:x)})}/></label>
    <label>Custo por m² (R$){numberField(item.costPerM2,n=>change({...data,models:data.models.map((x,j)=>j===i?{...x,costPerM2:n}:x)}))}</label>
    <label>Custo mínimo por peça (R$){numberField(item.minCost,n=>change({...data,models:data.models.map((x,j)=>j===i?{...x,minCost:n}:x)}))}</label>
    <label className="kiara-blinds-checkbox"><input type="checkbox" disabled={!admin} checked={item.active} onChange={e=>change({...data,models:data.models.map((x,j)=>j===i?{...x,active:e.target.checked}:x)})}/> Ativo</label>
    {admin&&<button className="kiara-commercial-button kiara-commercial-button--remove" type="button" onClick={()=>change({...data,models:data.models.filter((_,j)=>i!==j)})}>Remover</button>}
   </div>)}
   {admin&&<button className="kiara-commercial-button kiara-commercial-button--add" type="button" onClick={()=>change({...data,models:[...data.models,{id:'',name:'',costPerM2:null,minCost:null,active:true}]})}>Adicionar modelo</button>}
   <h4>Instalação, motorização e preço</h4>
   <div className="kiara-pricing-form">
    <label>Instalação manual por peça (R$){numberField(data.installation.manualPerPiece,n=>change({...data,installation:{...data.installation,manualPerPiece:n}}))}</label>
    <label>Instalação motorizada por peça (R$){numberField(data.installation.motorPerPiece,n=>change({...data,installation:{...data.installation,motorPerPiece:n}}))}</label>
    <label>Adicional de motorização no preço final por peça (R$){numberField(data.motorization.saleSurchargePerPiece,n=>change({...data,motorization:{saleSurchargePerPiece:n}}))}</label>
    <label>Acréscimo comercial sobre custos (%){numberField(data.pricing.markupPercent,n=>change({...data,pricing:{markupPercent:n}}))}</label>
   </div>
   <label>Observações comerciais<textarea rows={3} disabled={!admin} value={data.notes} onChange={e=>change({...data,notes:e.target.value})}/></label>
   {admin&&<button className="kiara-commercial-button kiara-commercial-button--primary" type="button" disabled={saving||!dirty} onClick={()=>void save()}>{saving?'Salvando…':'Salvar rascunho de persianas'}</button>}
   {notice&&<p role="status">{notice}</p>}
   <section className="kiara-commercial-test-section">
    <h4>Simulação interna — persianas</h4>
    <p>Somente peças individuais dentro dos limites. Não divide vãos, não aprova valores nem envia mensagens. O teste usa a última revisão salva, por isso alterações não salvas precisam ser gravadas primeiro.</p>
    <div className="kiara-pricing-form">
     <label>Modelo<select value={modelId} onChange={e=>setModelId(e.target.value)}><option value="">Selecione</option>{data.models.filter(x=>x.active).map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
     <label>Largura da peça (m)<input value={width} onChange={e=>setWidth(e.target.value)} placeholder="2,00"/></label>
     <label>Altura da peça (m)<input value={height} onChange={e=>setHeight(e.target.value)} placeholder="2,50"/></label>
     <label>Quantidade de peças iguais<input type="number" min="1" value={pieces} onChange={e=>setPieces(e.target.value)}/></label>
     <label className="kiara-blinds-checkbox"><input type="checkbox" checked={motorized} onChange={e=>setMotorized(e.target.checked)}/> Motorizada</label>
    </div>
    {sale!==null?<p><strong>{fmt(sale)}</strong> · TESTE INTERNO, SEM VALIDADE COMERCIAL. Custo base: {fmt(base)}; instalação: {fmt(installationCost)}; motorização: {fmt(addedMotor)}.</p>:
     <p role="status">{dirty?'Salve o rascunho antes de testar.':'Preencha os valores comerciais e selecione medidas e modelo válidos. Medidas fora dos limites exigem atendimento personalizado.'}</p>}
   </section>
  </>}
 </section>
}
