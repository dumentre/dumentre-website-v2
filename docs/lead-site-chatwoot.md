# Lead do site no Chatwoot — decisões e verificação

Change OpenSpec: `openspec/changes/lead-site-chatwoot/`. Este documento registra as decisões de arquitetura, as fontes consultadas e o que ainda não foi verificado.

## Hosting

- **Atual:** Cloudflare Pages, projeto `dumentre.pages.dev` (já referenciado em `tests/e2e/production.spec.ts` e em `docs/testing/README.md`). Build command `npm run build`, output `dist`.
- **Sem custo novo:** Pages Functions rodam no plano gratuito do próprio Pages. Nenhum serviço pago foi adicionado.
- **Layout:** a pasta `functions/` fica na raiz do repositório, irmã do `dist/` (não dentro dela). Fonte: busca em `developers.cloudflare.com/pages/functions/` (resumo de páginas de routing e wrangler-configuration, consultado em 2026-11-25). **Não verificado no deploy real.**

## Chatwoot: API e canal

Fontes lidas em 2026-11-25 (documentação pública em `developers.chatwoot.com/api-reference`):

- `contacts/create-contact`: `POST /api/v1/accounts/{account_id}/contacts`, `inbox_id` obrigatório; aceita `name`, `email`, `phone_number`, `custom_attributes`. Resposta traz `contact_inboxes[].source_id`. O schema da documentação coloca os campos sob `payload`, então o código aceita as duas formas.
- `conversations/create-new-conversation`: `POST /api/v1/accounts/{account_id}/conversations`, `source_id` obrigatório, além de `inbox_id`, `contact_id`, `custom_attributes`.
- `contacts/show-contact`: `GET /api/v1/accounts/{account_id}/contacts/{id}`, retorna `custom_attributes`. (`get-contact` retornou 404.)
- Autenticação: header `api_access_token` (marcado como legado na documentação) ou `Authorization: Bearer`. O código usa `api_access_token`. **Validar na instância real.**
- API pública (`/public/api/v1/inboxes/{inbox_identifier}/contacts`): não exige token, mas aceita qualquer pessoa na internet. Não foi usada.

### Decisão: proxy server-side, sem token no navegador

O formulário envia JSON para `POST /api/lead` (`functions/api/lead.js`). Só o servidor fala com o Chatwoot, usando `CHATWOOT_API_TOKEN` definido como segredo no painel do Pages. Motivos:

1. O token privado nunca vai ao cliente, a log ou a resposta (há testes que verificam isso).
2. A API pública não tem autenticação, então qualquer bot poderia criar leads.
3. A verificação E2E exige um GET autenticado, que só faz sentido com o token da API.

### Variáveis de ambiente (nomes apenas; valores ficam no painel, nunca no repo)

| Variável | Conteúdo |
|---|---|
| `CHATWOOT_BASE_URL` | URL https da instância (http só em loopback, para o simulador local) |
| `CHATWOOT_ACCOUNT_ID` | id numérico da conta |
| `CHATWOOT_INBOX_ID` | id numérico da caixa de API |
| `CHATWOOT_API_TOKEN` | token de acesso da API (segredo) |

Sem essas variáveis válidas, o endpoint responde 503 sem revelar nomes nem valores.

## Regras de entrada

Validação compartilhada em `src/utils/lead.js` (navegador e servidor). Resumo:

