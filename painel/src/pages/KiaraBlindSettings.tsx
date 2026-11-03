import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {useAccess} from '../components/AuthorizedAccess'

type BlindModel={id:string;name:string;costPerM2:number|null;minCost:number|null;active:boolean}
type Technical={
 maxPieceWidth:number;maxPieceHeight:number;maxPieces:number;overlapCm:number
 recommendedMaxWidth:number;recommendedMinWidth:number
 minimumManualWidth:number;minimumMotorWidth:number;windowSideAllowanceCm:number
}
type BlindSettings={
 version:number;models:BlindModel[];technicalLimits:Technical
 installation:{manualPerPiece:number|null;motorPerPiece:number|null}
 motorization:{saleSurchargePerPiece:number|null}
 pricing:{markupPercent:number|null}
 defaults:{model:string;color:string;openness:string;layout:'overlap'|'side_by_side'}
 notes:string
}
type Saved={settings:BlindSettings;revision:number;status:string}
type Area='window'|'balcony'
const initial=():BlindSettings=>({
 version:2,models:[],
 technicalLimits:{maxPieceWidth:2.4,maxPieceHeight:2.7,maxPieces:20,overlapCm:10,
  recommendedMaxWidth:1.2,recommendedMinWidth:.9,minimumManualWidth:.25,minimumMotorWidth:.72,windowSideAllowanceCm:10},
 installation:{manualPerPiece:null,motorPerPiece:null},
 motorization:{saleSurchargePerPiece:null},pricing:{markupPercent:null},
 defaults:{model:'Rolô',color:'Off-white',openness:'1%',layout:'overlap'},notes:''
})
const complete=(v:number|null)=>v!==null&&Number.isFinite(v)&&v>=0
const numeric=(v:string):number|null=>v.trim()===''?null:Number(v)
const measure=(v:string)=>v.trim()?Number(v.trim().replace(',','.')):NaN
const fmt=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const layoutName=(v:string)=>v==='side_by_side'?'Lado a lado':'Transpassada (sobreposta)'
function validate(s:BlindSettings){
 const errors:string[]=[];const t=s.technicalLimits
 if(![t.maxPieceWidth,t.maxPieceHeight,t.recommendedMaxWidth,t.recommendedMinWidth,t.minimumManualWidth,t.minimumMotorWidth].every(x=>Number.isFinite(x)&&x>0))errors.push('Limites de medidas inválidos.')
 if(t.recommendedMinWidth>t.recommendedMaxWidth||t.recommendedMaxWidth>t.maxPieceWidth)errors.push('Confira larguras recomendadas e máxima.')
 if(t.minimumManualWidth>t.maxPieceWidth||t.minimumMotorWidth>t.maxPieceWidth)errors.push('Largura mínima acima da máxima.')
 if(!Number.isInteger(t.maxPieces)||t.maxPieces<1||![t.overlapCm,t.windowSideAllowanceCm].every(x=>Number.isFinite(x)&&x>=0))errors.push('Limites de peças ou adicionais inválidos.')
 if(!s.models.length||s.models.some(m=>!m.id.trim()||!m.name.trim()||!complete(m.costPerM2)||m.costPerM2===0||!complete(m.minCost)))errors.push('Cadastre modelos com código, nome, custo por m² e mínimo.')
 if(new Set(s.models.map(m=>m.id.trim())).size!==s.models.length)errors.push('Códigos de modelo duplicados.')
 if([s.installation.manualPerPiece,s.installation.motorPerPiece,s.motorization.saleSurchargePerPiece,s.pricing.markupPercent].some(v=>!complete(v)))errors.push('Preencha custos de instalação, motorização e acréscimo.')
 if((s.pricing.markupPercent??0)>500)errors.push('Acréscimo comercial fora do limite.')
 if(!s.defaults.model.trim()||!s.defaults.color.trim()||!s.defaults.openness.trim())errors.push('Preencha os padrões de orçamento.')
 return errors
}
export function KiaraBlindSettings(){
 const access=useAccess(),admin=access?.role==='admin'
 const [data,setData]=useState<BlindSettings>(initial),[stored,setStored]=useState<Saved|null>(null)
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false)
 const [dirty,setDirty]=useState(false),[notice,setNotice]=useState(''),[refresh,setRefresh]=useState(0)
 const [area,setArea]=useState<Area>('window'),[condo,setCondo]=useState('unknown'),[rules,setRules]=useState('unknown')
 const [glass,setGlass]=useState('unknown'),[layout,setLayout]=useState('unknown')
 const [modelId,setModelId]=useState(''),[width,setWidth]=useState(''),[height,setHeight]=useState('')
 const [pieces,setPieces]=useState(''),[motorized,setMotorized]=useState(false)
 const [segments,setSegments]=useState('1'),[photosConfirmed,setPhotosConfirmed]=useState(false)
 useEffect(()=>{
  if(!access||!supabase){setLoading(false);return}
  let live=true;setLoading(true)
  void supabase.from('kiara_commercial_config').select('settings,status,revision')
   .eq('organization_id',access.organizationId).eq('product','persiana').maybeSingle()
   .then(({data:row,error})=>{
    if(!live)return
    setLoading(false)
    if(error){setNotice(error.message);return}
    const existing=row as Saved|null
    setStored(existing)
    // Completa registros antigos sem sobrescrever valores já cadastrados.
    const base=initial(),old=existing?.settings
    setData(old?{...base,...old,technicalLimits:{...base.technicalLimits,...old.technicalLimits},
     defaults:{...base.defaults,...old.defaults}}:base)
    setDirty(false);setNotice('')
   })
  return()=>{live=false}
 },[access?.organizationId,refresh])
 const change=(next:BlindSettings)=>{setData(next);setDirty(true)}
 const numberField=(v:number|null,update:(n:number|null)=>void)=>(
  <input type="number" min="0" step="0.01" disabled={!admin} value={v??''} onChange={e=>update(numeric(e.target.value))} placeholder="A definir"/>
 )
 const t=data.technicalLimits
 const setLimit=(key:keyof Technical,v:number)=>change({...data,technicalLimits:{...t,[key]:v}})
 const setDefault=(key:keyof BlindSettings['defaults'],v:string)=>change({...data,defaults:{...data.defaults,[key]:v}})
 async function save(){
  if(!supabase||!access||!admin||saving)return
  const errors=validate(data).filter(x=>!x.startsWith('Cadastre modelos')&&!x.startsWith('Preencha custos'))
  if(errors.length){setNotice(errors.join(' '));return}
  setSaving(true);setNotice('')
  const payload={organization_id:access.organizationId,product:'persiana',settings:data,status:'draft'}
  const response=stored?
   await supabase.from('kiara_commercial_config').update({settings:data,status:'draft'}).eq('organization_id',access.organizationId).eq('product','persiana').eq('revision',stored.revision):
   await supabase.from('kiara_commercial_config').insert(payload)
  setSaving(false)
  if(response.error){setNotice('Falha ao salvar: '+response.error.message);return}
  setNotice('Rascunho salvo sem ativar atendimento ou orçamento automático.')
  setRefresh(n=>n+1)
 }
 const w=measure(width),h=measure(height),requested=pieces.trim()?Number(pieces):NaN
 const count=Number.isInteger(requested)&&requested>0?requested:0
 const usingDefaultLayout=layout==='unknown'
 const selectedLayout=usingDefaultLayout?data.defaults.layout:layout
 const manualMinimum=motorized?t.minimumMotorWidth:t.minimumManualWidth
 // Janela: acrescenta 10 cm em cada extremidade ao vão total, uma única vez.
 // Cada folha transpassada recebe 10 cm de cada lado, contabilizados na área.
 const baseWidth=area==='window'?w+2*t.windowSideAllowanceCm/100:w
 const eachWidth=baseWidth/count+(selectedLayout==='overlap'&&count>1?2*t.overlapCm/100:0)
 const measuredWidth=area==='window'&&count===1?baseWidth:eachWidth
 const suggestedCount=Number.isFinite(w)&&w>0?Math.ceil((area==='window'?w+2*t.windowSideAllowanceCm/100:w)/t.recommendedMaxWidth):null
 const model=data.models.find(m=>m.id===modelId&&m.active)
 const dimensionOK=Number.isFinite(measuredWidth)&&measuredWidth>=manualMinimum&&measuredWidth<=t.maxPieceWidth&&h>0&&h<=t.maxPieceHeight&&count>0&&count<=t.maxPieces
 const condoBlocked=condo==='yes'&&rules==='different'
 // Sem separação frente/lateral e altura de cada segmento, a geometria da varanda é incompleta.
 const balconyBlocked=area==='balcony'&&(!photosConfirmed||Number(segments)!==1||glass==='unknown')
 const ready=Boolean(stored&&!dirty&&model&&validate(data).length===0&&dimensionOK&&!condoBlocked&&!balconyBlocked)
 const fabric=ready?Math.max(measuredWidth*h*(model!.costPerM2??0),model!.minCost??0)*count:0
 const installation=ready?count*(motorized?data.installation.motorPerPiece??0:data.installation.manualPerPiece??0):0
 const motor=ready&&motorized?count*(data.motorization.saleSurchargePerPiece??0):0
 const price=ready?Math.round(((fabric+installation)*(1+(data.pricing.markupPercent??0)/100)+motor)*100)/100:null
 return <section className="kiara-blinds-panel">
  <h3>Persianas — configurações comerciais e triagem</h3>
  <p>Primeiro verificar condomínio, tipo de ambiente, vidro e medidas. A estimativa é apenas interna e depende dos parâmetros comerciais preenchidos.</p>
  {loading?<p>Carregando…</p>:<>
   <p><strong>Estado:</strong> {stored?.status==='approved'?'Aprovada':stored?'Rascunho':'Sem configuração'} · Revisão {stored?.revision??'—'} {dirty?'· não salvo':''}</p>
   <h4>Padrões para cliente sem regras conhecidas</h4>
   <div className="kiara-pricing-form">
    <label>Modelo padrão<input disabled={!admin} value={data.defaults.model} onChange={e=>setDefault('model',e.target.value)}/></label>
    <label>Cor padrão<input disabled={!admin} value={data.defaults.color} onChange={e=>setDefault('color',e.target.value)}/></label>
    <label>Visibilidade padrão<input disabled={!admin} value={data.defaults.openness} onChange={e=>setDefault('openness',e.target.value)}/></label>
    <label>Forma de instalação padrão<select disabled={!admin} value={data.defaults.layout} onChange={e=>setDefault('layout',e.target.value)}><option value="overlap">Transpassada (sobreposta)</option><option value="side_by_side">Lado a lado</option></select></label>
   </div>
   <p>Esses padrões são provisórios e sempre sujeitos à convenção do condomínio. Não afirmar que o condomínio aprovou o padrão.</p>
   <h4>Limites técnicos e divisão</h4>
   <div className="kiara-pricing-form">
    <label>Largura máxima técnica por folha (m)<input type="number" min="0.01" step=".01" disabled={!admin} value={t.maxPieceWidth} onChange={e=>setLimit('maxPieceWidth',Number(e.target.value))}/></label>
    <label>Largura recomendada mínima (m)<input type="number" min="0.01" step=".01" disabled={!admin} value={t.recommendedMinWidth} onChange={e=>setLimit('recommendedMinWidth',Number(e.target.value))}/></label>
    <label>Largura recomendada máxima (m)<input type="number" min="0.01" step=".01" disabled={!admin} value={t.recommendedMaxWidth} onChange={e=>setLimit('recommendedMaxWidth',Number(e.target.value))}/></label>
    <label>Altura máxima por folha (m)<input type="number" min="0.01" step=".01" disabled={!admin} value={t.maxPieceHeight} onChange={e=>setLimit('maxPieceHeight',Number(e.target.value))}/></label>
    <label>Mínima manual (m)<input type="number" min="0.01" step=".01" disabled={!admin} value={t.minimumManualWidth} onChange={e=>setLimit('minimumManualWidth',Number(e.target.value))}/></label>
    <label>Mínima motorizada (m)<input type="number" min="0.01" step=".01" disabled={!admin} value={t.minimumMotorWidth} onChange={e=>setLimit('minimumMotorWidth',Number(e.target.value))}/></label>
    <label>Sobreposição por lado/folha (cm)<input type="number" min="0" step="1" disabled={!admin} value={t.overlapCm} onChange={e=>setLimit('overlapCm',Number(e.target.value))}/></label>
    <label>Adicional por lado da janela (cm)<input type="number" min="0" step="1" disabled={!admin} value={t.windowSideAllowanceCm} onChange={e=>setLimit('windowSideAllowanceCm',Number(e.target.value))}/></label>
    <label>Máximo de folhas por simulação<input type="number" min="1" step="1" disabled={!admin} value={t.maxPieces} onChange={e=>setLimit('maxPieces',Number(e.target.value))}/></label>
   </div>
   <p>Largura técnica máxima cadastral: 2,40 m; a recomendação para uso versátil é dividir em folhas de aproximadamente 0,90 a 1,20 m. O simulador sinaliza, mas não decide a divisão final sem conferência.</p>
   <h4>Modelos e custos</h4>
   {data.models.map((item,i)=><div className="kiara-pricing-form kiara-commercial-row kiara-commercial-row--rail" key={i}>
    <label>Código<input disabled={!admin} value={item.id} onChange={e=>change({...data,models:data.models.map((x,j)=>j===i?{...x,id:e.target.value}:x)})}/></label>
    <label>Modelo<input disabled={!admin} value={item.name} onChange={e=>change({...data,models:data.models.map((x,j)=>j===i?{...x,name:e.target.value}:x)})}/></label>
    <label>Custo por m² (R$){numberField(item.costPerM2,n=>change({...data,models:data.models.map((x,j)=>j===i?{...x,costPerM2:n}:x)}))}</label>
    <label>Custo mínimo por folha (R$){numberField(item.minCost,n=>change({...data,models:data.models.map((x,j)=>j===i?{...x,minCost:n}:x)}))}</label>
    <label className="kiara-blinds-checkbox"><input type="checkbox" disabled={!admin} checked={item.active} onChange={e=>change({...data,models:data.models.map((x,j)=>j===i?{...x,active:e.target.checked}:x)})}/> Ativo</label>
    {admin&&<button className="kiara-commercial-button kiara-commercial-button--remove" type="button" onClick={()=>change({...data,models:data.models.filter((_,j)=>i!==j)})}>Remover</button>}
   </div>)}
   {admin&&<button className="kiara-commercial-button kiara-commercial-button--add" type="button" onClick={()=>change({...data,models:[...data.models,{id:'',name:'',costPerM2:null,minCost:null,active:true}]})}>Adicionar modelo</button>}
   <h4>Instalação, motorização e preço</h4>
   <div className="kiara-pricing-form">
    <label>Instalação manual por folha (R$){numberField(data.installation.manualPerPiece,n=>change({...data,installation:{...data.installation,manualPerPiece:n}}))}</label>
    <label>Instalação motorizada por folha (R$){numberField(data.installation.motorPerPiece,n=>change({...data,installation:{...data.installation,motorPerPiece:n}}))}</label>
    <label>Adicional final de motorização por folha (R$){numberField(data.motorization.saleSurchargePerPiece,n=>change({...data,motorization:{saleSurchargePerPiece:n}}))}</label>
    <label>Acréscimo comercial sobre custos (%){numberField(data.pricing.markupPercent,n=>change({...data,pricing:{markupPercent:n}}))}</label>
   </div>
   <label>Observações internas<textarea disabled={!admin} value={data.notes} onChange={e=>change({...data,notes:e.target.value})} rows={3}/></label>
   {admin&&<button className="kiara-commercial-button kiara-commercial-button--primary" disabled={saving||!dirty} type="button" onClick={()=>void save()}>{saving?'Salvando…':'Salvar rascunho de persianas'}</button>}
   {notice&&<p role="status">{notice}</p>}
   <section className="kiara-commercial-test-section">
    <h4>Teste interno — triagem e persianas</h4>
    <div className="kiara-pricing-form">
     <label>Ambiente<select value={area} onChange={e=>setArea(e.target.value as Area)}><option value="window">Janela</option><option value="balcony">Varanda envidraçada</option></select></label>
     <label>Cliente mora em prédio?<select value={condo} onChange={e=>setCondo(e.target.value)}><option value="unknown">Não informado</option><option value="yes">Sim</option><option value="no">Não</option></select></label>
     {condo==='yes'&&<label>Conferiu as regras do condomínio?<select value={rules} onChange={e=>setRules(e.target.value)}><option value="unknown">Não sabe / ainda não conferiu</option><option value="standard">Sim, compatíveis com o padrão</option><option value="different">Sim, regras específicas</option></select></label>}
     <label>Instalação prevista<select value={layout} onChange={e=>setLayout(e.target.value)}><option value="unknown">Não sabe — usar padrão provisório</option><option value="overlap">Transpassada (sobreposta)</option><option value="side_by_side">Lado a lado</option></select></label>
     {area==='balcony'&&<>
      <label>Vidro / guarda-corpo<select value={glass} onChange={e=>setGlass(e.target.value)}><option value="unknown">Ainda não sabe</option><option value="full">Vidro do piso ao teto</option><option value="half">Vidro sobre guarda-corpo de alvenaria</option></select></label>
      <label>Trechos envidraçados<select value={segments} onChange={e=>setSegments(e.target.value)}><option value="1">Um trecho medido</option><option value="2">Frente e lateral</option><option value="3">Mais de dois trechos</option></select></label>
      <label className="kiara-blinds-checkbox"><input type="checkbox" checked={photosConfirmed} onChange={e=>setPhotosConfirmed(e.target.checked)}/> Fotos e identificação da área envidraçada conferidas</label>
     </>}
     <label>Modelo de persiana<select value={modelId} onChange={e=>setModelId(e.target.value)}><option value="">Selecione</option>{data.models.filter(x=>x.active).map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
     <label>{area==='window'?'Largura da janela/vão (m)':'Largura do trecho envidraçado (m)'}<input value={width} onChange={e=>setWidth(e.target.value)} placeholder="2,50"/></label>
     <label>{area==='window'?'Altura da janela/vão (m)':'Altura da área envidraçada (m)'}<input value={height} onChange={e=>setHeight(e.target.value)} placeholder="2,20"/></label>
     <label>Quantidade de folhas<input type="number" min="1" value={pieces} onChange={e=>setPieces(e.target.value)} placeholder="Definir pela divisão"/></label>
     <label className="kiara-blinds-checkbox"><input type="checkbox" checked={motorized} onChange={e=>setMotorized(e.target.checked)}/> Motorizada</label>
    </div>
    <p><strong>Modelo de referência se as regras não forem conhecidas:</strong> {data.defaults.model}, {data.defaults.color}, visibilidade {data.defaults.openness}, instalação {layoutName(selectedLayout)}. Sujeito à confirmação do condomínio.</p>
    {suggestedCount!==null&&<p>Divisão inicial sugerida pela largura: aproximadamente {suggestedCount} folha(s), antes de conferir sobreposição e dimensões técnicas. Preferência por 0,90–1,20 m por folha, sempre que possível.</p>}
    {area==='balcony'&&<p>Em varanda, pedir foto da frente e das laterais e identificar largura, comprimento e altura de cada trecho. Se houver meia parede, não usar a altura total do piso ao teto como altura do vidro.</p>}
    {count>0&&Number.isFinite(measuredWidth)&&<p>Estimativa geométrica: {count} folha(s) com cerca de {measuredWidth.toLocaleString('pt-BR',{maximumFractionDigits:3})} m de largura fabricada cada; {selectedLayout==='overlap'?'sobreposição incluída onde aplicável':'lado a lado sem sobreposição interna'}. Conferir divisão antes do pedido.</p>}
    {price!==null?<p><strong>{fmt(price)}</strong> · TESTE INTERNO, SEM VALIDADE COMERCIAL. Custo: {fmt(fabric)}; instalação: {fmt(installation)}; motorização: {fmt(motor)}.</p>:
     <p role="status">{dirty?'Salve os valores antes de testar.':condoBlocked?'Regras específicas do condomínio: solicite modelo, cor e instalação permitidos.':balconyBlocked?'Varanda com informações incompletas: solicite fotos e medidas separadas de frente e laterais.':!dimensionOK&&count>0?'Largura ou altura da folha fora dos limites para o acionamento selecionado.':'Informe modelo, divisão e medidas válidas; preços só são mostrados após cadastrar custos.'}</p>}
   </section>
  </>}
 </section>
}
