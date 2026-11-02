// HOMOLOGAÇÃO: importa Kiara real para validar compilação, mas NÃO chama
// handlers de webhook/queue, não cria KV e não possui credenciais Meta/OpenAI.
import kiara from '../src/worker.js';

if (typeof kiara?.fetch !== 'function' || typeof kiara?.queue !== 'function') {
  throw new Error('Kiara Worker incompleto.');
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const noStore = {'Cache-Control':'no-store'};
function cors(env, origin){
  return origin && origin === env.KIARA_DASHBOARD_ORIGIN
    ? {...noStore,'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, OPTIONS',
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
export default {
  async fetch(request,env={}){
    const url=new URL(request.url);
    if(request.method==='GET' && url.pathname==='/health')return json({
      service:'kiara-homologacao',status:'ok',worker_code:'integrado',external_integrations:'blocked',
      supabase_read:'authenticated_only'
    });
    if(url.pathname==='/kiara/coach' && ['GET','OPTIONS'].includes(request.method)){
      try{return await authenticatedRead(request,env,url)}
      catch(error){console.error('Staging read failed',error?.message);return json({error:'Read unavailable'},503,cors(env,request.headers.get('Origin')))}
    }
    return json({error:'Rota desativada na homologação isolada'},404);
  }
  // Sem handler de Queue, sem envio ao WhatsApp, sem mutações no Supabase.
};
