## Progresso implementado em 10/11/2026 — ainda SEM produção

**Concluído no código e Supabase (não equivale a deploy em produção):**
- Migration `kiara_new_contacts_activation_gate_off_by_default`: `kiara_activation_control`, `kiara_contact_eligibility` e RPC `kiara_is_new_contact_eligible`. `enabled=false`, `activated_at=null`, `legacy_snapshot_verified=false`.
- Migration `kiara_block_preexisting_crm_phone_numbers`: o RPC bloqueia também telefones preexistentes em `sales_opportunities`, além do cadastro `kiara_imported_contacts` e conversas anteriores ao corte.
- Migration `kiara_atomic_auto_reply_claims_fail_closed`: tabela `kiara_auto_reply_claims`, com `claim` atômico e `mark sent`. Falha ou resultado ambíguo NÃO autoriza reenvio automático; operador deve investigar claims pendentes.
- Worker com `KIARA_NEW_CONTACTS_ENABLED=true` **somente** se `KIARA_SYNC_ALL_CONTACTS=true` e sem `KIARA_STAGING_LIVE_ENABLED=true`. A produção deve configurar essas flags apenas após validação.
- Ingress de mensagens consulta elegibilidade antes de sincronizar/enfileirar; filas e rota do painel limitadas a contatos inscritos; bloqueio operacional, status humano e janela de 24h verificados antes do envio.
- Claims aplicados a respostas de texto, qualificação e fallback; áudio e imagem em modo multicontato transferem ao humano enquanto não forem homologados os envios automáticos.
- Mensagens antigas `history`/`smb_app_state_sync` permanecem ignoradas, comando `reiniciar teste` inativo no modo multicontato, limite de webhook 256 KiB.
- Cidades fora ABC Paulista/Grande São Paulo são encaminhadas ao humano para validar área de atendimento.
- Testes de segurança adicionados em `tests/new-contact-gate.test.mjs`. A sintaxe do Worker passou por validação local de parse e verificações simuladas fail-closed.
- `staging/wrangler.toml` contém `KIARA_NEW_CONTACTS_ENABLED = "false"`; produção não foi alterada.

**Ainda bloqueia GO (dependência externa/operacional):**
1. Obter lista completa de números já atendidos no WhatsApp antes do corte (somente identificadores de exclusão, sem importar mensagens), validar a cobertura e preencher o bloqueio de contatos antigos. O CRM identificado contém apenas parte dos telefones, não equivale ao histórico do WhatsApp. NÃO marcar `legacy_snapshot_verified=true` antes disso.
2. Conferir credenciais, bindings, filas, consumidores e webhook no Cloudflare/EasyCoexistence, com evidência de SHA implantado, e garantir um único ingressor ativo.
3. Executar o `npm test` completo em CI, obter evidência de deploy e testar E2E com novos e antigos contatos, intervenção humana durante geração, duplicidade/retry, limites de payload, orçamento e rollback.
4. Validar corrida restante: uma pausa humana ocorrida depois do último check e antes da API Meta não é atomicamente serializada. Para garantia forte, serializar por contato e envio.
5. Aprovar regras comerciais atualmente em `draft` (cortina e persiana) antes de qualquer orçamento externo; manter revisão humana e envio condicionado.
6. Definir responsável por monitorar claims presos em `claimed` sem `sent_at`, fila, alertas e respostas silenciosas antes de permitir operação 24/7.

**Operação de ativação:** Não mudar `main`, webhook, Worker de produção, `kiara_operational_control.enabled`, `kiara_activation_control.enabled` nem `activated_at` nesta fase. A troca deve ocorrer em janela assistida, com deploy comprovado e rollback pré-testado.

---
# Auditoria de segurança e plano de ativação — 10/11/2026

Escopo: preparar a Kiara para TODOS os **novos contatos** de WhatsApp, sem redirecionar webhooks ou mudar produção nesta auditoria.

## Resultado: NÃO LIBERAR PRODUÇÃO AINDA

### Evidências verificadas
- Worker isolado `fabrika-atendimento-ia-homologacao` respondeu `status:ok`, `external_integrations:test_only` (isso não prova o SHA publicado).
- `staging/wrangler.toml` mantém `KIARA_SYNC_ALL_CONTACTS=false`, com filas e KV próprios. `KIARA_HUMAN_SEND_ENABLED=false`.
- `kiara_operational_control.enabled=false` na organização (consulta 10/11).
- `kiara_commercial_config`: cortina revisão 4 e persiana revisão 2, ambas `draft`; nenhum conjunto aprovado observado.
- `kiara_budget_drafts`: 2 registros `rejected`, nenhum draft pendente/aprovado no momento da consulta.
- Branches divergentes: `homologacao` 413 commits à frente e 112 atrás de `main` na consulta. Não mesclar ou publicar por substituição automática.
- `routeBySource()` usa `TEST_ALLOWED_WA_ID` como `route.allowed`; `receiveMessage()` e `consumeMessage()` exigem igualdade do remetente com este único número. Alterar apenas `KIARA_SYNC_ALL_CONTACTS` não habilita atendimento multi-contato.
- Meta original valida `x-hub-signature-256`; EasyCoexistence aceita a chave de URL, sem assinatura HMAC do provedor. Exigir mitigação específica e verificação de controle do endpoint.
- Eventos `history` e `smb_app_state_sync` são ignorados; não há importação retroativa deliberada. Falta comprovante de política de corte por data/contato e de dupla execução no recebimento de mensagens.
- O código registra mensagens com `on_conflict=organization_id,whatsapp_message_id` e chaves KV de deduplicação, mas duplicidade entre Workers, retries, concorrência e crash recovery requer teste real.
- Há observação explícita em `docs/IMPLANTACAO_CONTROLADA.md`: `reply_held` e envio Meta não são atômicos (corrida em pausa/assumir).
- Controle humano e regras de horário existem, mas o comportamento real de pausar/assumir/devolver/responder exige evidência E2E antes da abertura.

