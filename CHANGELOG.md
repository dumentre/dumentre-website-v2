# Changelog

Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não lançado]

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

### Pendente
- Integração real com o Chatwoot, configuração das variáveis `CHATWOOT_*` no Pages e deploy (aguardam autorização).
