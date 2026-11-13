import {useState} from 'react'
import {KiaraBlindSettings} from './KiaraBlindSettings'
import {KiaraCurtainCategorySettings} from './KiaraCurtainCategorySettings'
export function KiaraCommercialSettings(){
 const [product,setProduct]=useState<'cortina'|'persiana'>('cortina')
 return <section className="kiara-settings-info">
  <h3>Configurações comerciais e precificação</h3>
  <p>Os parâmetros são editáveis e registrados por produto. Apenas revisões aprovadas podem servir às simulações internas; o envio automático de valores ao cliente permanece bloqueado.</p>
  <label>Produto <select value={product} onChange={event=>setProduct(event.target.value as 'cortina'|'persiana')}>
   <option value="cortina">Cortinas</option><option value="persiana">Persianas</option>
  </select></label>
  {product==='cortina'?<KiaraCurtainCategorySettings/>:<KiaraBlindSettings/>}
 </section>
}
