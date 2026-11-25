import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildWhatsAppLink } from '../src/utils/whatsapp.js';

describe('buildWhatsAppLink (Tarefa 3.5 / AT-03.5)', () => {
  it('gera link wa.me contendo código curto e parâmetros UTM estruturados', () => {
    const link = buildWhatsAppLink({
      sourceCode: 'hero-cta',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'black-friday'
    });

    assert.ok(link.startsWith('https://wa.me/5511999999999?text='));
    const decoded = decodeURIComponent(link);
    assert.ok(decoded.includes('[ref:hero-cta|utm_source:google|utm_medium:cpc|utm_campaign:black-friday]'));
  });
});
