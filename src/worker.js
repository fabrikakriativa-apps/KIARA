/*
 * FÁBRIKA KRIATIVA — KIARA / WORKER INTEGRADO (VERSÃO DE TESTE)
 * Base: Worker enviado em 01/11/2026; preserva espera de 15 s e pausa do atendimento humano.
 *
 * Variáveis opcionais do Worker:
 *   KIARA_SYNC_ENABLED="false" (defina "true" SOMENTE após cadastrar secrets)
 *   KIARA_CONTROL_ENABLED="false" (NÃO ativar antes do teste completo de retomada)
 *   KIARA_SYNC_ALL_CONTACTS="false" (limita coleta ao TEST_ALLOWED_WA_ID)
 *   SUPABASE_URL="https://<projeto>.supabase.co"
 *   SUPABASE_ORGANIZATION_ID=<uuid da empresa>
 * Secret: SUPABASE_SERVICE_ROLE_KEY (NUNCA colocar em variável pública/frontend)
 *
 * KIARA_KNOWLEDGE_ENABLED="false" (apenas regras aprovadas em KV, sem latência de Supabase).\n * Sincronização não bloqueia atendimento enquanto CONTROL_ENABLED=false.
 * Quando CONTROL_ENABLED=true, indisponibilidade do banco impede envio.
 * ATENÇÃO: não habilitar os botões do CRM antes de implementar a retomada
 * segura da pausa local (KV) e validar o evento real smb_message_echoes.
 */


const GRAPH_VERSION = "v26.0";
const MODEL = "gpt-6-luna";
const MEMORY_TTL = 7 * 24 * 60 * 60;
const RESPONSE_DELAY_SECONDS = 15;
const MAX_CONTEXT_ITEMS = 20;
const INSTRUCTIONS = `
Você é a assistente digital da Fábrika Kriativa,
loja especializada em cortinas e persianas sob medida,
em São Caetano do Sul, SP.
IDENTIDADE
- Seja cordial, objetiva e natural.
- Atenda como uma consultora comercial experiente.
- Apresente-se como assistente digital.
- Não finja ser humana.
- Evite respostas longas e linguagem robótica.
- Faça uma pergunta por vez.
- Não use menus numerados.
- Não repita informações já fornecidas.
OBJETIVO
Entender a necessidade do cliente e coletar informações
para uma estimativa inicial de cortinas ou persianas.
INFORMAÇÕES RELEVANTES
- Produto desejado.
- Ambiente de instalação.
- Necessidade de decoração, privacidade ou bloqueio de luz.
- Preferência de tecido, quando houver.
- Largura e altura aproximadas.
- Fotos do ambiente, quando disponíveis.
CONDUTA
- Responda primeiro à pergunta do cliente.
- Se ele quiser preço, seja direta.
- Não exija fotos.
- Se não souber o tecido, oriente de maneira simples.
- Não transforme a conversa em questionário.
PREÇOS
A calculadora ainda não foi integrada.
Nunca invente preços ou estimativas.
Não apresente faixas de preço.
Explique que a equipe poderá preparar uma estimativa
quando houver informações suficientes.
ATENDIMENTO HUMANO
Quando o cliente desejar atendimento personalizado,
explique que poderá conversar com a equipe da loja.
Não afirme que alguém já assumiu a conversa.
ESCOPO
Atenda somente cortinas e persianas.
Não prometa descontos, prazos ou visitas.
Não solicite dados bancários ou documentos.
CONTROLE COMERCIAL — ESSENCIAL
- Considere TODA a conversa atual, não apenas a última mensagem.
- Mantenha mentalmente uma lista de itens separada por ambiente e produto.
- Um novo produto ou ambiente ACRESCENTA um item; nunca substitui os anteriores.
- Para cada item, diferencie produto, ambiente, objetivo, tecido/modelo,
  medidas informadas e informações ainda pendentes. Não invente dados.
- Se o cliente perguntar "o que será orçado?", "o que pedi?" ou pedir resumo,
  enumere TODOS os itens solicitados, inclusive os incompletos, e diga
  claramente qual informação ainda falta para cada um.
- Nunca aplique medidas, tecidos ou prioridades de um ambiente a outro.
- Não diga que todos os itens estão prontos se ainda faltam informações.
- Se já houver informações suficientes de um item, reconheça isso e
  explique que a equipe calculará a estimativa; não repita a mesma pergunta.
- Se houver mais de um item, pergunte apenas a pendência mais útil, uma por vez.
- Não invente preços nem prometa que a estimativa foi gerada ou enviada.
- Mantenha o tom natural de WhatsApp, sem apresentar listas longas sem necessidade.

Escreva em português brasileiro, com mensagens
curtas e apropriadas para WhatsApp.
`;
function digits(value) {
  return String(value || "").replace(/\D/g, "");
}
function routeBySource(source, env) {
  if (source === "original") {
    return {
      source: "original",
      phoneId: env.META_PHONE_NUMBER_ID,
      token: env.META_ACCESS_TOKEN,
      allowed: env.TEST_ALLOWED_WA_ID
    };
  }
  if (source === "easy") {
    return {
      source: "easy",
      phoneId: env.EASY_PHONE_NUMBER_ID,
      token: env.EASY_ACCESS_TOKEN,
      allowed: env.TEST_ALLOWED_WA_ID
    };
  }
  return null;
}
function routeFor(pathname, env) {
  if (pathname === "/webhook") {
    return routeBySource("original", env);
  }
  if (
    env.EASY_WEBHOOK_KEY &&
    pathname === `/webhook/${env.EASY_WEBHOOK_KEY}`
  ) {
    return routeBySource("easy", env);
  }
  return null;
}
async function verifySignature(request, secret, body) {
  const signature = request.headers.get(
    "x-hub-signature-256"
  );
  if (
    !secret ||
    !/^sha256=[a-f0-9]{64}$/i.test(signature || "")
  ) {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, body)
  );
  const actual = new Uint8Array(
    signature.slice(7)
      .match(/.{2}/g)
      .map(value => parseInt(value, 16))
  );
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected[i] ^ actual[i];
  }
  return diff === 0;
}

