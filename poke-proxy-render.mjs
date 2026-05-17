// poke-proxy.mjs — Render-ready
// Holds your poke.church API key server-side and forwards requests
// from the Pokédesk dashboard.
//
// Required env vars:
//   POKE_API_KEY        your poke.church API key (set in Render dashboard)
//   ALLOWED_ORIGIN      optional, defaults to '*' (the Netlify URL once you know it)
//
// Local dev:
//   POKE_API_KEY=pk_xxx node poke-proxy.mjs

import http from 'node:http';

const PORT           = process.env.PORT || 8787;        // Render sets PORT automatically
const KEY            = process.env.POKE_API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const UPSTREAM       = 'https://api.poke.church';

if (!KEY) {
  console.error('FATAL: Set POKE_API_KEY in environment.');
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin',  ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Health check at /health — Render uses this to know the service is up.
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'poke-proxy', upstream: UPSTREAM }));
    return;
  }

  const upstreamUrl = UPSTREAM + req.url;
  console.log(`→ ${req.method} ${req.url}`);

  try {
    let body;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      body = Buffer.concat(chunks);
    }
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: {
        'X-API-Key': KEY,
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Accept': 'application/json',
      },
      body,
    });
    const text = await upstream.text();
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
    });
    res.end(text);
  } catch (e) {
    console.error('Proxy error:', e);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy failed', detail: String(e) }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`poke-proxy listening on port ${PORT}`);
  console.log(`upstream → ${UPSTREAM}`);
  console.log(`allowed origin → ${ALLOWED_ORIGIN}`);
});
