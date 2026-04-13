/**
 * proxy.js — eMooJI Token Proxy + PWA Static Server
 *
 * Lives at:  moofind/moo-app/proxy.js
 * Serves:    moofind/moo-app/public/  (your PWA files)
 *
 * Render setup:
 *   Root Directory : moo-app
 *   Build Command  : npm install
 *   Start Command  : node proxy.js
 *
 * Environment variables (set in Render dashboard):
 *   JACKDAW_CLIENT_ID      ← your JackDaw OAuth2 client_id
 *   JACKDAW_CLIENT_SECRET  ← your JackDaw OAuth2 client_secret
 *   JACKDAW_BASE_URL       ← optional, default https://api.jackdaw.online
 *   PORT                   ← auto-set by Render, do not set manually
 */

'use strict';

const express = require('express');
const path    = require('path');
const https   = require('https');
const http    = require('http');
const { URL } = require('url');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ── Read credentials from environment — NEVER from request body ──────────────
const CLIENT_ID     = process.env.JACKDAW_CLIENT_ID;
const CLIENT_SECRET = process.env.JACKDAW_CLIENT_SECRET;
const JACKDAW_BASE  = (process.env.JACKDAW_BASE_URL || 'https://api.jackdaw.online')
  .replace(/\/$/, '')
  .replace(/^http:\/\//, 'https://');  // always HTTPS

// ── Startup validation ────────────────────────────────────────────────────────
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('');
  console.error('╔══════════════════════════════════════════════════════════╗');
  console.error('║  MISSING CREDENTIALS — proxy will return 503 on /token  ║');
  console.error('║                                                          ║');
  console.error('║  Fix: In Render dashboard → Environment Variables, add: ║');
  console.error('║    JACKDAW_CLIENT_ID      = your_client_id              ║');
  console.error('║    JACKDAW_CLIENT_SECRET  = your_client_secret          ║');
  console.error('╚══════════════════════════════════════════════════════════╝');
  console.error('');
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS — allow any origin (PWA is same-origin but be explicit for dev)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options',   'nosniff');
  res.setHeader('X-Frame-Options',          'SAMEORIGIN');
  res.setHeader('Referrer-Policy',          'strict-origin-when-cross-origin');
  next();
});

// ── Request logger (shows up in Render logs) ──────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.path} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/health  — liveness probe, also confirms credentials are loaded
// ═════════════════════════════════════════════════════════════════════════════
app.get('/api/health', (req, res) => {
  res.json({
    status:       'ok',
    service:      'emoo-ji-proxy',
    credsSet:     !!(CLIENT_ID && CLIENT_SECRET),
    jackdawBase:  JACKDAW_BASE,
    timestamp:    new Date().toISOString(),
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/token  — exchange server-side credentials for a JackDaw bearer token
//
// The browser calls this with NO body and NO credentials.
// This server calls JackDaw with the real credentials from env vars.
// Only the access_token is returned to the browser — never the credentials.
// ═════════════════════════════════════════════════════════════════════════════
app.post('/api/token', async (req, res) => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(503).json({ error: 'proxy_not_configured' });
  }

  // Polirural OIDC requires Basic Auth Header: Base64(id:secret)
  const authHeader = 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

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
    } catch (err) {
      console.error(`[token] Error at ${endpoint}:`, err.message);
    }
  }

  res.status(502).json({ error: 'token_fetch_failed' });
});

  // ... rest of your loop logic ...
  let lastError = null;

  for (const endpoint of candidates) {
    console.log(`[token] Trying ${endpoint}`);
    try {
      const result = await httpsPost(endpoint, formBody, headers);

      if (result.status === 405) {
        console.log(`[token] 405 on ${endpoint} — wrong method, skipping`);
        continue;
      }
      if (result.status === 404) {
        console.log(`[token] 404 on ${endpoint} — not found, skipping`);
        continue;
      }
      if (result.status === 301 || result.status === 302) {
        const location = result.headers?.location || '';
        console.warn(`[token] Redirect on ${endpoint} → ${location} — skipping (would cause mixed-content)`);
        continue;
      }
      if (result.status >= 400) {
        console.warn(`[token] ${result.status} on ${endpoint}: ${result.body.slice(0, 300)}`);
        lastError = { endpoint, status: result.status, body: result.body.slice(0, 300) };
        continue;
      }

      // Parse JSON response
      let data;
      try {
        data = JSON.parse(result.body);
      } catch {
        console.warn(`[token] Non-JSON from ${endpoint}: ${result.body.slice(0, 100)}`);
        continue;
      }

      if (!data.access_token) {
        console.warn(`[token] No access_token from ${endpoint}:`, JSON.stringify(data).slice(0, 200));
        lastError = { endpoint, status: result.status, body: result.body.slice(0, 300) };
        continue;
      }

      // Success — return ONLY the token to the browser
      console.log(`[token] ✅ Token acquired from ${endpoint}`);
      return res.json({
        access_token: data.access_token,
        token_type:   data.token_type || 'bearer',
        expires_in:   data.expires_in || 3600,
      });

    } catch (err) {
      console.warn(`[token] Network error on ${endpoint}:`, err.message);
      lastError = { endpoint, status: 0, body: err.message };
    }
  }

  // All candidates failed — return useful debug info
  console.error('[token] ❌ All endpoints failed. Last error:', JSON.stringify(lastError));
  return res.status(502).json({
    error:    'token_fetch_failed',
    detail:   'Could not obtain a token from JackDaw. Check the Render logs for which endpoint returned what.',
    lastError,
  });


// ═════════════════════════════════════════════════════════════════════════════
// Static PWA files from ./public/
// ═════════════════════════════════════════════════════════════════════════════
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.static(PUBLIC_DIR, {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    // sw.js must never be cached — browser must always get the latest version
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma',        'no-cache');
      res.setHeader('Service-Worker-Allowed', '/');
    }
    // manifest.json — short cache
    if (filePath.endsWith('manifest.json')) {
      res.setHeader('Cache-Control', 'public, max-age=300');
    }
  },
}));

// SPA fallback — any path not matched above serves index.html
// This makes the PWA work when the user refreshes on any URL
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'), err => {
    if (err) {
      console.error('index.html not found in public/:', err.message);
      res.status(404).send(
        'index.html not found. Make sure public/ folder exists next to proxy.js.'
      );
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Minimal HTTPS POST helper using Node built-ins (no extra dependencies)
// ═════════════════════════════════════════════════════════════════════════════
function httpsPost(urlStr, body, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const options = {
      hostname: parsed.hostname,
      port:     parseInt(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + (parsed.search || ''),
      method:   'POST',
      headers,
    };

    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(options, incoming => {
      let data = '';
      incoming.on('data',  chunk => { data += chunk; });
      incoming.on('end',   ()    => resolve({
        status:  incoming.statusCode,
        headers: incoming.headers,
        body:    data,
      }));
    });

    req.setTimeout(12000, () => {
      req.destroy(new Error(`Timeout after 12s calling ${urlStr}`));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// Start server
// ═════════════════════════════════════════════════════════════════════════════
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log(`✅  eMooJI proxy server started`);
  console.log(`   Port          : ${PORT}`);
  console.log(`   JackDaw URL   : ${JACKDAW_BASE}`);
  console.log(`   Credentials   : ${CLIENT_ID && CLIENT_SECRET ? '✓ set' : '✗ MISSING — set env vars'}`);
  console.log(`   Static files  : ${PUBLIC_DIR}`);
  console.log(`   Health check  : GET /api/health`);
  console.log('');
});