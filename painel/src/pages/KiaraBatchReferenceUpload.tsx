import {useRef,useState} from 'react'
import {supabase} from '../lib/supabase'
import {useAccess} from '../components/AuthorizedAccess'

type Product='cortina'|'persiana'
type Category='produto'|'modelo_confeccao'|'composicao'
type Draft={key:string;file:File;product:Product;category:Category;model:string;title:string;description:string}
const allowed=['image/jpeg','image/png','image/webp']
const maxBytes=5*1024*1024
const titleFromFile=(name:string)=>name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim().slice(0,100)
const identity=(item:Pick<Draft,'product'|'category'|'model'|'title'>)=>
 [item.product,item.category,item.model.trim().toLocaleLowerCase('pt-BR'),item.title.trim().toLocaleLowerCase('pt-BR')].join('|')

export function KiaraBatchReferenceUpload({onImported}:{onImported:()=>void}){
 const access=useAccess()
 const admin=access?.role==='admin'
 const inputRef=useRef<HTMLInputElement|null>(null)
 const [drafts,setDrafts]=useState<Draft[]>([])
 const [bulkProduct,setBulkProduct]=useState<Product>('cortina')
 const [bulkCategory,setBulkCategory]=useState<Category>('produto')
 const [bulkModel,setBulkModel]=useState('')
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[progress,setProgress]=useState('')
 const ready=drafts.filter(d=>d.model.trim()&&d.title.trim()&&allowed.includes(d.file.type)&&d.file.size>0&&d.file.size<=maxBytes)
 const missing=drafts.length-ready.length
 function addFiles(incoming:File[]){
  const next=incoming.map((file,index):Draft=>({
   key:crypto.randomUUID()+'-'+index,file,product:bulkProduct,category:bulkCategory,
   model:bulkModel.trim(),title:titleFromFile(file.name),description:''
  }))
  setDrafts(prev=>[...prev,...next])
  setNotice('')
  if(inputRef.current)inputRef.current.value=''
 }
 function edit(key:string,change:Partial<Draft>){
  setDrafts(prev=>prev.map(d=>d.key===key?{...d,...change}:d))
 }
 function applyDefaults(){
  setDrafts(prev=>prev.map(d=>({...d,product:bulkProduct,category:bulkCategory,
   ...(bulkModel.trim()?{model:bulkModel.trim()}:{} )})))
 }
 async function upload(){
  if(!admin||!access||!supabase||busy||!drafts.length||missing)return
  setBusy(true);setNotice('')
  const current=await supabase.from('kiara_reference_images').select('product,title,model,category')
   .eq('organization_id',access.organizationId)
  if(current.error){
   setNotice('Não foi possível verificar as referências cadastradas. Nenhuma imagem foi importada.')
   setBusy(false);return
  }
  const existing=new Set((current.data||[]).map(item=>identity(item as Draft)))
  let added=0,skipped=0,failed=0
  const completed:string[]=[]
  for(const [index,draft] of drafts.entries()){
   const id=identity(draft)
   if(existing.has(id)){skipped++;completed.push(draft.key);continue}
   setProgress('Importando '+(index+1)+' de '+drafts.length+': '+draft.title)
   const ext=draft.file.type==='image/png'?'png':draft.file.type==='image/webp'?'webp':'jpg'
   const path=access.organizationId+'/'+crypto.randomUUID()+'.'+ext
   const uploaded=await supabase.storage.from('kiara-reference-images').upload(path,draft.file,{
    contentType:draft.file.type,upsert:false
   })
   if(uploaded.error){failed++;continue}
   const saved=await supabase.from('kiara_reference_images').insert({
    organization_id:access.organizationId,created_by:access.userId,
    product:draft.product,category:draft.category,
    model:draft.model.trim(),title:draft.title.trim(),description:draft.description.trim(),
    storage_path:path,active:false
   })
   if(saved.error){
    await supabase.storage.from('kiara-reference-images').remove([path])
    failed++;continue
   }
   existing.add(id);completed.push(draft.key);added++
  }
  setDrafts(prev=>prev.filter(d=>!completed.includes(d.key)))
  setBusy(false);setProgress('')
  setNotice('Cadastradas: '+added+'. Já existentes: '+skipped+'. Falhas: '+failed+
   '. Novas referências permanecem inativas até aprovação.')
  if(added)onImported()
 }
 return <div className="kiara-reference-editor">
  <h4>Importar imagens em lote</h4>
  <p>Selecione imagens JPG, PNG ou WebP (até 5 MB cada). Informe o produto, a categoria e o modelo para cada referência. Os títulos são sugeridos a partir dos nomes dos arquivos e podem ser alterados. As imagens são cadastradas como inativas, para revisão antes do uso no atendimento.</p>
  <label>Selecionar imagens
   <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple
    disabled={!admin||busy} onChange={e=>addFiles(Array.from(e.target.files||[]))}/>
  </label>
  {drafts.length>0&&<>
   <h5>Preenchimento para várias imagens</h5>
   <div className="kiara-pricing-form">
    <label>Produto
     <select value={bulkProduct} disabled={busy} onChange={e=>setBulkProduct(e.target.value as Product)}>
      <option value="cortina">Cortina</option><option value="persiana">Persiana</option>
     </select>
    </label>
    <label>Categoria
     <select value={bulkCategory} disabled={busy} onChange={e=>setBulkCategory(e.target.value as Category)}>
      <option value="produto">Produto, tecido ou transparência</option>
      <option value="modelo_confeccao">Modelo de confecção</option>
      <option value="composicao">Composição</option>
     </select>
    </label>
    <label>Modelo (opcional no preenchimento coletivo)
     <input value={bulkModel} disabled={busy} maxLength={100}
      onChange={e=>setBulkModel(e.target.value)} placeholder="Ex.: Wave, Romana, Rolô"/>
    </label>
   </div>
   <button type="button" disabled={busy} onClick={applyDefaults}>Aplicar campos às imagens selecionadas</button>
   <p>{drafts.length} imagem(ns) selecionada(s). {missing?missing+' precisa(m) de informações ou têm arquivo inválido.':'Todas prontas para cadastro.'}</p>
   <div className="kiara-reference-grid">
    {drafts.map(d=><article className="kiara-reference-item" key={d.key}>
     <div><strong>{d.file.name}</strong><small>{(d.file.size/1024/1024).toFixed(2)} MB</small></div>
     <div className="kiara-pricing-form">
      <label>Produto
       <select value={d.product} disabled={busy} onChange={e=>edit(d.key,{product:e.target.value as Product})}>
        <option value="cortina">Cortina</option><option value="persiana">Persiana</option>
       </select>
      </label>
      <label>Categoria
       <select value={d.category} disabled={busy} onChange={e=>edit(d.key,{category:e.target.value as Category})}>
        <option value="produto">Produto, tecido ou transparência</option>
        <option value="modelo_confeccao">Modelo de confecção</option>
        <option value="composicao">Composição</option>
       </select>
      </label>
      <label>Modelo
       <input value={d.model} disabled={busy} maxLength={100} placeholder="Obrigatório"
        onChange={e=>edit(d.key,{model:e.target.value})}/>
      </label>
      <label>Título
       <input value={d.title} disabled={busy} maxLength={100}
        onChange={e=>edit(d.key,{title:e.target.value})}/>
      </label>
      <label>Descrição (opcional)
       <textarea value={d.description} disabled={busy} maxLength={500} rows={2}
        onChange={e=>edit(d.key,{description:e.target.value})}/>
      </label>
     </div>
     {!allowed.includes(d.file.type)||!d.file.size||d.file.size>maxBytes?
      <p role="alert">Arquivo inválido ou maior que 5 MB.</p>:null}
     <button type="button" disabled={busy} onClick={()=>setDrafts(prev=>prev.filter(x=>x.key!==d.key))}>Retirar da seleção</button>
    </article>)}
   </div>
   <button type="button" disabled={busy||missing>0} onClick={()=>void upload()}>
    {busy?'Importando…':'Cadastrar '+ready.length+' imagem(ns) como inativas'}
   </button>
  </>}
  {progress&&<p role="status">{progress}</p>}
  {notice&&<p role="status">{notice}</p>}
 </div>
}
