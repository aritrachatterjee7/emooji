'use strict';

/**
 * eMooJI Token Proxy + PWA Static Server
 * Final Consolidated Version - 100% Clean
 */

const express = require('express');
const path    = require('path');
const https   = require('https');
const http    = require('http');
const { URL } = require('url');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ── Read credentials ──────────────────────────────────────────────────────────
const CLIENT_ID     = process.env.JACKDAW_CLIENT_ID;
const CLIENT_SECRET = process.env.JACKDAW_CLIENT_SECRET;
const JACKDAW_BASE  = (process.env.JACKDAW_BASE_URL || 'https://api.jackdaw.online')
  .replace(/\/$/, '')
  .replace(/^http:\/\//, 'https://'); 

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:   'ok',
    service:  'emoo-ji-proxy',
    credsSet: !!(CLIENT_ID && CLIENT_SECRET),
    jackdawBase: JACKDAW_BASE,
    timestamp: new Date().toISOString(),
  });
});

// ── POST /api/token Handler ───────────────────────────────────────────────────
app.post('/api/token', async (req, res) => { 
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(503).json({ 
      error: 'proxy_not_configured',
      detail: 'Missing JACKDAW_CLIENT_ID or JACKDAW_CLIENT_SECRET in Render env vars.'
    });
  }

  // 1. Basic Auth Header
  const authHeader = 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  // 2. Form Body
  const formBody = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET
  }).toString();

  const headers = {
    'Authorization':  authHeader,
    'Content-Type':   'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(formBody),
    'Accept':         'application/json',
  };

  const candidates = [
    'https://www.poliruralplus.eu/o/token/', 
    `${JACKDAW_BASE}/token`,
    `${JACKDAW_BASE}/auth/token`
  ];

  let lastError = null;

  for (const endpoint of candidates) {
    console.log(`[token] Trying ${endpoint}`);
    try {
      const result = await httpsPost(endpoint, formBody, headers);

      if (result.status >= 200 && result.status < 300) {
        const data = JSON.parse(result.body);
        console.log(`[token] ✅ Success from ${endpoint}`);
        return res.json({
          access_token: data.access_token,
          token_type:   data.token_type || 'bearer',
          expires_in:   data.expires_in || 3600,
        });
      }
      
      console.warn(`[token] ${result.status} from ${endpoint}`);
      lastError = { endpoint, status: result.status, body: result.body.slice(0, 200) };
    } catch (err) {
      console.warn(`[token] Error at ${endpoint}:`, err.message);
      lastError = { endpoint, status: 0, body: err.message };
    }
  }

  res.status(502).json({ error: 'token_fetch_failed', lastError });
});

// ── Static Files & SPA Fallback ───────────────────────────────────────────────
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.static(PUBLIC_DIR, {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ── Helper ────────────────────────────────────────────────────────────────────
function httpsPost(urlStr, body, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const lib = parsed.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      method: 'POST',
      headers,
    };

    const req = lib.request(options, incoming => {
      let data = '';
      incoming.on('data', chunk => { data += chunk; });
      incoming.on('end', () => resolve({
        status: incoming.statusCode,
        headers: incoming.headers,
        body: data,
      }));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Proxy started on port ${PORT}`);
});