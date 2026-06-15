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
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions_full (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id          TEXT,
        is_authenticated BOOLEAN DEFAULT FALSE,
        title            TEXT DEFAULT 'New Chat',
        polygon          JSONB,
        field_stats      JSONB,
        fields_map       JSONB DEFAULT '{}',
        messages         JSONB DEFAULT '[]',
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_full_user_id ON sessions_full(user_id);
    `);
    // Clean up empty sessions on startup
    await client.query(`DELETE FROM sessions_full WHERE jsonb_array_length(messages) = 0`);
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id, X-Session-Id, X-Field-Id');
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

function httpsPost(urlStr, body, headers) { return httpsRequest('POST', urlStr, body, headers); }
function httpsDelete(urlStr, headers)     { return httpsRequest('DELETE', urlStr, null, headers); }

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

// ── Token cache ────────────────────────────────────────────────────────────
let cachedToken    = null;
let tokenExpiresAt = 0;

async function fetchAccessToken(retries = 3) {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('Missing credentials');
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) return cachedToken;

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
        const data     = JSON.parse(result.body);
        cachedToken    = data.access_token;
        tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
        console.log('✅ Token fetched and cached');
        return cachedToken;
      }
      console.warn(`Token attempt ${attempt}/${retries} failed: ${result.status}`);
      if (attempt < retries) await new Promise(r => setTimeout(r, 2000 * attempt));
    } catch (err) {
      console.warn(`Token attempt ${attempt}/${retries} error: ${err.message}`);
      if (attempt < retries) await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  if (cachedToken) { console.warn('Using stale cached token'); return cachedToken; }
  throw new Error('Token fetch failed after ' + retries + ' attempts');
}

// ── Health ─────────────────────────────────────────────────────────────────
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

// ── MCP ────────────────────────────────────────────────────────────────────
app.post('/api/mcp/connect', async (req, res) => {
  try {
    const token = await fetchAccessToken();
    const body  = JSON.stringify(req.body);
    const hdrs  = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'Accept': 'application/json' };
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
    const result = await httpsDelete(`${JACKDAW_BASE}/mcp/all`, { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' });
    res.status(result.status);
    if (result.headers['content-type']) res.set('Content-Type', result.headers['content-type']);
    res.send(result.body);
  } catch (err) {
    res.status(503).json({ error: 'mcp_disconnect_failed', details: err.message });
  }
});

// ── Chat buffered ──────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const token = await fetchAccessToken();
    const sanitized = { messages: req.body.messages };
    if (req.body.system)      sanitized.system      = req.body.system;
    if (req.body.thread_id)   sanitized.thread_id   = req.body.thread_id;
    if (req.body.customer_id) sanitized.customer_id = req.body.customer_id;
    sanitized.wkt = req.body.wkt || DUMMY_WKT;
    const body   = JSON.stringify(sanitized);
    const hdrs   = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'Accept': 'application/json' };
    const result = await httpsPost(`${JACKDAW_BASE}/chat/v2/chat`, body, hdrs);
    res.status(result.status);
    if (result.headers['content-type']) res.set('Content-Type', result.headers['content-type']);
    res.send(result.body);
  } catch (err) {
    res.status(503).json({ error: 'chat_api_unavailable', details: err.message });
  }
});

// ── Chat stream — captures thinking trace and saves to sessions_full ───────
app.post('/api/chat/stream', async (req, res) => {
  try {
    const token = await fetchAccessToken();
    const sanitized = { messages: req.body.messages };
    if (req.body.system)      sanitized.system      = req.body.system;
    if (req.body.thread_id)   sanitized.thread_id   = req.body.thread_id;
    if (req.body.customer_id) sanitized.customer_id = req.body.customer_id;
    sanitized.wkt = req.body.wkt || DUMMY_WKT;

    const body = JSON.stringify(sanitized);
    const hdrs = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'Accept': 'text/event-stream' };

    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.flushHeaders();

    // ── Collect trace metadata ─────────────────────────────────────
    const startTime     = Date.now();
    const traceEvents   = [];
    const toolsUsed     = new Set();
    let   sseBuffer     = '';
    let   finalAnswer   = '';
    let   currentEvent  = null;  // track current event type across chunks
    let   finalDataBuf  = '';    // accumulate final event data across chunks

    const msgs            = req.body.messages || [];
    const lastUserMsg     = msgs.filter(m => m.role === 'user').slice(-1)[0];
    const question        = lastUserMsg?.content || '';
    const questionTime    = lastUserMsg?.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Session metadata from headers and body
    const clientSessionId = req.headers['x-session-id'] || null;
    const userId          = req.headers['x-user-id']    || null;
    const fieldId         = req.headers['x-field-id']   || req.body.field_id || null;
    const fieldsMap       = req.body.fields_map          || null;
    const isAuth          = !!userId;
    const polygon         = req.body.polygon    || null;
    const fieldStats      = req.body.field_stats || null;

    await httpsPostStream(`${JACKDAW_BASE}/chat/v2/chat/stream`, body, hdrs, (incoming) => {
      incoming.on('data', chunk => {
        res.write(chunk);

        // Parse SSE to collect thinking trace
        sseBuffer += chunk.toString();
        const lines = sseBuffer.split('\n');
        sseBuffer   = lines.pop();

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
            if (currentEvent === 'final') finalDataBuf = '';
          } else if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (currentEvent === 'final') {
              finalDataBuf += data;
            } else if (currentEvent === 'progress') {
              try {
                const parsed = JSON.parse(data);
                const text = parsed.content || parsed.message || parsed.text || null;
                if (text) {
                  traceEvents.push({ text, ts: Date.now(), source: parsed.source || 'unknown', stage: parsed.stage || null });
                  if (parsed.stage === 'tool_start' && parsed.meta?.tool_name) toolsUsed.add(parsed.meta.tool_name);
                  const match = (parsed.content || '').match(/Starting tool call: (\S+)/);
                  if (match) toolsUsed.add(match[1]);
                }
              } catch {}
            }
          } else if (line === '') {
            if (currentEvent === 'final' && finalDataBuf) {
              try {
                const parsed = JSON.parse(finalDataBuf);
                if (typeof parsed === 'string')                                finalAnswer = parsed;
                else if (parsed.content && typeof parsed.content === 'string') finalAnswer = parsed.content;
                else if (parsed.message && typeof parsed.message === 'string') finalAnswer = parsed.message;
                else if (parsed.msg?.content)                                  finalAnswer = parsed.msg.content;
                else if (Array.isArray(parsed) && parsed[0]?.msg?.content)     finalAnswer = parsed[0].msg.content;
                else if (parsed.response)                                       finalAnswer = parsed.response;
                console.log('✅ Final answer captured:', finalAnswer.slice(0, 100));
              } catch (e) { /* still accumulating */ }
              finalDataBuf = '';
            }
            currentEvent = null;
          }
        }
      });

      incoming.on('end', async () => {
        res.end();

        // Flush any remaining finalDataBuf
        if (finalDataBuf.trim()) {
          try {
            const p = JSON.parse(finalDataBuf);
            if (!finalAnswer) {
              if (typeof p === 'string')                                finalAnswer = p;
              else if (p.content && typeof p.content === 'string')     finalAnswer = p.content;
              else if (p.message && typeof p.message === 'string')     finalAnswer = p.message;
              else if (p.msg?.content)                                  finalAnswer = p.msg.content;
              else if (Array.isArray(p) && p[0]?.msg?.content)         finalAnswer = p[0].msg.content;
              else if (p.response)                                      finalAnswer = p.response;
            }
          } catch {}
        }
        console.log('Answer preview:', finalAnswer.slice(0, 150));

        // ── Build the two new message objects with embedded trace ──
        const userMessage = {
          role:     'user',
          content:  question,
          time:     questionTime,
          field_id: fieldId || null,
        };

        const assistantMessage = {
          role:           'assistant',
          content:        finalAnswer,
          time:           new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          field_id:       fieldId || null,
          thinking_trace: traceEvents,
          tools_used:     [...toolsUsed],
          duration_ms:    Date.now() - startTime,
        };

        // ── Upsert sessions_full ───────────────────────────────────
        try {
          if (clientSessionId) {
            // Try to update existing session
            const existing = await pool.query(
              `SELECT id, messages FROM sessions_full WHERE id = $1`,
              [clientSessionId]
            );

            if (existing.rows.length > 0) {
              // Append new messages to existing session
              const existingMessages = existing.rows[0].messages || [];
              const updatedMessages  = [...existingMessages, userMessage, assistantMessage];
              const autoTitle = updatedMessages.find(m => m.role === 'user')?.content?.slice(0, 60) || 'New Chat';

              await pool.query(
                `UPDATE sessions_full
                 SET messages = $1, updated_at = NOW(), title = $2,
                     polygon = COALESCE($3, polygon),
                     field_stats = COALESCE($4, field_stats),
                     fields_map = CASE WHEN $5::jsonb IS NOT NULL THEN $5::jsonb ELSE fields_map END,
                     user_id = COALESCE($6, user_id),
                     is_authenticated = $7
                 WHERE id = $8`,
                [
                  JSON.stringify(updatedMessages),
                  autoTitle,
                  polygon    ? JSON.stringify(polygon)    : null,
                  fieldStats ? JSON.stringify(fieldStats) : null,
                  fieldsMap  ? JSON.stringify(fieldsMap)  : null,
                  userId,
                  isAuth,
                  clientSessionId,
                ]
              );
              console.log(`✅ sessions_full updated: ${clientSessionId} (${updatedMessages.length} messages)`);
            } else {
              // Session ID provided but not in DB — create it with that ID
              const newMessages = [userMessage, assistantMessage];
              const autoTitle   = question.slice(0, 60) || 'New Chat';
              await pool.query(
                `INSERT INTO sessions_full (id, user_id, is_authenticated, title, polygon, field_stats, fields_map, messages)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                  clientSessionId,
                  userId,
                  isAuth,
                  autoTitle,
                  polygon    ? JSON.stringify(polygon)    : null,
                  fieldStats ? JSON.stringify(fieldStats) : null,
                  fieldsMap  ? JSON.stringify(fieldsMap)  : null,
                  JSON.stringify(newMessages),
                ]
              );
              console.log(`✅ sessions_full created: ${clientSessionId}`);
            }
          } else {
            // No session ID — create new session, return ID in header (can't after stream)
            // Just log it — frontend should always send X-Session-Id
            console.warn('No X-Session-Id header — session not saved');
          }
        } catch (dbErr) {
          console.error('sessions_full upsert failed:', dbErr.message);
        }
      });

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

