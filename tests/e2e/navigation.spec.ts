import { test, expect } from "@playwright/test";
import { NAV_SECTIONS } from "./helpers/selectors";

test.describe("Navigation", () => {
  // The desktop nav (with the visible link list) is hidden by CSS under 900px; mobile
  // navigation is covered separately in mobile-menu.spec.ts.
  test.skip(({ isMobile }) => isMobile, "Desktop-only: header nav list is hidden on mobile");

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  for (const section of NAV_SECTIONS) {
    test(`header link "${section.label}" navigates to ${section.hash}`, async ({ page }) => {
      const link = page.locator("nav.nav-menu").getByRole("link", { name: section.label, exact: true });
      await link.click();

      await expect(page).toHaveURL(new RegExp(`\\${section.hash}$`));

      const target = page.locator(section.hash);
      await expect(target).toBeInViewport();
    });
  }

  test("active-nav class follows the clicked section", async ({ page }) => {
    const solucoesLink = page.locator("nav.nav-menu").getByRole("link", { name: "Soluções", exact: true });
    await solucoesLink.click();

    await expect(solucoesLink).toHaveClass(/active-nav/);

    const ofertasLink = page.locator("nav.nav-menu").getByRole("link", { name: "Ofertas", exact: true });
    await expect(ofertasLink).not.toHaveClass(/active-nav/);
  });

  test("footer links resolve to the same real sections", async ({ page }) => {
    for (const section of NAV_SECTIONS) {
      const target = page.locator(section.hash);
      await expect(target).toHaveCount(1);
    }

    // Sections that left the header nav stay reachable from the footer.
    for (const hash of ["#problemas", "#produtos-entrada"]) {
      await expect(page.locator("footer").locator(`a[href="${hash}"]`)).toHaveCount(1);
      await expect(page.locator(hash)).toHaveCount(1);
    }

    // Footer uses a slightly different label for the FAQ link; confirm it points at #faq too.
    const footerFaqLink = page.locator("footer").getByRole("link", { name: "Perguntas Frequentes" });
    await expect(footerFaqLink).toHaveAttribute("href", "#faq");
  });
});
