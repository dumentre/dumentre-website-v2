/**
 * Contrato compartilhado do formulário de lead do site (browser + Pages Function).
 * Sem dependências e sem DOM: roda no navegador e no runtime do Cloudflare Pages.
 *
 * Regra de segurança: tudo que vem do visitante é tratado como não confiável.
 * Esta validação é a barreira de entrada; o servidor SEMPRE revalida (não confia no cliente).
 */

export const LEAD_INTERESTS = Object.freeze([
  'site-institucional',
  'ecommerce',
  'app-mobile',
  'chatbot-whatsapp',
  'crm-automacao',
  'seo-local',
  'outro'
]);

export const ATTRIBUTION_KEYS = Object.freeze([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'fbclid',
  'pagina_origem'
]);

export const LIMITS = Object.freeze({
  name: 80,
  email: 120,
  attribution: 200,
  bodyBytes: 8 * 1024
});

// Letras (qualquer idioma), espaço, apóstrofo, hífen e ponto. Sem < > " ` ou dígitos.
const NAME_RE = /^[\p{L}][\p{L}\p{M} .'’-]*$/u;
// Validação pragmática de e-mail: sem espaços, sem caracteres de marcação, com domínio e TLD.
const EMAIL_RE = /^[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`.]{2,}$/;
// Caracteres de controle (C0/C1, exceto tab/newline que serão tratados como espaço).
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

/**
 * Remove marcação e controle, normaliza espaços e limita o tamanho.
 * Não-string vira string vazia (atributos com objeto/array são descartados).
 */
export function sanitizeText(value, max) {
  if (typeof value !== 'string') return '';
  return value
    .replace(CONTROL_RE, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * Converte WhatsApp brasileiro para E.164 (+55DDNNNNNNNNN). Retorna null se inválido.
 * Aceita: "(11) 99999-9999", "+55 11 99999-9999", "5511999999999", "11 3333-4444".
 */
export function normalizeWhatsApp(raw) {
  if (typeof raw !== 'string') return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  // DDD (2 dígitos, 11–99) + 8 ou 9 dígitos.
  if (!/^[1-9][1-9]\d{8,9}$/.test(digits)) return null;
  return `+55${digits}`;
}

function validateName(raw) {
  const name = sanitizeText(raw, LIMITS.name);
  if (name.length < 2) return { error: 'Informe seu nome completo.' };
  if (!NAME_RE.test(name)) return { error: 'Use apenas letras no nome.' };
  return { value: name };
}

function validateEmail(raw) {
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!email || email.length > LIMITS.email || !EMAIL_RE.test(email)) {
    return { error: 'Informe um e-mail válido.' };
  }
  return { value: email };
}

function validateWhatsApp(raw) {
  const phone = normalizeWhatsApp(raw);
  if (!phone) return { error: 'Informe um WhatsApp válido com DDD.' };
  return { value: phone };
}

function validateInterest(raw) {
  if (!LEAD_INTERESTS.includes(raw)) return { error: 'Escolha um interesse da lista.' };
  return { value: raw };
}

function pickAttribution(input) {
  const attribution = {};
  for (const key of ATTRIBUTION_KEYS) {
    attribution[key] = sanitizeText(input[key], LIMITS.attribution);
  }
  return attribution;
}

/**
 * Valida o payload do formulário.
 * Retorno: { ok: true, lead } | { ok: false, errors } | { ok: false, honeypot: true }
 */
export function validateLead(input) {
  const data = input && typeof input === 'object' && !Array.isArray(input) ? input : {};

  // Campo armadilha oculto: bot preenche; humano não. Rejeição silenciosa no servidor.
  if (typeof data.website === 'string' && data.website.trim() !== '') {
    return { ok: false, honeypot: true, errors: {} };
  }

  const checks = {
    name: validateName(data.name),
    whatsapp: validateWhatsApp(data.whatsapp),
    email: validateEmail(data.email),
    interesse: validateInterest(data.interesse)
  };

  const errors = {};
  for (const [field, result] of Object.entries(checks)) {
    if (result.error) errors[field] = result.error;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    lead: {
      name: checks.name.value,
      whatsapp: checks.whatsapp.value,
      email: checks.email.value,
      interesse: checks.interesse.value,
      attribution: pickAttribution(data)
    }
  };
}
