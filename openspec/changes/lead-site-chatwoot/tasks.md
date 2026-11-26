## 1. Preparação
- [x] 1.1 Identificar hosting, arquitetura, Chatwoot e canal seguro; documentar decisões. *(Cloudflare Pages + Pages Function como proxy; ver `docs/lead-site-chatwoot.md`.)*
- [x] 1.2 Validar change em modo strict. *(`openspec validate lead-site-chatwoot --strict` → válido.)*

## 2. Implementação e verificação
- [ ] 2.1 Delegar código ao harness com esta change e política de testes. *(Não cumprido: a implementação foi feita diretamente na sessão de execução, sem acionar harness externo.)*
- [x] 2.2 Testar unitário, contrato, erros, regressão e E2E local; registrar evidências. *(`npm run test:unit` 32/32; `npm run test:e2e:lead` 7/7 em Chromium desktop e 7/7 em WebKit mobile; suíte existente 108 passam e 24 skipped de projeto. Correção de flakiness: workers=1 no config de lead, com 5/5 rodadas do E2E e 3/3 do unitário verdes. Comandos e saídas em `docs/lead-site-chatwoot.md`. E2E usa Chatwoot simulado.)*
- [ ] 2.3 Atualizar CHANGELOG e KB; gitleaks, commit e tag BRT. *(CHANGELOG feito; gitleaks sem vazamentos; commit e tag local feitos. **KB do ecossistema não atualizada**: fora do escopo deste repositório.)*
- [ ] 2.4 Criar PR quando seguro; solicitar autorizações separadas para merge, publicação e teste que escreve em produção. *(Não cumprido: PR não criado. Push e PR dependem de autorização.)*
- [ ] 2.5 Após autorizações, verificar HTTP 200, Playwright real e GET Chatwoot; registrar evidências sem dados pessoais ou segredos. *(Pendente: depende de deploy, configuração das variáveis `CHATWOOT_*` e autorização. O HTTP 200 e o formulário foram verificados só localmente.)*
- [ ] 2.6 Validar strict e arquivar change após todos os cenários aprovados. *(Validação strict feita; não arquivada, porque os cenários de integração real e publicação ainda não foram aprovados.)*
