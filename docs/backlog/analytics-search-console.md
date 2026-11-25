# Backlog: Configuração de Google Analytics e Search Console 📊

## Objetivo
Integrar o Google Analytics 4 (GA4) e verificar a propriedade no Google Search Console para monitorar o tráfego e interações no site da Dumentre.

## Por que isso importa comercialmente?
O que não pode ser medido, não pode ser melhorado. Saber quantas pessoas acessam o site, de onde vêm, quais seções mais engajam e quantos cliques ocorrem nos botões de WhatsApp é fundamental para otimizar os investimentos em marketing e melhorar a taxa de conversão.

## Escopo Inicial
- Integração do snippet de tag do GA4.
- Definição da plataforma responsável por persistir o histórico dos eventos de conversão, com consulta simples e exportação dos dados.
- Criação de eventos personalizados para monitorar:
  - Cliques nos botões de WhatsApp (Header, Hero, Middle, FAQ, Footer).
  - Cliques para envio de E-mail.
- Persistência do evento `whatsapp_click` com página, serviço, CTA, posição e UTMs permitidas, sem telefone, e-mail ou conteúdo da conversa.
- Definição de retenção, responsáveis pelo acesso e documentação do significado de cada evento e dimensão.
- Validação de consentimento e requisitos da LGPD antes de ativar ferramentas que transmitam dados para terceiros.
- Verificação do domínio no Google Search Console via registro DNS.

## Fora de Escopo por enquanto
- Integração de ferramentas de mapas de calor complexas (ex. Hotjar), priorizando performance.

## Critérios de Aceite
- Tag do Analytics não deve prejudicar a nota de performance do site de forma significativa.
- Eventos de clique disparados e validados no painel de debug do GA4.
- Histórico de conversões disponível em uma plataforma de consulta, não apenas na memória do navegador.
- Filtros por período, origem, campanha, página, serviço e posição do CTA.
- Dados exportáveis ou acessíveis por integração para permitir dashboards futuros sem aprisionamento desnecessário ao fornecedor.
- Nenhum dado pessoal ou conteúdo enviado pelo visitante deve ser registrado em analytics.

## Ideias Futuras
- Criação de um dashboard automatizado no Looker Studio ou ferramenta equivalente para acompanhamento de tráfego, campanhas, CTAs e conversões.
- Avaliar armazenamento complementar no servidor existente somente se a retenção ou análise necessária não couber adequadamente na plataforma escolhida.

## Prioridade Sugerida
**Alta**
