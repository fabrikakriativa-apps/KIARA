# Kiara — painel independente

Aplicação React/Vite própria, alojada em `painel/` do repositório KIARA. **O Worker da Kiara permanece em `src/worker.js`**, com homologação e publicação geridas separadamente.

## Arquitetura

- Painel: front-end estático independente (sem navegação do SISTEMA).
- Login: OAuth Google com Supabase SISTEMA e verificação de `memberships`; apenas `admin`/`comercial`.
- Dados: mesmas tabelas `kiara_conversations`, `kiara_messages`, `kiara_guidance`. As políticas RLS continuam garantindo isolamento.
- Segurança: ações de produção continuam desabilitadas até homologação de ponta a ponta. Nunca mover chaves de serviço, API da Meta ou tokens do Cloudflare para o painel.
- Publicação inicial prevista: GitHub Pages `https://fabrikakriativa-apps.github.io/KIARA/`; domínio final opcional `kiara.fabrikakriativa.com.br` após validar DNS e OAuth.

## Desenvolver

```bash
cd painel
npm install
npm run build
npm run dev
```

Criar `.env.local` a partir de `.env.example` e preencher somente a chave **publicável** do Supabase.

## Estado

Este trabalho ocorre em `feat/painel-independente`, ainda não publicado. Os módulos internos secundários são telas reservadas, sem funcionalidade simulada. O painel principal é uma extração do SISTEMA e ainda requer revisão visual final e testes de login em navegador antes da publicação.
