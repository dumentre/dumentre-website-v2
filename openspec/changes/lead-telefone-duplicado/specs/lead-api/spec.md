## ADDED Requirements

### Requirement: Duplicidade de telefone reutiliza o contato
O endpoint POST /api/lead SHALL, ao receber 422 do Chatwoot na criação de contato, procurar o contato existente por e-mail e, se não achar, por telefone, reutilizar o contact_id e abrir nova conversa na inbox configurada com os atributos da captura atual.

#### Scenario: telefone duplicado com e-mail diferente
- **WHEN** o Chatwoot devolve 422 ao criar o contato e a busca por e-mail não acha ninguém, mas a busca por telefone acha o contato 77
- **THEN** a conversa é criada com contact_id 77 e custom_attributes utm_*, e a resposta é 201 com `{ok:true}`

#### Scenario: e-mail duplicado
- **WHEN** o 422 é resolvido pela busca por e-mail
- **THEN** o comportamento anterior é mantido e a resposta é 201

### Requirement: Erros reais continuam 502
O endpoint MUST devolver 502 quando o contato duplicado não for encontrado ou o Chatwoot falhar, sem registrar dados pessoais ou token no log.

#### Scenario: 422 sem contato encontrável
- **WHEN** nenhuma busca acha o contato
- **THEN** a resposta é 502 com `ok:false`

#### Scenario: erro 5xx do Chatwoot
- **WHEN** o Chatwoot devolve 500 em qualquer etapa
- **THEN** a resposta é 502 e o log contém só tipo de erro e status
