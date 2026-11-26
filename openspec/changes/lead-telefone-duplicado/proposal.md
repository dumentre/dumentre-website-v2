# Lead com telefone duplicado não pode virar 502

## Plano
Hoje `createLeadInChatwoot` (functions/api/lead.js) trata 422 do POST /contacts só buscando o contato por e-mail. Se o 422 for por telefone já cadastrado em OUTRO contato (e-mail diferente), a busca por e-mail não acha nada, lança ChatwootError 422 e o endpoint devolve 502: lead perdido. Correção: no 422, buscar o contato existente por e-mail e, se não achar, por telefone (GET contacts/search?q=<telefone>, comparando phone_number normalizado); reutilizar contact_id, atualizar atributos utm_*, garantir contact_inbox na inbox configurada e criar nova conversa com os atributos desta captura. Responder 201 (contrato de sucesso atual) ao visitante.

## Saída esperada (aceite)
- Telefone duplicado com e-mail novo: 201, contato existente reutilizado, nova conversa na inbox 3 com utm_*.
- E-mail duplicado: comportamento atual preservado.
- 422 sem contato encontrável por e-mail nem telefone: continua 502.
- 5xx/erro de rede do Chatwoot: 502; log só com tipo e status, sem dados pessoais nem token.

## Como testar
`npm run test:unit` (casos novo, duplicado por e-mail, duplicado por telefone, 5xx, 422 sem achado), `npm run test:e2e:lead`, `npm run test:e2e`. Produção: POST com telefone de contato de teste (etiqueta `teste`) e conferência por SQL no VPS.

## Segurança (segredos, portões)
Token só em env do Pages. Sem PII em log. gitleaks antes do push. Merge no main só com testes verdes (autorizado pelo Luan neste escopo).

## Backup/rollback
`git revert -m 1 <commit de merge>` no main via PR, depois Retry deployment do commit anterior no Cloudflare Pages.

## Versionamento
Versão 1.1.1, CHANGELOG, tag BRT.
