// HOMOLOGAÇÃO: importa Kiara real para validar compilação, mas NÃO chama
// handlers de webhook/queue e usa exclusivamente o KV de testes, sem Meta/OpenAI.
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
// A ponte de homologação aceita somente EasyCoexistence, jamais o webhook Meta
// original. Credenciais presentes não habilitam tráfego por conta própria.
function stagingReadiness(env){
  const checks={
    enabled: env.KIARA_STAGING_LIVE_ENABLED === 'true',
    providerEasy: env.KIARA_STAGING_PROVIDER === 'easy',
    synchronization: env.KIARA_SYNC_ENABLED === 'true',
    operatorControl: env.KIARA_CONTROL_ENABLED === 'true',
    humanHold: env.KIARA_HOLD_ENABLED === 'true',
    limitedContacts: env.KIARA_SYNC_ALL_CONTACTS === 'false',
    kv: Boolean(env.CONVERSAS?.get && env.CONVERSAS?.put && env.CONVERSAS?.delete),
    queue: Boolean(env.KIARA_QUEUE?.send),
    easyPhoneId: /^\d{6,30}$/.test(String(env.EASY_PHONE_NUMBER_ID||'')),
    testRecipient: /^\d{8,30}$/.test(String(env.TEST_ALLOWED_WA_ID||'')),
    easyWebhookKey: /^[A-Za-z0-9_-]{24,256}$/.test(String(env.EASY_WEBHOOK_KEY||'')),
    easyCredential: Boolean(env.EASY_ACCESS_TOKEN),
    aiCredential: Boolean(env.OPENAI_API_KEY),
    supabaseServerCredential: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
  };
  return {ready:Object.values(checks).every(Boolean),checks};
}
function liveTestReady(env){return stagingReadiness(env).ready;}
function requireConfig(env){
  const url=String(env.SUPABASE_URL||'');
  const key=String(env.SUPABASE_PUBLISHABLE_KEY||'');
  const org=String(env.SUPABASE_ORGANIZATION_ID||'');
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !key.startsWith('sb_publishable_') || !uuid.test(org))
    throw new Error('Homologação sem configuração Supabase válida');
  return {url,key,org};
}
// Estado de orientação totalmente isolado do atendimento real.
// Exige sessão válida, associação à organização e RLS da conversa.
async function stagingCoach(request,env,url){
  const origin=request.headers.get('Origin')||'';
  const headers=cors(env,origin,'GET, POST, OPTIONS');
  if(origin!==env.KIARA_DASHBOARD_ORIGIN)return json({error:'Origem não autorizada'},403,headers);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(!['GET','POST'].includes(request.method))return json({error:'Método inválido'},405,headers);
  const authorization=request.headers.get('Authorization')||'';
  if(!/^Bearer [A-Za-z0-9._~-]{50,10000}$/.test(authorization))
    return json({error:'Sessão necessária'},401,headers);
  const {url:base,key,org}=requireConfig(env);
  if(!env.KIARA_CONTROLES?.get || !env.KIARA_CONTROLES?.put)
    return json({error:'KV de homologação indisponível'},503,headers);
  const sessionHeaders={apikey:key,Authorization:authorization};
  const verified=await fetch(base+'/auth/v1/user',{headers:sessionHeaders});
  if(!verified.ok)return json({error:'Sessão inválida'},401,headers);
  const user=await verified.json();
  if(!uuid.test(user?.id||''))return json({error:'Identidade inválida'},401,headers);
  const membershipQuery=new URLSearchParams({select:'role',organization_id:'eq.'+org,user_id:'eq.'+user.id,active:'is.true',limit:'5'});
  const membership=await fetch(base+'/rest/v1/memberships?'+membershipQuery,{headers:sessionHeaders});
  if(!membership.ok)return json({error:'Permissões indisponíveis'},503,headers);
  const memberships=await membership.json();
  if(!Array.isArray(memberships)||!memberships.some(x=>x.role==='admin'||x.role==='comercial'))
    return json({error:'Sem permissão'},403,headers);
  let conversationId,action;
  if(request.method==='GET')conversationId=url.searchParams.get('conversationId');
  else {
    let body;
    try{body=await request.json()}catch{return json({error:'JSON inválido'},400,headers)}
    conversationId=body?.conversationId;
    action=body?.action;
    if(!['hold','release'].includes(action))return json({error:'Ação inválida'},400,headers);
  }
  if(!uuid.test(conversationId||''))return json({error:'Conversa inválida'},400,headers);
  const qs=new URLSearchParams({select:'id,status',organization_id:'eq.'+org,id:'eq.'+conversationId,limit:'1'});
  const db=await fetch(base+'/rest/v1/kiara_conversations?'+qs,{headers:sessionHeaders});
  if(!db.ok)return json({error:'Conversa indisponível'},db.status===401||db.status===403?403:503,headers);
  const rows=await db.json();
  if(!Array.isArray(rows)||rows.length!==1)return json({error:'Conversa não encontrada'},404,headers);
  const stateKey='staging:control:'+org+':hold:'+conversationId;
  if(request.method==='POST'){
    const held=action==='hold';
    await env.KIARA_CONTROLES.put(stateKey,held?'true':'false',{expirationTtl:60*60*24*7});
    return json({ok:true,held,simulated:true,productionConnected:false,environment:'homologacao_isolada'},200,headers);
  }
  const saved=await env.KIARA_CONTROLES.get(stateKey);
  return json({held:saved==='true',status:rows[0].status,writable:true,
    simulated:true,productionConnected:false,environment:'homologacao_isolada'},200,headers);
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

/**
 * Controles de HOMOLOGAÇÃO. Todos os estados ficam exclusivamente no KV
 * KIARA_CONTROLES; nunca escrevem em conversas Supabase, em filas, nem no Meta.
 * Os IDs são apenas referências da interface; ações NÃO controlam a produção.
 */
async function stagingOperator(request,env){
  const origin=request.headers.get('Origin')||'';
  const headers=cors(env,origin,'GET, POST, OPTIONS');
  if(origin!==env.KIARA_DASHBOARD_ORIGIN)return json({error:'Origem não autorizada'},403,headers);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(!['GET','POST'].includes(request.method))return json({error:'Método inválido'},405,headers);
  const bearer=request.headers.get('Authorization')||'';
  if(!/^Bearer [A-Za-z0-9._~-]{50,10000}$/.test(bearer))return json({error:'Sessão necessária'},401,headers);
  const {url:base,key,org}=requireConfig(env);
  if(!env.KIARA_CONTROLES?.get || !env.KIARA_CONTROLES?.put)
    return json({error:'KV de homologação indisponível'},503,headers);
  const sessionHeaders={apikey:key,Authorization:bearer};
  const userResponse=await fetch(base+'/auth/v1/user',{headers:sessionHeaders});
  if(!userResponse.ok)return json({error:'Sessão inválida'},401,headers);
  const user=await userResponse.json();
  if(!uuid.test(user?.id||''))return json({error:'Identidade inválida'},401,headers);
  const q=new URLSearchParams({select:'role',organization_id:'eq.'+org,user_id:'eq.'+user.id,active:'is.true',limit:'5'});
  const membership=await fetch(base+'/rest/v1/memberships?'+q,{headers:sessionHeaders});
  if(!membership.ok)return json({error:'Permissões indisponíveis'},503,headers);
  const rows=await membership.json();
  if(!Array.isArray(rows)||!rows.some(r=>r.role==='admin'||r.role==='comercial'))
    return json({error:'Sem permissão'},403,headers);
  const globalKey='staging:control:'+org+':enabled';
  if(request.method==='GET'){
    const saved=await env.KIARA_CONTROLES.get(globalKey);
    const conversationId=new URL(request.url).searchParams.get('conversationId');
    let simulatedStatus=null;
    if(conversationId!==null){
      if(!uuid.test(conversationId))return json({error:'Conversa inválida'},400,headers);
      const scoped=new URLSearchParams({select:'id',id:'eq.'+conversationId,
        organization_id:'eq.'+org,limit:'1'});
      const check=await fetch(base+'/rest/v1/kiara_conversations?'+scoped,{headers:sessionHeaders});
      if(!check.ok)return json({error:'Conversa não autorizada'},check.status===401||check.status===403?403:503,headers);
      const visible=await check.json();
      if(!Array.isArray(visible)||visible.length!==1)return json({error:'Conversa não encontrada'},404,headers);
      const raw=await env.KIARA_CONTROLES.get('staging:control:'+org+':conversation:'+conversationId);
      if(raw){
        try{
          const state=JSON.parse(raw);
          if(state?.state==='ai'||state?.state==='human')simulatedStatus=state.state;
        }catch{ return json({error:'Estado de teste inválido'},503,headers); }
      }
    }
    return json({enabled:saved==='true',simulatedStatus,
      environment:'homologacao_isolada',simulated:true,productionConnected:false,
      description:'Ações simuladas apenas no KV de homologação; não controlam o WhatsApp.'},200,headers);
  }
  let body;
  try{body=await request.json()}catch{return json({error:'JSON inválido'},400,headers)}
  const action=body?.action;
  if(!['pause_all','resume_all','assume','return_to_ai'].includes(action))
    return json({error:'Ação não permitida'},400,headers);
  if(['pause_all','resume_all'].includes(action)){
    if(!rows.some(r=>r.role==='admin'))return json({error:'Ação restrita ao administrador'},403,headers);
    await env.KIARA_CONTROLES.put(globalKey,action==='resume_all'?'true':'false');
    return json({ok:true,action,enabled:action==='resume_all',simulated:true,
      environment:'homologacao_isolada',productionConnected:false},200,headers);
  }
  const conversationId=body?.conversationId;
  if(!uuid.test(conversationId||''))return json({error:'Conversa inválida'},400,headers);
  // Existência e acesso conferidos sob a sessão do operador e RLS da organização.
  const convQuery=new URLSearchParams({select:'id',id:'eq.'+conversationId,
    organization_id:'eq.'+org,limit:'1'});
  const conv=await fetch(base+'/rest/v1/kiara_conversations?'+convQuery,{headers:sessionHeaders});
  if(!conv.ok)return json({error:'Conversa não autorizada'},conv.status===401||conv.status===403?403:503,headers);
  const allowed=await conv.json();
  if(!Array.isArray(allowed)||allowed.length!==1)
    return json({error:'Conversa indisponível'},404,headers);
  const state=action==='assume'?'human':'ai';
  await env.KIARA_CONTROLES.put('staging:control:'+org+':conversation:'+conversationId,
    JSON.stringify({state,updatedBy:user.id,updatedAt:new Date().toISOString()}),
    {expirationTtl:60*60*24*7});
  return json({ok:true,action,conversationId,status:state,simulated:true,
    environment:'homologacao_isolada',productionConnected:false},200,headers);
}

export default {
  async queue(batch,env={},ctx){
    if(!liveTestReady(env))throw new Error('Homologação real não habilitada ou incompleta');
    return kiara.queue(batch,env,ctx);
  },
  async fetch(request,env={},ctx){
    const url=new URL(request.url);
    if(request.method==='GET' && url.pathname==='/health')return json({
      service:'kiara-homologacao',status:'ok',worker_code:'integrado',
      external_integrations:liveTestReady(env)?'test_only':'blocked',
      supabase_read:'authenticated_only'
    });
    // Somente a rota com chave EasyCoexistence pode alcançar o handler real.
    // /webhook (Meta direto) permanece sempre bloqueado nesta homologação.
    if(liveTestReady(env) && (
      url.pathname==='/webhook/'+env.EASY_WEBHOOK_KEY ||
      ['/kiara/control','/kiara/coach','/kiara/human-message'].includes(url.pathname)
    )) {
      return kiara.fetch(request,env,ctx);
    }
    if(url.pathname==='/kiara/control'){
      try{return await stagingOperator(request,env)}
      catch(error){console.error('Staging control unavailable',String(error?.message||''));return json({error:'Controle de homologação indisponível'},503,cors(env,request.headers.get('Origin'),'GET, POST, OPTIONS'))}
    }
    if(url.pathname==='/kiara/capabilities'){
      const origin=request.headers.get('Origin')||'';
      const headers=cors(env,origin);
      if(origin!==env.KIARA_DASHBOARD_ORIGIN)return json({error:'Origem não autorizada'},403,headers);
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
      if(request.method!=='GET')return json({error:'Método não permitido'},405,headers);
      const authorization=request.headers.get('Authorization')||'';
      if(!/^Bearer [A-Za-z0-9._~-]{50,10000}$/.test(authorization))
        return json({error:'Sessão necessária'},401,headers);
      try{
        const {url:base,key,org}=requireConfig(env);
        const sessionHeaders={apikey:key,Authorization:authorization};
        const userResponse=await fetch(base+'/auth/v1/user',{headers:sessionHeaders});
        if(!userResponse.ok)return json({error:'Sessão inválida'},401,headers);
        const user=await userResponse.json();
        if(!uuid.test(user?.id||''))return json({error:'Identidade inválida'},401,headers);
        const q=new URLSearchParams({select:'role',organization_id:'eq.'+org,user_id:'eq.'+user.id,active:'is.true',limit:'5'});
        const membership=await fetch(base+'/rest/v1/memberships?'+q,{headers:sessionHeaders});
        if(!membership.ok)return json({error:'Permissões indisponíveis'},503,headers);
        const rows=await membership.json();
        if(!Array.isArray(rows)||!rows.some(row=>row.role==='admin'||row.role==='comercial'))
          return json({error:'Sem permissão'},403,headers);
        const readiness=stagingReadiness(env);
        const live=readiness.ready;
        return json({
          environment:'homologacao_isolada',
          readiness,
          transport:live?'whatsapp_test_only':'disabled',productionConnected:false,
          capabilities:{
            pricingSimulation:{enabled:true,label:'Simulação de preços interna'},
            conversationRead:{enabled:true,label:'Consulta de conversas'},
            conversationControl:{enabled:true,label:live?'Assumir, devolver e pausar em homologação':'Simular assumir, devolver e pausar',mode:live?'test_only':'sandbox',reason:live?'Limitado ao número autorizado de teste':'Grava apenas no KV exclusivo da homologação; não interfere no WhatsApp'},
            humanMessages:{enabled:live&&env.KIARA_HUMAN_SEND_ENABLED==='true',label:'Envio humano pelo painel',reason:live?'Limitado ao número autorizado de teste':'Credenciais e número de teste ainda não validados'},
            automaticReplies:{enabled:live,label:'Respostas automáticas no WhatsApp',reason:live?'Limitadas ao número autorizado de teste':'Canal Meta ainda bloqueado'},
            coachingWrite:{enabled:true,label:live?'Segurar e liberar resposta de homologação':'Simular segurar e liberar resposta',mode:live?'test_only':'sandbox',reason:live?'Limitado à conversa de teste':'Salvo apenas no KV exclusivo de homologação; não altera a fila real'}
          }
        },200,headers);
      }catch(error){
        console.error('Capabilities unavailable',String(error?.message||''));
        return json({error:'Diagnóstico indisponível'},503,headers);
      }
    }
    if(url.pathname==='/kiara/pricing/simulate'){
      try{return await priceSimulation(request,env)}
      catch(error){console.error('Staging simulation failed',String(error?.message||''));return json({error:'Simulação indisponível'},503,cors(env,request.headers.get('Origin'),'POST, OPTIONS'))}
    }
    if(url.pathname==='/kiara/coach' && ['GET','POST','OPTIONS'].includes(request.method)){
      try{return await stagingCoach(request,env,url)}
      catch(error){console.error('Staging read failed',error?.message);return json({error:'Controle de orientação indisponível'},503,cors(env,request.headers.get('Origin'),'GET, POST, OPTIONS'))}
    }
    return json({error:'Rota desativada na homologação isolada'},404);
  }
  // Sem handler de Queue, sem envio ao WhatsApp, sem mutações no Supabase.
};