// ==== Kiara <-> SISTEMA: synchronization and controlled intervention ====
// Optional deployment flags default to OFF. Secrets never go to the browser.
const syncActive = env => env.KIARA_SYNC_ENABLED === 'true';
const controlActive = env => env.KIARA_CONTROL_ENABLED === 'true';

function checkSupabaseConfig(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_ORGANIZATION_ID)
    throw new Error('Kiara Supabase configuration missing');
}
async function dbRequest(env, table, method, query = '', data) {
  checkSupabaseConfig(env);
  const base = String(env.SUPABASE_URL).replace(/\/$/, '');
  const response = await fetch(`${base}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'resolution=ignore-duplicates,return=minimal' : 'return=minimal'
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) })
  });
  if (!response.ok) {
    console.error('Kiara database', table, method, response.status);
    throw new Error(`Kiara database request failed (${response.status})`);
  }
  return method === 'GET' ? response.json() : null;
}
const queryEq = (key, value) => `&${key}=eq.${encodeURIComponent(String(value))}`;
function toIso(timestamp) {
  const seconds = Number(timestamp);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString() : new Date().toISOString();
}
async function upsertConversation(env, source, phoneId, sender, options = {}) {
  const org = String(env.SUPABASE_ORGANIZATION_ID);
  const waId = digits(sender);
  if (!waId || !phoneId) throw new Error('Invalid WhatsApp identifiers');
  const stamp = options.timestamp || new Date().toISOString();
  await dbRequest(env, 'kiara_conversations', 'POST', '?on_conflict=organization_id,source,phone_number_id,contact_wa_id', {
    organization_id: org, source, phone_number_id: String(phoneId),
    contact_wa_id: waId, contact_phone: waId,
    contact_name: options.name || null,
    origin: options.referral?.source_type || null,
    ad_id: options.referral?.source_id || null,
    initial_referral: options.referral || null,
    first_message_at: stamp, last_interaction_at: stamp
  });
  const found = await dbRequest(env, 'kiara_conversations', 'GET',
    '?select=id,status,contact_name,initial_referral' + queryEq('organization_id', org) +
    queryEq('source', source) + queryEq('phone_number_id', phoneId) + queryEq('contact_wa_id', waId) + '&limit=1');
  if (!found?.length) throw new Error('Conversation not found');
  const patch = {
    last_interaction_at: stamp,
    ...(options.name && !found[0].contact_name ? { contact_name: options.name } : {})
  };
  await dbRequest(env, 'kiara_conversations', 'PATCH',
    '?id=eq.' + encodeURIComponent(found[0].id) + queryEq('organization_id', org), patch);
  return found[0];
}
async function saveMessage(env, conversationId, messageId, direction, sender, text, timestamp, type = 'text') {
  if (!messageId) return;
  await dbRequest(env, 'kiara_messages', 'POST', '?on_conflict=organization_id,whatsapp_message_id', {
    organization_id: String(env.SUPABASE_ORGANIZATION_ID), conversation_id: conversationId,
    whatsapp_message_id: String(messageId), direction, sender,
    message_type: type, text_body: text || null, occurred_at: timestamp
  });
}
async function syncInbound(env, route, value, message) {
  if (!syncActive(env)) return;
  const customer = digits(message.from);
  if (env.KIARA_SYNC_ALL_CONTACTS !== 'true' && customer !== digits(route.allowed)) return;
  const name = (value.contacts || []).find(c => digits(c.wa_id) === customer)?.profile?.name || null;
  const timestamp = toIso(message.timestamp);
  const row = await upsertConversation(env, route.source, route.phoneId, customer, {
    timestamp, name, referral: message.referral || null
  });
  await saveMessage(env, row.id, message.id, 'incoming', 'customer',
    message.type === 'text' ? message.text?.body : null, timestamp, message.type);
}
async function syncHumanEcho(env, route, echo) {
  if (!syncActive(env)) return;
  const recipient = digits(echo.to || echo.recipient_id);
  if (!recipient || !echo.id) return;
  if (env.KIARA_SYNC_ALL_CONTACTS !== 'true' && recipient !== digits(route.allowed)) return;
  const timestamp = toIso(echo.timestamp);
  const row = await upsertConversation(env, route.source, route.phoneId, recipient, { timestamp });
  await dbRequest(env, 'kiara_conversations', 'PATCH',
    '?id=eq.' + encodeURIComponent(row.id) + queryEq('organization_id', env.SUPABASE_ORGANIZATION_ID), {
      status: 'human', last_business_message_at: timestamp, updated_at: new Date().toISOString()
    });
  // Só considera observação quando a intervenção humana sucede
  // imediatamente uma resposta da Kiara. Não gera regra automática.
  let previous = null;
  if (echo.type === 'text' && String(echo.text?.body||'').trim()) {
    const recent=await dbRequest(env,'kiara_messages','GET',
      '?select=sender,text_body,occurred_at'+queryEq('organization_id',env.SUPABASE_ORGANIZATION_ID)+
      queryEq('conversation_id',row.id)+'&direction=eq.outgoing&order=occurred_at.desc&limit=1');
    previous=recent?.[0]||null;
  }
  await saveMessage(env, row.id, echo.id, 'outgoing', 'human',
    echo.type === 'text' ? echo.text?.body : null, timestamp, echo.type);
  const elapsed=Date.parse(timestamp)-Date.parse(previous?.occurred_at||'');
  if(previous?.sender==='kiara' && Number.isFinite(elapsed) && elapsed>=0 && elapsed<=7200000) {
    await dbRequest(env,'kiara_learning_observations','POST',
      '?on_conflict=organization_id,source_message_id',{
        organization_id:String(env.SUPABASE_ORGANIZATION_ID),
        conversation_id:row.id,source_message_id:String(echo.id),
        human_text:String(echo.text?.body||'').slice(0,2000),
        previous_ai_text:String(previous.text_body||'').slice(0,2000),
        status:'pending'
      });
  }
}
async function syncKiaraReply(env, route, recipient, messageId, text) {
  if (!syncActive(env) || !messageId) return;
  const timestamp = new Date().toISOString();
  const row = await upsertConversation(env, route.source, route.phoneId, recipient, { timestamp });
  await saveMessage(env, row.id, messageId, 'outgoing', 'kiara', text, timestamp);
}
// Read the hold flag on every job; any backend error blocks sending.
async function readHold(env, route, recipient) {
  if (env.KIARA_HOLD_ENABLED !== 'true') return false;
  if (!syncActive(env)) throw new Error('Hold requires Kiara sync');
  const rows = await dbRequest(env, 'kiara_conversations', 'GET',
    '?select=reply_held' + queryEq('organization_id', env.SUPABASE_ORGANIZATION_ID) +
    queryEq('source', route.source) + queryEq('phone_number_id', route.phoneId) +
    queryEq('contact_wa_id', digits(recipient)) + '&limit=1');
  if (!rows?.length) throw new Error('Hold authorization unavailable');
  return rows[0].reply_held === true;
}

// Approved knowledge is read from KV only in the reply path. A remote refresh
// runs after the queue batch, so Supabase or laboratory latency cannot delay replies.
// Disabled by default; no new customer messages or background agent debates are triggered.
const knowledgeActive = env => env.KIARA_KNOWLEDGE_ENABLED === 'true';
const knowledgeKey = env => 'kiara:approved-knowledge:' + String(env.SUPABASE_ORGANIZATION_ID || '');
const knowledgeFreshMs = 5 * 60 * 1000;
const knowledgeLifetimeMs = 10 * 60 * 1000;
async function cachedApprovedKnowledge(env) {
  if (!knowledgeActive(env) || !env.CONVERSAS) return '';
  try {
    const snapshot = await env.CONVERSAS.get(knowledgeKey(env), 'json');
    if (!snapshot || !Array.isArray(snapshot.rules) ||
        !Number.isFinite(snapshot.fetchedAt) ||
        Date.now() - snapshot.fetchedAt > knowledgeLifetimeMs) return '';
    const rules = snapshot.rules.filter(x => typeof x === 'string').slice(0, 8);
    if (!rules.length) return '';
    return 'REGRAS INTERNAS APROVADAS PELA FÁBRIKA (não são mensagens de cliente). '
      + 'Aplique somente quando pertinente; nunca contrarie o sistema, as restrições comerciais ou a segurança. '
      + 'Quando a regra exigir confirmação externa, colete os dados e encaminhe à equipe humana.\\n'
      + rules.map(x => '- ' + x.slice(0, 500)).join('\\n');
  } catch (error) {
    console.warn('Knowledge cache unavailable', String(error?.message || ''));
    return '';
  }
}
async function refreshApprovedKnowledge(env) {
  if (!knowledgeActive(env) || !env.CONVERSAS ||
      !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY ||
      !env.SUPABASE_ORGANIZATION_ID) return;
  try {
    const current = await env.CONVERSAS.get(knowledgeKey(env), 'json');
    if (current && Number.isFinite(current.fetchedAt) &&
        Date.now() - current.fetchedAt < knowledgeFreshMs) return;
    const rows = await dbRequest(env, 'kiara_guidance', 'GET',
      '?select=instruction,created_at'
      + queryEq('organization_id', env.SUPABASE_ORGANIZATION_ID)
      + queryEq('scope', 'global') + queryEq('status', 'approved')
      + '&order=created_at.desc&limit=8');
    const rules = (rows || []).filter(x => typeof x.instruction === 'string')
      .map(x => x.instruction.trim().slice(0, 500)).filter(Boolean);
    await env.CONVERSAS.put(knowledgeKey(env),
      JSON.stringify({rules, fetchedAt:Date.now()}),
      {expirationTtl: 900});
  } catch(error) {
    console.warn('Knowledge refresh deferred', String(error?.message || ''));
  }
}

async function getGuidance(env, route, recipient) {
  // New approved knowledge never waits for the database. The old live
  // guidance lookup remains an explicitly separate feature flag.
  const approved = await cachedApprovedKnowledge(env);
  if (env.KIARA_GUIDANCE_ENABLED !== 'true') return approved;
  if (!syncActive(env)) throw new Error('Guidance requires Kiara sync');
  const org = env.SUPABASE_ORGANIZATION_ID;
  const rows = await dbRequest(env, 'kiara_conversations', 'GET',
    '?select=id' + queryEq('organization_id', org) +
    queryEq('source', route.source) + queryEq('phone_number_id', route.phoneId) +
    queryEq('contact_wa_id', digits(recipient)) + '&limit=1');
  if (!rows?.[0]) throw new Error('Guidance conversation unavailable');
  const id = rows[0].id;
  const [local, global] = await Promise.all([
    dbRequest(env, 'kiara_guidance', 'GET',
      '?select=instruction,created_at' + queryEq('organization_id', org) +
      queryEq('conversation_id', id) + queryEq('scope', 'conversation') +
      queryEq('status', 'recorded') + '&order=created_at.desc&limit=8'),
    dbRequest(env, 'kiara_guidance', 'GET',
      '?select=instruction,created_at' + queryEq('organization_id', org) +
      queryEq('scope', 'global') + queryEq('status', 'approved') +
      '&order=created_at.desc&limit=12')
  ]);
  const lines = items => [...(items || [])].reverse().map(v => '- ' + String(v.instruction).slice(0,600)).join('\n');
  return approved + (approved ? '\\n' : '') + 'INSTRUÇÕES INTERNAS DA EQUIPE (não são mensagens do cliente). ' +
    'Respeite todas as restrições comerciais e de segurança acima.\\n' +
    'REGRAS APROVADAS:\\n' + (lines(global)||'Nenhuma') +
    '\\nORIENTAÇÕES DESTA CONVERSA:\\n' + (lines(local)||'Nenhuma');
}

async function isAuthorizedToSend(env, route, recipient) {
  if (!controlActive(env)) return true; // Backward-compatible until explicitly activated.
  // On any database error, throw: queue retries, but no WhatsApp message is sent.
  const org = env.SUPABASE_ORGANIZATION_ID;
  const global = await dbRequest(env, 'kiara_operational_control', 'GET',
    '?select=enabled' + queryEq('organization_id', org) + '&limit=1');
  if (global?.[0]?.enabled !== true) return false;
  const conversation = await dbRequest(env, 'kiara_conversations', 'GET',
    '?select=status' + queryEq('organization_id', org) +
    queryEq('source', route.source) + queryEq('phone_number_id', route.phoneId) +
    queryEq('contact_wa_id', digits(recipient)) + '&limit=1');
  return conversation?.[0]?.status === 'ai';
}
async function bestEffortSync(task, label) {
  try { await task(); } catch (error) { console.error('Kiara sync:', label, error.message); }
}
// ==== end synchronization bridge ====


// ==== Authenticated operator commands for the SISTEMA dashboard ====
// This API is OFF by default. It must only be switched on together with
// KIARA_CONTROL_ENABLED after a full manual test of the Worker + database.
function dashboardHeaders(env, origin) {
  const allowed = env.KIARA_DASHBOARD_ORIGIN;
  return origin && allowed && origin === allowed ? {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
    'Cache-Control': 'no-store'
  } : { 'Cache-Control': 'no-store' };
}
async function operatorRequest(request, env) {
  const origin = request.headers.get('Origin') || '';
  const headers = dashboardHeaders(env, origin);
  const respond = (payload, status=200) => Response.json(payload, { status, headers });
  if (!env.KIARA_DASHBOARD_ORIGIN || origin !== env.KIARA_DASHBOARD_ORIGIN) {
    return respond({error:'Origin not allowed'},403);
  }
  if (request.method === 'OPTIONS') return new Response(null, {status:204,headers});
  if (!['GET','POST'].includes(request.method)) return respond({error:'Method not allowed'},405);
  if (!controlActive(env) || !syncActive(env)) return respond({error:'Operator controls not enabled'},503);
  checkSupabaseConfig(env);
  const authorization = request.headers.get('Authorization') || '';
  if (!/^Bearer [A-Za-z0-9._~-]{50,10000}$/.test(authorization)) return respond({error:'Authentication required'},401);
  // Only a valid Supabase user session can reach the privileged RPC.
  const supabaseUrl=String(env.SUPABASE_URL).replace(/\/$/,'');
  const session=await fetch(supabaseUrl+'/auth/v1/user',{
    headers:{Authorization:authorization,apikey:env.SUPABASE_SERVICE_ROLE_KEY},
  });
  if (!session.ok) return respond({error:'Invalid session'},401);
  if (request.method === 'GET') {
    // Authenticated user + organization RLS; permissions are enforced by DB.
    const result=await fetch(supabaseUrl+'/rest/v1/kiara_operational_control?select=enabled&organization_id=eq.'+encodeURIComponent(env.SUPABASE_ORGANIZATION_ID),{
      headers:{Authorization:authorization,apikey:env.SUPABASE_SERVICE_ROLE_KEY}
    });
    if(!result.ok) return respond({error:'Unable to read status'},503);
    const rows=await result.json();
    return respond({enabled:rows?.[0]?.enabled===true});
  }
  let payload;
  try {payload=await request.json();} catch {return respond({error:'Invalid JSON'},400)}
  const action=payload?.action;
  const valid=['pause_all','resume_all','assume','return_to_ai'];
  if (!valid.includes(action)) return respond({error:'Invalid action'},400);
  const id=typeof payload?.conversationId==='string'?payload.conversationId:null;
  if ((action==='assume'||action==='return_to_ai') && !/^[a-f0-9-]{36}$/i.test(id||'')) return respond({error:'Conversation required'},400);
  if ((action==='pause_all'||action==='resume_all') && id) return respond({error:'Unexpected conversation'},400);
  // The RPC validates organization membership, role, and conversation ID.
  const rpc=await fetch(supabaseUrl+'/rest/v1/rpc/kiara_operator_action',{
    method:'POST',headers:{Authorization:authorization,apikey:env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({org_id:env.SUPABASE_ORGANIZATION_ID,action_name:action,target_conversation_id:id})
  });
  if(!rpc.ok) return respond({error:rpc.status===403?'Forbidden':'Action not completed'},rpc.status===403?403:409);
  const result=await rpc.json();
  if (id) {
    // RLS has already authorized this conversation via the RPC. The same
    // scoped ID is used only to locate its legacy Cloudflare KV pause key.
    const scoped=await dbRequest(env,'kiara_conversations','GET','?select=source,contact_wa_id,phone_number_id'+queryEq('organization_id',env.SUPABASE_ORGANIZATION_ID)+queryEq('id',id)+'&limit=1');
    if(!scoped?.[0]) return respond({error:'Conversation state unavailable'},503);
    const key=keys(scoped[0].source,scoped[0].contact_wa_id).paused;
    if(action==='assume') await env.CONVERSAS.put(key,'1',{expirationTtl:MEMORY_TTL});
    if(action==='return_to_ai') await env.CONVERSAS.delete(key);
  }
  return respond({ok:true,action:result.action});
}
// Coaching is independently gated. A hold does NOT assume the human conversation.
async function coachingRequest(request, env) {
  const origin = request.headers.get('Origin') || '';
  const headers = dashboardHeaders(env, origin);
  const reply = (data, status=200) => Response.json(data,{status,headers});
  if (!env.KIARA_DASHBOARD_ORIGIN || origin !== env.KIARA_DASHBOARD_ORIGIN)
    return reply({error:'Origin not allowed'},403);
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (env.KIARA_HOLD_ENABLED !== 'true' || !syncActive(env)) return reply({error:'Coaching not enabled'},503);
  if (!['GET','POST'].includes(request.method)) return reply({error:'Method not allowed'},405);
  checkSupabaseConfig(env);
  const token = request.headers.get('Authorization') || '';
  if (!/^Bearer [A-Za-z0-9._~-]{50,10000}$/.test(token)) return reply({error:'Authentication required'},401);
  const base=String(env.SUPABASE_URL).replace(/\/$/,'');
  const session=await fetch(base+'/auth/v1/user',{
    headers:{Authorization:token,apikey:env.SUPABASE_SERVICE_ROLE_KEY}});
  if(!session.ok) return reply({error:'Invalid session'},401);
  const payload=request.method==='POST'?await request.json():null;
  const conversationId=request.method==='GET'?new URL(request.url).searchParams.get('conversationId'):payload?.conversationId;
  if(!/^[a-f0-9-]{36}$/i.test(conversationId||'')) return reply({error:'Invalid conversation'},400);
  // RLS checks this user's organization and sales role on reads.
  if(request.method==='GET'){
    const read=await fetch(base+'/rest/v1/kiara_conversations?select=reply_held&'+
      queryEq('organization_id',env.SUPABASE_ORGANIZATION_ID).slice(1)+'&'+queryEq('id',conversationId).slice(1),{
       headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:token}
    });
    if(!read.ok) return reply({error:'Not authorized'},403);
    const rows=await read.json();
    if(!rows.length) return reply({error:'Not found or forbidden'},404);
    return reply({held:rows[0].reply_held===true});
  }
  if(!['hold','release'].includes(payload?.action)) return reply({error:'Invalid action'},400);
  const rpc=await fetch(base+'/rest/v1/rpc/kiara_set_reply_hold',{
    method:'POST',headers:{Authorization:token,apikey:env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({org_id:env.SUPABASE_ORGANIZATION_ID,target_conversation_id:conversationId,new_hold:payload.action==='hold'})
  });
  if(!rpc.ok) return reply({error:'Hold command rejected'},rpc.status===403?403:409);
  const result=await rpc.json();
  if(payload.action==='release' && result.status==='ai' && result.changed===true) {
    // Schedule fresh generation from the LAST unanswered customer batch;
    // previously held queue jobs were acknowledged, not retried forever.
    const records=await dbRequest(env,'kiara_conversations','GET',
      '?select=source,phone_number_id,contact_wa_id'+queryEq('organization_id',env.SUPABASE_ORGANIZATION_ID)+queryEq('id',conversationId)+'&limit=1');
    const c=records?.[0];
    if(!c) return reply({error:'Conversation not found after release'},503);
    const route=routeBySource(c.source,env);
    if(!route || String(route.phoneId)!==String(c.phone_number_id)) return reply({error:'Incorrect phone mapping'},503);
    const batch=await pendingCustomerBatch(env,route,c.contact_wa_id);
    if(batch) {
      await env.KIARA_QUEUE.send({source:c.source,sender:c.contact_wa_id,messageId:batch.latestId,input:batch.text.slice(0,2000)},{delaySeconds:0});
    }
  }
  return reply({ok:true,held:result.held,action:payload.action});
}

// ==== end operator API ====

async function sendMessage(route, to, message) {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${route.phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${route.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: {
          preview_url: false,
          body: message.slice(0, 3500)
        }
      })
    }
  );
  if (!response.ok) {
    console.error(
      "Falha WhatsApp",
      route.source,
      response.status
    );
    throw new Error("Falha ao enviar WhatsApp");
  }
  const result = await response.json();
  return result.messages?.[0]?.id || null;
}
async function generateReply(env, history, extraInstructions = '') {
  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        instructions: INSTRUCTIONS + (extraInstructions ? "\n\n" + extraInstructions : ""),
        input: history,
        max_output_tokens: 350,
        reasoning: { effort: "none" },
        store: false
      })
    }
  );
  if (!response.ok) {
    console.error("Falha OpenAI", response.status);
    throw new Error("Falha ao gerar resposta");
  }
  const data = await response.json();
  const answer = (data.output || [])
    .flatMap(item => item.content || [])
    .filter(item => item.type === "output_text")
    .map(item => item.text)
    .join("\n")
    .trim();
  if (!answer) {
    throw new Error("A IA retornou resposta vazia");
  }
  return answer;
}
function keys(source, sender) {
  const prefix = `${source}:${sender}`;
  return {
    history: `${prefix}:history`,
    paused: `${prefix}:human`,
    latest: `${prefix}:latest`
  };
}
async function handleHumanEcho(env, route, value) {
  const echoes = [
    ...(value.message_echoes || []),
    ...(value.messages || [])
  ];
  for (const echo of echoes) {
    const recipient = digits(echo.to);
    if (!recipient) continue;
    // Espelha todos os ecos quando KIARA_SYNC_ALL_CONTACTS=true, mas mantém
    // intervenção e pausa limitadas ao contato autorizado da homologação.
    await bestEffortSync(() => syncHumanEcho(env, route, echo), 'human echo');
    if (recipient !== digits(route.allowed)) continue;
    const conversation = keys(
      route.source,
      recipient
    );
    await env.CONVERSAS.put(
      conversation.paused,
      "1",
      { expirationTtl: MEMORY_TTL }
    );
    console.log(
      "Atendimento humano ativado",
      route.source
    );
  }
}
async function receiveMessage(env, route, message, value) {
  await bestEffortSync(() => syncInbound(env, route, value, message), "incoming");
  if (
    message.type !== "text" ||
    !message.id
  ) {
    return;
  }
  const sender = digits(message.from);
  const allowed = digits(route.allowed);
  if (!allowed || sender !== allowed) {
    return;
  }
  const input = message.text?.body?.trim();
  if (!input) {
    return;
  }
  const receivedKey =
    `${route.source}:received:${message.id}`;
  // Deduplicação inicial de eventos.
  if (await env.CONVERSAS.get(receivedKey)) {
    return;
  }
  const conversation = keys(route.source, sender);
  // Cada mensagem nova substitui a pendência anterior.
  // Assim evitamos várias respostas em sequência
  // quando o cliente escreve mensagens separadas.
  await env.KIARA_QUEUE.send(
    {
      source: route.source,
      sender,
      messageId: message.id,
      input: input.slice(0, 2000)
    },
    {
      delaySeconds:
        /^\/?reiniciar teste$/i.test(input.trim())
          ? 0
          : RESPONSE_DELAY_SECONDS
    }
  );
  await env.CONVERSAS.put(
    conversation.latest,
    message.id,
    { expirationTtl: MEMORY_TTL }
  );
  await env.CONVERSAS.put(
    receivedKey,
    "1",
    { expirationTtl: MEMORY_TTL }
  );
  console.log(
    "Mensagem agendada na fila",
    route.source
  );
}
// Fonte de verdade para agrupar mensagens: histórico já sincronizado no Supabase.
// Consulta somente a conversa do número de teste e as últimas 100 mensagens.
async function pendingCustomerBatch(env, route, sender) {
  if (!syncActive(env)) return null;
  const org = env.SUPABASE_ORGANIZATION_ID;
  const records = await dbRequest(env, 'kiara_conversations', 'GET',
    '?select=id' + queryEq('organization_id', org) +
    queryEq('source', route.source) + queryEq('phone_number_id', route.phoneId) +
    queryEq('contact_wa_id', digits(sender)) + '&limit=1');
  const id = records?.[0]?.id;
  if (!id) throw new Error('Conversa ainda não sincronizada');
  const rows = await dbRequest(env, 'kiara_messages', 'GET',
    '?select=whatsapp_message_id,direction,sender,text_body,occurred_at' +
    queryEq('organization_id', org) + queryEq('conversation_id', id) +
    '&order=occurred_at.desc,created_at.desc&limit=100');
  const pending = [];
  for (const msg of rows || []) {
    if (msg.direction === 'outgoing') break;
    if (msg.direction === 'incoming' && msg.text_body?.trim()) pending.push(msg);
  }
  pending.reverse();
  const newest = pending[pending.length - 1];
  return newest ? {
    latestId: newest.whatsapp_message_id,
    latestAt: Date.parse(newest.occurred_at),
    text: pending.map(m => m.text_body.trim()).join('\n')
  } : null;
}

// Contexto real da conversa, desde o último reinício de teste visível.
// Uma resposta deve conhecer TODOS os itens pedidos no atendimento atual.
// O Supabase é a fonte de contexto; o KV continua responsável pela fila.
async function loadCommercialHistory(env, route, sender, requiredMessageId) {
  const org = env.SUPABASE_ORGANIZATION_ID;
  const conversations = await dbRequest(env, 'kiara_conversations', 'GET',
    '?select=id' + queryEq('organization_id', org) +
    queryEq('source', route.source) + queryEq('phone_number_id', route.phoneId) +
    queryEq('contact_wa_id', digits(sender)) + '&limit=1');
  const conversationId = conversations?.[0]?.id;
  if (!conversationId) throw new Error('Histórico comercial indisponível');

  const messages = await dbRequest(env, 'kiara_messages', 'GET',
    '?select=whatsapp_message_id,direction,sender,text_body,occurred_at,created_at' +
    queryEq('organization_id', org) + queryEq('conversation_id', conversationId) +
    '&order=occurred_at.desc,created_at.desc&limit=100');

  const chronological = [...(messages || [])].reverse();
  if (!chronological.some(m => m.whatsapp_message_id === requiredMessageId)) {
    throw new Error('Mensagem atual ainda não consta no histórico comercial');
  }

  // '/reiniciar teste' zera o atendimento conversacional, mas não apaga
  // registros comerciais já armazenados. Mantemos esse limite explícito.
  let resetIndex = -1;
  for (let i = 0; i < chronological.length; i++) {
    if (chronological[i].direction === 'incoming' &&
      /^\/?reiniciar teste$/i.test(String(chronological[i].text_body || '').trim())) {
      resetIndex = i;
    }
  }
  const sessionMessages = chronological.slice(resetIndex + 1)
    .filter(m => m.text_body && m.text_body.trim());

  return sessionMessages.map(m => ({
    role: m.direction === 'incoming' ? 'user' : 'assistant',
    content: m.sender === 'human'
      ? '[Equipe humana] ' + m.text_body
      : m.text_body
  }));
}

async function consumeMessage(env, job) {
  const route = routeBySource(job.source, env);
  if (!route) return;
  const sender = digits(job.sender);
  if (!sender || sender !== digits(route.allowed)) return;

  const conversation = keys(route.source, sender);
  const isReset = /^\/?reiniciar teste$/i.test(String(job.input || '').trim());

  // Antes do agrupamento, respeita a intervenção humana e os controles gerais.
  if (!(await isAuthorizedToSend(env, route, sender))) {
    console.log('Envio bloqueado por controle operacional');
    return;
  }
  if (!isReset && await env.CONVERSAS.get(conversation.paused)) {
    console.log('Resposta cancelada: atendimento humano');
    return;
  }

  if (await readHold(env, route, sender)) {
    console.log('Envio suspenso: aguardando orientação humana');
    return;
  }

  // Em modo sincronizado, consulta as mensagens persistidas, não apenas o KV
  // eventualmente consistente. Isso impede perder a resposta por desencontro
  // do identificador latest após webhooks próximos.
  const batch = !isReset && syncActive(env)
    ? await pendingCustomerBatch(env, route, sender)
    : null;
  if (!isReset && syncActive(env) && !batch) {
    console.log('Nenhuma mensagem nova pendente');
    return;
  }
  if (batch && batch.latestId !== job.messageId) {
    console.log('Mensagem anterior agrupada; a mais recente será processada');
    return;
  }

  // Quando não existe sincronização, conserva o mecanismo anterior do KV.
  if (!isReset && !syncActive(env)) {
    const latest = await env.CONVERSAS.get(conversation.latest);
    if (latest !== job.messageId) {
      console.log('Mensagem substituida por outra');
      return;
    }
  }

  const targetId = batch?.latestId || job.messageId;
  const completedKey = `${route.source}:sent:${targetId}`;
  if (await env.CONVERSAS.get(completedKey)) return;

  if (isReset) {
    await env.CONVERSAS.delete(conversation.history);
    await env.CONVERSAS.delete(conversation.paused);
    if (!(await isAuthorizedToSend(env, route, sender))) return;
    const text = 'Conversa reiniciada! 😊 Como posso ajudar?';
    const sentId = await sendMessage(route, sender, text);
    await bestEffortSync(() => syncKiaraReply(env, route, sender, sentId, text), 'reset reply');
    await env.CONVERSAS.put(completedKey, '1', {expirationTtl: MEMORY_TTL});
    return;
  }

  const history = (await env.CONVERSAS.get(conversation.history, 'json')) || [];
  const inputText = batch?.text || job.input;
  const nextHistory = syncActive(env)
    ? await loadCommercialHistory(env, route, sender, targetId)
    : [
        ...history.slice(-MAX_CONTEXT_ITEMS),
        { role: 'user', content: inputText }
      ];
  const guidance = await getGuidance(env, route, sender);
  const answer = await generateReply(env, nextHistory, guidance);

  // Verificação final: se chegou outra mensagem durante a geração,
  // esta resposta antiga não deve ser enviada.
  if (await readHold(env, route, sender)) {
    console.log('Envio suspenso antes do WhatsApp');
    return;
  }
  if (await env.CONVERSAS.get(conversation.paused)) {
    console.log('Envio cancelado: humano assumiu');
    return;
  }
  if (syncActive(env)) {
    const latestBatch = await pendingCustomerBatch(env, route, sender);
    if (!latestBatch || latestBatch.latestId !== targetId) {
      console.log('Nova mensagem durante a geração; tarefa mais recente assumirá');
      return;
    }
  } else {
    const latest = await env.CONVERSAS.get(conversation.latest);
    if (latest !== job.messageId) {
      console.log('Envio cancelado: mensagem mais recente');
      return;
    }
  }
  if (!(await isAuthorizedToSend(env, route, sender))) {
    console.log('Resposta cancelada: controle operacional');
    return;
  }
  if (await env.CONVERSAS.get(completedKey)) return;
  if (await readHold(env, route, sender)) return;

  const sentId = await sendMessage(route, sender, answer);
  await bestEffortSync(() => syncKiaraReply(env, route, sender, sentId, answer), 'kiara reply');
  nextHistory.push({role:'assistant',content:answer});
  await env.CONVERSAS.put(conversation.history,
    JSON.stringify(nextHistory.slice(-MAX_CONTEXT_ITEMS)),
    {expirationTtl: MEMORY_TTL});
  await env.CONVERSAS.put(completedKey, '1', {expirationTtl: MEMORY_TTL});
  console.log('Resposta da Kiara enviada pela fila',route.source);
}
export default {
  async queue(batch, env, ctx) {
    for (const message of batch.messages) {
      try {
        await consumeMessage(
          env,
          message.body
        );
        message.ack();
      } catch (error) {
        console.error(
          "Erro na fila Kiara",
          error.message
        );
        message.retry({
          delaySeconds: 10
        });
      }
    }
    // Runs after processing, not in the customer's reply critical path.
    if (knowledgeActive(env) && ctx?.waitUntil) {
      ctx.waitUntil(refreshApprovedKnowledge(env));
    }
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/kiara/coach') {
      try { return await coachingRequest(request,env); }
      catch (error) { console.error('Kiara coaching failed',error.message); return Response.json({error:'Coaching unavailable'},{status:503}); }
    }
    if (url.pathname === '/kiara/control') {
      try { return await operatorRequest(request,env); }
      catch (error) { console.error('Kiara control endpoint failed',error.message); return Response.json({error:'Operator unavailable'},{status:503}); }
    }
    if (
      url.pathname === "/" &&
      request.method === "GET"
    ) {
      return Response.json({
        projeto: "Fabrika Kriativa Atendimento IA",
        status: "online",
        modo: "fila com espera de 15 segundos"
      });
    }
    const route = routeFor(url.pathname, env);
    if (!route) {
      return new Response(
        "Not found",
        { status: 404 }
      );
    }
    if (request.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get(
        "hub.verify_token"
      );
      const challenge = url.searchParams.get(
        "hub.challenge"
      );
      if (
        env.META_VERIFY_TOKEN &&
        mode === "subscribe" &&
        token === env.META_VERIFY_TOKEN &&
        challenge !== null
      ) {
        return new Response(
          challenge,
          { status: 200 }
        );
      }
      return new Response(
        "Unauthorized",
        { status: 403 }
      );
    }
    if (request.method !== "POST") {
      return new Response(
        "Method not allowed",
        { status: 405 }
      );
    }
    const body = await request.arrayBuffer();
    // Mantém a validação da integração original.
    if (route.source === "original") {
      const valid = await verifySignature(
        request,
        env.META_APP_SECRET,
        body
      );
      if (!valid) {
        return new Response(
          "Unauthorized",
          { status: 401 }
        );
      }
    }
    // EasyCoexistence usa a chave exclusiva na URL.
    // O segredo do app Meta do fornecedor não é
    // disponibilizado para validação HMAC.
    if (
      !route.token ||
      !route.phoneId ||
      !digits(route.allowed) ||
      !env.OPENAI_API_KEY ||
      !env.CONVERSAS ||
      !env.KIARA_QUEUE
    ) {
      console.error(
        "Configuracao incompleta",
        route.source
      );
      return new Response(
        "Not configured",
        { status: 503 }
      );
    }
    if ((syncActive(env) || controlActive(env)) &&
      (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_ORGANIZATION_ID)) {
      console.error('Supabase server configuration missing');
      return new Response('Not configured', { status: 503 });
    }

    let event;
    try {
      event = JSON.parse(
        new TextDecoder().decode(body)
      );
    } catch {
      return new Response(
        "Invalid JSON",
        { status: 400 }
      );
    }
    if (
      event.object !== "whatsapp_business_account"
    ) {
      return new Response(
        "EVENT_RECEIVED",
        { status: 200 }
      );
    }
    try {
      for (const entry of event.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value || {};
          if (
            String(value.metadata?.phone_number_id) !==
            String(route.phoneId)
          ) {
            continue;
          }
          if (
            change.field === "smb_message_echoes" &&
            route.source === "easy"
          ) {
            await handleHumanEcho(
              env,
              route,
              value
            );
            continue;
          }
          if (change.field !== "messages") {
            continue;
          }
          for (const message of value.messages || []) {
            await receiveMessage(
              env,
              route,
              message,
              value
            );
          }
        }
      }
    } catch (error) {
      console.error(
        "Erro no webhook",
        error.message
      );
      return new Response(
        "Processing failed",
        { status: 500 }
      );
    }
    return new Response(
      "EVENT_RECEIVED",
      { status: 200 }
    );
  }
};