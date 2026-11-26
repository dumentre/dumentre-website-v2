import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.CW_BASE_URL ?? "";
const ACC = process.env.CW_ACCOUNT ?? "2";
const TOKEN = process.env.CW_TOKEN ?? "";
const API = `${BASE}/api/v1/accounts/${ACC}`;
const SUCCESS = "Recebemos seu contato. Em breve nossa equipe fala com voc\u00ea pelo WhatsApp.";

test.skip(!BASE || !TOKEN, "defina CW_BASE_URL e CW_TOKEN (ver scripts/run-e2e-real.py)");

test("lead com UTMs grava contato real no Chatwoot com atributos utm_*", async ({ page, request }) => {
  const stamp = Date.now();
  const email = `teste+e2e-${stamp}@dumentre.com`;
  const headers = { api_access_token: TOKEN };

  await page.goto(
    "/?utm_source=teste&utm_medium=cpc&utm_campaign=e2e-real&utm_content=banner&utm_term=agencia&gclid=e2e-gclid&fbclid=e2e-fbclid"
  );
  await page.locator("#lead-name").fill("Teste Automatizado");
  await page.locator("#lead-whatsapp").fill("(11) 99999-9999");
  await page.locator("#lead-email").fill(email);
  await page.locator("#lead-interesse").selectOption("site-institucional");
  await page.locator("[data-lead-submit]").click();
  await expect(page.locator("[data-lead-status]")).toHaveText(SUCCESS);

  let contactId = 0;
  for (let i = 0; i < 10 && !contactId; i++) {
    const s = await request.get(API + "/contacts/search", { params: { q: email }, headers });
    expect(s.status()).toBe(200);
    const items = (await s.json()).payload as Array<{ id: number; email: string }>;
    contactId = items.find((c) => c.email === email)?.id ?? 0;
    if (contactId === 0) await page.waitForTimeout(1500);
  }
  expect(contactId, "contato criado no Chatwoot").toBeGreaterThan(0);

  const detail = await request.get(API + "/contacts/" + contactId, { headers });
  expect(detail.status()).toBe(200);
  const contact = (await detail.json()).payload;
  expect(contact.custom_attributes).toMatchObject({
    utm_source: "teste",
    utm_medium: "cpc",
    utm_campaign: "e2e-real",
    utm_content: "banner",
    utm_term: "agencia",
    gclid: "e2e-gclid",
    fbclid: "e2e-fbclid",
    interesse: "site-institucional",
  });

  const cUrl = API + "/contacts/" + contactId + "/conversations";
  const convs = await request.get(cUrl, { headers });
  expect(convs.status()).toBe(200);
  const list = (await convs.json()).payload as Array<{ id: number; inbox_id: number }>;
  expect(list.length).toBeGreaterThanOrEqual(1);
  const labelUrl = API + "/conversations/" + list[0].id + "/labels";
  const lab = await request.post(labelUrl, { headers, data: { labels: ["lead-site-teste"] } });
  expect(lab.status()).toBe(200);
  mkdirSync("test-results", { recursive: true });
  const evidence = { contact_id: contactId, conversation_id: list[0].id, inbox_id: list[0].inbox_id, custom_attributes: contact.custom_attributes };
  writeFileSync("test-results/chatwoot-contact-evidence.json", JSON.stringify(evidence, null, 2));
});
