import { supabase } from './supabase'

export type KiaraOperatorAction = 'pause_all' | 'resume_all' | 'assume' | 'return_to_ai'

// Public endpoint only; do not put API keys or credentials in VITE_ variables.
const base = import.meta.env.VITE_KIARA_CONTROL_URL?.trim() || ''

export const kiaraControlConfigured = Boolean(base && /^https:\/\//.test(base))

async function operator<T>(method: 'GET'|'POST', body?: unknown, conversationId?:string): Promise<T> {
  if (!kiaraControlConfigured || !supabase) {
    throw new Error('O controle da Kiara ainda não foi habilitado.')
  }
  const {data: { session }, error} = await supabase.auth.getSession()
  if (error || !session?.access_token) throw new Error('Entre novamente no SISTEMA para continuar.')
  const endpoint=method==='GET'&&conversationId?base+'?conversationId='+encodeURIComponent(conversationId):base
  const response=await fetch(endpoint,{
    method,
    headers:{
      Authorization: `Bearer ${session.access_token}`,
      ...(method==='POST'?{'Content-Type':'application/json'}:{})
    },
    ...(body?{body:JSON.stringify(body)}:{})
  })
  if(!response.ok){
    if(response.status===401) throw new Error('Sua sessão expirou. Entre novamente.')
    if(response.status===403) throw new Error('Você não tem permissão para executar essa ação.')
    if(response.status===503) throw new Error('Controle da Kiara indisponível. Nenhuma alteração foi confirmada.')
    throw new Error('Não foi possível confirmar o comando da Kiara.')
  }
  return response.json() as Promise<T>
}

export const readKiaraControl = (conversationId?:string) => operator<{enabled:boolean;simulated?:boolean;productionConnected?:boolean;simulatedStatus?:'ai'|'human'|null}>('GET',undefined,conversationId)
export const commandKiara = (action:KiaraOperatorAction,conversationId?:string) =>
  operator<{ok:boolean;action:string}>('POST',{action,conversationId:conversationId||null})
