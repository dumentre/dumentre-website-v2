/**
 * Formulário de lead do site (navegador). Lógica de validação vem de ./utils/lead.js,
 * a mesma usada pelo servidor (functions/api/lead.js), então as regras não divergem.
 *
 * Não há nenhum token aqui: o envio vai para /api/lead, e só o servidor fala com o Chatwoot.
 * Tudo que aparece na tela é escrito com textContent (sem innerHTML) para evitar XSS.
 */
import { validateLead, ATTRIBUTION_KEYS } from './utils/lead.js';

export const ATTRIBUTION_STORAGE_KEY = 'dumentre.lead.attribution';
export const LEAD_ENDPOINT = '/api/lead';
const REQUEST_TIMEOUT_MS = 15000;

export const MSG_SUCCESS = 'Recebemos seu contato. Em breve nossa equipe fala com você pelo WhatsApp.';
export const MSG_FAILURE = 'Não foi possível enviar seu contato agora. Tente novamente ou fale com a gente pelo WhatsApp.';

const CAMPAIGN_PARAMS = ATTRIBUTION_KEYS.filter((key) => key !== 'pagina_origem');

function emptyAttribution() {
  return Object.fromEntries(ATTRIBUTION_KEYS.map((key) => [key, '']));
}

function readStored(storage) {
  try {
    const raw = storage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Captura a atribuição da visita.
 * - Se a URL trouxer qualquer parâmetro de campanha, ele substitui a atribuição guardada
 *   e a página de entrada passa a ser a página atual.
 * - Senão, mantém a atribuição da sessão; na primeira visita, grava a página de entrada.
 * Guarda em sessionStorage (some ao fechar a aba). Nunca grava dados pessoais.
 */
export function captureAttribution(location = window.location, storage = window.sessionStorage) {
  const params = new URLSearchParams(location.search);
  const fromUrl = {};
  for (const key of CAMPAIGN_PARAMS) {
    const value = params.get(key);
    if (value) fromUrl[key] = value;
  }

  const stored = readStored(storage);
  let attribution;
  if (Object.keys(fromUrl).length > 0) {
    attribution = { ...emptyAttribution(), ...fromUrl, pagina_origem: location.pathname };
  } else if (stored) {
    attribution = { ...emptyAttribution(), ...stored };
  } else {
    attribution = { ...emptyAttribution(), pagina_origem: location.pathname };
  }

  try {
    storage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    // Armazenamento indisponível (modo privado restrito): segue sem persistir.
  }
  return attribution;
}

function setFieldError(form, field, message) {
  const slot = form.querySelector(`[data-error-for="${field}"]`);
  const input = form.elements.namedItem(field);
  if (slot) slot.textContent = message ?? '';
  if (input) {
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
}

function clearErrors(form) {
  for (const slot of form.querySelectorAll('[data-error-for]')) slot.textContent = '';
  for (const input of form.querySelectorAll('[aria-invalid]')) input.removeAttribute('aria-invalid');
}

function setStatus(form, message, kind) {
  const status = form.querySelector('[data-lead-status]');
  if (!status) return;
  status.textContent = message;
  status.dataset.kind = kind;
}

function readFields(form) {
  const value = (name) => (form.elements.namedItem(name)?.value ?? '').toString();
  return {
    name: value('name'),
    whatsapp: value('whatsapp'),
    email: value('email'),
    interesse: value('interesse'),
    website: value('website')
  };
}

async function postLead(payload, fetchImpl = window.fetch, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(LEAD_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

export function initLeadForm(form, { location = window.location, storage = window.sessionStorage, fetchImpl } = {}) {
  const attribution = captureAttribution(location, storage);
  const submit = form.querySelector('[data-lead-submit]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);
    setStatus(form, '', 'idle');

    const fields = readFields(form);
    // Valida no cliente para dar feedback rápido; o servidor revalida tudo.
    const check = validateLead({ ...fields, ...attribution });
    if (!check.ok && !check.honeypot) {
      for (const [field, message] of Object.entries(check.errors)) setFieldError(form, field, message);
      const first = form.querySelector('[aria-invalid="true"]');
      if (first) first.focus();
      setStatus(form, 'Revise os campos destacados.', 'error');
      return;
    }

    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    setStatus(form, 'Enviando…', 'pending');
    try {
      const { status, data } = await postLead({ ...fields, ...attribution }, fetchImpl);
      if (status === 201) {
        form.reset();
        setStatus(form, MSG_SUCCESS, 'success');
      } else if (status === 400 && data?.errors) {
        for (const [field, message] of Object.entries(data.errors)) setFieldError(form, field, message);
        setStatus(form, 'Revise os campos destacados.', 'error');
      } else {
        setStatus(form, MSG_FAILURE, 'error');
      }
    } catch {
      setStatus(form, MSG_FAILURE, 'error');
    } finally {
      submit.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });

  return { attribution };
}

if (typeof document !== 'undefined') {
  const form = document.getElementById('lead-form');
  if (form) initLeadForm(form);
}
