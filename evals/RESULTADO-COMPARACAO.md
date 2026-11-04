# Avaliação comparativa da Kiara — 04/11/2026

## Execução realizada
- **Versão antiga:** prompt anterior ao refactor, preservado no commit `1b61c1fb6f296a3a55216e60697e61172d5d29bf`.
- **Versão candidata:** identidade consultiva + conhecimento de produto + política operacional na branch `homologacao`.
- **Cenários:** identificação, orientação teto/parede, retomada de preferência antiga, correção de pressuposto, dois ambientes, pedido rápido de preço, resumo pré-orçamento.
- **Infraestrutura:** workflow de comparação isolado criado em `.github/workflows/kiara-comparacao-consultiva.yml`, sem WhatsApp, sem Cloudflare e sem Supabase.
- **Tentativa executada:** GitHub Actions [41886275005](https://github.com/fabrikakriativa-apps/KIARA/actions/runs/41886275005).

## Resultado verificável
O job foi iniciado, mas **interrompido na verificação da credencial**, antes de gerar respostas. A variável protegida `OPENAI_API_KEY` não está disponível no repositório GitHub. Portanto **não existem respostas comparativas reais nem vencedor comprovado**. Não foram enviadas mensagens ou expostos segredos.

## Comparação estática (não é avaliação de qualidade do modelo)
| Critério | Prompt anterior | Estrutura candidata |
| --- | --- | --- |
| Identidade | Longo bloco INSTRUCTIONS, várias regras de tom e consultoria acrescentadas por incidente | Identidade central curta em `src/consultative-identity.js` |
| Conhecimento técnico | Parte no INSTRUCTIONS, parte em quote-intake e regras comerciais | Conhecimento base em `src/product-knowledge.js`; configurações comerciais continuam separadas |
| Operação | Instruções misturadas a políticas dinâmicas | Orientações operacionais em `src/operational-policy.js`; bloqueios reais seguem no código |
| Memória | Detalhamento extenso sobre escolhas antigas e confirmação | Princípio único de distinguir lembrança, possibilidade e escolha aprovada |
| Risco remanescente | Tom de formulário e concorrência de instruções | A qualidade das respostas é **não verificada** sem geração real |

## Evidências disponíveis
- A suíte automatizada de homologação passou na execução [41846348033](https://github.com/fabrikakriativa-apps/KIARA/actions/runs/41846348033).
- O código candidato não foi publicado no Worker de atendimento, preservando o número de testes.
- Cenários e critérios estão registrados em `evals/consultative-scenarios.json`.
- Um runner de avaliação com chamadas de modelo reais e salvamento de respostas foi criado em `evals/compare-live.mjs`.

## Critério de decisão
**Não aprovar a publicação ainda.** Reexecutar a comparação com acesso seguro a uma credencial de API de IA no ambiente de avaliação e avaliar as respostas em cada cenário. A ausência de credencial não pode ser substituída por um placar inventado, nem apenas por testes de presença de texto no prompt.

## Próxima ação restrita
Uma pessoa com permissão de administrar os secrets do repositório poderá disponibilizar uma credencial de avaliação no GitHub Actions, sem publicá-la no código nem no chat. A partir daí, executar o job isolado e revisar os resultados. Nenhum teste requer mudar a configuração EasyCoexistence nem reconfigurar o WhatsApp.
