import {useState} from 'react'
import {supabase} from '../lib/supabase'
import {useAccess} from '../components/AuthorizedAccess'
import {kiaraVisualManifest} from './kiaraVisualManifest'

export function KiaraBatchReferenceUpload({onImported}:{onImported:()=>void}){
 const access=useAccess()
 const admin=access?.role==='admin'
 const [files,setFiles]=useState<File[]>([])
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const [progress,setProgress]=useState('')
 const selected=files.map(file=>({file,preset:kiaraVisualManifest.find(row=>row.filename===file.name)}))
 const recognized=selected.filter(row=>Boolean(row.preset))
 async function upload(){
  if(!admin||!access||!supabase||busy)return
  setBusy(true);setNotice('')
  const current=await supabase.from('kiara_reference_images').select('title,model,category')
   .eq('organization_id',access.organizationId)
  if(current.error){setNotice('Não foi possível conferir duplicidades. Nada foi importado.');setBusy(false);return}
  const existing=new Set((current.data||[]).map(row=>row.category+'|'+row.model+'|'+row.title))
  let added=0,skipped=0,failed=0
  for(const [index,item] of recognized.entries()){
   const {file,preset}=item
   if(!preset){skipped++;continue}
   const key=preset.category+'|'+preset.model+'|'+preset.title
   if(existing.has(key)){skipped++;continue}
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||!file.size||file.size>5*1024*1024){failed++;continue}
   setProgress('Importando '+(index+1)+' de '+recognized.length+': '+preset.title)
   const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg'
   const path=access.organizationId+'/'+crypto.randomUUID()+'.'+ext
   const savedFile=await supabase.storage.from('kiara-reference-images').upload(path,file,{contentType:file.type,upsert:false})
   if(savedFile.error){failed++;continue}
   const stored=await supabase.from('kiara_reference_images').insert({
    organization_id:access.organizationId,created_by:access.userId,product:preset.product,
    model:preset.model,title:preset.title,description:preset.description,
    category:preset.category,storage_path:path,active:false
   })
   if(stored.error){await supabase.storage.from('kiara-reference-images').remove([path]);failed++;continue}
   existing.add(key);added++
  }
  setBusy(false);setProgress('')
  setNotice('Importadas: '+added+'. Já cadastradas: '+skipped+'. Falhas: '+failed+'. Todas as novas imagens continuam inativas.')
  if(added)onImported()
 }
 return <div className="kiara-reference-editor">
  <h4>Importar imagens revisadas em lote</h4>
  <p>Extraia o ZIP da biblioteca e selecione as imagens. Os 22 nomes revisados serão reconhecidos automaticamente, com seus modelos e descrições. Não envia nada ao WhatsApp.</p>
  <label>Selecionar vários arquivos de imagem
   <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!admin||busy}
    onChange={event=>setFiles(Array.from(event.target.files||[]))}/>
  </label>
  {files.length>0&&<p>{recognized.length} de {files.length} arquivo(s) reconhecido(s) na lista. Arquivos desconhecidos não serão importados.</p>}
  {progress&&<p role="status">{progress}</p>}
  {notice&&<p role="status">{notice}</p>}
  <button type="button" disabled={!admin||busy||!recognized.length} onClick={()=>void upload()}>
   {busy?'Importando…':'Importar '+recognized.length+' referência(s) como inativas'}
  </button>
 </div>
}
