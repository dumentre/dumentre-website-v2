import { test, expect } from "@playwright/test";

/**
 * Favicon assets: ink-background (#15140f) squares with the paper D+M monogram, generated from
 * assets/brand/dumentre-simbolo-paper.svg by scripts/generate-brand-assets.js — never a
 * transparent PNG. The browser theme color is the paper tone used by the header.
 */
test.describe("Favicon", () => {
  test("favicon.ico responds with a real icon, not the HTML fallback", async ({ request }) => {
    const response = await request.get("/favicon.ico");
    expect(response.status()).toBe(200);

    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).not.toContain("text/html");
    expect(contentType).toMatch(/image\/(x-icon|vnd\.microsoft\.icon)/);

    // Real ICO files start with the reserved 00 00, type 01 00 header.
    const body = await response.body();
    expect(body.length).toBeGreaterThan(0);
    expect(body.readUInt16LE(0)).toBe(0);
    expect(body.readUInt16LE(2)).toBe(1);
  });

  for (const path of [
    "/favicon-16x16.png",
    "/favicon-32x32.png",
    "/apple-touch-icon.png",
    "/android-chrome-192x192.png",
    "/android-chrome-512x512.png",
  ]) {
    test(`${path} responds with image/png`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("image/png");
    });
  }

  test("site.webmanifest is valid JSON with the expected name and colors", async ({ request }) => {
    const response = await request.get("/site.webmanifest");
    expect(response.status()).toBe(200);

    const manifest = await response.json();
    expect(manifest.name).toBe("Dumentre");
    expect(manifest.short_name).toBe("Dumentre");
    expect(manifest.theme_color).toBe("#f4f1ea");
    expect(manifest.background_color).toBe("#15140f");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/android-chrome-192x192.png", sizes: "192x192" }),
        expect.objectContaining({ src: "/android-chrome-512x512.png", sizes: "512x512" }),
      ])
    );
  });

  test("index.html references all favicon assets in <head>", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator('link[rel="icon"][sizes="any"]')).toHaveAttribute("href", "/favicon.ico");
    await expect(page.locator('link[rel="icon"][sizes="32x32"]')).toHaveAttribute("href", "/favicon-32x32.png");
    await expect(page.locator('link[rel="icon"][sizes="16x16"]')).toHaveAttribute("href", "/favicon-16x16.png");
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/apple-touch-icon.png");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/site.webmanifest");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#f4f1ea");
  });
});
