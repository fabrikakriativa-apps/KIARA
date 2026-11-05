import {supabase} from './supabase'
export type Capability={enabled:boolean;label:string;reason?:string}
export type KiaraCapabilities={
 environment:string;transport:string;productionConnected:boolean;
 capabilities:Record<string,Capability>
}
const endpoint=(import.meta.env.VITE_KIARA_CAPABILITIES_URL||'').trim()
export const kiaraCapabilitiesConfigured=/^https:\/\//.test(endpoint)
export async function readKiaraCapabilities():Promise<KiaraCapabilities>{
 if(!supabase||!kiaraCapabilitiesConfigured)throw Error('Diagnóstico de homologação não configurado.')
 const {data:{session},error}=await supabase.auth.getSession()
 if(error||!session?.access_token)throw Error('Sessão indisponível. Entre novamente.')
 const res=await fetch(endpoint,{headers:{Authorization:'Bearer '+session.access_token}})
 if(!res.ok)throw Error('Não foi possível consultar a prontidão do Worker (HTTP '+res.status+').')
 const data=await res.json() as KiaraCapabilities
 if(!data||!data.capabilities||typeof data.capabilities!=='object')throw Error('Diagnóstico inválido.')
 return data
}
