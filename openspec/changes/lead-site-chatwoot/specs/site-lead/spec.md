## ADDED Requirements

### Requirement: Lead com atribuição
O site SHALL oferecer formulário com nome, WhatsApp, e-mail e interesse e capturar utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, fbclid e página de origem.

#### Scenario: Lead válido com atribuição
- **WHEN** visitante envia formulário válido com parâmetros de campanha
- **THEN** contato e conversa são criados no Chatwoot e os atributos de origem estão disponíveis no contato

#### Scenario: Entrada inválida
- **WHEN** visitante envia dados inválidos ou obrigatórios ausentes
- **THEN** a interface informa o erro e não envia o lead

#### Scenario: Falha de integração
- **WHEN** o serviço de integração falha
- **THEN** a interface informa a falha sem declarar sucesso e sem expor segredos

### Requirement: Preservar rastreamento existente
O site SHALL preservar o gerador wa.me e UTMs existente.

#### Scenario: Link existente
- **WHEN** visitante usa o gerador existente
- **THEN** o link gerado permanece funcional com sua atribuição

### Requirement: Implantação verificável
O site SHALL ser implantável no hosting atual sem serviço pago adicional.

#### Scenario: Site publicado
- **WHEN** implantação e merge forem aprovados e executados
- **THEN** URL pública responde HTTP 200 e Playwright mais GET autenticado comprovam o lead de teste
