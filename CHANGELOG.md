# Changelog

Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [1.1.1] - 2026-11-26

### Corrigido
- `POST /api/lead` não devolve mais 502 quando o telefone já existe em outro contato do Chatwoot (422): busca o contato por e-mail e, se não achar, por telefone, reutiliza o contact_id e abre nova conversa com os utm_*. Erros reais continuam 502.

Rollback: `git revert -m 1 <merge>` no main + Retry deployment do commit anterior.

## [1.1.0] - 2026-11-26

Publicado no Cloudflare Pages (projeto `dumentre`, branch `main`). Rollback: reverter o merge; commit anterior de `main` = `bbd2ca6`.

### Adicionado
- Formulário de lead no site (nome, WhatsApp, e-mail e interesse), com validação no navegador e no servidor.
- Captura de atribuição: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid`, `fbclid` e página de origem.
- Endpoint `POST /api/lead` (Cloudflare Pages Function) que cria contato e conversa no Chatwoot. O token de API fica só no servidor.
- Testes unitários (`npm run test:unit`) e E2E local com Chatwoot simulado (`npm run test:e2e:lead`).
- Documento de decisões e pendências: `docs/lead-site-chatwoot.md`.

### Corrigido
- Teste E2E de lead instável: o simulador do Chatwoot compartilhava estado entre projetos paralelos. O config de lead passou a usar um worker (`playwright.lead.config.ts`).

### Mantido
- Gerador de link wa.me com UTM (`src/utils/whatsapp.js`) sem alterações, com teste de regressão.

### Verificado
- E2E real contra o Chatwoot (conta 2, inbox 3): contato e conversa criados com etiqueta `lead-site-teste` e atributos `utm_*`, `gclid`, `fbclid`, `pagina_origem` (`docs/chatwoot-e2e-real-evidence.json`).
