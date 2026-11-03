import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {useAccess} from '../components/AuthorizedAccess'

type ImageRow={id:string;organization_id:string;product:'cortina'|'persiana';model:string;title:string;description:string;storage_path:string;active:boolean;created_at:string}
type DisplayRow=ImageRow&{url?:string}
const bucket='kiara-reference-images'
const supported=['image/jpeg','image/png','image/webp']
const maxBytes=5*1024*1024

export function KiaraReferenceImages(){
 const access=useAccess()
 const admin=access?.role==='admin'
 const [images,setImages]=useState<DisplayRow[]>([])
 const [product,setProduct]=useState<'cortina'|'persiana'>('cortina')
 const [model,setModel]=useState('')
 const [title,setTitle]=useState('')
 const [description,setDescription]=useState('')
 const [file,setFile]=useState<File|null>(null)
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const [refresh,setRefresh]=useState(0)
 useEffect(()=>{
  if(!supabase||!access){setLoading(false);return}
  let live=true;setLoading(true)
  void (async()=>{
   const response=await supabase.from('kiara_reference_images').select('id,organization_id,product,model,title,description,storage_path,active,created_at')
    .eq('organization_id',access.organizationId).order('created_at',{ascending:false})
   if(!live)return
   if(response.error){setNotice('Falha ao carregar imagens: '+response.error.message);setLoading(false);return}
   const rows=(response.data||[]) as ImageRow[]
   const previews=await Promise.all(rows.map(async row=>{
    const {data}=await supabase!.storage.from(bucket).createSignedUrl(row.storage_path,600)
    return {...row,url:data?.signedUrl||undefined}
   }))
   if(live){setImages(previews);setLoading(false)}
  })()
  return()=>{live=false}
 },[access?.organizationId,refresh])
 async function addImage(){
  if(!supabase||!access||!admin||busy)return
  if(!file||!supported.includes(file.type)||file.size>maxBytes||!title.trim()||!model.trim()){
   setNotice('Preencha título, modelo e selecione uma imagem JPG, PNG ou WebP de até 5 MB.');return
  }
  setBusy(true);setNotice('')
  const extension=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg'
  const path=access.organizationId+'/'+crypto.randomUUID()+'.'+extension
  const uploaded=await supabase.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false})
  if(uploaded.error){setNotice('Falha no upload: '+uploaded.error.message);setBusy(false);return}
  const saved=await supabase.from('kiara_reference_images').insert({
   organization_id:access.organizationId,created_by:access.userId,product,model:model.trim(),
   title:title.trim(),description:description.trim(),storage_path:path,active:false
  })
  if(saved.error){
   await supabase.storage.from(bucket).remove([path])
   setNotice('Falha no cadastro: '+saved.error.message)
  }else{
   setTitle('');setModel('');setDescription('');setFile(null)
   const picker=document.getElementById('kiara-reference-file') as HTMLInputElement|null
   if(picker)picker.value=''
   setNotice('Imagem cadastrada como inativa. Ative somente depois de conferir o modelo e a foto.')
   setRefresh(x=>x+1)
  }
  setBusy(false)
 }
 async function toggle(row:ImageRow){
  if(!supabase||!admin||busy)return
  setBusy(true);setNotice('')
  const result=await supabase.from('kiara_reference_images').update({active:!row.active,updated_at:new Date().toISOString()})
   .eq('organization_id',access!.organizationId).eq('id',row.id)
  setBusy(false)
  if(result.error)setNotice('Falha ao alterar a imagem: '+result.error.message)
  else{setNotice(!row.active?'Imagem aprovada e ativa na biblioteca; envio pelo WhatsApp ainda não está habilitado.':'Imagem desativada.');setRefresh(x=>x+1)}
 }
 return <section className="kiara-reference-library">
  <h3>Biblioteca de imagens de referência</h3>
  <p>Cadastre fotos reais dos modelos e aprove individualmente. Os arquivos ficam em um espaço privado da Fábrika. A biblioteca ainda não envia imagens automaticamente no WhatsApp.</p>
  {admin&&<div className="kiara-reference-editor">
   <h4>Adicionar referência</h4>
   <div className="kiara-pricing-form">
    <label>Produto<select value={product} onChange={e=>setProduct(e.target.value as 'cortina'|'persiana')}><option value="cortina">Cortina</option><option value="persiana">Persiana</option></select></label>
    <label>Modelo<input value={model} onChange={e=>setModel(e.target.value)} placeholder="Ex.: Wave, Rolô, Romana" maxLength={100}/></label>
    <label>Título da referência<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Rolô off-white em varanda" maxLength={100}/></label>
    <label>Imagem (JPG, PNG ou WebP, até 5 MB)<input id="kiara-reference-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
   </div>
   <label>Descrição para orientar a escolha<textarea rows={3} maxLength={500} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Ex.: mostra a transparência do tecido e a instalação sobreposta"/></label>
   <button className="kiara-commercial-button kiara-commercial-button--primary" type="button" disabled={busy||!file||!title.trim()||!model.trim()} onClick={()=>void addImage()}>{busy?'Salvando…':'Adicionar imagem como inativa'}</button>
  </div>}
  {notice&&<p role="status">{notice}</p>}
  <h4>Referências cadastradas ({images.length})</h4>
  {loading?<p>Carregando imagens…</p>:images.length===0?<p>Nenhuma imagem cadastrada. Comece com fotos aprovadas dos modelos mais pedidos.</p>:
   <div className="kiara-reference-grid">{images.map(row=><article className="kiara-reference-item" key={row.id}>
    {row.url?<img src={row.url} alt={row.title} loading="lazy"/>:<div className="kiara-reference-unavailable">Prévia indisponível</div>}
    <div><strong>{row.title}</strong><small>{row.product==='cortina'?'Cortina':'Persiana'} · {row.model}</small>
     {row.description&&<p>{row.description}</p>}
     <small>{row.active?'Ativa na biblioteca':'Inativa — aguardando aprovação'}</small>
     {admin&&<button type="button" disabled={busy} onClick={()=>void toggle(row)}>{row.active?'Desativar imagem':'Aprovar e ativar'}</button>}
    </div>
   </article>)}</div>}
  <p><small>As imagens são referências ilustrativas, não garantias de disponibilidade ou resultado. O envio automático depende de integração específica do Worker e testes com a API do WhatsApp.</small></p>
 </section>
}
