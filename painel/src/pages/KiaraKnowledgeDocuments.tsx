import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {useAccess} from '../components/AuthorizedAccess'

type DocumentRow={
 id:string;version:string;title:string;status:string;source_filename:string;
 content_markdown:string;editorial_review_date:string|null;created_at:string;content_checksum:string
}
export function KiaraKnowledgeDocuments(){
 const access=useAccess(),admin=access?.role==='admin'
 const [documents,setDocuments]=useState<DocumentRow[]>([])
 const [loading,setLoading]=useState(true),[message,setMessage]=useState(''),[revision,setRevision]=useState(0)
 const [expanded,setExpanded]=useState<string|null>(null)
 const [file,setFile]=useState<File|null>(null),[version,setVersion]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{
  if(!supabase||!access){setLoading(false);return}
  let live=true;setLoading(true)
  void supabase.from('kiara_knowledge_documents')
   .select('id,version,title,status,source_filename,content_markdown,editorial_review_date,created_at,content_checksum')
   .eq('organization_id',access.organizationId).order('created_at',{ascending:false}).limit(20)
   .then(({data,error})=>{
    if(!live)return
    setLoading(false)
    if(error)setMessage('Não foi possível consultar as versões da base: '+error.message)
    else{setDocuments((data||[]) as DocumentRow[]);setMessage('')}
   })
  return()=>{live=false}
 },[access?.organizationId,revision])
 async function upload(){
  if(!supabase||!access||!admin||busy||!file||!version.trim())return
  if(!/^[a-z0-9._-]+$/i.test(version.trim())){setMessage('Use uma versão como 2.1 ou 3.0.');return}
  if(!/\\.(md|txt)$/i.test(file.name)||file.size>200000){setMessage('Selecione arquivo Markdown ou TXT com até 200 KB.');return}
  setBusy(true);setMessage('')
  try{
   const contents=await file.text()
   if(contents.trim().length<100)throw Error('O documento está vazio ou muito curto.')
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(contents))
   const checksum=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('')
   const {error}=await supabase.from('kiara_knowledge_documents').insert({
    organization_id:access.organizationId,version:version.trim(),
    title:'Base de conhecimento — Kiara',source_filename:file.name,
    content_markdown:contents,content_checksum:checksum,status:'draft'
   })
   if(error)throw Error(error.code==='23505'?'Esta versão já existe. Cadastre um número de versão novo.':error.message)
   setFile(null);setVersion('');setMessage('Versão cadastrada como rascunho. Nenhuma instrução foi ativada automaticamente.')
   setRevision(n=>n+1)
  }catch(e){setMessage(e instanceof Error?e.message:'Não foi possível importar a base.')}
  finally{setBusy(false)}
 }
 return <section className="kiara-management-card">
  <h2>Base de conhecimento — versões</h2>
  <p>Documento editorial separado da precificação. Uma versão importada permanece em rascunho até revisão e publicação supervisionada. Informações identificadas como [VALIDAR] não devem ser tratadas como regras aprovadas.</p>
  {loading?<p>Carregando versões…</p>:documents.length===0?<p>Nenhuma versão cadastrada.</p>:
   documents.map(doc=><article key={doc.id} className="kiara-kb-version">
    <strong>{doc.title} · v{doc.version}</strong>
    <p><small>{doc.status==='approved'?'Aprovada':doc.status==='archived'?'Arquivada':'Rascunho — não ativa'} · Fonte: {doc.source_filename} · {new Date(doc.created_at).toLocaleDateString('pt-BR')}</small></p>
    <button type="button" onClick={()=>setExpanded(x=>x===doc.id?null:doc.id)}>{expanded===doc.id?'Ocultar documento':'Consultar documento'}</button>
    {expanded===doc.id&&<pre style={{whiteSpace:'pre-wrap',maxHeight:420,overflow:'auto',fontSize:12}}>{doc.content_markdown}</pre>}
   </article>)}
  {admin&&<div className="kiara-kb-upload">
   <h3>Cadastrar nova versão</h3>
   <p><small>Importe revisões futuras sem substituir ou alterar automaticamente a versão em uso.</small></p>
   <label>Versão<input value={version} maxLength={30} onChange={e=>setVersion(e.target.value)} placeholder="2.1"/></label>
   <label>Arquivo Markdown ou TXT<input type="file" accept=".md,.txt,text/markdown,text/plain" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
   <button type="button" disabled={busy||!file||!version.trim()} onClick={()=>void upload()}>{busy?'Importando…':'Cadastrar versão como rascunho'}</button>
  </div>}
  {message&&<p role="status">{message}</p>}
 </section>
}
