import { supabase } from './supabase'

const base=(import.meta.env.VITE_KIARA_COACH_URL || '').trim()
export const kiaraCoachConfigured = /^https:\/\//.test(base)

async function request<T>(method:'GET'|'POST',conversationId:string,action?:'hold'|'release'):Promise<T> {
 if(!kiaraCoachConfigured || !supabase) throw new Error('Controle de orientação ainda não ativado.')
 const {data:{session},error}=await supabase.auth.getSession()
 if(error || !session?.access_token) throw new Error('Entre novamente no SISTEMA.')
 const url=method==='GET'?base+'?conversationId='+encodeURIComponent(conversationId):base
 const response=await fetch(url,{
  method,headers:{Authorization:'Bearer '+session.access_token,...(method==='POST'?{'Content-Type':'application/json'}:{})},
  ...(method==='POST'?{body:JSON.stringify({conversationId,action})}:{})
 })
 if(!response.ok) {
  if(response.status===401) throw new Error('Sessão expirada.')
  if(response.status===403 || response.status===404) throw new Error('Sem permissão para esta conversa.')
  throw new Error('O controle de orientação está indisponível.')
 }
 return response.json()
}
export const readKiaraHold = (conversationId:string)=>request<{held:boolean;writable?:boolean;environment?:string;status?:string}>('GET',conversationId)
export const setKiaraHold = (conversationId:string,held:boolean)=>
 request<{ok:boolean;held:boolean}>('POST',conversationId,held?'hold':'release')
