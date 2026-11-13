import {useState} from 'react'
import {supabase} from '../lib/supabase'
import {useAccess} from '../components/AuthorizedAccess'
const url=import.meta.env.VITE_KIARA_PRICE_SIMULATION_URL?.trim()||''
type Parameters={width:number;height:number;quantity:number;year:number;faces:{category:string;includeInstallation:boolean}[];railType:string;rails:number;expected:number;revision:number;draft:boolean;dirty:boolean}
const money=(value:number)=>value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
export function KiaraQuoteServerValidation({params}:{params:Parameters}){
 const access=useAccess()
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 async function check(){
  if(!supabase||!url||busy||params.dirty)return
  setBusy(true);setNotice('')
  try{
   const {data:{session},error}=await supabase.auth.getSession()
   if(error||!session?.access_token)throw Error('Sua sessão expirou. Entre novamente.')
   const response=await fetch(url,{
    method:'POST',
    headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
    body:JSON.stringify({
     mode:params.draft?'draft':'approved',
     input:{width:params.width,height:params.height,quantity:params.quantity,year:params.year,drive:'manual',faces:params.faces},
     config:{railType:params.railType,rails:params.rails}
    })
   })
   const payload=await response.json()
   if(!response.ok||payload.ready!==true)throw Error((payload.errors||[]).join('. ')||payload.error||'Cálculo do Worker indisponível')
   const actual=Number(payload.internalSuggestedSale)
   if(!Number.isFinite(actual))throw Error('O Worker não retornou um valor válido.')
   if(payload.configurationRevision!==params.revision)throw Error('Revisões diferentes entre painel e Worker. Recarregue os parâmetros.')
   const diff=Math.round((actual-params.expected)*100)/100
   setNotice(Math.abs(diff)<0.01
    ?'Conferência aprovada: Worker e painel retornaram '+money(actual)+' na revisão '+params.revision+'.'
    :'Diferença encontrada: Worker '+money(actual)+'; painel '+money(params.expected)+'; variação '+money(diff)+'. Não aprove esta revisão.')
  }catch(e){setNotice(e instanceof Error?e.message:'Não foi possível conferir o cálculo no Worker.')}
  finally{setBusy(false)}
 }
 if(!url)return <p><small>Conferência com o Worker ainda não configurada neste ambiente. A simulação local não autoriza envio de preços ao cliente.</small></p>
 if(!/^https:\/\//.test(url))return <p role="alert">Endereço de homologação do Worker inválido.</p>
 return <div>
  <button type="button" className="kiara-commercial-button" disabled={busy||params.dirty||!access||params.draft&&access.role!=='admin'} onClick={()=>void check()}>
   {busy?'Conferindo…':'Conferir com o Worker autenticado'}
  </button>
  {params.dirty&&<p><small>Salve as alterações antes de comparar com o Worker.</small></p>}
  {notice&&<p role="status">{notice}</p>}
 </div>
}
