/**
 * Helper de Geração de Link WhatsApp com UTM e Código Curto (Tarefa 3.5 / AT-03.5)
 * Formato auditável classificado como origem declarada pelo cliente
 */
export function buildWhatsAppLink({
  phone = '5511999999999',
  message = 'Olá! Gostaria de falar com a Dumentre.',
  sourceCode = 'site-home',
  utmSource = 'site',
  utmMedium = 'organic',
  utmCampaign = 'geral'
} = {}) {
  const trackingTag = `[ref:${sourceCode}|utm_source:${utmSource}|utm_medium:${utmMedium}|utm_campaign:${utmCampaign}]`;
  const fullText = `${message} ${trackingTag}`.trim();
  const encoded = encodeURIComponent(fullText);
  return `https://wa.me/${phone}?text=${encoded}`;
}
