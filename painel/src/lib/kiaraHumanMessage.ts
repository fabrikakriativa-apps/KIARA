import {supabase} from './supabase'

// Nunca envie nome/identidade do navegador. O Worker consulta o perfil autenticado,
// verifica a permissão, o estado da conversa e acrescenta o nome ao texto.
const endpoint=(import.meta.env.VITE_KIARA_HUMAN_MESSAGE_URL||'').trim()
export const kiaraHumanMessageConfigured=/^https:\/\//.test(endpoint)
export async function sendKiaraHumanMessage(conversationId:string,text:string):Promise<{ok:true;senderName:string;synchronized:boolean}>{
 if(!kiaraHumanMessageConfigured||!supabase)throw Error('Envio humano pelo painel ainda não está habilitado.')
 const body=text.trim()
 if(!body||body.length>3000)throw Error('Informe uma mensagem com até 3.000 caracteres.')
 const {data:{session},error}=await supabase.auth.getSession()
 if(error||!session?.access_token)throw Error('Sua sessão expirou. Entre novamente.')
 const response=await fetch(endpoint,{
  method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
  body:JSON.stringify({conversationId,text:body})
 })
 let payload:{ok?:boolean;error?:string;senderName?:string;synchronized?:boolean}
 try{payload=await response.json()}catch{throw Error('O servidor não retornou confirmação de envio. Verifique a conversa antes de tentar novamente.')}
 if(!response.ok||payload.ok!==true){
  if(response.status===409)throw Error(payload.error||'Assuma a conversa para enviar mensagens.')
  throw Error(payload.error||'O WhatsApp não confirmou o envio. Verifique o histórico antes de repetir.')
 }
 return {ok:true,senderName:payload.senderName||'Atendente',synchronized:payload.synchronized===true}
}
