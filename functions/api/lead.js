/**
 * POST /api/lead — Cloudflare Pages Function (hosting atual: Cloudflare Pages, plano gratuito).
 *
 * Recebe o lead do formulário do site, revalida tudo no servidor e cria contato + conversa
 * na caixa de API do Chatwoot. O token de API fica só em variáveis de ambiente do Pages
 * (CHATWOOT_API_TOKEN, definido como segredo no painel); NUNCA vai para o navegador,
 * para resposta, para log ou para o repositório.
 *
 * Variáveis esperadas (sem valores aqui):
 *   CHATWOOT_BASE_URL     https://<host do chatwoot>
 *   CHATWOOT_ACCOUNT_ID   id numérico da conta
 *   CHATWOOT_INBOX_ID     id numérico da caixa de API
 *   CHATWOOT_API_TOKEN    token de acesso da API (segredo)
 *
 * Referências de API (developers.chatwoot.com/api-reference):
 *   POST /api/v1/accounts/{id}/contacts                      (inbox_id obrigatório; custom_attributes)
 *   GET  /api/v1/accounts/{id}/contacts/search?q=           (busca de duplicado)
 *   PUT  /api/v1/accounts/{id}/contacts/{contact_id}         (atualiza atributos)
 *   POST /api/v1/accounts/{id}/contacts/{contact_id}/contact_inboxes  (inbox_id -> source_id)
 *   POST /api/v1/accounts/{id}/conversations                 (source_id obrigatório; inbox_id; contact_id)
 * Auth: header `api_access_token` (aceito pela API; o doc marca como legado — validar na integração real).
 */

import { validateLead, LIMITS } from '../../src/utils/lead.js';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

const MSG_UNAVAILABLE = 'Não foi possível enviar seu contato agora. Tente novamente ou fale com a gente pelo WhatsApp.';

function respond(status, data) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

class ChatwootError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ChatwootError';
    this.status = status;
  }
}

/**
 * HTTPS é obrigatório (o token vai no header). Exceção: http apenas para loopback,
 * usada pelo simulador local dos testes E2E; nunca em produção.
 */
function isAllowedBaseUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  } catch {
    return false;
  }
}

/** Lê e valida a configuração. Retorna null se faltar algo ou se a URL não for permitida. */
function readConfig(env) {
  const baseUrl = (env?.CHATWOOT_BASE_URL ?? '').trim().replace(/\/+$/, '');
  const accountId = (env?.CHATWOOT_ACCOUNT_ID ?? '').trim();
  const inboxId = Number(env?.CHATWOOT_INBOX_ID);
  const token = env?.CHATWOOT_API_TOKEN ?? '';
  if (!isAllowedBaseUrl(baseUrl) || !/^\d+$/.test(accountId) || !Number.isInteger(inboxId) || inboxId <= 0 || !token) {
    return null;
  }
  return { baseUrl, accountId, inboxId, token };
}

