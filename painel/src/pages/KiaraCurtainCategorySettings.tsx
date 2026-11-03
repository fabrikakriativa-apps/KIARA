import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {useAccess} from '../components/AuthorizedAccess'
import {calculateCurtainCategoryQuote} from '../lib/curtainCategoryMath'

type Category={name:string;costPerM2:number;records?:number;fabricsCount?:number;baseYear?:number;active?:boolean}
type Rail={id:string;label:string;costPerMeter:number;records?:number;baseYear?:number;active?:boolean}
type Settings={
 methodology:string;referenceYear:number;annualAdjustmentPercent:number;
 models:string[];categories:Category[];rails:Rail[];
 installation:{manualPerFace:number;motorPerFace:number};
 pricing:{markupPercent:number};motorization:{finalSaleSurcharge:number};
 technicalLimits:{maxWidth:number;maxHeight:number;maxQuantity:number};
 modelCosts:unknown[];ratios:unknown[];source?:string
}
type Stored={settings:Settings;revision:number;status:string}
const money=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const numeric=(n:number)=>Number.isFinite(n)
function validate(s:Settings):string[]{
 const errors:string[]=[]
 if(s.methodology!=='commercial_categories_v1')errors.push('Metodologia por categorias não configurada')
 if(!Number.isInteger(s.referenceYear)||s.referenceYear<2022||s.referenceYear>2100)errors.push('Ano de referência inválido')
 if(!numeric(s.annualAdjustmentPercent)||s.annualAdjustmentPercent<=-100||s.annualAdjustmentPercent>100)errors.push('Reajuste inválido')
 if(!numeric(s.pricing.markupPercent)||s.pricing.markupPercent<0||s.pricing.markupPercent>500)errors.push('Markup inválido')
 if(!numeric(s.installation.manualPerFace)||s.installation.manualPerFace<0)errors.push('Instalação inválida')
 if(!s.models.length||s.models.some(x=>!x.trim()))errors.push('Cadastre os modelos')
 if(!s.categories.length||s.categories.some(c=>!c.name.trim()||!numeric(c.costPerM2)||c.costPerM2<=0))errors.push('Revise as categorias')
 if(!s.rails.length||s.rails.some(r=>!r.id.trim()||!r.label.trim()||!numeric(r.costPerMeter)||r.costPerMeter<0))errors.push('Revise os trilhos')
 if(new Set(s.categories.map(c=>c.name.trim().toLowerCase())).size!==s.categories.length)errors.push('Categorias com nomes duplicados')
 if(new Set(s.rails.map(r=>r.id.trim())).size!==s.rails.length)errors.push('Códigos de trilho duplicados')
 if(!s.technicalLimits.maxWidth||!s.technicalLimits.maxHeight||!s.technicalLimits.maxQuantity)errors.push('Limites de pré-orçamento inválidos')
 return errors
}
export function KiaraCurtainCategorySettings(){
 const access=useAccess(),admin=access?.role==='admin'
 const [stored,setStored]=useState<Stored|null>(null)
 const [data,setData]=useState<Settings|null>(null)
 const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[refresh,setRefresh]=useState(0)
 const [category,setCategory]=useState(''),[rail,setRail]=useState(''),[width,setWidth]=useState('2,10'),[height,setHeight]=useState('2,45'),[quantity,setQuantity]=useState('1'),[year,setYear]=useState(''),[includeInstallation,setIncludeInstallation]=useState(true)
 const [withLining,setWithLining]=useState(false),[liningCategory,setLiningCategory]=useState(''),[railCount,setRailCount]=useState('1')
 useEffect(()=>{
  if(!supabase||!access)return
  let live=true
  void supabase.from('kiara_commercial_config').select('settings,status,revision').eq('organization_id',access.organizationId).eq('product','cortina').maybeSingle().then(({data:row,error})=>{
   if(!live)return
   if(error){setMessage('Falha ao carregar precificação: '+error.message);return}
   setStored(row as Stored|null);setData((row as Stored|null)?.settings||null);setDirty(false)
   if((row as Stored|null)?.settings?.referenceYear)setYear(String((row as Stored).settings.referenceYear))
  })
  return()=>{live=false}
 },[access?.organizationId,refresh])
 function change(next:Settings){setData(next);setDirty(true)}
 const number=(value:number,onChange:(n:number)=>void,step='0.01')=><input type="number" step={step} value={value} disabled={!admin} onChange={e=>onChange(Number(e.target.value))}/>
 async function save(){
  if(!supabase||!access||!admin||!data||busy)return
  const issues=validate(data);if(issues.length){setMessage(issues.join('. '));return}
  setBusy(true);setMessage('')
  const result=await supabase.from('kiara_commercial_config').update({settings:{...data,modelCosts:[],ratios:[]},status:'draft'})
   .eq('organization_id',access.organizationId).eq('product','cortina').eq('revision',stored?.revision||-1).select('revision').maybeSingle()
  setBusy(false)
  if(result.error)setMessage('Falha ao salvar: '+result.error.message)
  else if(!result.data)setMessage('A versão foi alterada. Atualize antes de salvar novamente.')
  else{setMessage('Revisão salva como rascunho. Nenhum preço foi liberado ao cliente.');setRefresh(x=>x+1)}
 }
 async function approve(){
  if(!supabase||!access||!admin||!stored||!data||dirty||busy||stored.status==='approved')return
  const issues=validate(data);if(issues.length){setMessage(issues.join('. '));return}
  if(!window.confirm('Aprovar estes parâmetros para simulações internas? Isso não autoriza envios automáticos ao cliente.'))return
  setBusy(true)
  const result=await supabase.from('kiara_commercial_config').update({status:'approved'}).eq('organization_id',access.organizationId).eq('product','cortina').eq('revision',stored.revision).eq('status','draft').select('revision').maybeSingle()
  setBusy(false)
  if(result.error||!result.data)setMessage('Não foi possível confirmar a aprovação. Confira se esta ainda é a revisão atual.')
  else{setMessage('Configuração aprovada somente para simulações internas.');setRefresh(x=>x+1)}
 }
 const w=Number(width.replace(',','.')),h=Number(height.replace(',','.')),q=Number(quantity),y=Number(year)
 const face={width:w,height:h,quantity:q,category,year:y,includeInstallation}
 const quote=data?calculateCurtainCategoryQuote(data,[face,...(withLining?[{...face,category:liningCategory}]:[])],rail,Number(railCount)):null
 const valid=Boolean(quote?.ready)
 const total=quote?.ready?quote.sale:0
 return <section className="kiara-settings-info">
  <h3>Precificação comercial — cortinas</h3>
  <p>Metodologia por categoria comercial: custo por m² da categoria × área, mais trilho e instalação; aplica-se o acréscimo comercial ao total. O modelo e a proporção são informativos e não alteram o preço. Trabalhe uma face por vez.</p>
  {!data?<p>Carregando configuração de cortinas…</p>:<>
   <p><strong>Situação:</strong> {stored?.status==='approved'?'Aprovada para simulação interna':'Rascunho'} · Revisão {stored?.revision||'—'}{dirty?' · alterações não salvas':''}</p>
   <h4>Parâmetros gerais</h4>
   <div className="kiara-pricing-form">
    <label>Ano de referência{number(data.referenceYear,n=>change({...data,referenceYear:n}),'1')}</label>
    <label>Reajuste anual (%) {number(data.annualAdjustmentPercent,n=>change({...data,annualAdjustmentPercent:n}))}</label>
    <label>Acréscimo comercial (%) {number(data.pricing.markupPercent,n=>change({...data,pricing:{...data.pricing,markupPercent:n}}))}</label>
    <label>Instalação por face (R$) {number(data.installation.manualPerFace,n=>change({...data,installation:{...data.installation,manualPerFace:n}}))}</label>
   </div>
   <h4>Modelos de confecção (informativos)</h4>
   <p><small>Wave, prega macho e franzida não mudam a média comercial da categoria. Esta lista organiza o atendimento, mas não acrescenta fator de tecido ao custo.</small></p>
   {data.models.map((item,i)=><div key={i} className="kiara-commercial-row kiara-commercial-row--model">
    <label>Modelo<input value={item} disabled={!admin} onChange={e=>change({...data,models:data.models.map((m,j)=>j===i?e.target.value:m)})}/></label>
    {admin&&<button className="kiara-commercial-button kiara-commercial-button--remove" type="button" onClick={()=>change({...data,models:data.models.filter((_,j)=>j!==i)})}>Remover modelo</button>}
   </div>)}
   {admin&&<button type="button" className="kiara-commercial-button" onClick={()=>change({...data,models:[...data.models,'']})}>Adicionar modelo</button>}
   <h4>Motorização — parâmetros reservados para avaliação personalizada</h4>
   <p><small>Estes parâmetros permanecem editáveis para a operação, mas não são utilizados no cálculo por categoria de uma face. Não ativam orçamento automático de cortinas motorizadas.</small></p>
   <div className="kiara-pricing-form">
    <label>Instalação motorizada por face (R$) {number(data.installation.motorPerFace,n=>change({...data,installation:{...data.installation,motorPerFace:n}}))}</label>
    <label>Adicional comercial de motorização (R$) {number(data.motorization.finalSaleSurcharge,n=>change({...data,motorization:{...data.motorization,finalSaleSurcharge:n}}))}</label>
   </div>
   <h4>Categorias comerciais</h4>
   {data.categories.map((c,i)=><div key={i} className="kiara-pricing-form kiara-commercial-row kiara-commercial-row--category">
    <label>Categoria<input disabled={!admin} value={c.name} onChange={e=>change({...data,categories:data.categories.map((x,j)=>j===i?{...x,name:e.target.value}:x)})}/></label>
    <label>Referência R$/m² {number(c.costPerM2,n=>change({...data,categories:data.categories.map((x,j)=>j===i?{...x,costPerM2:n}:x)}))}</label>
    <label>Ano-base {number(c.baseYear||data.referenceYear,n=>change({...data,categories:data.categories.map((x,j)=>j===i?{...x,baseYear:n}:x)}),'1')}</label>
    <label>Amostra {number(c.records||0,n=>change({...data,categories:data.categories.map((x,j)=>j===i?{...x,records:n}:x)}),'1')}</label>
    {admin&&<button type="button" className="kiara-commercial-button kiara-commercial-button--remove" onClick={()=>change({...data,categories:data.categories.filter((_,j)=>j!==i)})}>Remover</button>}
   </div>)}
   {admin&&<button className="kiara-commercial-button" onClick={()=>change({...data,categories:[...data.categories,{name:'',costPerM2:0,baseYear:data.referenceYear,records:0,active:true}]})}>Adicionar categoria</button>}
   <h4>Trilhos</h4>
   {data.rails.map((r,i)=><div key={r.id+i} className="kiara-pricing-form kiara-commercial-row kiara-commercial-row--category">
    <label>Trilho<input disabled={!admin} value={r.label} onChange={e=>change({...data,rails:data.rails.map((x,j)=>j===i?{...x,label:e.target.value}:x)})}/></label>
    <label>Referência R$/m {number(r.costPerMeter,n=>change({...data,rails:data.rails.map((x,j)=>j===i?{...x,costPerMeter:n}:x)}))}</label>
    <label>Ano-base {number(r.baseYear||data.referenceYear,n=>change({...data,rails:data.rails.map((x,j)=>j===i?{...x,baseYear:n}:x)}),'1')}</label>
    <label>Amostra {number(r.records||0,n=>change({...data,rails:data.rails.map((x,j)=>j===i?{...x,records:n}:x)}),'1')}</label>
    {admin&&<button type="button" className="kiara-commercial-button kiara-commercial-button--remove" onClick={()=>change({...data,rails:data.rails.filter((_,j)=>j!==i)})}>Remover</button>}
   </div>)}
   {admin&&<button className="kiara-commercial-button" onClick={()=>change({...data,rails:[...data.rails,{id:'rail_'+crypto.randomUUID(),label:'',costPerMeter:0,baseYear:data.referenceYear,records:0,active:true}]})}>Adicionar trilho</button>}
   <h4>Limites para estimativas</h4>
   <div className="kiara-pricing-form">
    <label>Largura máxima (m) {number(data.technicalLimits.maxWidth,n=>change({...data,technicalLimits:{...data.technicalLimits,maxWidth:n}}))}</label>
    <label>Altura máxima (m) {number(data.technicalLimits.maxHeight,n=>change({...data,technicalLimits:{...data.technicalLimits,maxHeight:n}}))}</label>
    <label>Quantidade máxima {number(data.technicalLimits.maxQuantity,n=>change({...data,technicalLimits:{...data.technicalLimits,maxQuantity:n}}),'1')}</label>
   </div>
   <label>Fonte e observações<textarea rows={3} disabled={!admin} value={data.source||''} onChange={e=>change({...data,source:e.target.value})}/></label>
   {admin&&<div className="kiara-management-actions">
    <button className="kiara-commercial-button kiara-commercial-button--primary" disabled={busy||!dirty} onClick={()=>void save()}>Salvar rascunho</button>
    <button className="kiara-commercial-button kiara-commercial-button--primary" disabled={busy||dirty||stored?.status==='approved'} onClick={()=>void approve()}>Aprovar para simulações internas</button>
   </div>}
   <section className="kiara-commercial-test-section">
    <h4>Teste de pré-orçamento — uma face</h4>
    <p>Os valores abaixo utilizam os campos exibidos nesta página, inclusive alterações ainda não salvas. A simulação não envia mensagens ao WhatsApp.</p>
    <div className="kiara-pricing-form">
     <label>Categoria<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Selecione</option>{data.categories.filter(x=>x.active!==false).map(x=><option key={x.name} value={x.name}>{x.name}</option>)}</select></label>
     <label>Trilho<select value={rail} onChange={e=>setRail(e.target.value)}><option value="">Selecione</option>{data.rails.filter(x=>x.active!==false).map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
     <label>Quantidade total de trilhos<input type="number" min="0" max="4" value={railCount} onChange={e=>setRailCount(e.target.value)}/><small>Conte os trilhos físicos apenas uma vez, mesmo quando houver forro.</small></label>
     <label>Composição<select value={withLining?'front-lining':'front'} onChange={e=>setWithLining(e.target.value==='front-lining')}><option value="front">Somente frente</option><option value="front-lining">Frente + forro de tecido</option></select></label>
     {withLining&&<label>Categoria do forro<select value={liningCategory} onChange={e=>setLiningCategory(e.target.value)}><option value="">Selecione</option>{data.categories.filter(x=>x.active!==false).map(x=><option key={x.name} value={x.name}>{x.name}</option>)}</select></label>}
     <label>Largura (m)<input value={width} onChange={e=>setWidth(e.target.value)}/></label>
     <label>Altura (m)<input value={height} onChange={e=>setHeight(e.target.value)}/></label>
     <label>Quantidade de faces iguais<input type="number" min="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
     <label>Ano da estimativa<input type="number" value={year} onChange={e=>setYear(e.target.value)}/></label>
     <label><input type="checkbox" checked={includeInstallation} onChange={e=>setIncludeInstallation(e.target.checked)}/> Incluir instalação por face</label>
    </div>
    {valid&&quote?.ready?<div><p><strong>Valor sugerido: {money(total)}</strong> — simulação interna, sujeita a revisão humana.</p>
      {quote.faces.map((face,index)=><p key={index}>{index===0?'Frente':'Forro'} ({face.category}): área {face.area.toLocaleString('pt-BR')} m² · tecido {money(face.fabric)} · instalação {money(face.installation)}</p>)}
      <p>Trilhos compartilhados: {money(quote.rails)} · Custo total: {money(quote.cost)} · Acréscimo: {quote.markupPercent}%.</p>
      <p><small>Para composições com medidas ou quantidades diferentes, calcule cada face separadamente. Nenhum valor é enviado automaticamente.</small></p>
     </div>:<p role="status">{quote&&!quote.ready?quote.errors.join('. '):'Preencha os campos para calcular.'}</p>}
   </section>
  </>}
  {message&&<p role="status">{message}</p>}
 </section>
}
