import {createContext,useContext,useEffect,useState,type ReactNode} from 'react'
import {LogIn,ShieldCheck} from 'lucide-react'
import type {Session} from '@supabase/supabase-js'
import {supabase,supabaseConfigured} from '../lib/supabase'

type Access={userId:string;organizationId:string;role:string}
const AccessContext=createContext<Access|null>(null)
export const useAccess=()=>useContext(AccessContext)
export function AuthGate({children}:{children:ReactNode}){
 const [session,setSession]=useState<Session|null>(null)
 const [access,setAccess]=useState<Access|null>(null)
 const [ready,setReady]=useState(false)
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 useEffect(()=>{
  if(!supabase){setReady(true);return}
  let alive=true
  void supabase.auth.getSession().then(({data})=>{if(alive){setSession(data.session);setReady(true)}}).catch(()=>{if(alive){setError('Não foi possível verificar o login.');setReady(true)}})
  const {data}=supabase.auth.onAuthStateChange((_event,current)=>{if(alive){setSession(current);setReady(true)}})
  return()=>{alive=false;data.subscription.unsubscribe()}
 },[])
 useEffect(()=>{
  setAccess(null)
  if(!supabase||!session?.user.id)return
  let alive=true
  const client=supabase
  void (async()=>{
   try{
    const {data:userData,error:userError}=await client.auth.getUser()
    if(userError||!userData.user||userData.user.id!==session.user.id||userData.user.is_anonymous)throw Error('Sessão inválida.')
    const {data,error:memberError}=await client.from('memberships').select('organization_id,user_id,role,active').eq('user_id',userData.user.id).eq('active',true)
    if(memberError)throw memberError
    const members=(data||[]).filter(m=>['admin','comercial'].includes(m.role))
    if(members.length!==1)throw Error('Acesso à Kiara não autorizado. Solicite liberação ao administrador.')
    if(alive){setAccess({userId:userData.user.id,organizationId:members[0].organization_id,role:members[0].role});setError('')}
   }catch(e){if(alive)setError(e instanceof Error?e.message:'Falha ao conferir acesso.')}
  })()
  return()=>{alive=false}
 },[session?.user.id])
 const signIn=async()=>{
  if(!supabase)return
  setBusy(true)
  const {error:loginError}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+import.meta.env.BASE_URL}})
  if(loginError){setError(loginError.message);setBusy(false)}
 }
 if(access)return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>
 return <main className="kiara-login"><section className="kiara-login-card"><div className="kiara-login-mark">✦</div><span className="kiara-login-eyebrow">Fábrika Kriativa</span><h1>Kiara</h1><h2>Central de Atendimento IA</h2><p>Uma central exclusiva para acompanhar conversas, orientar a atendente e gerenciar leads.</p>
  {!supabaseConfigured?<p role="alert">Configure a URL e a chave publicável do Supabase para ativar o login.</p>:error?<p role="alert">{error}</p>:!ready||session?<p>Verificando acesso autorizado…</p>:<button disabled={busy} onClick={()=>void signIn()}><LogIn size={19}/> {busy?'Conectando…':'Entrar com Google'}</button>}
  <small><ShieldCheck size={14}/> Acesso restrito à equipe autorizada · Dados protegidos pelo Supabase</small></section></main>
}
