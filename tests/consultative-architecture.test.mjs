import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CONSULTATIVE_IDENTITY} from '../src/consultative-identity.js';
import {PRODUCT_KNOWLEDGE} from '../src/product-knowledge.js';
import {OPERATIONAL_POLICY} from '../src/operational-policy.js';

const suite=JSON.parse(readFileSync(new URL('../evals/consultative-scenarios.json',import.meta.url),'utf8'));
test('todos os cenários consultivos possuem contexto e critérios sem resposta fixa',()=>{
  assert.equal(suite.cases.length,7);
  for(const scenario of suite.cases){
    assert.ok(scenario.id&&scenario.history.length&&scenario.expected&&scenario.bad.length);
    assert.ok(scenario.history.some(([role])=>role==='user'));
  }
});
test('identidade, conhecimento e limites são independentes',()=>{
  assert.match(CONSULTATIVE_IDENTITY,/compreender cada pessoa/);
  assert.match(PRODUCT_KNOWLEDGE,/cortinas e persianas/);
  assert.match(OPERATIONAL_POLICY,/não substituem os validadores|sem autorização/i);
  assert.doesNotMatch(CONSULTATIVE_IDENTITY,/R\$\s*\d/);
  assert.doesNotMatch(PRODUCT_KNOWLEDGE,/\b[Aa]ssuma\b|\b[Pp]ause\b/);
});
test('cobertura dos erros observados',()=>{
  const ids=new Set(suite.cases.map(x=>x.id));
  for(const id of ['identificacao','teto-ou-parede','opcao-anterior','corrigir-suposicao','dois-ambientes','preco-rapido','resumo-pre-orcamento'])
    assert.ok(ids.has(id),id);
  assert.match(CONSULTATIVE_IDENTITY,/escolha expressamente confirmada/);
  assert.match(CONSULTATIVE_IDENTITY,/Registre silenciosamente/);
  assert.match(CONSULTATIVE_IDENTITY,/recapitule uma única vez/);
});
