# Implantação controlada da Kiara — checklist operacional

**Status em 02/11/2026:** código e testes na branch `homologacao`; nenhuma implantação do novo Worker foi executada. O Worker de produção `fabrika-atendimento-ia` permanece intocado pelo GitHub. O usuário informou que ativou **Disable builds** na integração nativa Cloudflare/GitHub.

## 1. Evitar publicação acidental

- Mantenha **Disable builds** ativado no Worker de produção.
- Não configure a branch `homologacao` como branch de produção.
- Não execute `npx wrangler deploy` com o nome `fabrika-atendimento-ia`.
- `main` permanece sem arquivo de configuração implantável. Na branch de testes, `wrangler.example.toml` é um modelo incompleto e não deve ser publicado.
- Não misture os bindings com o CRM antigo.

## 2. Requisitos para Worker isolado

Criar um Worker independente com nome **`fabrika-atendimento-ia-homologacao`**, sem rotas de produção e sem alterar as URLs de webhook da Meta e da EasyCoexistence.

Conferir e usar **bindings próprios de homologação**:
- KV `CONVERSAS`: namespace de teste, não o namespace da produção.
- Queue `KIARA_QUEUE`: fila de teste, não `kiara-respostas`.
- Consumer da Queue de teste: somente o Worker de homologação; confirmar `max_batch_size`, retries e DLQ antes de testar.
- `SUPABASE_URL`: projeto SISTEMA autorizado. Usar somente a empresa/contato de teste e conferir regras de acesso. Preferir banco de staging quando disponível.
- `TEST_ALLOWED_WA_ID`: somente o telefone de teste. Não ativar `KIARA_SYNC_ALL_CONTACTS`.
- `META_PHONE_NUMBER_ID` e `EASY_PHONE_NUMBER_ID`: não cadastrar webhook da produção no Worker de teste.
- `KIARA_HOLD_ENABLED`, `KIARA_GUIDANCE_ENABLED`, `KIARA_CONTROL_ENABLED`: manter desligados antes de garantir endpoints seguros e credenciais.

**Nenhum segredo fica no repositório.** O acesso ao Supabase com service role, chaves da Meta, OpenAI e EasyCoexistence precisam ser configurados pelo gerenciador de segredos do Cloudflare.

## 3. Testes antes da publicação

1. `npm test`: testes simulados, sem redes externas.
2. `node --check src/worker.js`: sintaxe.
3. Validar `GET /` no Worker de homologação, sem conectar webhook comercial.
4. Testar autenticação de `/kiara/coach` com token inválido, outro usuário e usuário autorizado.
5. Testar hold antes da geração e durante geração; uma nova mensagem enviada enquanto está retido.
6. Testar liberação única e duplicada; no último caso, apenas um enfileiramento.
7. Testar intervenção humana via `smb_message_echoes` com a rota real de teste.
8. Confirmar que nenhum token ou orientação interna aparece no WhatsApp.
9. Confirmar tempo de resposta, preservação dos dois itens e histórico completo.
10. Registrar versão original/rollback antes de qualquer promoção à produção.

## 4. Limite conhecido

A verificação final `reply_held` e a chamada Meta não são atômicas. Uma pausa disparada exatamente após a verificação pode não cancelar o envio já iniciado. Para garantia estrita, serializar a autorização e o envio por contato (por exemplo, Durable Objects).

## 5. Bloqueio operacional atual

Não há conexão de administração de Workers/Builds do Cloudflare nas ferramentas disponíveis nesta conversa. Não é possível confirmar nem modificar pela API os bindings, secrets, build settings ou a implantação real. O GitHub está acessível, mas **um commit validado não comprova implantação no Cloudflare**.

O próximo passo de implantação exige acesso autorizado de Cloudflare (integração) ou execução pelo usuário no console do Cloudflare. Até isso ocorrer, mantenha o Worker atual e a opção **Disable builds** intactos.
