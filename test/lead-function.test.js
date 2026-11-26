import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/lead.js';

const ENV = {
  CHATWOOT_BASE_URL: 'https://chatwoot.test',
  CHATWOOT_ACCOUNT_ID: '7',
  CHATWOOT_INBOX_ID: '3',
  CHATWOOT_API_TOKEN: 'tok-test-secret-123'
};

const validBody = () => ({
  name: 'Maria Silva',
  whatsapp: '(11) 99999-9999',
  email: 'maria@example.com',
  interesse: 'site-institucional',
  utm_source: 'google',
  utm_medium: 'cpc',
  utm_campaign: 'black-friday',
  utm_content: 'banner',
  utm_term: 'agencia',
  gclid: 'Cj0K',
  fbclid: 'IwAR1',
  pagina_origem: '/lp/black-friday'
});

function post(body, { raw, env = ENV, headers = {} } = {}) {
  const request = new Request('https://dumentre.test/api/lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: raw ?? JSON.stringify(body)
  });
  return onRequestPost({ request, env });
}

/** Stub de fetch: `routes` mapeia "METHOD path" -> função que devolve Response. Registra chamadas. */
function stubFetch(routes) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    const key = `${init.method ?? 'GET'} ${u.pathname}`;
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ key, url: u.toString(), headers: init.headers, body });
    const handler = routes[key];
    if (!handler) return new Response(JSON.stringify({ error: 'rota não simulada' }), { status: 599 });
    return handler(body, u);
  };
  return calls;
}

const json = (status, data) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

const happyRoutes = () => ({
  'POST /api/v1/accounts/7/contacts': () =>
    json(200, { id: 55, contact_inboxes: [{ source_id: 'src-abc', inbox: { id: 3 } }] }),
  'POST /api/v1/accounts/7/conversations': () => json(200, { id: 900, account_id: 7, inbox_id: 3 })
});

let originalFetch;
beforeEach(() => {
  originalFetch = globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('POST /api/lead — caminho feliz (Chatwoot simulado)', () => {
  it('cria contato com atributos de origem e conversa vinculada, e responde 201 sem vazar token', async () => {
    const calls = stubFetch(happyRoutes());
    const res = await post(validBody());
    const text = await res.text();

    assert.equal(res.status, 201);
    assert.equal(text.includes('tok-test-secret-123'), false, 'token vazou na resposta');
    assert.deepEqual(JSON.parse(text), { ok: true });

    const contact = calls.find((c) => c.key === 'POST /api/v1/accounts/7/contacts');
    assert.ok(contact, 'contato não criado');
    assert.equal(contact.headers.api_access_token, 'tok-test-secret-123');
    assert.equal(contact.body.inbox_id, 3);
    assert.equal(contact.body.name, 'Maria Silva');
    assert.equal(contact.body.email, 'maria@example.com');
    assert.equal(contact.body.phone_number, '+5511999999999');
    assert.equal(contact.body.custom_attributes.utm_source, 'google');
    assert.equal(contact.body.custom_attributes.gclid, 'Cj0K');
    assert.equal(contact.body.custom_attributes.fbclid, 'IwAR1');
    assert.equal(contact.body.custom_attributes.pagina_origem, '/lp/black-friday');

    const conv = calls.find((c) => c.key === 'POST /api/v1/accounts/7/conversations');
    assert.ok(conv, 'conversa não criada');
    assert.equal(conv.body.source_id, 'src-abc');
    assert.equal(conv.body.inbox_id, 3);
    assert.equal(conv.body.contact_id, 55);
    assert.equal(conv.body.custom_attributes.utm_campaign, 'black-friday');
  });

  it('aceita a forma de resposta com payload.contact (versões antigas da API)', async () => {
    stubFetch({
      'POST /api/v1/accounts/7/contacts': () =>
        json(200, { payload: { contact: { id: 56, contact_inboxes: [{ source_id: 'src-x' }] } } }),
      'POST /api/v1/accounts/7/conversations': () => json(200, { id: 901 })
    });
    const res = await post(validBody());
    assert.equal(res.status, 201);
  });
});

describe('POST /api/lead — validação e entradas inválidas', () => {
  it('JSON malformado → 400 e nenhuma chamada ao Chatwoot', async () => {
    const calls = stubFetch(happyRoutes());
    const res = await post(null, { raw: '{nao-e-json' });
    assert.equal(res.status, 400);
    assert.equal(calls.length, 0);
  });

  it('campos inválidos → 400 com erros por campo e nenhuma chamada ao Chatwoot', async () => {
    const calls = stubFetch(happyRoutes());
    const res = await post({ ...validBody(), email: 'nao-email', name: '<script>alert(1)</script>' });
    const data = await res.json();
    assert.equal(res.status, 400);
    assert.ok(data.errors.email);
    assert.ok(data.errors.name);
    assert.equal(calls.length, 0);
  });

  it('obrigatório ausente → 400', async () => {
    const calls = stubFetch(happyRoutes());
    const { whatsapp, ...semWhats } = validBody();
    const res = await post(semWhats);
    assert.equal(res.status, 400);
    assert.ok((await res.json()).errors.whatsapp);
    assert.equal(calls.length, 0);
  });

  it('honeypot preenchido → resposta genérica, sem criar nada', async () => {
    const calls = stubFetch(happyRoutes());
    const res = await post({ ...validBody(), website: 'http://spam.test' });
    assert.equal(res.status, 201);
    assert.equal(calls.length, 0);
  });

  it('corpo acima do limite → 413', async () => {
    const calls = stubFetch(happyRoutes());
    const res = await post(null, { raw: JSON.stringify({ ...validBody(), utm_term: 'x'.repeat(20000) }) });
    assert.equal(res.status, 413);
    assert.equal(calls.length, 0);
  });

  it('content-type diferente de JSON → 415', async () => {
    const request = new Request('https://dumentre.test/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify(validBody())
    });
    const res = await onRequestPost({ request, env: ENV });
    assert.equal(res.status, 415);
  });
});

describe('POST /api/lead — configuração e falhas de integração', () => {
  it('configuração ausente → 503 sem revelar nomes/valores de segredo', async () => {
    const calls = stubFetch(happyRoutes());
    const res = await post(validBody(), { env: { CHATWOOT_BASE_URL: 'https://chatwoot.test' } });
    const text = await res.text();
    assert.equal(res.status, 503);
    assert.equal(calls.length, 0);
    assert.equal(text.includes('tok-test-secret-123'), false);
    assert.equal(text.includes('CHATWOOT_API_TOKEN'), false);
  });

  it('falha ao criar contato (5xx) → 502 com mensagem genérica, sem declarar sucesso', async () => {
    stubFetch({ 'POST /api/v1/accounts/7/contacts': () => json(500, { error: 'boom tok-test-secret-123' }) });
    const res = await post(validBody());
    const text = await res.text();
    assert.equal(res.status, 502);
    assert.equal(JSON.parse(text).ok, false);
    assert.equal(text.includes('tok-test-secret-123'), false);
  });

  it('falha ao criar conversa → 502, e o contato já criado não é reportado como lead completo', async () => {
    stubFetch({
      'POST /api/v1/accounts/7/contacts': () =>
        json(200, { id: 55, contact_inboxes: [{ source_id: 'src-abc' }] }),
      'POST /api/v1/accounts/7/conversations': () => json(503, {})
    });
    const res = await post(validBody());
    assert.equal(res.status, 502);
    assert.equal((await res.json()).ok, false);
  });

  it('erro de rede (fetch rejeita) → 502', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('network down');
    };
    const res = await post(validBody());
    assert.equal(res.status, 502);
  });
});

