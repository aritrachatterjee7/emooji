'use strict';
const express = require('express');
const path    = require('path');
const https   = require('https');
const http    = require('http');
const { URL } = require('url');
const { Pool } = require('pg');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

const CLIENT_ID     = process.env.JACKDAW_CLIENT_ID;
const CLIENT_SECRET = process.env.JACKDAW_CLIENT_SECRET;
const JACKDAW_BASE  = (process.env.JACKDAW_BASE_URL || 'https://api.jackdaw.online')
  .replace(/\/$/, '').replace(/^http:\/\//, 'https://');

const POLIRURAL_TOKEN_URL = 'https://www.poliruralplus.eu/o/token/';

const DUMMY_WKT = {
  srid: 4326,
  wkt: 'POLYGON ((10.0 50.0, 10.1 50.0, 10.1 50.1, 10.0 50.1, 10.0 50.0))',
};

// ── PostgreSQL ─────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ||
    'postgresql://emooji_db_user:yvEqiXeKYGME06DTCzGnMWlPEjA68Nkd@dpg-d7q63upugtpc73anvsqg-a.oregon-postgres.render.com/emooji_db',
  ssl: { rejectUnauthorized: false },
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     TEXT NOT NULL,
        title       TEXT NOT NULL DEFAULT 'New Chat',
        polygon     JSONB,
        field_stats JSONB,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS messages (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
        role       TEXT NOT NULL,
        content    TEXT NOT NULL,
        time       TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
    `);
    console.log('✅ DB tables ready');
  } catch (err) {
    console.error('DB init error:', err.message);
  } finally {
    client.release();
  }
}
initDB();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');
  res.setHeader('Cross-Origin-Opener-Policy',   'same-origin-allow-popups');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function httpsRequest(method, urlStr, body, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port || 443,
      path:     parsed.pathname + (parsed.search || ''),
      method,
      headers,
    }, incoming => {
      let data = '';
      incoming.on('data', c => { data += c; });
      incoming.on('end', () => resolve({ status: incoming.statusCode, headers: incoming.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function httpsPost(urlStr, body, headers) {
  return httpsRequest('POST', urlStr, body, headers);
}

function httpsDelete(urlStr, headers) {
  return httpsRequest('DELETE', urlStr, null, headers);
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

async function fetchAccessToken(retries = 3) {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('Missing credentials');
  const authHeader = 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const formBody = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
  }).toString();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await httpsPost(POLIRURAL_TOKEN_URL, formBody, {
        'Authorization':  authHeader,
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(formBody),
        'Accept':         'application/json',
      });
      if (result.status >= 200 && result.status < 300) {
        return JSON.parse(result.body).access_token;
      }
      console.warn(`Token attempt ${attempt}/${retries} failed: ${result.status}`);
      if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * attempt));
    } catch (err) {
      console.warn(`Token attempt ${attempt}/${retries} error: ${err.message}`);
      if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error('Token fetch failed after ' + retries + ' attempts');
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

app.delete('/api/mcp/all', async (req, res) => {
  try {
    const token  = await fetchAccessToken();
    const result = await httpsDelete(`${JACKDAW_BASE}/mcp/all`, {
      'Authorization': `Bearer ${token}`,
      'Accept':        'application/json',
    });
    console.log('=== MCP disconnect status:', result.status);
    res.status(result.status);
    if (result.headers['content-type']) res.set('Content-Type', result.headers['content-type']);
    res.send(result.body);
  } catch (err) {
    res.status(503).json({ error: 'mcp_disconnect_failed', details: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const token = await fetchAccessToken();
    // Always send WKT — real polygon from client or dummy fallback
    // JackDaw requires geometry to use its built-in climate/NDVI/terrain tools
    const sanitized = { messages: req.body.messages };
    if (req.body.system)      sanitized.system      = req.body.system;
    if (req.body.thread_id)   sanitized.thread_id   = req.body.thread_id;
    if (req.body.customer_id) sanitized.customer_id = req.body.customer_id;
    sanitized.wkt = req.body.wkt || DUMMY_WKT;

    const body = JSON.stringify(sanitized);
    const hdrs = {
      'Authorization':  `Bearer ${token}`,
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Accept':         'application/json',
    };

    const result = await httpsPost(`${JACKDAW_BASE}/chat/v2/chat`, body, hdrs);
    res.status(result.status);
    if (result.headers['content-type']) res.set('Content-Type', result.headers['content-type']);
    res.send(result.body);
  } catch (err) {
    res.status(503).json({ error: 'chat_api_unavailable', details: err.message });
  }
});

// ── Chat stream with SSE debug logging ────────────────────────────────────
app.post('/api/chat/stream', async (req, res) => {
  try {
    const token = await fetchAccessToken();
    // Always send WKT — use real polygon if drawn, dummy WKT if not
    const DUMMY_WKT_S = { srid: 4326, wkt: 'POLYGON ((10.0 50.0, 10.1 50.0, 10.1 50.1, 10.0 50.1, 10.0 50.0))' };
    const sanitized = { messages: req.body.messages };
    if (req.body.system)      sanitized.system      = req.body.system;
    if (req.body.thread_id)   sanitized.thread_id   = req.body.thread_id;
    if (req.body.customer_id) sanitized.customer_id = req.body.customer_id;
    sanitized.wkt = req.body.wkt || DUMMY_WKT_S;

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

    await httpsPostStream(`${JACKDAW_BASE}/chat/v2/chat/stream`, body, hdrs, (incoming) => {
      incoming.on('data', chunk => {
        res.write(chunk);
      });
      incoming.on('end', () => { res.end(); });
      incoming.on('error', () => {
        res.write('event: error\ndata: {"message":"Stream error"}\n\n');
        res.end();
      });
    });
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    res.end();
  }
});

// ── Session API ────────────────────────────────────────────────────────────
function requireUserId(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'X-User-Id header required' });
  req.userId = userId;
  next();
}

app.get('/api/sessions', requireUserId, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, polygon, field_stats, created_at, updated_at
       FROM sessions WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 50`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'db_error', details: err.message });
  }
});

