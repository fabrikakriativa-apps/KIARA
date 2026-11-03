import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {useAccess} from '../components/AuthorizedAccess'
import {KiaraApprovedSimulation} from './KiaraApprovedSimulation'
import {KiaraBlindSettings} from './KiaraBlindSettings'

type Category={name:string;costPerM2:number;records?:number;active?:boolean}
type ModelCost={category:string;model:string;position:string;costPerM2:number;records?:number;active?:boolean}
type Ratio={position:string;model:string;ratio:number;records?:number}
type Rail={id:string;label:string;costPerMeter:number;active?:boolean}
type Settings={
 models:string[];technicalLimits:{maxWidth:number;maxHeight:number;maxQuantity:number};
 categories:Category[];modelCosts:ModelCost[];ratios:Ratio[];rails:Rail[];
 installation:{manualPerFace:number;motorPerFace:number};
 motorization:{finalSaleSurcharge:number};
 pricing:{markupPercent:number};source?:string
}
type Stored={settings:Settings;status:string;revision:number;updated_at:string}
const blank=():Settings=>({
 models:[],technicalLimits:{maxWidth:0,maxHeight:0,maxQuantity:0},
 categories:[],modelCosts:[],ratios:[],rails:[],
 installation:{manualPerFace:0,motorPerFace:0},
 motorization:{finalSaleSurcharge:0},pricing:{markupPercent:0}
})
const money=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
function validate(s:Settings){
 const issues:string[]=[]
 if(!s.models.length)issues.push('Cadastre pelo menos um modelo')
 if(!s.technicalLimits?.maxWidth||!s.technicalLimits?.maxHeight||!s.technicalLimits?.maxQuantity)issues.push('Defina limites comerciais de medidas e quantidade')
 if(!s.categories.length)issues.push('Cadastre pelo menos uma categoria')
 if(!s.rails.length)issues.push('Cadastre pelo menos um trilho')
 for(const c of s.categories){
  if(!c.name.trim()||!(c.costPerM2>0))issues.push('Categoria sem nome ou custo válido')
 }
 for(const r of s.rails){
  if(!r.id.trim()||!r.label.trim()||!(r.costPerMeter>0))issues.push('Trilho sem código, nome ou custo válido')
 }
 if(!Number.isFinite(s.installation.manualPerFace)||s.installation.manualPerFace<0)issues.push('Instalação manual inválida')
 if(!Number.isFinite(s.installation.motorPerFace)||s.installation.motorPerFace<0)issues.push('Instalação motorizada inválida')
 if(!Number.isFinite(s.motorization.finalSaleSurcharge)||s.motorization.finalSaleSurcharge<0)issues.push('Adicional de motorização inválido')
 if(!Number.isFinite(s.pricing.markupPercent)||s.pricing.markupPercent<0||s.pricing.markupPercent>500)issues.push('Acréscimo comercial inválido')
 return issues
}
export function KiaraCommercialSettings(){
 const access=useAccess()
 const [product,setProduct]=useState<'cortina'|'persiana'>('cortina')
 const [data,setData]=useState<Settings>(blank)
 const [stored,setStored]=useState<Stored|null>(null)
 const [history,setHistory]=useState<{revision:number;status:string;changed_at:string}[]>([])
 const [busy,setBusy]=useState(false),[dirty,setDirty]=useState(false)
 const [showTest,setShowTest]=useState(false)
 const [notice,setNotice]=useState(''),[refresh,setRefresh]=useState(0)
 const admin=access?.role==='admin'
 useEffect(()=>{
  if(!access||!supabase)return
  const client=supabase
  let live=true
  void (async()=>{
   const [current,old]=await Promise.all([
    client.from('kiara_commercial_config').select('settings,status,revision,updated_at')
     .eq('organization_id',access.organizationId).eq('product',product).maybeSingle(),
    client.from('kiara_commercial_config_history').select('revision,status,changed_at')
     .eq('organization_id',access.organizationId).eq('product',product)
     .order('revision',{ascending:false}).limit(15)
   ])
   if(!live)return
   if(current.error){setNotice(current.error.message);return}
   const row=current.data as Stored|null
   setStored(row);setData(row?.settings||blank());setDirty(false)
   if(!old.error)setHistory(old.data||[])
   setNotice('')
  })()
  return()=>{live=false}
 },[access?.organizationId,product,refresh])
 function mutate(next:Settings){setData(next);setDirty(true)}
 async function save(){
  if(!supabase||!access||!admin||busy)return
  const issues=validate(data)
  if(issues.length){setNotice(issues.join('. '));return}
  setBusy(true);setNotice('')
  const client=supabase
  const payload={organization_id:access.organizationId,product,settings:data,status:'draft'}
  const response=stored
   ?await client.from('kiara_commercial_config').update({settings:data,status:'draft'})
     .eq('organization_id',access.organizationId).eq('product',product)
   :await client.from('kiara_commercial_config').insert(payload)
  setBusy(false)
  if(response.error)setNotice(response.error.message)
  else{setNotice('Configuração salva como rascunho. Não altera preços em uso até aprovação.');setRefresh(x=>x+1)}
 }
 async function approve(){
  if(!supabase||!access||!admin||busy||dirty||!stored||stored.status==='approved')return
  const issues=validate(data)
  if(issues.length){setNotice(issues.join('. '));return}
  if(!window.confirm('Aprovar esta revisão comercial para simulações internas? Verifique se os custos históricos e os valores comerciais estão corretos.'))return
  setBusy(true)
  const {error}=await supabase.from('kiara_commercial_config')
   .update({status:'approved'})
   .eq('organization_id',access.organizationId).eq('product',product).eq('revision',stored.revision)
  setBusy(false)
  if(error)setNotice(error.message)
  else{setNotice('Revisão aprovada para simulações internas. O envio automático ao cliente continua bloqueado.');setRefresh(x=>x+1)}
 }
 const inputNumber=(value:number,onChange:(x:number)=>void)=><input type="number" min="0" step="0.01" value={value} onChange={e=>onChange(Number(e.target.value))} disabled={!admin}/>
 return <section className="kiara-settings-info">
  <h3>Configurações comerciais e precificação</h3>
  <p>Todos os valores são armazenados no banco por produto. Apenas administradores podem editar e aprovar; alterações criam uma nova revisão.</p>
  <label>Produto <select value={product} onChange={e=>setProduct(e.target.value as 'cortina'|'persiana')}>
   <option value="cortina">Cortinas</option><option value="persiana">Persianas</option>
  </select></label>
  {product==='persiana'?<KiaraBlindSettings/>:<>
   <p><strong>Estado:</strong> {stored?.status==='approved'?'Aprovada':stored?'Rascunho':'Sem configuração'} · Revisão {stored?.revision||'—'} {dirty?'· alterações não salvas':''}</p>
   <h4>Custos comerciais e instalação</h4>
   <div className="kiara-pricing-form">
    <label>Instalação manual por face (R$){inputNumber(data.installation.manualPerFace,n=>mutate({...data,installation:{...data.installation,manualPerFace:n}}))}</label>
    <label>Instalação motorizada por face (R$){inputNumber(data.installation.motorPerFace,n=>mutate({...data,installation:{...data.installation,motorPerFace:n}}))}</label>
    <label>Adicional de motorização no valor final (R$){inputNumber(data.motorization.finalSaleSurcharge,n=>mutate({...data,motorization:{finalSaleSurcharge:n}}))}</label>
    <label>Acréscimo comercial sobre custos (%){inputNumber(data.pricing.markupPercent,n=>mutate({...data,pricing:{markupPercent:n}}))}</label>
   </div>
   <h4>Modelos de cortina e limites comerciais</h4>
   {data.models.map((model,i)=><div className="kiara-pricing-form kiara-commercial-row kiara-commercial-row--model" key={i}>
    <label>Modelo<input disabled={!admin} value={model} onChange={e=>mutate({...data,models:data.models.map((x,j)=>j===i?e.target.value:x)})}/></label>
    {admin&&<button className="kiara-commercial-button kiara-commercial-button--remove" type="button" onClick={()=>mutate({...data,models:data.models.filter((_,j)=>i!==j)})}>Remover modelo</button>}
   </div>)}
   {admin&&<button className="kiara-commercial-button kiara-commercial-button--add" type="button" onClick={()=>mutate({...data,models:[...data.models,'']})}>Adicionar modelo</button>}
   <div className="kiara-pricing-form">
    <label>Largura máxima no pré-orçamento (m){inputNumber(data.technicalLimits?.maxWidth||0,n=>mutate({...data,technicalLimits:{...data.technicalLimits,maxWidth:n}}))}</label>
    <label>Altura máxima no pré-orçamento (m){inputNumber(data.technicalLimits?.maxHeight||0,n=>mutate({...data,technicalLimits:{...data.technicalLimits,maxHeight:n}}))}</label>
    <label>Quantidade máxima de conjuntos<input type="number" min="1" disabled={!admin} value={data.technicalLimits?.maxQuantity||0} onChange={e=>mutate({...data,technicalLimits:{...data.technicalLimits,maxQuantity:Number(e.target.value)}})}/></label>
   </div>
   <h4>Categorias comerciais de tecido</h4>
   {data.categories.map((item,i)=><div className="kiara-pricing-form kiara-commercial-row kiara-commercial-row--category" key={i}>
    <label>Categoria<input disabled={!admin} value={item.name} onChange={e=>mutate({...data,categories:data.categories.map((x,j)=>j===i?{...x,name:e.target.value}:x)})}/></label>
    <label>Custo histórico por m² (R$){inputNumber(item.costPerM2,n=>mutate({...data,categories:data.categories.map((x,j)=>j===i?{...x,costPerM2:n}:x)}))}</label>
    <label>Registros históricos<input type="number" min="0" disabled={!admin} value={item.records||0} onChange={e=>mutate({...data,categories:data.categories.map((x,j)=>j===i?{...x,records:Number(e.target.value)}:x)})}/></label>
    {admin&&<button className="kiara-commercial-button kiara-commercial-button--remove" type="button" onClick={()=>mutate({...data,categories:data.categories.filter((_,j)=>i!==j)})}>Remover categoria</button>}
   </div>)}
   {admin&&<button className="kiara-commercial-button kiara-commercial-button--add" type="button" onClick={()=>mutate({...data,categories:[...data.categories,{name:'',costPerM2:0,records:0}]})}>Adicionar categoria</button>}
   <h4>Custos por modelo e posição (sobrepõem a média da categoria)</h4>
   {data.modelCosts.map((item,i)=><div className="kiara-pricing-form kiara-commercial-row kiara-commercial-row--cost" key={i}>
    <label>Categoria<select disabled={!admin} value={item.category} onChange={e=>mutate({...data,modelCosts:data.modelCosts.map((x,j)=>j===i?{...x,category:e.target.value}:x)})}>
     <option value="">Selecione</option>{data.categories.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
    </select></label>
    <label>Modelo<select disabled={!admin||item.position==='lining'} value={item.position==='lining'?'Franzida':item.model} onChange={e=>mutate({...data,modelCosts:data.modelCosts.map((x,j)=>j===i?{...x,model:e.target.value}:x)})}>
     {data.models.map(v=><option key={v}>{v}</option>)}
    </select></label>
    <label>Posição<select disabled={!admin} value={item.position} onChange={e=>mutate({...data,modelCosts:data.modelCosts.map((x,j)=>j===i?{...x,position:e.target.value,model:e.target.value==='lining'?'Franzida':x.model}:x)})}>
     <option value="front">Frente/face única</option><option value="lining">Forro</option>
    </select></label>
    <label>Custo por m² (R$){inputNumber(item.costPerM2,n=>mutate({...data,modelCosts:data.modelCosts.map((x,j)=>j===i?{...x,costPerM2:n}:x)}))}</label>
    {admin&&<button className="kiara-commercial-button kiara-commercial-button--remove" type="button" onClick={()=>mutate({...data,modelCosts:data.modelCosts.filter((_,j)=>i!==j)})}>Remover referência</button>}
   </div>)}
   {admin&&<button className="kiara-commercial-button kiara-commercial-button--add" type="button" onClick={()=>mutate({...data,modelCosts:[...data.modelCosts,{category:data.categories[0]?.name||'',model:'Wave',position:'front',costPerM2:0,records:0}]})}>Adicionar referência por modelo</button>}
   <h4>Trilhos e valores</h4>
   {data.rails.map((item,i)=><div className="kiara-pricing-form kiara-commercial-row kiara-commercial-row--rail" key={i}>
    <label>Código<input disabled={!admin} value={item.id} onChange={e=>mutate({...data,rails:data.rails.map((x,j)=>j===i?{...x,id:e.target.value}:x)})}/></label>
    <label>Descrição<input disabled={!admin} value={item.label} onChange={e=>mutate({...data,rails:data.rails.map((x,j)=>j===i?{...x,label:e.target.value}:x)})}/></label>
    <label>Custo por metro (R$){inputNumber(item.costPerMeter,n=>mutate({...data,rails:data.rails.map((x,j)=>j===i?{...x,costPerMeter:n}:x)}))}</label>
    {admin&&<button className="kiara-commercial-button kiara-commercial-button--remove" type="button" onClick={()=>mutate({...data,rails:data.rails.filter((_,j)=>i!==j)})}>Remover trilho</button>}
   </div>)}
   {admin&&<button className="kiara-commercial-button kiara-commercial-button--add" type="button" onClick={()=>mutate({...data,rails:[...data.rails,{id:'',label:'',costPerMeter:0}]})}>Adicionar trilho</button>}
   <h4>Proporções técnicas por posição e modelo</h4>
   {data.ratios.map((item,i)=><div className="kiara-pricing-form kiara-commercial-row kiara-commercial-row--ratio" key={i}>
    <label>Posição<select disabled={!admin} value={item.position} onChange={e=>mutate({...data,ratios:data.ratios.map((x,j)=>j===i?{...x,position:e.target.value}:x)})}><option value="front">Frente</option><option value="lining">Forro</option></select></label>
    <label>Modelo<select disabled={!admin} value={item.model} onChange={e=>mutate({...data,ratios:data.ratios.map((x,j)=>j===i?{...x,model:e.target.value}:x)})}>{['Wave','Prega Macho','Franzida'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label>Proporção{inputNumber(item.ratio,n=>mutate({...data,ratios:data.ratios.map((x,j)=>j===i?{...x,ratio:n}:x)}))}</label>
    {admin&&<button className="kiara-commercial-button kiara-commercial-button--remove" type="button" onClick={()=>mutate({...data,ratios:data.ratios.filter((_,j)=>i!==j)})}>Remover proporção</button>}
   </div>)}
   {admin&&<button className="kiara-commercial-button kiara-commercial-button--add" type="button" onClick={()=>mutate({...data,ratios:[...data.ratios,{position:'front',model:'Wave',ratio:0}]})}>Adicionar proporção</button>}
   <p><small>As proporções documentam o padrão de confecção; custos por m² já incluem a confecção e não são multiplicados novamente.</small></p>
   <label>Fonte e observações<textarea disabled={!admin} value={data.source||''} onChange={e=>mutate({...data,source:e.target.value})} rows={3}/></label>
   {admin&&<div className="kiara-management-actions"><button className="kiara-commercial-button kiara-commercial-button--primary" type="button" disabled={busy||!dirty} onClick={()=>void save()}>Salvar rascunho</button>
    <button className="kiara-commercial-button kiara-commercial-button--primary" type="button" disabled={busy||dirty||stored?.status==='approved'||!stored} onClick={()=>void approve()}>Aprovar revisão comercial</button>
   </div>}
   {admin&&<section className="kiara-commercial-test-section">
    <h4>Homologação de preços</h4>
    <p>Teste os parâmetros já salvos, mesmo em rascunho. Valores experimentais não são aprovados ou enviados a clientes.</p>
    {dirty&&<p role="status">Existem alterações não salvas. O teste usa a última revisão salva no Supabase, não os campos alterados nesta tela.</p>}
    <button className="kiara-commercial-button kiara-commercial-button--add" type="button" onClick={()=>setShowTest(x=>!x)}>{showTest?'Fechar teste':'Testar precificação'}</button>
    {showTest&&<KiaraApprovedSimulation draftMode/>}
   </section>}
   <h4>Histórico de revisões</h4>
   {history.length?<ul>{history.map(h=><li key={h.revision}>Revisão {h.revision}: {h.status==='approved'?'aprovada':'rascunho'} — {new Date(h.changed_at).toLocaleString('pt-BR')}</li>)}</ul>:<p>Sem revisões registradas.</p>}
  </>}
  {notice&&<p role="status">{notice}</p>}
 </section>
}
