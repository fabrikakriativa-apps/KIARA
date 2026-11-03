export async function sendKiaraImage({env,route,to,reference,version='v26.0',request=fetch,guard=async()=>true}){
 const org=String(env.SUPABASE_ORGANIZATION_ID||'');
 const path=String(reference?.storage_path||'');
 if(!/^[a-f0-9-]{36}$/i.test(org)||!path.startsWith(org+'/')||path.includes('..'))throw Error('Imagem fora da organização');
 const mime=/\.png$/i.test(path)?'image/png':/\.webp$/i.test(path)?'image/webp':/\.jpe?g$/i.test(path)?'image/jpeg':null;
 if(!mime)throw Error('Formato não autorizado');
 if(!route?.phoneId||!route?.token)throw Error('Canal indisponível');
 if(!(await guard()))return null;
 const encoded=path.split('/').map(encodeURIComponent).join('/');
 const base=String(env.SUPABASE_URL||'').replace(/\/$/,'');
 const key=env.SUPABASE_SERVICE_ROLE_KEY;
 const downloaded=await request(base+'/storage/v1/object/authenticated/kiara-reference-images/'+encoded,{
  headers:{apikey:key,Authorization:'Bearer '+key}
 });
 if(!downloaded.ok)throw Error('Falha no download privado');
 const bytes=await downloaded.arrayBuffer();
 if(!bytes.byteLength||bytes.byteLength>5242880)throw Error('Tamanho inválido');
 const actual=String(downloaded.headers.get('content-type')||'').split(';')[0].trim();
 if(actual&&actual!==mime)throw Error('MIME inconsistente');
 if(!(await guard()))return null;
 const form=new FormData();
 form.set('messaging_product','whatsapp');form.set('type',mime);
 form.set('file',new Blob([bytes],{type:mime}),path.split('/').at(-1));
 const uploaded=await request('https://graph.facebook.com/'+version+'/'+route.phoneId+'/media',{
  method:'POST',headers:{Authorization:'Bearer '+route.token},body:form
 });
 if(!uploaded.ok)throw Error('Upload na Meta falhou');
 const media=await uploaded.json();
 if(!/^[0-9]{4,40}$/.test(String(media.id||'')))throw Error('ID de mídia inválido');
 if(!(await guard()))return null;
 const sent=await request('https://graph.facebook.com/'+version+'/'+route.phoneId+'/messages',{
  method:'POST',headers:{Authorization:'Bearer '+route.token,'Content-Type':'application/json'},
  body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to,type:'image',
   image:{id:media.id,caption:String(reference.title||'Exemplo de cortina').slice(0,140)}})
 });
 if(!sent.ok)throw Error('Envio de imagem falhou');
 return (await sent.json()).messages?.[0]?.id||null;
}
