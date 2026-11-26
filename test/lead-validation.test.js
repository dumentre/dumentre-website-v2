import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateLead, normalizeWhatsApp, sanitizeText, LEAD_INTERESTS, ATTRIBUTION_KEYS } from '../src/utils/lead.js';

const validInput = () => ({
  name: 'Maria Silva',
  whatsapp: '(11) 99999-9999',
  email: 'Maria@Example.com',
  interesse: 'site-institucional',
  utm_source: 'google',
  utm_medium: 'cpc',
  utm_campaign: 'black-friday',
  utm_content: 'banner-topo',
  utm_term: 'agencia digital',
  gclid: 'Cj0KCQ-abc',
  fbclid: 'IwAR123',
  pagina_origem: '/lp/black-friday'
});

describe('normalizeWhatsApp', () => {
  it('normaliza formatos brasileiros para E.164', () => {
    assert.equal(normalizeWhatsApp('(11) 99999-9999'), '+5511999999999');
    assert.equal(normalizeWhatsApp('+55 11 99999-9999'), '+5511999999999');
    assert.equal(normalizeWhatsApp('5511999999999'), '+5511999999999');
    assert.equal(normalizeWhatsApp('11 3333-4444'), '+551133334444');
  });

  it('rejeita números curtos, DDD inválido e lixo', () => {
    assert.equal(normalizeWhatsApp('123'), null);
    assert.equal(normalizeWhatsApp('00 99999-9999'), null);
    assert.equal(normalizeWhatsApp('abc'), null);
    assert.equal(normalizeWhatsApp(''), null);
    assert.equal(normalizeWhatsApp(undefined), null);
  });
});

describe('sanitizeText', () => {
  it('remove caracteres de controle e marcação HTML e limita tamanho', () => {
    assert.equal(sanitizeText('  <script>x</script>  ', 100), 'scriptx/script');
    assert.equal(sanitizeText('a\u0000b\u0007c', 100), 'abc');
    assert.equal(sanitizeText('x'.repeat(300), 200).length, 200);
  });

  it('retorna string vazia para não-string', () => {
    assert.equal(sanitizeText({ a: 1 }, 200), '');
    assert.equal(sanitizeText(null, 200), '');
  });
});

describe('validateLead (Lead com atribuição)', () => {
  it('aceita lead válido, normaliza campos e preserva atribuição', () => {
    const result = validateLead(validInput());
    assert.equal(result.ok, true);
    assert.equal(result.lead.name, 'Maria Silva');
    assert.equal(result.lead.whatsapp, '+5511999999999');
    assert.equal(result.lead.email, 'maria@example.com');
    assert.equal(result.lead.interesse, 'site-institucional');
    for (const key of ATTRIBUTION_KEYS) {
      assert.ok(key in result.lead.attribution, `falta ${key}`);
    }
    assert.equal(result.lead.attribution.utm_source, 'google');
    assert.equal(result.lead.attribution.gclid, 'Cj0KCQ-abc');
    assert.equal(result.lead.attribution.fbclid, 'IwAR123');
    assert.equal(result.lead.attribution.pagina_origem, '/lp/black-friday');
  });

  it('aceita lead sem parâmetros de campanha (atribuição vazia)', () => {
    const { name, whatsapp, email, interesse } = validInput();
    const result = validateLead({ name, whatsapp, email, interesse });
    assert.equal(result.ok, true);
    assert.equal(result.lead.attribution.utm_source, '');
    assert.equal(result.lead.attribution.gclid, '');
  });

  it('rejeita obrigatórios ausentes com erro por campo', () => {
    const result = validateLead({});
    assert.equal(result.ok, false);
    assert.ok(result.errors.name);
    assert.ok(result.errors.whatsapp);
    assert.ok(result.errors.email);
    assert.ok(result.errors.interesse);
  });

  it('rejeita WhatsApp inválido', () => {
    const result = validateLead({ ...validInput(), whatsapp: '12' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.whatsapp);
  });

  it('rejeita e-mail inválido', () => {
    for (const email of ['sem-arroba', 'a@b', 'a b@c.com', 'x@y.com<script>']) {
      const result = validateLead({ ...validInput(), email });
      assert.equal(result.ok, false, `aceitou ${email}`);
      assert.ok(result.errors.email);
    }
  });

  it('rejeita interesse fora da lista conhecida', () => {
    assert.ok(LEAD_INTERESTS.length >= 3);
    const result = validateLead({ ...validInput(), interesse: 'qualquer-coisa' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.interesse);
  });

  it('rejeita nome com marcação HTML/XSS ou muito curto', () => {
    const xss = validateLead({ ...validInput(), name: '<img src=x onerror=alert(1)>' });
    assert.equal(xss.ok, false);
    assert.ok(xss.errors.name);

    const curto = validateLead({ ...validInput(), name: 'A' });
    assert.equal(curto.ok, false);
    assert.ok(curto.errors.name);
  });

  it('aceita nomes com acento, apóstrofo e hífen', () => {
    const result = validateLead({ ...validInput(), name: "José D'Ávila-Neto" });
    assert.equal(result.ok, true);
  });

  it('descarta atributos não-string e campos desconhecidos', () => {
    const result = validateLead({ ...validInput(), utm_source: { $evil: 1 }, outro: 'x' });
    assert.equal(result.ok, true);
    assert.equal(result.lead.attribution.utm_source, '');
    assert.equal('outro' in result.lead, false);
  });

  it('remove marcação HTML dos parâmetros de atribuição e limita tamanho', () => {
    const result = validateLead({ ...validInput(), utm_content: '<b>x</b>'.padEnd(500, 'y') });
    assert.equal(result.ok, true);
    assert.ok(!result.lead.attribution.utm_content.includes('<'));
    assert.ok(result.lead.attribution.utm_content.length <= 200);
  });

  it('sinaliza honeypot preenchido como rejeição silenciosa', () => {
    const result = validateLead({ ...validInput(), website: 'http://spam.example' });
    assert.equal(result.ok, false);
    assert.equal(result.honeypot, true);
  });
});