/** Chamada à API do Chatwoot. Não lança em status HTTP de erro: devolve status e corpo para quem chama decidir. */
async function chatwoot(config, method, path, body) {
  const res = await fetch(`${config.baseUrl}/api/v1/accounts/${config.accountId}${path}`, {
    method,
    headers: { 'content-type': 'application/json', api_access_token: config.token },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

function mustSucceed(result, step) {
  if (!result.ok) throw new ChatwootError(`${step} falhou`, result.status);
  return result.data;
}

/** Caixa de API: contato pode já trazer contact_inboxes com inbox.id ou inbox_id. */
function sourceIdForInbox(contact, inboxId) {
  const list = Array.isArray(contact?.contact_inboxes) ? contact.contact_inboxes : [];
  const match = list.find((ci) => Number(ci?.inbox?.id ?? ci?.inbox_id) === inboxId);
  return match?.source_id ?? null;
}

async function findContactByEmail(config, email) {
  const result = await chatwoot(config, 'GET', `/contacts/search?q=${encodeURIComponent(email)}`);
  const list = mustSucceed(result, 'busca de contato');
  const items = Array.isArray(list?.payload) ? list.payload : [];
  return items.find((c) => typeof c?.email === 'string' && c.email.toLowerCase() === email) ?? null;
}

/** Só dígitos: "+55 (11) 99999-9999" e "5511999999999" são o mesmo telefone. */
function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/** Usado quando o 422 é por telefone já cadastrado em outro contato (e-mail diferente). */
async function findContactByPhone(config, phone) {
  const wanted = digitsOnly(phone);
  if (!wanted) return null;
  const result = await chatwoot(config, 'GET', `/contacts/search?q=${encodeURIComponent(phone)}`);
  const list = mustSucceed(result, 'busca de contato por telefone');
  const items = Array.isArray(list?.payload) ? list.payload : [];
  return items.find((c) => digitsOnly(c?.phone_number) === wanted) ?? null;
}

/**
 * Cria (ou reaproveita, se o e-mail já existe) o contato e abre uma conversa na caixa de API.
 * Retorna { contactId, conversationId }.
 */
export async function createLeadInChatwoot(config, lead) {
  const attributes = { ...lead.attribution, interesse: lead.interesse };

  const created = await chatwoot(config, 'POST', '/contacts', {
    inbox_id: config.inboxId,
    name: lead.name,
    email: lead.email,
    phone_number: lead.whatsapp,
    custom_attributes: attributes
  });

  let contactId;
  let sourceId;

  if (created.status === 422) {
    // Duplicado (e-mail ou telefone já cadastrados): reaproveita o contato e atualiza a atribuição do lead mais recente.
    // Não sobrescreve o e-mail do contato existente: só atributos, contact_inbox e conversa nova.
    const existing =
      (await findContactByEmail(config, lead.email)) ?? (await findContactByPhone(config, lead.whatsapp));
    if (!existing) throw new ChatwootError('contato duplicado não encontrado', 422);
    contactId = existing.id;
    mustSucceed(
      await chatwoot(config, 'PUT', `/contacts/${contactId}`, { custom_attributes: attributes }),
      'atualização do contato'
    );
    sourceId = sourceIdForInbox(existing, config.inboxId);
    if (!sourceId) {
      const ci = mustSucceed(
        await chatwoot(config, 'POST', `/contacts/${contactId}/contact_inboxes`, { inbox_id: config.inboxId }),
        'vínculo do contato à caixa'
      );
      sourceId = ci?.source_id ?? null;
    }
  } else {
    const data = mustSucceed(created, 'criação de contato');
    const contact = data?.payload?.contact ?? data?.payload ?? data;
    contactId = contact?.id ?? data?.id;
    sourceId = sourceIdForInbox(contact, config.inboxId) ?? contact?.contact_inboxes?.[0]?.source_id ?? null;
  }

  if (!contactId || !sourceId) throw new ChatwootError('resposta sem contato ou source_id', 502);

  const conversation = mustSucceed(
    await chatwoot(config, 'POST', '/conversations', {
      source_id: sourceId,
      inbox_id: config.inboxId,
      contact_id: contactId,
      custom_attributes: attributes
    }),
    'criação de conversa'
  );

  return { contactId, conversationId: conversation?.id ?? null };
}

async function readBodyWithLimit(request) {
  const text = await request.text();
  // Conta bytes reais (UTF-8), não caracteres.
  if (new TextEncoder().encode(text).length > LIMITS.bodyBytes) return { tooLarge: true };
  return { text };
}

export async function onRequestPost({ request, env }) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return respond(415, { ok: false, error: 'Tipo de conteúdo inválido.' });
  }

  const body = await readBodyWithLimit(request);
  if (body.tooLarge) return respond(413, { ok: false, error: 'Envio grande demais.' });

  let input;
  try {
    input = JSON.parse(body.text);
  } catch {
    return respond(400, { ok: false, error: 'Dados inválidos.' });
  }

  const result = validateLead(input);
  if (result.honeypot) {
    // Resposta idêntica à de sucesso para não ensinar o bot a contornar a armadilha.
    return respond(201, { ok: true });
  }
  if (!result.ok) {
    return respond(400, { ok: false, errors: result.errors });
  }

  const config = readConfig(env);
  if (!config) {
    // Mensagem genérica: não revela nomes de variáveis nem valores.
    console.error('lead: integração Chatwoot sem configuração válida');
    return respond(503, { ok: false, error: 'Integração indisponível no momento.' });
  }

  try {
    await createLeadInChatwoot(config, result.lead);
    return respond(201, { ok: true });
  } catch (err) {
    // Loga só o tipo e o status; nunca o corpo da resposta, o token ou os dados pessoais do lead.
    console.error('lead: falha ao enviar ao Chatwoot', err?.name ?? 'Error', err?.status ?? 'sem-status');
    return respond(502, { ok: false, error: MSG_UNAVAILABLE });
  }
}
