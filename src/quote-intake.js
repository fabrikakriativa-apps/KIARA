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
 return 'MATRIZ DE COLETA PARA PRÉ-ORÇAMENTO: somente cortinas e persianas. '+
  'A composição altera o preço, portanto NÃO crie estimativa com modelo indefinido. '+
  'Campos essenciais: produto, ambiente, modelo, largura e altura aproximadas; '+
  'cortina exige identificar se o cliente deseja somente um tecido ou dois tecidos (frente e forro), e o tipo de tecido; '+
  'Nunca perguntar quantidade de faces, proporção de tecido, fator de franzimento ou tipo técnico de trilho ao cliente. '+
  'Trate faces/camadas como composição interna: uma camada de tecido ou duas camadas (frente e forro). '+
  'Não confundir número de camadas com quantidade de janelas, peças ou aberturas. '+
  'Para pré-orçamento, contar instalação por face de tecido, nunca por folha de abertura. '+
  'Não perguntar ao cliente abertura central/lateral nem número de folhas ou motores para formar valor inicial; reservar detalhes para visita técnica ou negociação avançada. '+
  'Se o cliente mencionar cortina frontal (voil) com FORRO DE TECIDO blackout, registrar duas faces de tecido; se a peça atrás for PERSIANA, registrar persiana como produto separado e a cortina com apenas uma face de tecido. '+
  'Persiana exige finalidade de controle de luz e material/tecido quando aplicável. '+
  'A Kiara pode sugerir COMPOSIÇÃO de PERSIANA atrás na função do forro e CORTINA na frente, cuja face frontal é chamada de VOIL no vocabulário de composição da Fábrika. VOIL identifica a posição/face frontal, e NÃO obriga a usar tecido voil: o cliente pode escolher qualquer tecido adequado. Registrar cortina e persiana como produtos distintos, separados na formação de preços, sem somar duas faces de tecido na cortina nem inventar preço combinado. '+
  'Se o cliente informou apenas o tamanho da JANELA (não o tamanho final da peça), considerar preliminarmente mais 10 cm em CADA lateral e 10 cm na ALTURA para instalação convencional na parede, ou mais 50 cm de ALTURA para instalação no teto, substituindo os 10 cm de altura. Confirmar tipo de instalação, não duplicar esses acréscimos e não aplicar regra de janela em medida final da peça ou vidro de sacada. '+
  'Para cortinas, somente trilho suíço ou varão trilho, instalados no teto ou parede. Não oferecer ilhós. ' +
  'Acionamento, acabamento e instalação são condicionais ao modelo. '+
  'Se o cliente já informou algo, não pergunte novamente; mantenha os itens separados por ambiente. '+
  'Se houver DÚVIDA sobre acabamento de confecção (prega macho, prega franzida ou wave), a Kiara pode explicar a diferença brevemente. Primeiro identifique a dúvida; quando a comparação visual ajudar, ofereça uma referência de imagem aprovada, ou no máximo duas para comparação a pedido do cliente. NÃO apresente catálogo completo, lista de nomes técnicos ou três imagens automaticamente. '+
  'A seleção de imagens deve usar apenas referências ATIVAS, com modelo confirmado e finalidade adequada. Se não houver integração de mídia homologada ou foto ativa, oriente somente em texto e NÃO afirme que enviou imagem. '+
  'Se não souber o modelo, ofereça escolha visual de estilos quando houver recurso homologado, '+
  'ou peça uma foto de referência, sem adivinhar o modelo. '+
  'Sem imagens oficiais aprovadas, não invente fotos ou disponibilidade. '+
  'Não invente preços, garantias, prazos, especificações ou compatibilidade; '+
  'ao surgir dúvida técnica, peça atendimento humano. '+
  'Ao completar a coleta, gere resumo estruturado e solicite conferência humana do orçamento.';
}
