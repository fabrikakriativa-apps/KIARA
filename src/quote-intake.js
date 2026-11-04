// Matriz comercial de pré-orçamento (homologação). Modelos são hipóteses
// de catálogo para validação pela Fábrika antes de disponibilizar imagens.
export const QUOTE_PRODUCTS = Object.freeze({
  cortina: {
    label: 'Cortina',
    models: [
      {id:'wave',label:'Wave'},
      {id:'prega_macho',label:'Prega macho'},
      {id:'franzida',label:'Franzida'}
    ],
    essential:['ambiente','modelo','largura','altura','forro_preferencia','tecido_frontal'],
    conditional:{
      forro:'Perguntar em linguagem simples se deseja somente um tecido ou tecido da frente mais outro atrás (forro). Não usar o termo faces com o cliente.',
      suporte:'Somente trilho suíço ou varão trilho, fixados no teto ou parede.',
      acionamento:'Perguntar se deseja motorização apenas quando pertinente.'
    }
  },
  persiana: {
    label:'Persiana',
    models: [
      {id:'rolo',label:'Rolô'},
      {id:'double_vision',label:'Double Vision'},
      {id:'romana',label:'Romana'},
      {id:'horizontal',label:'Horizontal'},
      {id:'vertical',label:'Vertical'}
    ],
    essential:['ambiente','modelo','largura','altura','controle_luz','material_confirmado'],
    conditional:{
      tecido:'Identificar tecido ou grau de abertura quando isso muda o preço.',
      blackout:'Não presumir blackout apenas porque o cliente quer menos luz.',
      acionamento:'Confirmar manual ou motorizado, se aplicável.'
    }
  }
});
export const QUOTE_BASE_FIELDS = Object.freeze([
 {id:'ambiente',label:'Ambiente',level:'essential'},
 {id:'modelo',label:'Modelo',level:'essential'},
 {id:'largura',label:'Largura aproximada',level:'essential'},
 {id:'altura',label:'Altura aproximada',level:'essential'},
 {id:'foto',label:'Foto do local ou referência',level:'optional'},
 {id:'instalacao',label:'Instalação',level:'conditional'}
]);
export function quoteMissing(product,values={}){
 const def=QUOTE_PRODUCTS[product];
 if(!def)return ['produto'];
 return def.essential.filter(key=>!String(values[key]??'').trim());
}
export function quoteNextQuestion(product,values={},mode='quick'){
 const missing=quoteMissing(product,values);
 if(missing.includes('produto'))return 'Você procura cortina ou persiana?';
 if(missing.includes('ambiente'))return 'Para qual ambiente será?';
 if(missing.includes('modelo'))return mode==='personalized'
  ? 'Você já tem algum modelo em mente ou prefere ver as opções?'
  : 'Você já sabe o modelo ou gostaria de escolher pelo estilo?';
 if(missing.includes('largura')||missing.includes('altura'))return
  'Você sabe aproximadamente a largura e a altura do espaço?';
 if(missing.includes('forro_preferencia'))return 'Você prefere a cortina com apenas um tecido ou com dois tecidos: um na frente e outro atrás (forro)? Se não souber, posso te orientar.';
 if(missing.includes('tecido_frontal'))return
  'Você já tem preferência de tecido ou gostaria de orientação?';
 if(missing.includes('material_confirmado'))return 'Você já tem preferência de tecido ou material para essa persiana?';
 if(missing.includes('controle_luz'))return
  'Para esse ambiente, o mais importante é privacidade, filtrar a luz ou escurecer?';
 return null;
}
export function quoteIntakePrompt(){
 return [
  'DADOS TÉCNICOS PARA PRÉ-ORÇAMENTO (não é um roteiro de conversa):',
  'Para cortinas: ambiente, modelo, largura e altura, tecido frontal e decisão de forro.',
  'Para persianas: ambiente, modelo, largura e altura, tecido/material e finalidade de controle de luminosidade.',
  'Só considerar dados que o cliente confirmou. Diferenciar alternativas ainda em avaliação; não aplicar dados de um ambiente a outro.',
  'Cortina com frente e forro de tecido tem duas faces para cálculo. Persiana atrás é outro produto, não uma face adicional.',
  'Não perguntar ao cliente quantidade de faces, fator de franzimento, número de folhas, motores ou detalhes técnicos usados apenas internamente.',
  'Antes do orçamento, oferecer síntese breve das especificações confirmadas e pendências; a formação de valores exige validação comercial e humana.',
  'Não inventar valores, produtos, garantias, prazos ou especificações.'
 ].join(' ');
}
