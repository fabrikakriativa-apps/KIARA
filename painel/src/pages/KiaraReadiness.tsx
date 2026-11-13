import {useEffect,useState} from 'react'
import {readKiaraCapabilities,kiaraCapabilitiesConfigured,type KiaraCapabilities} from '../lib/kiaraCapabilities'
import {useAccess} from '../components/AuthorizedAccess'
export function KiaraReadiness(){
 const access=useAccess()
 const [report,setReport]=useState<KiaraCapabilities|null>(null)
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(false)
 const [refresh,setRefresh]=useState(0)
 useEffect(()=>{
  if(!access||!kiaraCapabilitiesConfigured)return
  let live=true;setLoading(true);setError('')
  void readKiaraCapabilities().then(value=>{if(live)setReport(value)})
   .catch(e=>{if(live)setError(e instanceof Error?e.message:'Diagnóstico indisponível')})
   .finally(()=>{if(live)setLoading(false)})
  return()=>{live=false}
 },[access?.organizationId,refresh])
 return <section className="kiara-readiness" aria-label="Diagnóstico da homologação">
  <h3>Prontidão do atendimento — homologação</h3>
  <p>Os botões são habilitados apenas quando o Worker conectado suporta a ação. Compilação e publicação do painel não ativam o WhatsApp.</p>
  {!kiaraCapabilitiesConfigured?<p role="status">Diagnóstico não configurado neste painel.</p>:null}
  {loading?<p>Consultando recursos do Worker…</p>:null}
  {error?<p role="alert">{error}</p>:null}
  {report?<div>
   <p><strong>Ambiente:</strong> {report.environment} · <strong>Conexão de mensagens:</strong> {report.transport==='disabled'?'Desativada':report.transport}</p>
   <ul>{Object.entries(report.capabilities).map(([key,cap])=><li key={key}>
     <strong>{cap.label}:</strong> {cap.enabled?'Disponível para teste':'Bloqueado'}{!cap.enabled&&cap.reason?' — '+cap.reason:''}
   </li>)}</ul>
   {!report.productionConnected&&<p><small>Este ambiente não está conectado à produção. Testes de mensagens dependem de Worker operacional e número Meta autorizados.</small></p>}
  </div>:null}
  <button type="button" onClick={()=>setRefresh(x=>x+1)} disabled={loading||!kiaraCapabilitiesConfigured}>Atualizar diagnóstico</button>
 </section>
}
