#!/usr/bin/env node
/**
 * Regenerates favicons, app icons and the Open Graph image from the vector symbol
 * (assets/brand/dumentre-simbolo-paper.svg), so no icon is ever hand-exported again.
 *
 *   node scripts/generate-brand-assets.js
 *
 * Uses the Playwright Chromium already installed for the e2e tests. favicon.ico is
 * assembled here as a PNG-compressed ICO (16, 32 and 48 px), which every current browser reads.
 */

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const INK = "#15140f";
const PAPER = "#f4f1ea";
const symbol = fs.readFileSync(path.join(ROOT, "assets/brand/dumentre-simbolo-paper.svg"), "utf8");

const ICONS = [
  { file: "favicon-16x16.png", size: 16, scale: 0.86 },
  { file: "favicon-32x32.png", size: 32, scale: 0.78 },
  { file: "favicon-48x48.tmp.png", size: 48, scale: 0.74 },
  { file: "apple-touch-icon.png", size: 180, scale: 0.62 },
  { file: "android-chrome-192x192.png", size: 192, scale: 0.62 },
  { file: "android-chrome-512x512.png", size: 512, scale: 0.62 },
];

function iconHtml(size, scale) {
  const h = Math.round(size * scale);
  return `<html><body style="margin:0;width:${size}px;height:${size}px;background:${INK};display:grid;place-items:center">
    <div style="height:${h}px;width:${Math.round((h * 630) / 655)}px">${symbol.replace(/width="630" height="655"/, 'width="100%" height="100%"')}</div>
  </body></html>`;
}

const OG_HTML = `<html><head>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=Schibsted+Grotesk:wght@800&display=swap" rel="stylesheet">
<style>
  body { margin:0; width:1200px; height:630px; background:${PAPER}; color:${INK}; font-family:"Schibsted Grotesk"; position:relative; overflow:hidden; }
  .grid { position:absolute; inset:0; background-image:linear-gradient(#d9d4c7 1px,transparent 1px),linear-gradient(90deg,#d9d4c7 1px,transparent 1px); background-size:40px 40px; opacity:.45; }
  .top { position:absolute; left:72px; right:72px; top:56px; display:flex; justify-content:space-between; font:500 20px "IBM Plex Mono"; color:#6b675e; padding-bottom:20px; border-bottom:2px solid ${INK}; }
  h1 { position:absolute; left:72px; top:140px; width:1000px; margin:0; font-weight:800; font-size:76px; line-height:1; letter-spacing:-.045em; }
  mark { background:linear-gradient(transparent 10%,#eaf05a 10%,#eaf05a 90%,transparent 90%); color:inherit; }
  .foot { position:absolute; left:72px; right:72px; bottom:56px; display:flex; justify-content:space-between; align-items:center; }
  .lock { display:flex; align-items:center; gap:18px; font-weight:800; font-size:48px; letter-spacing:-.05em; }
  .lock svg { height:50px; width:48px; }
  .tag { font:500 20px "IBM Plex Mono"; color:#2236f5; }
</style></head><body><div class="grid"></div>
<div class="top"><span>Sites · sistemas · automações</span><span>dumentre.com</span></div>
<h1>Enquanto você cuida do negócio, <mark>a gente cuida do digital.</mark></h1>
<div class="foot"><div class="lock">${symbol.replace(/fill="#F4F1EA"/, `fill="${INK}"`).replace(/width="630" height="655"/, "")}dumentre</div><span class="tag">Escopo, prazo e preço fechados →</span></div>
</body></html>`;

function buildIco(pngBuffers) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngBuffers.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngBuffers.length;
  for (const { size, data } of pngBuffers) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.data)]);
}

(async () => {
  const browser = await chromium.launch();
  const icoParts = [];
  for (const { file, size, scale } of ICONS) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(iconHtml(size, scale));
    const out = path.join(ROOT, file);
    await page.screenshot({ path: out, omitBackground: false });
    if (size <= 48) icoParts.push({ size, data: fs.readFileSync(out) });
    await page.close();
  }
  fs.writeFileSync(path.join(ROOT, "favicon.ico"), buildIco(icoParts));
  fs.unlinkSync(path.join(ROOT, "favicon-48x48.tmp.png"));

  const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await og.setContent(OG_HTML, { waitUntil: "networkidle" });
  await og.evaluate(() => document.fonts.ready);
  await og.screenshot({ path: path.join(ROOT, "og-image.png") });
  await browser.close();
  console.log("[generate-brand-assets] favicons, app icons and og-image.png written");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
