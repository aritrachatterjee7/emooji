'use strict';
// proxy.js — identical to moo-app version, serves the React Native web build too
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

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups'); // ← add this
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', credsSet: !!(CLIENT_ID && CLIENT_SECRET), timestamp: new Date().toISOString() }));

async function fetchAccessToken() {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('Missing credentials');
  const authHeader = 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const formBody = new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }).toString();
  const result = await httpsPost('https://www.poliruralplus.eu/o/token/', formBody, {
    'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(formBody), 'Accept': 'application/json',
  });
  if (result.status < 200 || result.status >= 300) throw new Error(`Token ${result.status}: ${result.body}`);
  return JSON.parse(result.body).access_token;
}

app.post('/api/token', async (req, res) => {
  try { res.json({ access_token: await fetchAccessToken(), token_type: 'bearer', expires_in: 3600 }); }
  catch (err) { res.status(502).json({ error: 'token_fetch_failed', details: err.message }); }
});

app.post('/api/chat', async (req, res) => {
  try {
    const token = await fetchAccessToken();
    const body  = JSON.stringify(req.body);
    const hdrs  = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'Accept': 'application/json' };
    const endpoints = [`${JACKDAW_BASE}/chat_v2`, `${JACKDAW_BASE}/chat/v2/chat`, `${JACKDAW_BASE}/v2/chat`];
    let chatRes = null;
    for (const url of endpoints) {
      const attempt = await httpsPost(url, body, hdrs);
      if (attempt.status !== 404) { chatRes = attempt; break; }
    }
    if (!chatRes) return res.status(502).json({ error: 'chat_endpoint_not_found' });
    res.status(chatRes.status);
    if (chatRes.headers['content-type']) res.set('Content-Type', chatRes.headers['content-type']);
    res.send(chatRes.body);
  } catch (err) { res.status(503).json({ error: 'chat_api_unavailable', details: err.message }); }
});

const PUBLIC_DIR = path.join(__dirname, 'dist');
app.use(express.static(PUBLIC_DIR, { maxAge: '1h', setHeaders: (res, fp) => { if (fp.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache'); } }));
app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

function httpsPost(urlStr, body, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({ hostname: parsed.hostname, port: parsed.port || 443, path: parsed.pathname + (parsed.search || ''), method: 'POST', headers }, incoming => {
      let data = '';
      incoming.on('data', c => { data += c; });
      incoming.on('end', () => resolve({ status: incoming.statusCode, headers: incoming.headers, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

app.listen(PORT, '0.0.0.0', () => console.log(`✅ Proxy on port ${PORT}`));