- Nome: 2 a 80 caracteres, só letras, espaço, apóstrofo, hífen e ponto.
- WhatsApp: DDD + número, normalizado para `+55DDNNNNNNNNN`.
- E-mail: até 120 caracteres, formato validado, em minúsculas.
- Interesse: uma das opções da lista (`LEAD_INTERESTS`).
- Atribuição: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid`, `fbclid`, `pagina_origem`. Sem `<` nem `>`, controle removido, máximo 200 caracteres.
- Corpo: máximo 8 KB, `content-type` JSON obrigatório.
- Honeypot: campo `website` oculto. Se preenchido, o servidor responde como sucesso e não envia nada.
- Duplicado: se o e-mail já existe (422), reaproveita o contato, atualiza os atributos e cria uma nova conversa.

## Atribuição

`captureAttribution` (em `src/lead-form.js`) lê a URL no carregamento. Se houver qualquer parâmetro de campanha, ele substitui a atribuição guardada e registra a página atual como `pagina_origem`. Caso contrário, mantém a atribuição da sessão. Fica em `sessionStorage`, e nenhum dado pessoal é gravado nele.

## Gerador wa.me

`src/utils/whatsapp.js` e `test/whatsapp-utm.test.js` não foram alterados. O teste de regressão passa.

## Comandos e resultados (2026-11-25)

| Comando | Resultado |
|---|---|
| `npm run test:unit` | 32/32 passam (validação, função, atribuição, URL do Chatwoot e regressão wa.me) |
| `npm run build` | OK, 14 arquivos copiados (inclui `src/lead-form.js` e `src/utils/lead.js`) |
| `npm run test:e2e:lead` (desktop Chromium) | 7/7 passam |
| `npx playwright test -c playwright.lead.config.ts --project=webkit-mobile` | 7/7 passam |
| `npm run test:e2e` (suíte existente) | 108 passam, 24 skipped (os skips são de projeto: desktop-only e mobile-only, já existiam) |
| `openspec validate lead-site-chatwoot --strict` | válido |
| `gitleaks dir` nos arquivos alterados | nenhum vazamento |

Antes de implementar, os testes de unidade foram executados e falharam por módulos inexistentes (fase vermelha do TDD).

### Correção de flakiness do E2E de lead (2026-11-25)

Sintoma: `npm run test:e2e:lead` falhou em 1 de 2 rodadas, com o teste de falha de integração recebendo sucesso no Chromium. Em outra rodada, falhou o teste de "mesmo e-mail" no WebKit.

Causa: o simulador do Chatwoot é um único processo com estado compartilhado (contatos, conversas, `fail-next`, `reset`). Com dois projetos em workers paralelos, a falha armada por um teste era consumida pelo envio do outro projeto, e o `reset` do `beforeEach` apagava dados em uso.

Correção: `workers: 1` em `playwright.lead.config.ts` (backup `playwright.lead.config.ts.bak-20261125-2355`). Isolar o estado do simulador por projeto preservaria a paralelização e fica como pendência.

| Comando | Resultado |
|---|---|
| `npm run test:e2e:lead` (5 rodadas) | 14/14 em cada rodada (7 Chromium + 7 WebKit) |
| `npm run test:unit` (3 rodadas) | 32/32 em cada rodada |

## Cenários da change: situação

| Cenário | Situação |
|---|---|
| Lead válido com atribuição | Verificado no Chatwoot **simulado** (E2E local). Integração real: **pendente** |
| Entrada inválida | Verificado (unit + E2E): erro por campo, nada enviado |
| Falha de integração | Verificado (unit + E2E): mensagem de falha, sem sucesso, sem token |
| Link existente (wa.me) | Verificado (unit de regressão + suíte E2E existente) |
| Site publicado (HTTP 200 + Playwright + GET autenticado no Chatwoot real) | **Pendente**: depende de deploy e de autorização |

## Pendências (não executadas, com motivo)

- **Integração real com o Chatwoot:** precisa das variáveis `CHATWOOT_*` configuradas no painel do Pages pelo Luan. Não li nem obtive nenhum segredo.
- **Chaves de atributos:** não confirmei se a conta aceita as chaves `utm_*`, `gclid`, `fbclid`, `pagina_origem` e `interesse` como atributos personalizados. Se não aceitar, a criação falha com 422 e vira 502. Validar antes do deploy.
- **Deploy e publicação:** não executados (exigem autorização separada).
- **Push, PR e merge:** não executados.
- **Teste real que escreve em produção:** não executado.
- **KB do ecossistema (`dumentre-knowledge-base`):** não atualizada, porque a instrução limita o trabalho a este repositório.
- **Política de privacidade:** o formulário envia nome, WhatsApp e e-mail para o Chatwoot. O texto da política (`docs/backlog/politica-privacidade.md`) precisa citar isso antes de publicar.
- **Rollback:** reverter o commit. Não há migração de banco. Leads já criados no Chatwoot não são apagados.
