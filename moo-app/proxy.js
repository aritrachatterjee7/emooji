'use strict';

const express = require('express');
const path    = require('path');
const https   = require('https');
const http    = require('http');
const { URL } = require('url');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ── Read credentials from Render Env Vars ─────────────────────────────────────
const CLIENT_ID     = process.env.JACKDAW_CLIENT_ID;
const CLIENT_SECRET = process.env.JACKDAW_CLIENT_SECRET;
const JACKDAW_BASE  = (process.env.JACKDAW_BASE_URL || 'https://api.jackdaw.online')
  .replace(/\/$/, '')
  .replace(/^http:\/\//, 'https://'); 

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Health Check (To verify the server is actually ALIVE) ─────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:   'ok',
    credsSet: !!(CLIENT_ID && CLIENT_SECRET),
    timestamp: new Date().toISOString(),
  });
});

// ── Helper: Fetch OAuth2 token (used by both /token and /chat endpoints) ─────
async function fetchAccessToken() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing CLIENT_ID or CLIENT_SECRET');
  }

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

  // Primary token endpoint (Polirural/Django OIDC)
  const tokenEndpoint = 'https://www.poliruralplus.eu/o/token/';
  
  const result = await httpsPost(tokenEndpoint, formBody, headers);
  
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Token request failed with status ${result.status}: ${result.body}`);
  }
  
  const data = JSON.parse(result.body);
  return data.access_token;
}

// ── The Auth Bridge (Original endpoint for frontend token requests) ───────────
app.post('/api/token', async (req, res) => {
  try {
    const access_token = await fetchAccessToken();
    res.json({
      access_token,
      token_type: 'bearer',
      expires_in: 3600,
    });
  } catch (err) {
    console.error('[token] Error:', err.message);
    res.status(502).json({ error: 'token_fetch_failed', details: err.message });
  }
});

// ── Chat Proxy (Handles token + correct path automatically) ───────────────────
app.post('/api/chat', async (req, res) => {
  try {
    // 1. Obtain a fresh token
    const access_token = await fetchAccessToken();

    // 2. Prepare the request to JackDaw
    const chatBody = JSON.stringify(req.body);
    const chatHeaders = {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(chatBody),
      'Accept': 'application/json',
    };

    // 3. Try JackDaw chat endpoints in order until one succeeds.
    //    /chat_v2        — original working path (try first)
    //    /chat/v2/chat   — alternate path (try second)
    //    /v2/chat        — another common variant
    const chatEndpoints = [
      `${JACKDAW_BASE}/chat_v2`,
      `${JACKDAW_BASE}/chat/v2/chat`,
      `${JACKDAW_BASE}/v2/chat`,
    ];

    let chatResponse = null;
    let usedUrl = null;

    for (const url of chatEndpoints) {
      console.log(`[chat] Trying ${url}`);
      const attempt = await httpsPost(url, chatBody, chatHeaders);
      // 404 = wrong path, try next. Anything else (200, 400, 401, 500) = right path.
      if (attempt.status === 404) {
        console.log(`[chat] 404 on ${url} — trying next endpoint`);
        continue;
      }
      chatResponse = attempt;
      usedUrl = url;
      console.log(`[chat] Got ${attempt.status} from ${url}`);
      break;
    }

    if (!chatResponse) {
      return res.status(502).json({
        error: 'chat_endpoint_not_found',
        detail: 'All JackDaw chat endpoint candidates returned 404. Check JACKDAW_BASE_URL.',
        tried: chatEndpoints,
      });
    }

    // 4. Forward status, headers, and body back to the frontend
    res.status(chatResponse.status);

    if (chatResponse.headers['content-type']) {
      res.set('Content-Type', chatResponse.headers['content-type']);
    }

    res.send(chatResponse.body);
  } catch (err) {
    console.error('[chat] Proxy error:', err.message);
    res.status(503).json({ error: 'chat_api_unavailable', details: err.message });
  }
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

// ── Helper Function: HTTPS POST ───────────────────────────────────────────────
function httpsPost(urlStr, body, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      method: 'POST',
      headers,
    }, incoming => {
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

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Proxy started on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   Chat proxy:   POST /api/chat`);
});