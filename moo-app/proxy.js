'use strict';
const express = require('express');
const path    = require('path');
const https   = require('https');
const http    = require('http');
const { URL } = require('url');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

const CLIENT_ID     = process.env.JACKDAW_CLIENT_ID;
const CLIENT_SECRET = process.env.JACKDAW_CLIENT_SECRET;
const JACKDAW_BASE  = (process.env.JACKDAW_BASE_URL || 'https://api.jackdaw.online')
  .replace(/\/$/, '').replace(/^http:\/\//, 'https://');

const POLIRURAL_TOKEN_URL = 'https://www.poliruralplus.eu/o/token/';

// Dummy WKT - centre of Europe - used when no real polygon is drawn
// Satisfies JackDaw geometry validation without affecting the response
const DUMMY_WKT = {
  srid: 4326,
  wkt: 'POLYGON ((10.0 50.0, 10.1 50.0, 10.1 50.1, 10.0 50.1, 10.0 50.0))',
};

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cross-Origin-Opener-Policy',   'same-origin-allow-popups');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function httpsPost(urlStr, body, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port || 443,
      path:     parsed.pathname + (parsed.search || ''),
      method:   'POST',
      headers,
    }, incoming => {
      let data = '';
      incoming.on('data', c => { data += c; });
      incoming.on('end', () => resolve({ status: incoming.statusCode, headers: incoming.headers, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsPostStream(urlStr, body, headers, onResponse) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port || 443,
      path:     parsed.pathname + (parsed.search || ''),
      method:   'POST',
      headers,
    }, incoming => {
      onResponse(incoming);
      incoming.on('end', resolve);
      incoming.on('error', reject);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function fetchAccessToken() {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('Missing credentials');
  const authHeader = 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const formBody = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
  }).toString();
  const result = await httpsPost(POLIRURAL_TOKEN_URL, formBody, {
    'Authorization':  authHeader,
    'Content-Type':   'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(formBody),
    'Accept':         'application/json',
  });
  if (result.status < 200 || result.status >= 300) throw new Error(`Token ${result.status}: ${result.body}`);
  return JSON.parse(result.body).access_token;
}

app.get('/api/health', (req, res) => res.json({
  status: 'ok', credsSet: !!(CLIENT_ID && CLIENT_SECRET), timestamp: new Date().toISOString(),
}));

app.post('/api/token', async (req, res) => {
  try {
    res.json({ access_token: await fetchAccessToken(), token_type: 'bearer', expires_in: 3600 });
  } catch (err) {
    res.status(502).json({ error: 'token_fetch_failed', details: err.message });
  }
});

app.post('/api/mcp/connect', async (req, res) => {
  try {
    const token = await fetchAccessToken();
    const body  = JSON.stringify(req.body);
    const hdrs  = {
      'Authorization':  `Bearer ${token}`,
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Accept':         'application/json',
    };
    const result = await httpsPost(`${JACKDAW_BASE}/mcp/connect`, body, hdrs);
    res.status(result.status);
    if (result.headers['content-type']) res.set('Content-Type', result.headers['content-type']);
    res.send(result.body);
  } catch (err) {
    res.status(503).json({ error: 'mcp_connect_failed', details: err.message });
  }
});

// Always use /chat/v2/chat.
// Send dummy WKT when no real polygon — satisfies JackDaw validation.
// System prompt tells JackDaw to answer from knowledge only when no real polygon.
app.post('/api/chat', async (req, res) => {
  try {
    const token  = await fetchAccessToken();
    const hasWkt = !!req.body.wkt;

    const sanitized = {
      messages: req.body.messages,
      wkt:      req.body.wkt || DUMMY_WKT,
    };
    if (req.body.system)      sanitized.system      = req.body.system;
    if (req.body.thread_id)   sanitized.thread_id   = req.body.thread_id;
    if (req.body.customer_id) sanitized.customer_id = req.body.customer_id;

    const body = JSON.stringify(sanitized);
    const hdrs = {
      'Authorization':  `Bearer ${token}`,
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Accept':         'application/json',
    };

    console.log(`=== /api/chat | real_wkt: ${hasWkt} | thread: ${!!req.body.thread_id}`);

    const result = await httpsPost(`${JACKDAW_BASE}/chat/v2/chat`, body, hdrs);
    console.log(`=== status: ${result.status}`);
    if (result.status >= 400) console.log('=== error:', result.body.slice(0, 300));

    res.status(result.status);
    if (result.headers['content-type']) res.set('Content-Type', result.headers['content-type']);
    res.send(result.body);
  } catch (err) {
    res.status(503).json({ error: 'chat_api_unavailable', details: err.message });
  }
});

app.post('/api/chat/stream', async (req, res) => {
  try {
    const token = await fetchAccessToken();

    const sanitized = {
      messages: req.body.messages,
      wkt:      req.body.wkt || DUMMY_WKT,
    };
    if (req.body.system)      sanitized.system      = req.body.system;
    if (req.body.thread_id)   sanitized.thread_id   = req.body.thread_id;
    if (req.body.customer_id) sanitized.customer_id = req.body.customer_id;

    const body = JSON.stringify(sanitized);
    const hdrs = {
      'Authorization':  `Bearer ${token}`,
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Accept':         'text/event-stream',
    };

    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.flushHeaders();

    await httpsPostStream(
      `${JACKDAW_BASE}/chat/v2/chat/stream`,
      body,
      hdrs,
      (incoming) => {
        incoming.on('data', chunk => { res.write(chunk); });
        incoming.on('end',  () => { res.end(); });
        incoming.on('error', () => {
          res.write('event: error\ndata: {"message":"Stream error"}\n\n');
          res.end();
        });
      }
    );
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    res.end();
  }
});

const PUBLIC_DIR = path.join(__dirname, 'dist');
app.use(express.static(PUBLIC_DIR, {
  maxAge: '1h',
  setHeaders: (res, fp) => {
    if (fp.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
  },
}));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'api_route_not_found', path: req.path });
  }
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`✅ Proxy on port ${PORT}`));