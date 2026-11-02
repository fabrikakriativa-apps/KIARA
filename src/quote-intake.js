// Matriz comercial de pré-orçamento (homologação). Modelos são hipóteses
// de catálogo para validação pela Fábrika antes de disponibilizar imagens.
export const QUOTE_PRODUCTS = Object.freeze({
  cortina: {
    label: 'Cortina',
    models: [
      {id:'wave',label:'Wave'},
      {id:'prega_macho',label:'Prega macho'},
      {id:'franzida',label:'Franzida'},
      {id:'ilhos',label:'Ilhós'}
    ],
    essential:['ambiente','modelo','largura','altura','tecido_frontal','forro_preferencia'],
    conditional:{
      forro:'Perguntar se deseja forro e qual o objetivo (privacidade, escurecimento).',
      trilho:'Confirmar trilho ou varão quando afetar a composição.',
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
 if(missing.includes('tecido_frontal'))return
  'Você já escolheu o tecido da frente ou gostaria de orientação?';
 if(missing.includes('forro_preferencia'))return 'Você gostaria de usar forro nessa cortina? A ideia é mais privacidade ou escurecimento?';
 if(missing.includes('material_confirmado'))return 'Você já tem preferência de tecido ou material para essa persiana?';
 if(missing.includes('controle_luz'))return
  'Para esse ambiente, o mais importante é privacidade, filtrar a luz ou escurecer?';
 return null;
}
export function quoteIntakePrompt(){
 return 'MATRIZ DE COLETA PARA PRÉ-ORÇAMENTO: somente cortinas e persianas. '+
  'A composição altera o preço, portanto NÃO crie estimativa com modelo indefinido. '+
  'Campos essenciais: produto, ambiente, modelo, largura e altura aproximadas; '+
  'cortina exige identificação de tecido frontal e indicação de necessidade de forro; '+
  'persiana exige finalidade de controle de luz e material/tecido quando aplicável. '+
  'Trilho/varão, acionamento, acabamento e instalação são condicionais ao modelo. '+
  'Se o cliente já informou algo, não pergunte novamente; mantenha os itens separados por ambiente. '+
  'Se não souber o modelo, ofereça escolha visual de estilos quando houver recurso homologado, '+
  'ou peça uma foto de referência, sem adivinhar o modelo. '+
  'Sem imagens oficiais aprovadas, não invente fotos ou disponibilidade. '+
  'Não invente preços, garantias, prazos, especificações ou compatibilidade; '+
  'ao surgir dúvida técnica, peça atendimento humano. '+
  'Ao completar a coleta, gere resumo estruturado e solicite conferência humana do orçamento.';
}
