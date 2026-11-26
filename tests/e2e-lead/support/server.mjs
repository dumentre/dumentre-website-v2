/**
 * Servidor local para os testes E2E do lead. Serve dist/ (saída de `npm run build`) e
 * roteia /api/lead para a MESMA função usada no Cloudflare Pages (functions/api/lead.js),
 * apontando o Chatwoot para o simulador em /__chatwoot__ (somente loopback, token falso).
 *
 * Uso: node tests/e2e-lead/support/server.mjs   (porta: PORT, padrão 8800)
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { onRequestPost } from '../../../functions/api/lead.js';
import { createChatwootSim } from './chatwoot-sim.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..', '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT ?? 8800);
const SIM_PREFIX = '/__chatwoot__';

const sim = createChatwootSim({ token: process.env.CHATWOOT_API_TOKEN, accountId: process.env.CHATWOOT_ACCOUNT_ID });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = path.normalize(path.join(DIST, rel));
  if (!file.startsWith(DIST) || !existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
  const body = await readFile(file);
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  res.end(req.method === 'HEAD' ? undefined : body);
}

async function handleLead(req, res) {
  const raw = await readBody(req);
  const request = new Request(`http://127.0.0.1:${PORT}/api/lead`, {
    method: 'POST',
    headers: { 'content-type': req.headers['content-type'] ?? '' },
    body: raw
  });
  const response = await onRequestPost({ request, env: process.env });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(await response.text());
}

async function handleSim(req, res, url) {
  const raw = await readBody(req);
  let body;
  try {
    body = raw.length ? JSON.parse(raw.toString('utf8')) : undefined;
  } catch {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'json inválido' }));
    return;
  }
  const pathname = url.pathname.slice(SIM_PREFIX.length) || '/';
  const out = sim.handle({
    method: req.method,
    pathname,
    query: url.searchParams,
    headers: req.headers,
    body
  });
  res.writeHead(out.status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(out.data));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (url.pathname === '/api/lead') {
      if (req.method !== 'POST') {
        res.writeHead(405, { allow: 'POST' });
        res.end();
        return;
      }
      return handleLead(req, res);
    }
    if (url.pathname.startsWith(SIM_PREFIX)) return handleSim(req, res, url);
    return serveStatic(req, res, url.pathname);
  } catch (err) {
    console.error('server error', err?.name ?? 'Error');
    res.writeHead(500);
    res.end();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`lead e2e server on http://127.0.0.1:${PORT}`);
});
