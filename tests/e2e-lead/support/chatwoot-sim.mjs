/**
 * Simulador LOCAL de endpoints da API do Chatwoot usados pelo site. Só para testes.
 * Não é integração real: a prova de integração real exige a instância do Luan e fica pendente.
 *
 * Cobre os mesmos endpoints de functions/api/lead.js e exige o header `api_access_token`.
 * Controle de falha: POST /__sim/fail-next faz a próxima criação de contato responder 500.
 */

const json = (status, data) => ({ status, data });

export function createChatwootSim({ token, accountId = '7' }) {
  const contacts = new Map();
  const conversations = [];
  let nextId = 100;
  let failNext = 0;

  const newId = () => ++nextId;
  const sourceFor = (id) => `src-${id}`;

  function findByEmail(email) {
    return [...contacts.values()].find((c) => c.email?.toLowerCase() === email?.toLowerCase());
  }

  function publicContact(c) {
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone_number: c.phone_number,
      custom_attributes: c.custom_attributes,
      contact_inboxes: c.contact_inboxes,
      conversation_ids: conversations.filter((cv) => cv.contact_id === c.id).map((cv) => cv.id)
    };
  }

  function handleContacts(method, rest, body, query) {
    if (method === 'POST' && rest === '') {
      if (failNext > 0) {
        failNext -= 1;
        return json(500, { error: 'falha simulada' });
      }
      if (!body?.inbox_id) return json(422, { message: 'inbox_id obrigatório' });
      if (body.email && findByEmail(body.email)) {
        return json(422, { message: 'Email has already been taken' });
      }
      const id = newId();
      const contact = {
        id,
        name: body.name ?? '',
        email: body.email ?? null,
        phone_number: body.phone_number ?? null,
        custom_attributes: { ...(body.custom_attributes ?? {}) },
        contact_inboxes: [{ id: newId(), source_id: sourceFor(id), inbox: { id: body.inbox_id } }]
      };
      contacts.set(id, contact);
      return json(200, { id, contact_inboxes: contact.contact_inboxes });
    }

    if (method === 'GET' && rest === '/search') {
      const q = (query.get('q') ?? '').toLowerCase();
      const payload = [...contacts.values()]
        .filter((c) => [c.email, c.name, c.phone_number].some((v) => (v ?? '').toLowerCase().includes(q)))
        .map(publicContact);
      return json(200, { payload });
    }

    const match = rest.match(/^\/(\d+)(\/contact_inboxes)?$/);
    if (!match) return json(404, { error: 'não encontrado' });
    const contact = contacts.get(Number(match[1]));
    if (!contact) return json(404, { error: 'contato não encontrado' });

    if (match[2] && method === 'POST') {
      const ci = { id: newId(), source_id: sourceFor(contact.id), inbox: { id: body?.inbox_id } };
      contact.contact_inboxes.push(ci);
      return json(200, { source_id: ci.source_id });
    }
    if (!match[2] && method === 'PUT') {
      Object.assign(contact.custom_attributes, body?.custom_attributes ?? {});
      if (body?.name) contact.name = body.name;
      return json(200, publicContact(contact));
    }
    if (!match[2] && method === 'GET') {
      return json(200, { payload: publicContact(contact) });
    }
    return json(405, {});
  }

  function handleConversations(method, body) {
    if (method !== 'POST') return json(405, {});
    const contact = contacts.get(body?.contact_id);
    const knowsSource = contact?.contact_inboxes.some((ci) => ci.source_id === body?.source_id);
    if (!contact || !knowsSource) return json(422, { message: 'source_id/contact_id inválido' });
    const id = newId();
    const conversation = {
      id,
      contact_id: contact.id,
      inbox_id: body.inbox_id,
      custom_attributes: { ...(body.custom_attributes ?? {}) }
    };
    conversations.push(conversation);
    return json(200, { id, account_id: Number(accountId), inbox_id: body.inbox_id });
  }

  /** Recebe (method, pathname, query, body) relativo ao prefixo do simulador. */
  function handle({ method, pathname, query, headers, body }) {
    if (method === 'POST' && pathname === '/__sim/fail-next') {
      failNext = 1;
      return json(200, { ok: true });
    }
    if (method === 'POST' && pathname === '/__sim/reset') {
      contacts.clear();
      conversations.length = 0;
      failNext = 0;
      return json(200, { ok: true });
    }

    if (headers['api_access_token'] !== token) return json(401, { error: 'token inválido' });

    const base = `/api/v1/accounts/${accountId}`;
    if (!pathname.startsWith(base)) return json(404, { error: 'conta não encontrada' });
    const rest = pathname.slice(base.length);

    if (rest.startsWith('/contacts')) return handleContacts(method, rest.slice('/contacts'.length), body, query);
    if (rest === '/conversations') return handleConversations(method, body);
    return json(404, { error: 'rota não simulada' });
  }

  return { handle, snapshot: () => ({ contacts: [...contacts.values()].map(publicContact), conversations }) };
}
