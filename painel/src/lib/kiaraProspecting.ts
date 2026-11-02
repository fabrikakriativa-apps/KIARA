import {supabase} from './supabase'

export type KiaraPromotion = {ok:boolean;opportunity_id:string;created:boolean;already_linked:boolean}

/** Explicit human qualification. The database RPC checks membership, company,
 * phone reuse and creates/links exactly one opportunity transactionally. */
export async function sendKiaraToProspecting(organizationId:string,conversationId:string):Promise<KiaraPromotion>{
 if(!supabase)throw new Error('Entre novamente na Kiara.')
 const {data,error}=await supabase.rpc('kiara_send_to_prospecting',{
  org_id:organizationId,target_conversation_id:conversationId
 })
 if(error){
  if(error.code==='42501')throw new Error('Você não tem permissão para encaminhar leads.')
  if(error.code==='23505')throw new Error('Encontramos registros comerciais duplicados. Verifique o telefone na Prospecção antes de encaminhar.')
  throw new Error(error.message||'Não foi possível vincular o lead à Prospecção.')
 }
 const result=data as KiaraPromotion|null
 if(!result?.ok||!result.opportunity_id)throw new Error('O servidor não confirmou o vínculo comercial.')
 return result
}

export const prospectingUrl=()=> 'https://fabrikakriativa-apps.github.io/SISTEMA/#/prospeccao'