describe('POST /api/lead — URL do Chatwoot', () => {
  it('http público é recusado (token não sai sem TLS); http só em loopback', async () => {
    const calls = stubFetch(happyRoutes());
    const res = await post(validBody(), { env: { ...ENV, CHATWOOT_BASE_URL: 'http://chatwoot.example.com' } });
    assert.equal(res.status, 503);
    assert.equal(calls.length, 0);

    stubFetch(happyRoutes());
    const local = await post(validBody(), { env: { ...ENV, CHATWOOT_BASE_URL: 'http://127.0.0.1:8800' } });
    assert.equal(local.status, 201);
  });
});

describe('POST /api/lead — duplicação de contato', () => {
  it('contato já existente (422) → busca pelo e-mail, reaproveita contato e cria conversa', async () => {
    const calls = stubFetch({
      'POST /api/v1/accounts/7/contacts': () => json(422, { message: 'Email has already been taken' }),
      'GET /api/v1/accounts/7/contacts/search': () =>
        json(200, {
          payload: [{ id: 77, email: 'maria@example.com', contact_inboxes: [{ source_id: 'src-old', inbox: { id: 3 } }] }]
        }),
      'PUT /api/v1/accounts/7/contacts/77': () => json(200, { id: 77 }),
      'POST /api/v1/accounts/7/conversations': () => json(200, { id: 902 })
    });
    const res = await post(validBody());
    assert.equal(res.status, 201);
    const conv = calls.find((c) => c.key === 'POST /api/v1/accounts/7/conversations');
    assert.equal(conv.body.contact_id, 77);
    assert.equal(conv.body.source_id, 'src-old');
  });

  it('duplicado sem contact_inbox para a caixa → cria contact_inbox e usa o source_id novo', async () => {
    const calls = stubFetch({
      'POST /api/v1/accounts/7/contacts': () => json(422, { message: 'taken' }),
      'GET /api/v1/accounts/7/contacts/search': () =>
        json(200, { payload: [{ id: 78, email: 'maria@example.com', contact_inboxes: [] }] }),
      'PUT /api/v1/accounts/7/contacts/78': () => json(200, { id: 78 }),
      'POST /api/v1/accounts/7/contacts/78/contact_inboxes': () => json(200, { source_id: 'src-new' }),
      'POST /api/v1/accounts/7/conversations': () => json(200, { id: 903 })
    });
    const res = await post(validBody());
    assert.equal(res.status, 201);
    const conv = calls.find((c) => c.key === 'POST /api/v1/accounts/7/conversations');
    assert.equal(conv.body.source_id, 'src-new');
  });

  it('422 sem contato encontrável na busca → 502', async () => {
    stubFetch({
      'POST /api/v1/accounts/7/contacts': () => json(422, { message: 'taken' }),
      'GET /api/v1/accounts/7/contacts/search': () => json(200, { payload: [] })
    });
    const res = await post(validBody());
    assert.equal(res.status, 502);
  });
});
