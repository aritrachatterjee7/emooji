// src/hooks/useJackDaw.js
import { useState, useRef, useCallback } from 'react';
import Constants from 'expo-constants';

const PROXY_BASE =
  Constants.expoConfig?.extra?.proxyUrl ||
  process.env.EXPO_PUBLIC_PROXY_URL ||
  '';

const CFG = {
  jackdaw: { baseUrl: 'https://api.jackdaw.online' },
  proxy: {
    tokenUrl:      `${PROXY_BASE}/api/token`,
    chatUrl:       `${PROXY_BASE}/api/chat`,
    streamUrl:     `${PROXY_BASE}/api/chat/stream`,
    mcpUrl:        `${PROXY_BASE}/api/mcp/connect`,
    mcpDisconnect: `${PROXY_BASE}/api/mcp/all`,
  },
  mcp: {
    serverUrl: 'https://emooji.onrender.com/sse',
    name:      'moofind-emoo-ji-mcp',
  },
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export function geojsonToWKT(geometry) {
  const geom = typeof geometry === 'string' ? JSON.parse(geometry) : geometry;
  if (!geom || geom.type !== 'Polygon') return null;
  const ring = geom.coordinates[0];
  if (!ring || ring.length < 3) return null;
  const points = ring.map(c => `${c[0]} ${c[1]}`);
  if (points[0] !== points[points.length - 1]) points.push(points[0]);
  return `POLYGON ((${points.join(', ')}))`;
}

export function useJackDaw() {
  const [connStatus, setConnStatus] = useState({ state: 'connecting', label: 'Connecting' });
  const tokenRef     = useRef(null);
  const sessionRef   = useRef(null);
  const historyRef   = useRef([]);
  const mcpConnected = useRef(false);

  const setStatus = useCallback((state, label) => setConnStatus({ state, label }), []);

  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch(CFG.proxy.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data.access_token) return false;
      tokenRef.current = data.access_token;
      return true;
    } catch {
      return false;
    }
  }, []);

  const disconnectMCP = useCallback(async () => {
    try {
      await fetch(CFG.proxy.mcpDisconnect, { method: 'DELETE' });
      mcpConnected.current = false;
      sessionRef.current   = null;
    } catch {}
  }, []);

  const connectMCP = useCallback(async () => {
    if (mcpConnected.current) return true;
    try {
      const res = await fetch(CFG.proxy.mcpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          name:      CFG.mcp.name,
          transport: 'sse',
          url:       CFG.mcp.serverUrl,
        }]),
      });
      if (!res.ok) return false;
      const data = await res.json();
      sessionRef.current = data.session_id || data.id || null;
      mcpConnected.current = true;
      return true;
    } catch {
      return false;
    }
  }, []);

  const init = useCallback(async (onProgress) => {
    const timeout = setTimeout(() => {
      setStatus('error', 'Timeout');
      onProgress(100, 'Timed out');
    }, 8000);

    try {
      onProgress(10, 'Loading map…');
      await sleep(200);
      onProgress(30, 'Connecting to JackDaw…');
      setStatus('connecting', 'Connecting');

      await disconnectMCP();

      const tokenOk = await Promise.race([fetchToken(), sleep(6000).then(() => false)]);

      if (tokenOk) {
        onProgress(90, 'Ready.');
        setStatus('online', 'Connected');
      } else {
        onProgress(90, 'Auth failed — map ready');
        setStatus('error', 'Auth failed');
      }

      await sleep(300);
      onProgress(100, 'Launching…');
      await sleep(250);
    } catch {
      setStatus('error', 'Error');
    } finally {
      clearTimeout(timeout);
    }
  }, [fetchToken, disconnectMCP, setStatus]);

  const initMCP = useCallback(async () => {
    if (mcpConnected.current) return;
    setStatus('connecting', 'Upgrading…');
    const ok = await connectMCP();
    if (ok) setStatus('online', 'Connected');
  }, [connectMCP, setStatus]);

  // ── Send message — streaming for EVERYONE ─────────────────────────────
  // Both signed-in and unauthenticated users use the stream endpoint
  // so progress messages ("Analyzing...", "Starting tool call...") show for all.
  // The system prompt and payload differ based on auth state.
  const sendMessage = useCallback(async (
    userText,
    polygon,
    customerId = null,
    onProgress = null,
    isSignedIn = false,
    fullSessionId = null,
  ) => {

    // No system prompt — let JackDaw behave exactly as its native interface
    // System prompts were blocking JackDaw's built-in GeoRAG tools
    const systemCtx = undefined;

    historyRef.current.push({ role: 'user', content: userText });

    // Build payload — no system prompt, JackDaw behaves like its native interface
    const DUMMY_WKT = {
      srid: 4326,
      wkt: 'POLYGON ((10.0 50.0, 10.1 50.0, 10.1 50.1, 10.0 50.1, 10.0 50.0))',
    };

    const payload = { messages: historyRef.current };

    if (polygon) {
      const wkt = geojsonToWKT(polygon);
      payload.wkt     = wkt ? { srid: 4326, wkt } : DUMMY_WKT;
      payload.polygon = polygon; // send raw polygon for DB storage
    } else {
      payload.wkt = DUMMY_WKT;
    }

    // Save session_id for conversation continuity
    if (sessionRef.current) payload.session_id = sessionRef.current;

    // ── Try streaming first (works for everyone) ───────────────────────
    try {
      const streamHeaders = { 'Content-Type': 'application/json' };
      // Use fullSessionId (from sessions_full) for thinking trace storage
      if (fullSessionId)      streamHeaders['X-Session-Id'] = fullSessionId;
      else if (sessionRef.current) streamHeaders['X-Session-Id'] = sessionRef.current;
      if (customerId)         streamHeaders['X-User-Id']    = customerId;

      const res = await fetch(CFG.proxy.streamUrl, {
        method:  'POST',
        headers: streamHeaders,
        body:    JSON.stringify(payload),
      });

      if (res.ok && res.body) {
        const reply = await readSSEStream(
          res.body,
          onProgress,
          isSignedIn ? sessionRef : null, // only save thread_id when signed in
        );
        if (reply) {
          historyRef.current.push({ role: 'assistant', content: reply });
          return reply;
        }
      }
    } catch {
      // Fall through to buffered
    }

    // ── Fallback buffered ──────────────────────────────────────────────
    const res = await fetch(CFG.proxy.chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 401) {
      tokenRef.current = null;
      setStatus('error', 'Session expired');
      return 'Session expired. Please restart the app.';
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    let reply;
    if (Array.isArray(data) && data.length > 0 && data[0].msg) {
      reply = data[0].msg.content;
      if (isSignedIn && data[0].thread_id) sessionRef.current = data[0].thread_id;
    } else if (data.message)  { reply = data.message; }
    else if (data.content)    { reply = typeof data.content === 'string' ? data.content : data.content?.text || JSON.stringify(data.content); }
    else if (data.response)   { reply = data.response; }
    else if (data.msg)        { reply = data.msg.content || JSON.stringify(data); }
    else                      { reply = JSON.stringify(data); }

    historyRef.current.push({ role: 'assistant', content: reply });
    return reply;
  }, [setStatus]);

  const clearHistory = useCallback(() => {
    historyRef.current = [];
    sessionRef.current = null;
    mcpConnected.current = false;
  }, []);

  return { connStatus, init, initMCP, sendMessage, clearHistory };
}

