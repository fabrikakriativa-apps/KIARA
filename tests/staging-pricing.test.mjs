import test from 'node:test';
import assert from 'node:assert/strict';
import staging from '../staging/worker.js';

const origin='https://kiara-painel-homologacao.pages.dev';
const uuid='0e398095-cc22-421b-ae34-7bf0df8ad7b2';
const userId='ed76d5b6-1e10-4b84-bf31-b9290d1a5465';
const token='Bearer '+'a'.repeat(60);
const env={SUPABASE_URL:'https://dpowbyexrcdcwwqysgzp.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_dummy',SUPABASE_ORGANIZATION_ID:uuid,KIARA_DASHBOARD_ORIGIN:origin};
const settings={
 methodology:'commercial_categories_v1',referenceYear:2026,annualAdjustmentPercent:0,technicalLimits:{maxWidth:30,maxHeight:10,maxQuantity:20},
 categories:[{name:'Voil texturizado',costPerM2:72.4716,baseYear:2026,records:33,active:true}],
 rails:[{id:'trilho_07',label:'Trilho Varao Branco',costPerMeter:35.1082,baseYear:2026,active:true}],
 installation:{manualPerFace:60},pricing:{markupPercent:120}
};
const input={width:2.1,height:2.45,quantity:1,year:2026,faces:[{category:'Voil texturizado',includeInstallation:true}]};
function request(body,auth=token,customOrigin=origin){
 return new Request('https://worker.example/kiara/pricing/simulate',{method:'POST',headers:{Origin:customOrigin,Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify(body)});
}
test('sem token não permite simulação',async()=>{
 const r=await staging.fetch(request({mode:'draft',input,config:{railType:'trilho_07',rails:1}},''),env);
 assert.equal(r.status,401);
});
test('origem diferente é negada',async()=>{
 const r=await staging.fetch(request({mode:'draft',input},token,'https://malicioso.example'),env);
 assert.equal(r.status,403);
});
test('preflight da simulação habilita apenas origem homologada',async()=>{
 const r=await staging.fetch(new Request('https://worker.example/kiara/pricing/simulate',{method:'OPTIONS',headers:{Origin:origin}}),env);
 assert.equal(r.status,204);
 assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);
});
test('simulação interna reproduz 1114,51 e não envia preços',async(t)=>{
 const original=globalThis.fetch;
 globalThis.fetch=async url=>{
  const u=String(url);
  if(u.endsWith('/auth/v1/user'))return Response.json({id:userId});
  if(u.includes('/memberships?'))return Response.json([{role:'admin'}]);
  if(u.includes('/kiara_commercial_config?'))return Response.json([{settings,revision:3,status:'draft'}]);
  throw Error('Saída inesperada: '+u);
 };
 t.after(()=>{globalThis.fetch=original});
 const r=await staging.fetch(request({mode:'draft',input,config:{railType:'trilho_07',rails:1}}),env);
 const body=await r.json();
 assert.equal(r.status,200);
 assert.equal(body.internalSuggestedSale,1114.51);
 assert.equal(body.configurationRevision,3);
 assert.equal(body.customerPriceAllowed,false);
 assert.equal(body.environment,'homologacao');
});
