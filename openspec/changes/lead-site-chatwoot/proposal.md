# Lead do site no Chatwoot

## Plano
Adicionar formulário e integração segura ao Chatwoot sem custo novo, preservando a geração existente de links WhatsApp. Identificar hosting e canal suportado antes de escolher a arquitetura; nunca expor token privado ao navegador.

## Saída esperada (aceite)
Formulário nome, WhatsApp, e-mail e interesse cria contato e conversa no Chatwoot com utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, fbclid e página de origem. Página pública responde 200. Playwright envia lead e GET autenticado confirma atributos. PR mergeado, commit, tag BRT e CHANGELOG.

## Como testar
TDD proporcional: testes de unidade e contrato para validação, atribuição, erros e integração com respostas simuladas; Playwright local E2E; integração real Playwright e GET apenas após portões aplicáveis. Testar regressão de wa.me. Registrar resultados por cenário. Validar change em modo strict.

## Segurança (segredos, portões)
Nunca enviar credencial privada ao cliente, log, commit ou prompt. Validar e limitar entradas; tratar duplicação e falhas. Não escrever no banco de produção nem publicar/deploy ou fazer merge sem aprovação específica do Luan; não enviar mensagens externas. Cumprir proteção de dados.

## Backup/rollback
Trabalhar em branch isolada; sem alterar configurações existentes sem backup com timestamp. Reverter commit/deploy aprovado conforme hosting; preservar leads existentes, sem apagá-los.

## Versionamento
CHANGELOG, commit e tag local com hora BRT; scan gitleaks antes de qualquer push. PR e merge/publicação sujeitos aos portões próprios.
