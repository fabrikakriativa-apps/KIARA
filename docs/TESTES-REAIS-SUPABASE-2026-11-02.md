# Integração Supabase — validação real de autorização e pausa

Data: 02/11/2026. Projeto: SISTEMA (`dpowbyexrcdcwwqysgzp`).

## Verificações executadas com o conector Supabase

1. Confirmada a existência e compatibilidade dos campos utilizados em `kiara_conversations`, `kiara_messages`, `kiara_guidance` e `kiara_operational_control`.
2. Confirmadas funções reais `kiara_set_reply_hold`, `kiara_review_guidance` e `kiara_operator_action`. A função de pausa é `SECURITY DEFINER`, concede EXECUTE a `authenticated`, nega a `anon` e exige `auth.uid()` e vínculo de organização com papel admin/comercial.
3. Autorização simulada sob role PostgreSQL `authenticated`, usando usuário cadastrado na organização: uma conversa ficou visível e `private.has_org_role` retornou `true`.
4. Usuário autenticado sintético sem vínculo: zero conversas visíveis, `private.has_org_role` retornou `false`.
5. Em transação explícita encerrada por **ROLLBACK**, a função real `kiara_set_reply_hold` foi exercitada:
   - `hold=true`: `held=true`, `changed=true`
   - `hold=true` repetido: `held=true`, `changed=false`
   - `hold=false`: `held=false`, `changed=true`.
   - As três condições foram verificadas por asserções no SQL. Resultado: `hold-release-idempotence-ok`.
6. Consulta separada após rollback confirmou `reply_held=false` e `status=human`, preservando o estado inicial da conversa de teste.

**Atenção:** os testes de banco não utilizaram JWT real de navegador, a API HTTP do Worker nem credenciais reais do WhatsApp. O contexto de autenticação foi simulado com `SET LOCAL ROLE authenticated` e a claim de um usuário autorizado, apenas dentro da transação. Nenhuma mudança persistente foi aplicada a conversas.

## Testes já executados no GitHub

Os testes Node de fluxo supervisionado com mocks das integrações passaram (24/24), cobrindo segurar, orientar, liberar, bloqueio durante geração, retomada única e falhas de autorização.

## O que continua bloqueado

O Worker da homologação expõe apenas `/health` e responde 404 às demais rotas. Ele **não** pode gerar/envia mensagens reais, não possui queue consumer e não está vinculado ao WhatsApp. O Worker de produção permanece separado, sem alterações de deploy.

Próxima etapa de homologação: endpoint autenticado em ambiente de teste para validar JWT real, CORS, leitura e operação via HTTPS, com credenciais somente no Cloudflare, sem habilitar webhook ou fila. É necessário assegurar isolamento do contato de teste e validar a política de autorização da organização antes de liberar.