app.post('/api/sessions', requireUserId, async (req, res) => {
  try {
    const { title, messages, polygon, fieldStats } = req.body;
    if (!messages || messages.length === 0) return res.status(400).json({ error: 'No messages' });

    const autoTitle = title ||
      messages.find(m => m.role === 'user')?.content?.slice(0, 60) || 'New Chat';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const sessionRes = await client.query(
        `INSERT INTO sessions (user_id, title, polygon, field_stats) VALUES ($1, $2, $3, $4) RETURNING id`,
        [req.userId, autoTitle, polygon ? JSON.stringify(polygon) : null, fieldStats ? JSON.stringify(fieldStats) : null]
      );
      const sessionId = sessionRes.rows[0].id;
      for (const msg of messages) {
        await client.query(
          `INSERT INTO messages (session_id, role, content, time) VALUES ($1, $2, $3, $4)`,
          [sessionId, msg.role, msg.content, msg.time || null]
        );
      }
      await client.query('COMMIT');
      res.json({ id: sessionId, title: autoTitle });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: 'db_error', details: err.message });
  }
});

app.put('/api/sessions/:id', requireUserId, async (req, res) => {
  try {
    const { messages, polygon, fieldStats } = req.body;
    if (!messages || messages.length === 0) return res.status(400).json({ error: 'No messages' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE sessions SET polygon=$1, field_stats=$2, updated_at=NOW() WHERE id=$3 AND user_id=$4`,
        [polygon ? JSON.stringify(polygon) : null, fieldStats ? JSON.stringify(fieldStats) : null, req.params.id, req.userId]
      );
      await client.query(`DELETE FROM messages WHERE session_id=$1`, [req.params.id]);
      for (const msg of messages) {
        await client.query(
          `INSERT INTO messages (session_id, role, content, time) VALUES ($1, $2, $3, $4)`,
          [req.params.id, msg.role, msg.content, msg.time || null]
        );
      }
      await client.query('COMMIT');
      res.json({ id: req.params.id });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: 'db_error', details: err.message });
  }
});

app.get('/api/sessions/:id', requireUserId, async (req, res) => {
  try {
    const sessionRes = await pool.query(
      `SELECT id, title, polygon, field_stats, created_at FROM sessions WHERE id=$1 AND user_id=$2`,
      [req.params.id, req.userId]
    );
    if (sessionRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const messagesRes = await pool.query(
      `SELECT role, content, time FROM messages WHERE session_id=$1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json({ ...sessionRes.rows[0], messages: messagesRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'db_error', details: err.message });
  }
});

app.delete('/api/sessions/:id', requireUserId, async (req, res) => {
  try {
    await pool.query(`DELETE FROM sessions WHERE id=$1 AND user_id=$2`, [req.params.id, req.userId]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'db_error', details: err.message });
  }
});

// ── Static ─────────────────────────────────────────────────────────────────
const PUBLIC_DIR = path.join(__dirname, 'dist');
app.use(express.static(PUBLIC_DIR, {
  maxAge: '1h',
  setHeaders: (res, fp) => {
    if (fp.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
  },
}));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not_found' });
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ── Keep-alive ping — prevents Render free tier spin-down ─────────────────
if (process.env.RENDER_EXTERNAL_URL) {
  const SELF_URL = process.env.RENDER_EXTERNAL_URL;
  setInterval(() => {
    require('https').get(`${SELF_URL}/api/health`, () => {}).on('error', () => {});
    console.log('Keep-alive ping sent');
  }, 10 * 60 * 1000); // every 10 minutes
}

app.listen(PORT, '0.0.0.0', () => console.log(`✅ Proxy on port ${PORT}`));