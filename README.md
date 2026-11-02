# Kiara — atendente digital da Fábrika Kriativa

Este repositório mantém o código do Cloudflare Worker que integra WhatsApp Business, EasyCoexistence, fila de respostas, memória KV e o Supabase do SISTEMA.

## Estado

- **`main`**: branch reservada à produção; ainda NÃO contém código implantável.
- **`homologacao`**: versão candidata completa em `src/worker.js`, sem tokens.
- **GitHub Actions**: valida sintaxe e seis cenários automatizados, **não publica no Cloudflare**.
- **Cloudflare**: manter **Disable builds** ATIVO até revisão e homologação.
- O Worker em uso no WhatsApp **não foi atualizado por este repositório**.

## Código e validações

- `src/worker.js`: evolução do Worker apresentado em 02/11/2026, com leitura de orientações privadas, bloqueio por conversa e liberação idempotente.
- `tests/coaching.test.mjs`: seis testes isolados sem chamadas reais à Meta, OpenAI ou Supabase.
- `.github/workflows/validate.yml`: testes sem permissões de publicação.
- `wrangler.example.toml`: **apenas exemplo**, não contém os bindings reais e não deve ser utilizado para deploy.

Execução local, com Node 22 ou superior:

```sh
npm test
node --check src/worker.js
```

## Proteção de produção

O Worker atual usa integração com Meta/EasyCoexistence, KV `CONVERSAS`, fila `kiara-respostas`, `KIARA_QUEUE` e variáveis protegidas. As configurações exatas precisam ser confirmadas no painel do Cloudflare antes de ativar publicação automática. Não criar um `wrangler.toml` com bindings presumidos.

A arquitetura separa as funções:

- **Atendimento automático**: fila com atraso de 15 segundos, hoje restrita ao `TEST_ALLOWED_WA_ID`.
- **Controle humano**: pausa manual via eventos `smb_message_echoes`.
- **Orientação interna**: `KIARA_GUIDANCE_ENABLED`, desligada na ausência da flag; somente orientações aprovadas ou específicas da conversa.
- **Segurar resposta**: `KIARA_HOLD_ENABLED`, desligada na ausência da flag; antes da geração e do envio confere `reply_held`.
- **Controles gerais**: `KIARA_CONTROL_ENABLED`, independente e desabilitado até homologação.

## Antes da ativação

1. Confirmar o backup integral do Worker publicado e comparar versão/variáveis/bindings.
2. Configurar homologação isolada ou outra estratégia de teste sem produção.
3. Confirmar acesso ao banco SISTEMA, políticas RLS e URL autenticada `/kiara/coach`.
4. Testar pausas durante geração, repetição de liberação, eventos humanos e falhas de conexão.
5. Configurar `VITE_KIARA_COACH_URL` para o SISTEMA de teste.
6. Validar o risco residual de concorrência entre a verificação final e a chamada de envio da Meta antes de permitir contatos reais.
7. Só então definir processo de merge e deploy aprovado, com rollback.

**Nunca versionar secrets, chaves da Meta, OpenAI, Supabase ou EasyCoexistence.**
