import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {useAccess} from '../components/AuthorizedAccess'

type Conversation={id:string;contact_name:string|null;contact_phone:string|null;last_interaction_at:string|null}
type PriceResult={
 ready:boolean;customerPriceAllowed:boolean;errors?:string[];
 intake?:{environment:string;model:string;width:number;height:number;frontCategory:string;backCategory:string;drive:string;quantity:number};
 costs?:{front:number;lining:number;rails:number;installation:number;total:number};
 internalSuggestedSale?:number;motorSurcharge?:number;warnings?:string[];
}
const money=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export function KiaraConversationPricing(){
 const access=useAccess()
 const endpoint=import.meta.env.VITE_KIARA_PRICE_SIMULATION_URL||''
 const [conversations,setConversations]=useState<Conversation[]>([])
 const [selected,setSelected]=useState('')
 const [railType,setRailType]=useState('varao_trilho')
 const [rails,setRails]=useState('1')
 const [loading,setLoading]=useState(false)
 const [result,setResult]=useState<PriceResult|null>(null)
 const [feedback,setFeedback]=useState('')
 useEffect(()=>{
  if(!supabase||!access)return
  let alive=true
  void supabase.from('kiara_conversations')
   .select('id,contact_name,contact_phone,last_interaction_at')
   .eq('organization_id',access.organizationId)
   .order('last_interaction_at',{ascending:false})
   .limit(80)
   .then(({data,error})=>{
    if(!alive)return
    if(error)setFeedback('Não foi possível listar as conversas.')
    else setConversations((data||[]) as Conversation[])
   })
  return()=>{alive=false}
 },[access?.organizationId])
 async function simulate(e:React.FormEvent){
  e.preventDefault()
  if(!supabase||!endpoint||!selected||loading)return
  setLoading(true);setResult(null);setFeedback('')
  try{
   const {data:{session}}=await supabase.auth.getSession()
   if(!session)throw Error('É necessário entrar novamente no painel.')
   const response=await fetch(endpoint,{
    method:'POST',
    headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
    body:JSON.stringify({conversationId:selected,config:{
     railType,rails:Number(rails)
    }})
   })
   const json=await response.json() as PriceResult & {error?:string}
   setResult(json)
   if(!response.ok)setFeedback(json.error||'Dados insuficientes para simular. Revise a conversa e os parâmetros.')
  }catch(error){
   setFeedback(error instanceof Error?error.message:'Não foi possível simular.')
  }finally{setLoading(false)}
 }
 return <section className="kiara-management-card">
  <h2>Simulação interna a partir da conversa</h2>
  <p>A Kiara identifica medidas e composição do cliente. O trilho é definido internamente; todos os preços e acréscimos são lidos das Configurações aprovadas. Nenhum valor é enviado pelo WhatsApp.</p>
  {!endpoint?<p role="status">Integração indisponível até configurar o endereço de homologação do simulador.</p>:
  <form className="kiara-pricing-form" onSubmit={e=>void simulate(e)}>
   <label>Conversa do cliente<select required value={selected} onChange={e=>{setSelected(e.target.value);setResult(null)}}>
    <option value="">Selecione a conversa</option>
    {conversations.map(c=><option value={c.id} key={c.id}>{c.contact_name||c.contact_phone||'Cliente'} · {c.last_interaction_at?new Date(c.last_interaction_at).toLocaleString('pt-BR'):''}</option>)}
   </select></label>
   <label>Trilho (definição interna)<select value={railType} onChange={e=>setRailType(e.target.value)}>
    <option value="varao_trilho">Varão trilho</option><option value="trilho_suico">Trilho suíço — referência sujeita a revisão</option>
   </select></label>
   <label>Quantidade de trilhos na composição<select value={rails} onChange={e=>setRails(e.target.value)}>
    <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
   </select></label>
   <button disabled={loading||!selected} type="submit">{loading?'Analisando...':'Gerar simulação interna'}</button>
  </form>}
  {feedback&&<p role="status">{feedback}</p>}
  {result&&<div>
   {!result.ready?<><h3>Pendências identificadas</h3><ul>{(result.errors||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></>:
   <><h3>Estimativa para conferência</h3>
    <p>{result.intake?.environment} · {result.intake?.model} · {result.intake?.frontCategory} {result.intake?.backCategory!=='Sem forro'?'+ '+result.intake?.backCategory:''}</p>
    <p><strong>{money(result.internalSuggestedSale||0)}</strong> · valor interno, não aprovado</p>
    <details><summary>Detalhamento interno de custos</summary>
     {result.costs&&<dl>
      <dt>Tecido da frente</dt><dd>{money(result.costs.front)}</dd>
      <dt>Forro</dt><dd>{money(result.costs.lining)}</dd>
      <dt>Trilhos</dt><dd>{money(result.costs.rails)}</dd>
      <dt>Instalação inclusa</dt><dd>{money(result.costs.installation)}</dd>
      <dt>Custo total estimado</dt><dd>{money(result.costs.total)}</dd>
      <dt>Adicional comercial por motorização</dt><dd>{money(result.motorSurcharge||0)}</dd>
     </dl>}
    </details><ul>{(result.warnings||[]).map((x,i)=><li key={i}>{x}</li>)}</ul>
    <small>Simulação exploratória. Exige revisão humana antes da elaboração ou envio de orçamento.</small></>}
  </div>}
 </section>
}