// ════════════════════════════════════════════════════════════════════════════
// sessions_full API
// ════════════════════════════════════════════════════════════════════════════

// ── POST /api/sessions-full/init — create a new session, return its ID ────
app.post('/api/sessions-full/init', async (req, res) => {
  try {
    const userId   = req.headers['x-user-id'] || null;
    const isAuth   = !!userId;
    const { polygon, fieldStats } = req.body;

    const result = await pool.query(
      `INSERT INTO sessions_full (user_id, is_authenticated, polygon, field_stats)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [userId, isAuth, polygon ? JSON.stringify(polygon) : null, fieldStats ? JSON.stringify(fieldStats) : null]
    );
    res.json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'db_error', details: err.message });
  }
});

// ── GET /api/sessions-full — list sessions for a user (or all anonymous) ──
app.get('/api/sessions-full', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || null;
    const limit  = parseInt(req.query.limit || '50');

    let result;
    if (userId) {
      result = await pool.query(
        `SELECT id, user_id, is_authenticated, title, polygon, field_stats, created_at, updated_at,
                jsonb_array_length(messages) as message_count
         FROM sessions_full WHERE user_id = $1
         ORDER BY updated_at DESC LIMIT $2`,
        [userId, limit]
      );
    } else {
      // Anonymous — client should filter by session IDs it knows about
      const sessionIds = req.query.ids ? req.query.ids.split(',') : [];
      if (sessionIds.length === 0) return res.json([]);
      result = await pool.query(
        `SELECT id, user_id, is_authenticated, title, polygon, field_stats, created_at, updated_at,
                jsonb_array_length(messages) as message_count
         FROM sessions_full WHERE id = ANY($1)
         ORDER BY updated_at DESC`,
        [sessionIds]
      );
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'db_error', details: err.message });
  }
});

// ── GET /api/sessions-full/:id — load full session with all messages ───────
app.get('/api/sessions-full/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM sessions_full WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'db_error', details: err.message });
  }
});

// ── DELETE /api/sessions-full/:id ─────────────────────────────────────────
app.delete('/api/sessions-full/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM sessions_full WHERE id = $1`, [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'db_error', details: err.message });
  }
});

