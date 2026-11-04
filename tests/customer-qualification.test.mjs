import test from 'node:test';
import assert from 'node:assert/strict';
import {blankQualification,mergeQualification,evaluateCustomerQualification,extractQualification,qualificationQuestion,containsCommercialPrice} from '../src/customer-qualification.js';

test('primeiro nome é solicitado no início, sem depender do perfil WhatsApp',()=>{
  assert.match(qualificationQuestion(blankQualification(),{initial:true}),/Como posso te chamar/);
  assert.deepEqual(evaluateCustomerQualification(blankQualification()).missing,
    ['firstName','lastName','neighborhood','city']);
});
test('somente apresentação explícita ou resposta à pergunta define nome',()=>{
  assert.deepEqual(extractQualification('Olá, quero cortinas'),{});
  assert.deepEqual(extractQualification('João'),{});
  assert.equal(extractQualification('João',{expectingFirstName:true}).firstName,'João');
  assert.equal(extractQualification('Meu nome é Ana Beatriz').firstName,'Ana');
  assert.equal(extractQualification('Meu nome é Ana Beatriz').lastName,'Beatriz');
  assert.deepEqual(extractQualification('11965740213',{expectingFirstName:true}),{});
});
test('sobrenome isolado é obtido somente após pergunta específica',()=>{
  assert.equal(extractQualification('Silva',{expectingLastName:true}).lastName,'Silva');
  assert.equal(extractQualification('Silva').lastName,undefined);
});
test('bairro e cidade explícitos são reconhecidos sem presumir localização',()=>{
  const b=extractQualification('bairro Cerâmica, cidade São Caetano do Sul');
  assert.equal(b.neighborhood,'Cerâmica');
  assert.equal(b.city,'São Caetano do Sul');
  assert.deepEqual(extractQualification('Preciso de orçamento em tecido de linho'),{});
});
test('orçamento é proibido até preencher os quatro dados',()=>{
  let p=blankQualification();
  p=mergeQualification(p,{firstName:'Ana'});
  assert.equal(evaluateCustomerQualification(p).qualified,false);
  p=mergeQualification(p,{lastName:'Silva',neighborhood:'Cerâmica',city:'São Caetano do Sul'});
  assert.equal(evaluateCustomerQualification(p).qualified,true);
  assert.deepEqual(evaluateCustomerQualification(p).missing,[]);
});
test('detectar valores de orçamento antes do envio',()=>{
  assert.equal(containsCommercialPrice('A partir de R$ 1.100,00'),true);
  assert.equal(containsCommercialPrice('R$ 900'),true);
  assert.equal(containsCommercialPrice('Qual seu bairro?'),false);
});