## Bloqueadores P0 (todos obrigatórios)
1. **Separar roteamento de homologação e produção**: um ingressor ativo por `phone_number_id`, registro do destino atual, rollback do endpoint antigo, nenhuma escrita no Worker legado durante ativação. Confirmar credenciais e bindings por API ou console, sem copiá-los para GitHub.
2. **Criar gate de ativação com corte temporal**: `enabled=false` por padrão; aceitar somente `messages` originadas APÓS `activated_at` para conversas cuja primeira mensagem elegível também é posterior ao corte. Persistir elegibilidade por contato + número/organização, não reativar conversas existentes por histórico/echo/retry. Testar duplicidade e diferenças de timestamp. Contatos antigos devem ser atendidos por humanos até decisão comercial explícita.
3. **Suportar múltiplos novos contatos com isolamento**: substituir validação por único número por autorização por rota, organização, número de negócio e elegibilidade; consultar `status=ai`, `reply_held=false`, pausa KV/DB, controle global, bloqueio por contato e horário/janela 24h antes de TODOS os envios (inclusive saudação, imagens, orçamento e áudios).
4. **Idempotência e exclusividade de consumo**: webhook autenticado, IDs de mensagem únicos, uma fila consumer ativo por envio, um envio por mensagem/estado; testar reentrega de eventos, duas mensagens rápidas, takeover humano na geração, callback duplicado e queda entre envio e persistência. Adicionar DLQ e alerta para falhas prolongadas.
5. **Webhook EasyCoexistence**: não inferir assinatura HMAC; usar chave secreta forte na URL, proteção de rede possível, rotação de segredo, limitação/rate limit, validação estrita de `phone_number_id`, formato/tamanho de payload, origem e observabilidade. Não divulgar a URL com segredo em logs e relatórios.
6. **Bloqueios comerciais e privacidade**: não enviar preços antes do cadastro mínimo e revisão humana; configurações comerciais draft não aprovadas não viram oferta ativa; nenhum acesso de cliente a service role. Auditar RLS/permissões do painel e retenção/consentimento/dados pessoais conforme LGPD.
7. **Controle humano real**: verificar Assumir/Pausar/Devolver/Responder e a corrida entre verificação de hold e envio, com teste de interrupção durante geração. Garantir tomada humana sem resposta tardia; se atomicidade estrita, serializar por contato (ex.: Durable Object).
8. **Congelar versão e rollback**: escolher commit candidato da homologação, testes automáticos verdes, cotejar configuração e dependências com branch de produção divergente, registrar SHA/deployments antes/depois, preservar pacote anterior e voltar por comando reversível. Não fazer merge cego `main` ↔ `homologacao`.

## Preparação P1
- Cenários de suporte, assistência, reforma, papel de parede e cabeceiras: transferência assistida se faltarem dados aprovados; horários e expectativa de retorno corretos.
- Testes de imagem/áudio (e fallbacks), referências aprovadas sem vazamento de instruções internas.
- Painel CRM: sem importação de histórico, sem lead duplicado, funil e alertas para conversa abandonada; separar contato novo de contato antigo.
- Medir entregabilidade, latência, filas, erros, takeover, repetição, preço indevido e feedback humano; limites e alertas.

## Ordem de ativação (não executada)
1. Estabilizar branch `release` a partir de versão testada, sem merge automático; inventariar secrets, rotas, bindings, filas e versão exata publicada; backup/rollback.
2. Implementar P0 e executar suíte de regressão local/CI, testes adversariais e provas reais no número de teste.
3. Simular vários contatos artificiais autorizados em ambiente separado; validar primeiros contatos novos versus históricos, reentrega, corrida humano/IA, preços não aprovados, mídia, horário e falhas externas.
4. Validar painel completo e critérios de aprovação com equipe; registrar dono de suporte e forma de desligamento emergencial.
5. Implantar versão com **gate desligado**, sem mudar webhook. Testar saúde, acesso, vínculos e logs.
6. Em janela acompanhada, alternar webhook para **um ingressor** somente depois de confirmar rollback, ligar gate apenas para mensagens elegíveis APÓS o corte e monitorar ativamente.
7. Se ocorrer resposta duplicada, resposta em conversa antiga, preço sem aprovação, entrega ao número errado ou tomada humana ignorada: desligar gate, restaurar rota, drenar/inspecionar fila e impedir replay.
8. Após 24–48h de estabilidade observada, decidir se mantém cobertura total dos novos contatos e expandir funções gradualmente.

## Critério de GO/NO-GO
**GO somente se**: gate temporal e multi-contato cobertos por testes, rotas reais verificadas, controles humanos E2E comprovados, 0 resposta a contato anterior ao corte, 0 preço não aprovado, 0 resposta duplicada em simulações de retry, logging e rollback exercitados, um único consumidor ativo, equipe disponível.
**NO-GO** se qualquer P0 faltar ou houver dúvida sobre roteamento/versão publicada.
