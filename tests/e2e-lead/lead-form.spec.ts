import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

// Token falso do simulador local (ver playwright.lead.config.ts). Não é credencial real.
const SIM_TOKEN = "sim-token-local-only";
const SIM = "/__chatwoot__/api/v1/accounts/7";
const SUCCESS = "Recebemos seu contato. Em breve nossa equipe fala com você pelo WhatsApp.";
const FAILURE = "Não foi possível enviar seu contato agora. Tente novamente ou fale com a gente pelo WhatsApp.";

async function resetSim(request: APIRequestContext) {
  const res = await request.post("/__chatwoot__/__sim/reset");
  expect(res.status()).toBe(200);
}

/** GET autenticado na API (simulada): busca o contato pelo e-mail e devolve os detalhes. */
async function getContactByEmail(request: APIRequestContext, email: string) {
  const search = await request.get(`${SIM}/contacts/search`, {
    params: { q: email },
    headers: { api_access_token: SIM_TOKEN },
  });
  expect(search.status()).toBe(200);
  const { payload } = await search.json();
  const hit = (payload as Array<{ id: number; email: string }>).find((c) => c.email === email);
  if (!hit) return null;
  const detail = await request.get(`${SIM}/contacts/${hit.id}`, {
    headers: { api_access_token: SIM_TOKEN },
  });
  expect(detail.status()).toBe(200);
  return (await detail.json()).payload;
}

async function fillLead(page: Page, overrides: Partial<Record<"name" | "whatsapp" | "email", string>> = {}) {
  await page.locator("#lead-name").fill(overrides.name ?? "Maria Silva");
  await page.locator("#lead-whatsapp").fill(overrides.whatsapp ?? "(11) 99999-9999");
  await page.locator("#lead-email").fill(overrides.email ?? "maria.e2e@example.com");
  await page.locator("#lead-interesse").selectOption("site-institucional");
}

test.beforeEach(async ({ request }) => {
  await resetSim(request);
});

test("página pública responde 200 e exibe o formulário de lead", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator("#lead-form")).toBeVisible();
  await expect(page.locator("#lead-name")).toBeVisible();
  await expect(page.locator("#lead-whatsapp")).toBeVisible();
  await expect(page.locator("#lead-email")).toBeVisible();
  await expect(page.locator("#lead-interesse")).toBeVisible();
});

test("lead válido com atribuição cria contato e conversa com UTMs, gclid, fbclid e página de origem", async ({
  page,
  request,
}) => {
  const email = "maria.atribuicao@example.com";
  await page.goto(
    "/?utm_source=google&utm_medium=cpc&utm_campaign=black-friday&utm_content=banner-topo&utm_term=agencia%20digital&gclid=Cj0KCQ-e2e&fbclid=IwAR-e2e"
  );
  await fillLead(page, { email });
  await page.locator("[data-lead-submit]").click();
  await expect(page.locator("[data-lead-status]")).toHaveText(SUCCESS);

  const contact = await getContactByEmail(request, email);
  expect(contact).not.toBeNull();
  expect(contact.name).toBe("Maria Silva");
  expect(contact.phone_number).toBe("+5511999999999");
  expect(contact.custom_attributes).toMatchObject({
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "black-friday",
    utm_content: "banner-topo",
    utm_term: "agencia digital",
    gclid: "Cj0KCQ-e2e",
    fbclid: "IwAR-e2e",
    pagina_origem: "/",
    interesse: "site-institucional",
  });
  expect(contact.conversation_ids.length).toBe(1);
});

test("atribuição da visita persiste para o envio feito em outra página da mesma sessão", async ({
  page,
  request,
}) => {
  const email = "ana.sessao@example.com";
  await page.goto("/?utm_source=ads-sessao");
  await page.goto("/");
  await fillLead(page, { name: "Ana Souza", email });
  await page.locator("[data-lead-submit]").click();
  await expect(page.locator("[data-lead-status]")).toHaveText(SUCCESS);

  const contact = await getContactByEmail(request, email);
  expect(contact.custom_attributes.utm_source).toBe("ads-sessao");
});

test("entrada inválida mostra erro por campo e não envia nada", async ({ page }) => {
  const sent: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/lead")) sent.push(req.url());
  });
  await page.goto("/");
  await fillLead(page, { whatsapp: "12", email: "nao-e-email" });
  await page.locator("[data-lead-submit]").click();

  await expect(page.locator('[data-error-for="whatsapp"]')).toHaveText("Informe um WhatsApp válido com DDD.");
  await expect(page.locator('[data-error-for="email"]')).toHaveText("Informe um e-mail válido.");
  await expect(page.locator("[data-lead-status]")).not.toHaveText(SUCCESS);
  expect(sent).toHaveLength(0);
});

test("nome com marcação HTML é rejeitado e nenhum script executa", async ({ page }) => {
  let dialogFired = false;
  page.on("dialog", async (d) => {
    dialogFired = true;
    await d.dismiss();
  });
  const sent: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/lead")) sent.push(req.url());
  });

  await page.goto("/");
  await fillLead(page, { name: '<img src=x onerror="alert(1)">' });
  await page.locator("[data-lead-submit]").click();

  await expect(page.locator('[data-error-for="name"]')).toHaveText("Use apenas letras no nome.");
  expect(sent).toHaveLength(0);
  expect(dialogFired).toBe(false);
});

test("falha de integração informa a falha sem declarar sucesso e sem expor o token", async ({ page, request }) => {
  const email = "falha.e2e@example.com";
  const armed = await request.post("/__chatwoot__/__sim/fail-next");
  expect(armed.status()).toBe(200);

  await page.goto("/");
  await fillLead(page, { email });
  await page.locator("[data-lead-submit]").click();

  const status = page.locator("[data-lead-status]");
  await expect(status).toHaveText(FAILURE);
  await expect(status).not.toHaveText(SUCCESS);
  expect(await page.content()).not.toContain(SIM_TOKEN);
  expect(await getContactByEmail(request, email)).toBeNull();
});

test("mesmo e-mail enviado de novo reaproveita o contato e cria outra conversa", async ({ page, request }) => {
  const email = "repetido.e2e@example.com";
  await page.goto("/?utm_source=primeiro");
  await fillLead(page, { email });
  await page.locator("[data-lead-submit]").click();
  await expect(page.locator("[data-lead-status]")).toHaveText(SUCCESS);

  await page.goto("/?utm_source=segundo");
  await fillLead(page, { email });
  await page.locator("[data-lead-submit]").click();
  await expect(page.locator("[data-lead-status]")).toHaveText(SUCCESS);

  const contact = await getContactByEmail(request, email);
  expect(contact.custom_attributes.utm_source).toBe("segundo");
  expect(contact.conversation_ids.length).toBe(2);
});
