import test from 'node:test'
import assert from 'node:assert/strict'
import staging from '../staging/worker.js'

const origin='https://kiara-painel-homologacao.pages.dev'
const url='https://test.workers.dev/kiara/capabilities'
const token='Bearer '+'a'.repeat(80)
const env={
 KIARA_DASHBOARD_ORIGIN:origin,
 SUPABASE_URL:'https://example.supabase.co',
 SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example',
 SUPABASE_ORGANIZATION_ID:'0e398095-cc22-421b-ae34-7bf0df8ad7b2'
}
test('diagnóstico só permite origem do painel',async()=>{
 const r=await staging.fetch(new Request(url,{headers:{Origin:'https://malicious.example',Authorization:token}}),env)
 assert.equal(r.status,403)
})
test('diagnóstico exige sessão autenticada',async()=>{
 const r=await staging.fetch(new Request(url,{headers:{Origin:origin}}),env)
 assert.equal(r.status,401)
})
test('diagnóstico declara exatamente as capacidades disponíveis',async(t)=>{
 const initial=globalThis.fetch
 globalThis.fetch=async(input)=>{
  const uri=String(input)
  if(uri.endsWith('/auth/v1/user'))return Response.json({id:'ed76d5b6-1e10-4b84-bf31-b9290d1a5465'})
  if(uri.includes('/memberships?'))return Response.json([{role:'admin'}])
  throw Error('Unrecognized URL '+uri)
 }
 t.after(()=>{globalThis.fetch=initial})
 const r=await staging.fetch(new Request(url,{headers:{Origin:origin,Authorization:token}}),env)
 assert.equal(r.status,200)
 const body=await r.json()
 assert.equal(body.capabilities.pricingSimulation.enabled,true)
 assert.equal(body.capabilities.conversationControl.enabled,false)
 assert.equal(body.capabilities.humanMessages.enabled,false)
 assert.equal(body.productionConnected,false)
})