// ── GET /api/sessions-full/:id/traces — get just the thinking traces ───────
app.get('/api/sessions-full/:id/traces', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT messages FROM sessions_full WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const messages = result.rows[0].messages || [];
    const traces   = messages
      .filter(m => m.role === 'assistant' && m.thinking_trace?.length > 0)
      .map(m => ({
        question:       messages[messages.indexOf(m) - 1]?.content || '',
        thinking_trace: m.thinking_trace,
        tools_used:     m.tools_used,
        duration_ms:    m.duration_ms,
      }));
    res.json(traces);
  } catch (err) {
    res.status(500).json({ error: 'db_error', details: err.message });
  }
});

// Legacy sessions API removed — using sessions_full only

// ── Static ─────────────────────────────────────────────────────────────────
const PUBLIC_DIR = path.join(__dirname, 'dist');
app.use(express.static(PUBLIC_DIR, {
  maxAge: '1h',
  setHeaders: (res, fp) => {
    // Never cache service worker or entry HTML
    if (fp.endsWith('sw.js') || fp.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
}));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not_found' });
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ── Keep-alive ─────────────────────────────────────────────────────────────
if (process.env.RENDER_EXTERNAL_URL) {
  const SELF_URL = process.env.RENDER_EXTERNAL_URL;
  setInterval(() => {
    require('https').get(`${SELF_URL}/api/health`, () => {}).on('error', () => {});
    console.log('Keep-alive ping sent');
  }, 10 * 60 * 1000);
}

app.listen(PORT, '0.0.0.0', () => console.log(`✅ Proxy on port ${PORT}`));