import {useEffect,useState} from 'react'
import {useAccess} from '../components/AuthorizedAccess'
import {supabase} from '../lib/supabase'

type Observation={id:string;conversation_id:string;human_text:string;previous_ai_text:string|null;created_at:string}
export function KiaraObservations(){
 const access=useAccess(),[items,setItems]=useState<Observation[]>([]),[draft,setDraft]=useState<Record<string,string>>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0)
 useEffect(()=>{if(!supabase||!access)return;let live=true;const client=supabase;void client.from('kiara_learning_observations').select('id,conversation_id,human_text,previous_ai_text,created_at').eq('organization_id',access.organizationId).eq('status','pending').order('created_at',{ascending:false}).limit(50).then(({data,error:e})=>{
 if(live){if(e)setError('Não foi possível carregar as observações.');else{setItems((data||[]) as Observation[]);setError('')}}});return()=>{live=false}},[access?.organizationId,revision])
 async function decide(item:Observation,action:'reviewed'|'discarded'){
  if(!access||!supabase||busy)return
  if(action==='reviewed'&&draft[item.id]?.trim().length<5){setError('Descreva a regra que a Kiara deve aprender antes de enviar à aprovação.');return}
  setBusy(true);setError('')
  if(action==='reviewed'){
   const {error:e}=await supabase.from('kiara_guidance').insert({
    organization_id:access.organizationId,conversation_id:null,message_id:null,scope:'global',kind:'correction',
    instruction:draft[item.id].trim().slice(0,2000),status:'pending_review',created_by:access.userId
   })
   if(e){setError('Não foi possível registrar a sugestão: '+e.message);setBusy(false);return}
  }
  const {error:e}=await supabase.rpc('kiara_review_observation',{p_id:item.id,p_action:action})
  setBusy(false)
  if(e)setError('A sugestão foi registrada, mas houve falha ao atualizar a observação. Atualize para conferir.')
  else setRevision(n=>n+1)
 }
 return <section className="kiara-management-card"><h2>Intervenções observadas</h2>
 <p>Quando uma resposta humana sucede uma resposta da Kiara, o sistema pode guardar o par de mensagens para revisão. Isso não é tratado como uma correção automaticamente.</p>
 {error&&<p role="alert">{error}</p>}
 {items.length===0?<p>Nenhuma intervenção registrada para avaliação.</p>:items.map(item=><article className="kiara-management-card" key={item.id}>
 <small>{new Date(item.created_at).toLocaleString('pt-BR')}</small>
 <p><strong>Resposta anterior da Kiara:</strong> {item.previous_ai_text||'Sem texto'}</p>
 <p><strong>Resposta humana seguinte:</strong> {item.human_text}</p>
 <label style={{display:'block'}}>Que regra devemos extrair deste caso?<textarea style={{width:'100%'}} value={draft[item.id]||''} onChange={e=>setDraft(d=>({...d,[item.id]:e.target.value}))} maxLength={2000} placeholder="Descreva uma regra aplicável a outros atendimentos…"/></label>
 <div className="kiara-management-actions"><button disabled={busy} onClick={()=>void decide(item,'reviewed')}>Sugerir aprendizado para aprovação</button><button disabled={busy} onClick={()=>void decide(item,'discarded')}>Ignorar observação</button></div>
 </article>)}
 </section>
}