// HOMOLOGAÇÃO: importa Kiara real para validar compilação, mas NÃO chama
// handlers de webhook/queue, não cria KV e não possui credenciais Meta/OpenAI.
import kiara from '../src/worker.js';
import {simulateCurtainQuote} from '../src/quote-pricing.js';

if (typeof kiara?.fetch !== 'function' || typeof kiara?.queue !== 'function') {
  throw new Error('Kiara Worker incompleto.');
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const noStore = {'Cache-Control':'no-store'};
function cors(env, origin, methods='GET, OPTIONS'){
  return origin && origin === env.KIARA_DASHBOARD_ORIGIN
    ? {...noStore,'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':methods,
        'Access-Control-Allow-Headers':'Authorization, Content-Type','Vary':'Origin'}
    : noStore;
}
function json(body,status=200,headers=noStore){return Response.json(body,{status,headers});}
function requireConfig(env){
  const url=String(env.SUPABASE_URL||'');
  const key=String(env.SUPABASE_PUBLISHABLE_KEY||'');
  const org=String(env.SUPABASE_ORGANIZATION_ID||'');
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !key.startsWith('sb_publishable_') || !uuid.test(org))
    throw new Error('Homologação sem configuração Supabase válida');
  return {url,key,org};
}
async function authenticatedRead(request,env,url){
  const origin=request.headers.get('Origin')||'';
  const headers=cors(env,origin);
  if(origin!==env.KIARA_DASHBOARD_ORIGIN)return json({error:'Origin not allowed'},403,headers);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='GET')return json({error:'Read-only staging'},405,headers);
  const conversationId=url.searchParams.get('conversationId')||'';
  if(!uuid.test(conversationId))return json({error:'Invalid conversation'},400,headers);
  const token=request.headers.get('Authorization')||'';
  if(!/^Bearer [A-Za-z0-9._~-]{50,10000}$/.test(token))return json({error:'Authentication required'},401,headers);
  const {url:base,key,org}=requireConfig(env);
  const authHeaders={apikey:key,Authorization:token};
  const verified=await fetch(base+'/auth/v1/user',{headers:authHeaders});
  if(!verified.ok)return json({error:'Invalid session'},401,headers);
  const qs=new URLSearchParams({select:'reply_held,status',organization_id:'eq.'+org,id:'eq.'+conversationId,limit:'1'});
  const db=await fetch(base+'/rest/v1/kiara_conversations?'+qs,{headers:authHeaders});
  if(!db.ok)return json({error:'Read not available'},db.status===401||db.status===403?403:503,headers);
  const rows=await db.json();
  if(!Array.isArray(rows)||rows.length===0)return json({error:'Conversation unavailable'},404,headers);
  return json({held:rows[0].reply_held===true,status:rows[0].status,writable:false,environment:'homologacao'},200,headers);
}
// Simulação comercial com token do usuário e RLS, sem service_role.
// O staging continua proibido de enviar mensagens, alterar conversas ou operar filas.
async function priceSimulation(request,env){
 const origin=request.headers.get('Origin')||'';
 const headers=cors(env,origin,'POST, OPTIONS');
 if(origin!==env.KIARA_DASHBOARD_ORIGIN)return json({error:'Origem não autorizada'},403,headers);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return json({error:'Método não permitido'},405,headers);
 const authorization=request.headers.get('Authorization')||'';
 if(!/^Bearer [A-Za-z0-9._~-]{50,10000}$/.test(authorization))
  return json({error:'Sessão necessária'},401,headers);
 const {url:base,key,org}=requireConfig(env);
 const sessionHeaders={apikey:key,Authorization:authorization};
 const userResponse=await fetch(base+'/auth/v1/user',{headers:sessionHeaders});
 if(!userResponse.ok)return json({error:'Sessão inválida'},401,headers);
 const user=await userResponse.json();
 if(!uuid.test(user?.id||''))return json({error:'Identidade inválida'},401,headers);
 const membershipQuery=new URLSearchParams({select:'role',organization_id:'eq.'+org,user_id:'eq.'+user.id,active:'is.true',limit:'5'});
 const membershipResponse=await fetch(base+'/rest/v1/memberships?'+membershipQuery,{headers:sessionHeaders});
 if(!membershipResponse.ok)return json({error:'Permissões indisponíveis'},503,headers);
 const memberships=await membershipResponse.json();
 if(!Array.isArray(memberships)||!memberships.some(x=>x.role==='admin'||x.role==='comercial'))
  return json({error:'Usuário sem permissão'},403,headers);
 let payload;
 try{payload=await request.json()}catch{return json({error:'Corpo inválido'},400,headers)}
 const draft=payload?.mode==='draft';
 if(!draft && payload?.mode!=='approved')return json({error:'Modo inválido'},400,headers);
 if(draft&&!memberships.some(x=>x.role==='admin'))
  return json({error:'Rascunho restrito ao administrador'},403,headers);
 if(payload?.conversationId)return json({error:'A homologação isolada permite apenas simulação manual'},400,headers);
 const query=new URLSearchParams({select:'settings,revision,status',organization_id:'eq.'+org,product:'eq.cortina',status:'eq.'+(draft?'draft':'approved'),limit:'1'});
 const recordResponse=await fetch(base+'/rest/v1/kiara_commercial_config?'+query,{headers:sessionHeaders});
 if(!recordResponse.ok)return json({error:'Não foi possível ler a configuração comercial'},503,headers);
 const records=await recordResponse.json();
 if(!Array.isArray(records)||!records.length)return json({ready:false,customerPriceAllowed:false,errors:['Revisão comercial não disponível para simulação']},422,headers);
 const config=payload?.config||{};
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(String(config.railType||'')))
  return json({error:'Trilho inválido'},400,headers);
 const result=simulateCurtainQuote(payload?.input||{},{
  pricing:records[0].settings,railType:config.railType,rails:config.rails,revision:records[0].revision
 });
 return json({...result,customerPriceAllowed:false,configurationStatus:records[0].status,environment:'homologacao'},result.ready?200:422,headers);
}
export default {
  async fetch(request,env={}){
    const url=new URL(request.url);
    if(request.method==='GET' && url.pathname==='/health')return json({
      service:'kiara-homologacao',status:'ok',worker_code:'integrado',external_integrations:'blocked',
      supabase_read:'authenticated_only'
    });
    if(url.pathname==='/kiara/pricing/simulate'){
      try{return await priceSimulation(request,env)}
      catch(error){console.error('Staging simulation failed',String(error?.message||''));return json({error:'Simulação indisponível'},503,cors(env,request.headers.get('Origin'),'POST, OPTIONS'))}
    }
    if(url.pathname==='/kiara/coach' && ['GET','OPTIONS'].includes(request.method)){
      try{return await authenticatedRead(request,env,url)}
      catch(error){console.error('Staging read failed',error?.message);return json({error:'Read unavailable'},503,cors(env,request.headers.get('Origin')))}
    }
    return json({error:'Rota desativada na homologação isolada'},404);
  }
  // Sem handler de Queue, sem envio ao WhatsApp, sem mutações no Supabase.
};
