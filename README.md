# Kiara — Fábrika Kriativa

Código da atendente digital para WhatsApp Business.

**Produção protegida:** o Worker de produção `fabrika-atendimento-ia` não deve ser substituído pelo conteúdo deste repositório sem backup e homologação.

A branch `main` é apenas um ponto de partida, **não contém configuração de deploy nem Worker pronto para publicar**. O desenvolvimento inicial fica na branch `homologacao`.

Antes de habilitar Builds no Cloudflare, comparar o código do Worker publicado com o candidato, revisar bindings (KV, Queue), rotas, secrets e configurar branch de produção/ambiente de homologação.

Nunca incluir chaves e tokens no GitHub.
