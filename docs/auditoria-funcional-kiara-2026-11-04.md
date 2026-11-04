# Kiara — auditoria funcional e plano de conclusão
Data: 04/11/2026. Escopo: branch `homologacao`, Worker `fabrika-atendimento-ia` limitado ao único contato WhatsApp de testes autorizado. Não habilitar clientes reais nesta fase.

## Critérios
- **Ativo:** fluxo já habilitado no Worker e evidenciado por execução.
- **Implementado parcialmente:** existem módulos, dados ou endpoints, mas sem fluxo integrado e homologado.
- **Pendente:** recurso não encontrado em operação na infraestrutura auditada.
- Um teste de código aprovado não prova entrega de uma mensagem no aplicativo WhatsApp; distinguir os dois.

## Evidências
- Worker exige `TEST_ALLOWED_WA_ID`, e o workflow de publicação valida o identificador Business e a restrição de contato.
- Supabase: 22 referências de mídia ativas; 22 arquivos correspondentes em `storage.objects`, nenhum ausente.
- Suite de regressão das imagens e mídia aprovada na branch `homologacao`.
- Auditoria de bindings Cloudflare: `KIARA_GUIDANCE_ENABLED=true`, `KIARA_SYNC_ENABLED=true`, `KIARA_CUSTOMER_QUALIFICATION_ENABLED=true`, `KIARA_CONTROL_ENABLED=false`, `KIARA_SYNC_ALL_CONTACTS=false`. Antes da mudança atual, `KIARA_MEDIA_ENABLED` não estava presente.
- `kiara_budget_drafts`: 0 registros; `kiara_pricing_rules`: 0; `kiara_commercial_config`: 1 registro, situação **draft**; `kiara_knowledge_documents`: 1, situação **draft**; `kiara_learning_observations`: 0; `kiara_lab_runs`: 3; `kiara_lab_proposals`: 2.
- Flags desativadas/não presentes antes da auditoria: `KIARA_AUDIO_MODE`, `KIARA_HOLD_ENABLED`, `KIARA_HUMAN_SEND_ENABLED`, `KIARA_ADS_ROUTING_ENABLED`, `KIARA_QUOTE_SIMULATION_ENABLED`, `KIARA_COMMERCIAL_GUIDANCE_ENABLED`. Não confundir presença do código com disponibilidade operacional.

## Quadro de implementação

| Recurso previsto | Situação verificada | Próximo trabalho |
| --- | --- | --- |
| WhatsApp Business coexistente, conversa com IA | Ativo em contato autorizado de testes | Teste de continuidade e posterior liberação controlada |
| Estilo consultivo e histórico | Ativo em testes; sujeito a validação qualitativa | Acompanhar diálogos e evitar reforçar scripts rígidos |
| Orientações aprovadas do painel | Ativo (consulta Supabase por atendimento) | Validar novas instruções no próximo turno |
| Biblioteca de imagens | Integrada e habilitada para teste; envio real pela Meta ainda depende de teste prático | Enviar solicitação explícita de foto no contato autorizado; verificar no histórico |
| Gerenciamento de imagens e arquivos privados | 22 referências ativas e objetos presentes | Validar tipos e conteúdo das fotos em WhatsApp |
| Identificação antes de preços | Regra no código e recurso ativado | Validar registro em CRM e bloqueio de preços em ponta a ponta |
| Pré-orçamento com calculadora por categorias comerciais | Parcial: motor de simulação e matriz técnica existem; envio automático via diálogo não comprovado; nenhuma regra em `kiara_pricing_rules` | Aprovar configuração comercial e vincular calculadora ao diálogo com revisão humana |
| Configuração comercial alterável no painel | Parcial: 1 configuração de cortina em draft, consumo aprovado desativado | Validar versões, aprovação e leitura antes de ativar |
| Resumo por ambiente antes do orçamento | Orientação de linguagem existente; rascunhos estruturados 0 | Persistência estruturada e revisão de orçamento |
| Controles Assumir, Pausar, Devolver e Responder | Código/endpoint e tabelas presentes; controles operacionais reais desligados | Homologar pausa e retomada KV/DB, autorizações e envio humano |
| Atendimento por áudio | Código de transcrição e triagem presente, modo desativado | Teste de áudio isolado e políticas de falha |
| Horários de atendimento e transferência fora de expediente | Sem aplicação comprovada no Worker auditado | Implementar/sincronizar regras de horário e fallback |
| Follow-up automático de leads | Nenhum mecanismo de acompanhamento de leads encontrado no Worker auditado | Definir elegibilidade e janela de 24h, limite de tentativas, opt-out e autorização Meta |
| Integração CRM / funil de Prospecção | Sincronização de conversas ativa; vínculo e movimentação de oportunidades não comprovados ponta a ponta | Teste de criação/atualização e mudança de etapa |
| Identificação e segmentação de campanhas | Colunas de origem/campanha presentes, roteamento de anúncios desativado | Validar referência Meta e campanha só quando fornecida |
| Aprendizado supervisionado | Estrutura existente; 0 observações de aprendizagem | Testar captura de correções humanas, aprovação e reaplicação |
| Laboratório multiagente | 3 execuções e 2 propostas; rotina diária habilitada no banco | Avaliar qualidade, aprovação e limites; não autorizar autoalterações |
| Base integral de conhecimento | Documento versão 2.0 cadastrado como draft; orientações pontuais aprovadas chegam à IA | Revisão editorial e aprovação antes de usar como fonte operacional |
| Painel com indicadores de tempo, origem e cliques sem resposta | Dados parciais no banco; apresentação e cálculos não homologados nesta auditoria | Homologação da interface com eventos reais |

## Prioridade recomendada
1. Teste de WhatsApp com solicitação visual explícita, validação de 1–2 imagens aprovadas e intervenção humana.
2. Painel operacional com Assumir/Pausar/Devolver/Responder + consistência KV/DB.
3. Integração da precificação aprovada e resumo estruturado com revisão humana.
4. Regras de horário, campanha e acompanhamento de leads.
5. Áudio, aprendizado supervisionado, base de conhecimento e indicadores.

## Regras de segurança preservadas
Não enviar para contatos externos, não alterar EasyCoexistence, não liberar `KIARA_CONTROL_ENABLED` sem homologação, não inventar preço, não expor tokens, não aprovar automaticamente dados comerciais em draft, não atribuir capacidade de envio de fotos ao WhatsApp sem observação do recebimento real.