// ── SSE stream reader ──────────────────────────────────────────────────────
// sessionRef is null for unauthenticated — thread_id never saved
async function readSSEStream(body, onProgress, sessionRef) {
  const reader   = body.getReader();
  const decoder  = new TextDecoder();
  let buffer     = '';
  let finalReply = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    let eventType = null;
    let dataLine  = null;

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLine = line.slice(5).trim();
      } else if (line === '' && eventType && dataLine) {
        try {
          const parsed = JSON.parse(dataLine);

          if (eventType === 'progress' && onProgress) {
            const text = extractProgressText(parsed);
            if (text) onProgress(text);
          }

          if (eventType === 'final') {
            finalReply = extractFinalReply(parsed);
            // Only save thread_id when signed in (sessionRef is non-null)
            if (sessionRef && parsed.thread_id) {
              sessionRef.current = parsed.thread_id;
            }
          }

          if (eventType === 'error') {
            throw new Error(parsed.message || 'Stream error');
          }
        } catch (e) { /* ignore parse errors */ }

        eventType = null;
        dataLine  = null;
      }
    }
  }

  return finalReply;
}

// ── Extract human-readable progress text from JackDaw SSE events ──────────
// JackDaw sends various progress event formats — handle all known ones
function extractProgressText(data) {
  if (!data) return null;

  // Plain string
  if (typeof data === 'string') return data;

  // Direct message/text fields
  if (data.message && typeof data.message === 'string') return data.message;
  if (data.text    && typeof data.text    === 'string') return data.text;
  if (data.status  && typeof data.status  === 'string') return data.status;

  // Content field (string or object)
  if (data.content) {
    if (typeof data.content === 'string') return data.content;
    if (data.content.text)  return data.content.text;
  }

  // Tool call events — various formats JackDaw uses
  if (data.tool_name) {
    const name = data.tool_name;
    if (data.phase === 'start'  || data.type === 'tool_start'  || data.status === 'starting') return `Starting tool call: ${name}`;
    if (data.phase === 'end'    || data.type === 'tool_end'    || data.status === 'finished') return `Finished tool call: ${name}`;
    if (data.phase === 'error'  || data.type === 'tool_error'  || data.status === 'error')    return `Tool error: ${name}`;
    return `Calling tool: ${name}`;
  }
  if (data.tool) {
    const name = data.tool;
    if (data.status === 'start' || data.status === 'starting') return `Starting tool call: ${name}`;
    if (data.status === 'end'   || data.status === 'finished') return `Finished tool call: ${name}`;
    return `Calling tool: ${name}`;
  }
  if (data.name && (data.type === 'tool_use' || data.type === 'tool_call')) {
    return `Starting tool call: ${data.name}`;
  }
  if (data.name && data.type === 'tool_result') {
    return `Finished tool call: ${data.name}`;
  }

  // Node/step labels from JackDaw graph execution
  if (data.node)  return `${data.node}…`;
  if (data.step)  return `${data.step}…`;
  if (data.label) return data.label;

  // Type-based fallback messages
  if (data.type) {
    const typeMap = {
      'thinking':          'Thinking…',
      'analyzing':         'Analyzing your question…',
      'selecting_tools':   'Selecting relevant tools…',
      'tool_start':        'Starting tool…',
      'tool_end':          'Tool completed',
      'generating':        'Generating response…',
      'summarizing':       'Summarizing results…',
    };
    if (typeMap[data.type]) return typeMap[data.type];
    // Generic type display
    if (typeof data.type === 'string' && data.type.length < 40) {
      return data.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) + '…';
    }
  }

  return null;
}

function extractFinalReply(data) {
  if (typeof data === 'string') return data;
  if (data.message)  return data.message;
  if (data.content)  return typeof data.content === 'string' ? data.content : data.content?.text || null;
  if (data.response) return data.response;
  if (data.msg)      return data.msg.content || null;
  if (Array.isArray(data) && data[0]?.msg) return data[0].msg.content;
  return null;
}