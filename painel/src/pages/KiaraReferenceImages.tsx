import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'
import {useAccess} from '../components/AuthorizedAccess'
import {KiaraBatchReferenceUpload} from './KiaraBatchReferenceUpload'

type ImageRow={id:string;organization_id:string;product:'cortina'|'persiana';model:string;title:string;description:string;storage_path:string;category:'produto'|'modelo_confeccao'|'composicao';active:boolean;created_at:string}
type DisplayRow=ImageRow&{url?:string}
type ImageDraft=Pick<ImageRow,'product'|'category'|'model'|'title'|'description'>
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
 const [category,setCategory]=useState<'produto'|'modelo_confeccao'|'composicao'>('produto')
 const [description,setDescription]=useState('')
 const [file,setFile]=useState<File|null>(null)
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const [refresh,setRefresh]=useState(0)
 const [editingId,setEditingId]=useState<string|null>(null)
 const [draft,setDraft]=useState<ImageDraft|null>(null)
 const [categoryFilter,setCategoryFilter]=useState('all')
 const [statusFilter,setStatusFilter]=useState('all')
 const [search,setSearch]=useState('')
 useEffect(()=>{
  if(!supabase||!access){setLoading(false);return}
  let live=true;setLoading(true)
  void (async()=>{
   const response=await supabase.from('kiara_reference_images').select('id,organization_id,product,model,title,description,storage_path,category,active,created_at')
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
   title:title.trim(),description:description.trim(),storage_path:path,category,active:false
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
 function beginEdit(row:ImageRow){
  if(!admin||busy||row.active)return
  setEditingId(row.id)
  setDraft({product:row.product,category:row.category,model:row.model,title:row.title,description:row.description||''})
  setNotice('')
 }
 async function saveEdit(){
  if(!supabase||!access||!admin||busy||!editingId||!draft)return
  if(images.find(row=>row.id===editingId)?.active){
   setNotice('Desative a referência antes de editar.');return
  }
  if(!draft.model.trim()||!draft.title.trim()){
   setNotice('Informe o modelo e o título.');return
  }
  setBusy(true);setNotice('')
  const result=await supabase.from('kiara_reference_images').update({
   product:draft.product,category:draft.category,model:draft.model.trim(),
   title:draft.title.trim(),description:draft.description.trim(),updated_at:new Date().toISOString()
  }).eq('organization_id',access.organizationId).eq('id',editingId).eq('active',false).select('id').maybeSingle()
  setBusy(false)
  if(result.error)setNotice('Falha ao atualizar a referência: '+result.error.message)
  else if(!result.data)setNotice('Alteração não confirmada. Confira as permissões e atualize a lista.')
  else{
   setEditingId(null);setDraft(null)
   setNotice('Dados atualizados. A referência permanece inativa até aprovação.')
   setRefresh(x=>x+1)
  }
 }
 async function toggle(row:ImageRow){
  if(!supabase||!admin||busy)return
  setBusy(true);setNotice('')
  const result=await supabase.from('kiara_reference_images').update({active:!row.active,updated_at:new Date().toISOString()})
   .eq('organization_id',access!.organizationId).eq('id',row.id).eq('active',row.active).select('id').maybeSingle()
  setBusy(false)
  if(result.error)setNotice('Falha ao alterar a imagem: '+result.error.message)
  else if(!result.data)setNotice('A alteração não foi confirmada. Atualize a lista e tente novamente.')
  else{setNotice(!row.active?'Imagem aprovada na biblioteca. O envio depende das configurações do atendimento.':'Imagem desativada.');setRefresh(x=>x+1)}
 }
 const visible=images.filter(row=>{
  if(categoryFilter!=='all'&&row.category!==categoryFilter)return false
  if(statusFilter==='active'&&!row.active)return false
  if(statusFilter==='inactive'&&row.active)return false
  const term=search.trim().toLocaleLowerCase('pt-BR')
  return !term||[row.title,row.model,row.description,row.product].some(value=>String(value||'').toLocaleLowerCase('pt-BR').includes(term))
 })
 const activeCount=images.filter(row=>row.active).length
 return <section className="kiara-reference-library">
  <h3>Biblioteca de imagens de referência</h3>
  <p>Organize e aprove referências visuais de produtos, modelos de confecção e composições. Os arquivos permanecem privados e só podem ser utilizados pela Kiara conforme as regras de atendimento e de envio habilitadas.</p>
  {admin&&<div className="kiara-reference-editor">
   <h4>Adicionar referência</h4>
   <div className="kiara-pricing-form">
    <label>Produto<select value={product} onChange={e=>setProduct(e.target.value as 'cortina'|'persiana')}><option value="cortina">Cortina</option><option value="persiana">Persiana</option></select></label>
    <label>Categoria<select value={category} onChange={e=>setCategory(e.target.value as 'produto'|'modelo_confeccao'|'composicao')}><option value="produto">Produto, tecido ou transparência</option><option value="modelo_confeccao">Modelo de confecção</option><option value="composicao">Composição de produtos</option></select></label>
    <label>Modelo<input value={model} onChange={e=>setModel(e.target.value)} placeholder="Ex.: Wave, Rolô, Romana" maxLength={100}/></label>
    <label>Título da referência<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Rolô off-white em varanda" maxLength={100}/></label>
    <label>Imagem (JPG, PNG ou WebP, até 5 MB)<input id="kiara-reference-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
   </div>
   <label>Descrição para orientar a escolha<textarea rows={3} maxLength={500} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Ex.: mostra a transparência do tecido e a instalação sobreposta"/></label>
   <button className="kiara-commercial-button kiara-commercial-button--primary" type="button" disabled={busy||!file||!title.trim()||!model.trim()} onClick={()=>void addImage()}>{busy?'Salvando…':'Adicionar imagem como inativa'}</button>
  </div>}
  {admin&&<KiaraBatchReferenceUpload onImported={()=>setRefresh(x=>x+1)}/>}
  {notice&&<p role="status">{notice}</p>}
  <h4>Referências cadastradas ({images.length})</h4>
  <p><small>{activeCount} ativa(s) · {images.length-activeCount} inativa(s). As inativas não são elegíveis ao envio automático.</small></p>
  <div className="kiara-reference-filters">
   <label>Buscar referência<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Título, modelo, produto…"/></label>
   <label>Categoria<select value={categoryFilter} onChange={event=>setCategoryFilter(event.target.value)}>
    <option value="all">Todas</option><option value="produto">Produtos e tecidos</option><option value="modelo_confeccao">Modelos de confecção</option><option value="composicao">Composições</option>
   </select></label>
   <label>Situação<select value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}>
    <option value="all">Todas</option><option value="active">Ativas</option><option value="inactive">Inativas</option>
   </select></label>
  </div>
  {loading?<p>Carregando imagens…</p>:images.length===0?<p>Nenhuma referência cadastrada. Adicione imagens individualmente ou utilize a importação em lote.</p>:visible.length===0?<p>Nenhuma referência encontrada para os filtros selecionados.</p>:
   <div className="kiara-reference-grid">{visible.map(row=><article className="kiara-reference-item" key={row.id}>
    {row.url?<img src={row.url} alt={row.title} loading="lazy"/>:<div className="kiara-reference-unavailable">Prévia indisponível</div>}
    <div><strong>{row.title}</strong><small>{row.product==='cortina'?'Cortina':'Persiana'} · {row.model} · {row.category==='modelo_confeccao'?'Modelo de confecção':row.category==='composicao'?'Composição':'Produto e tecido'}</small>
     {row.description&&<p>{row.description}</p>}
     <small>{row.active?'Ativa na biblioteca':'Inativa — aguardando aprovação'}</small>
     {admin&&<div className="kiara-reference-actions">
      <button type="button" disabled={busy||editingId!==null} onClick={()=>void toggle(row)}>{row.active?'Desativar':'Aprovar e ativar'}</button>
      <button type="button" disabled={busy||row.active||editingId!==null} onClick={()=>beginEdit(row)}>Editar informações</button>
     </div>}
     {editingId===row.id&&draft&&<div className="kiara-reference-edit">
      <p><small>Edite os dados desta referência. Para substituir a foto, cadastre uma nova imagem.</small></p>
      <label>Produto<select value={draft.product} onChange={event=>setDraft({...draft,product:event.target.value as ImageDraft['product']})}><option value="cortina">Cortina</option><option value="persiana">Persiana</option></select></label>
      <label>Categoria<select value={draft.category} onChange={event=>setDraft({...draft,category:event.target.value as ImageDraft['category']})}><option value="produto">Produto ou tecido</option><option value="modelo_confeccao">Modelo de confecção</option><option value="composicao">Composição</option></select></label>
      <label>Modelo<input value={draft.model} maxLength={100} onChange={event=>setDraft({...draft,model:event.target.value})}/></label>
      <label>Título<input value={draft.title} maxLength={100} onChange={event=>setDraft({...draft,title:event.target.value})}/></label>
      <label>Descrição<textarea rows={3} maxLength={500} value={draft.description} onChange={event=>setDraft({...draft,description:event.target.value})}/></label>
      <div className="kiara-reference-actions">
       <button type="button" disabled={busy||!draft.model.trim()||!draft.title.trim()} onClick={()=>void saveEdit()}>Salvar alterações</button>
       <button type="button" disabled={busy} onClick={()=>{setEditingId(null);setDraft(null)}}>Cancelar</button>
      </div>
     </div>}
    </div>
   </article>)}</div>}
  <p><small>As imagens são ilustrativas, não garantias de disponibilidade ou resultado. A aprovação na biblioteca não ativa, por si só, o envio automático pelo WhatsApp.</small></p>
 </section>
}
