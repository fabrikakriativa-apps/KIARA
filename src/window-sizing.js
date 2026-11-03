// Pré-dimensionamento a partir das medidas da JANELA, não da peça pronta.
// Parâmetros ajustáveis por organização; o resultado é uma referência para orçamento.
export function windowQuoteDimensions({width,height,mount='wall',sideAllowanceCm=10,heightAllowanceCm=10,ceilingHeightAllowanceCm=50}={}){
 const n=v=>typeof v==='number'?v:typeof v==='string'&&/^\d+(?:[.,]\d+)?$/.test(v.trim())?Number(v.replace(',','.')):NaN;
 const w=n(width),h=n(height),side=n(sideAllowanceCm),wall=n(heightAllowanceCm),ceiling=n(ceilingHeightAllowanceCm);
 const errors=[];
 if(!(w>0&&Number.isFinite(w)&&h>0&&Number.isFinite(h)))errors.push('Medidas da janela inválidas ou ausentes');
 if(!['wall','ceiling'].includes(mount))errors.push('Tipo de instalação não confirmado');
 if(![side,wall,ceiling].every(v=>Number.isFinite(v)&&v>=0))errors.push('Acréscimos técnicos inválidos');
 if(errors.length)return {ready:false,errors};
 const deltaHeight=(mount==='ceiling'?ceiling:wall)/100;
 return {ready:true,width:Math.round((w+2*side/100)*1000)/1000,
  height:Math.round((h+deltaHeight)*1000)/1000,
  source:'window',mount,
  allowances:{sideEachCm:side,heightTotalCm:mount==='ceiling'?ceiling:wall},
  provisional:true};
}
