import test from 'node:test';
import assert from 'node:assert/strict';
import {validateExtractedQualification,qualificationExtractionInstructions} from '../src/qualification-ai.js';
import {blankQualification,mergeQualification,evaluateCustomerQualification} from '../src/customer-qualification.js';

const item=(value,evidence)=>({value,evidence});
test('resposta Ana à pergunta anterior é interpretável por IA e validável pelo sistema',()=>{
 const conversation=[
  {role:'assistant',content:'Como posso te chamar?'},
  {role:'user',content:'Ana'}
 ];
 const data={firstName:item('Ana','Ana')};
 const accepted=validateExtractedQualification(data,conversation,blankQualification());
 assert.deepEqual(accepted,{firstName:'Ana'});
 assert.deepEqual(evaluateCustomerQualification(mergeQualification(blankQualification(),accepted)).missing,
 ['lastName','neighborhood','city']);
});
test('mensagem espontânea fornece os quatro dados de uma vez, sem ordem obrigatória',()=>{
 const history=[{role:'user',content:'Quero uma cortina. Sou Ana Silva, moro no bairro Cerâmica, em São Caetano do Sul.'}];
 const parsed={
  city:item('São Caetano do Sul','São Caetano do Sul'),
  neighborhood:item('Cerâmica','bairro Cerâmica'),
  lastName:item('Silva','Ana Silva'),
  firstName:item('Ana','Ana Silva')
 };
 const accepted=validateExtractedQualification(parsed,history,blankQualification());
 assert.equal(evaluateCustomerQualification(mergeQualification(blankQualification(),accepted)).qualified,true);
});
test('rejeita inferência a partir de texto da Kiara ou dado inventado',()=>{
 const history=[{role:'assistant',content:'Atendemos São Caetano do Sul.'},{role:'user',content:'Quero um orçamento'}];
 const malicious={city:item('São Caetano do Sul','São Caetano do Sul'),firstName:item('Paula','Paula')};
 assert.deepEqual(validateExtractedQualification(malicious,history,blankQualification()),{});
});
test('não altera identificação já confirmada e rejeita campos sem evidência',()=>{
 const history=[{role:'user',content:'Ana Silva'}];
 const candidate={firstName:item('Maria','Ana Silva'),lastName:item('Silva','Ana Silva'),city:item('Campinas','')};
 const accepted=validateExtractedQualification(candidate,history,{firstName:'Ana'});
 assert.deepEqual(accepted,{lastName:'Silva'});
});
test('instruções de extração não tratam perfil WhatsApp como prova',()=>{
 const p=qualificationExtractionInstructions();
 assert.match(p,/contexto/i);
 assert.match(p,/não deduza/i);
 assert.match(p,/evidence/i);
});
