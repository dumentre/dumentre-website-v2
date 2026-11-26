## 1. Testes (red primeiro)
- [x] 1.1 Teste unitário: 422 por telefone duplicado (busca por e-mail vazia, busca por telefone acha) -> 201, conversa com contact_id existente
- [x] 1.2 Teste: 422 sem achado em nenhuma busca -> 502
- [x] 1.3 Teste: 5xx na busca -> 502 e log sem PII

## 2. Implementação
- [x] 2.1 `findContactByPhone` em functions/api/lead.js e fallback no tratamento do 422
- [x] 2.2 Log sem dados pessoais

## 3. Verificação e entrega
- [x] 3.1 test:unit, test:e2e:lead, test:e2e verdes
- [ ] 3.2 CHANGELOG 1.1.1, commit, tag BRT, gitleaks
- [ ] 3.3 PR, merge se verde, validação em produção, rollback documentado
