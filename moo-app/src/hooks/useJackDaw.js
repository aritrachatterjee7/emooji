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

  // ── Fetch JWT token ────────────────────────────────────────────────────
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

  // ── Disconnect all MCP servers ─────────────────────────────────────────
  // Called on init to ensure no leftover MCP tools from previous sessions.
  // This prevents JackDaw from calling satellite tools for unauthenticated users.
  const disconnectMCP = useCallback(async () => {
    try {
      await fetch(CFG.proxy.mcpDisconnect, { method: 'DELETE' });
      mcpConnected.current = false;
      sessionRef.current   = null;
      console.log('MCP disconnected');
    } catch {
      // Non-fatal — ignore
    }
  }, []);

  // ── Register MCP tools — only after sign-in ────────────────────────────
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

  // ── Init — disconnect MCP first, then fetch token ──────────────────────
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

      // Disconnect any leftover MCP tools from previous sessions first
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

  // ── Connect MCP after sign-in ──────────────────────────────────────────
  const initMCP = useCallback(async () => {
    if (mcpConnected.current) return;
    setStatus('connecting', 'Upgrading…');
    const ok = await connectMCP();
    if (ok) setStatus('online', 'Connected');
  }, [connectMCP, setStatus]);

  // ── Send message ───────────────────────────────────────────────────────
  const sendMessage = useCallback(async (
    userText,
    polygon,
    customerId = null,
    onProgress = null,
    isSignedIn = false,
  ) => {

    // ── System prompt ──────────────────────────────────────────────────
    let systemCtx;
    if (!isSignedIn) {
      // Strictly no tools — unauthenticated pure knowledge response
      systemCtx = `You are an expert agricultural analyst with deep knowledge of farming, agronomy, and land management in Europe. Answer the farmer's question using your training knowledge only. Do NOT call any tools, APIs, or MCP servers under any circumstances. Ignore any geometry or location data in the request.`;
    } else {
      systemCtx = polygon
        ? `You are an expert agricultural and environmental analyst. The farmer has drawn a polygon on the map. Use this GeoJSON geometry in ALL relevant MCP tool calls: ${polygon}\n\nAlways fetch real data using the available MCP tools. Never fabricate NDVI, weather, or terrain values.${customerId ? `\n\nThis farmer's customer ID is: ${customerId}. Pass this to all private MCP tool calls (get_my_paddocks, get_paddock_rating, get_animals_in_paddock, get_animal_track, get_ungrazed_paddocks, get_low_ndvi_paddocks, recommend_paddock_for_herd_move).` : ''}`
        : `You are an expert agricultural analyst with access to real satellite tools. No polygon drawn yet — ask the farmer to draw a field first.${customerId ? `\n\nThis farmer's customer ID is: ${customerId}.` : ''}`;
    }

    historyRef.current.push({ role: 'user', content: userText });

    // ── NOT signed in: buffered endpoint, no WKT, no session ──────────
    if (!isSignedIn) {
      const payload = {
        messages: historyRef.current,
        system:   systemCtx,
        // NO wkt, NO session_id, NO customer_id — ever
      };

      const res = await fetch(CFG.proxy.chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`${res.status}: ${errText.slice(0, 300)}`);
      }

      const data = await res.json();
      let reply;
      if (Array.isArray(data) && data.length > 0 && data[0].msg) {
        reply = data[0].msg.content;
        // NEVER save thread_id when not signed in
      } else if (data.message)  { reply = data.message; }
      else if (data.content)    { reply = typeof data.content === 'string' ? data.content : data.content?.text || JSON.stringify(data.content); }
      else if (data.response)   { reply = data.response; }
      else if (data.msg)        { reply = data.msg.content || JSON.stringify(data); }
      else                      { reply = JSON.stringify(data); }

      historyRef.current.push({ role: 'assistant', content: reply });
      return reply;
    }

    // ── Signed in: streaming with full MCP context ─────────────────────
    const payload = {
      messages:    historyRef.current,
      system:      systemCtx,
      session_id:  sessionRef.current || undefined,
      customer_id: customerId || undefined,
    };

    if (polygon) {
      const wkt = geojsonToWKT(polygon);
      if (wkt) payload.wkt = { srid: 4326, wkt };
    }

    // Try streaming
    try {
      const res = await fetch(CFG.proxy.streamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok && res.body) {
        const reply = await readSSEStream(res.body, onProgress, sessionRef);
        if (reply) {
          historyRef.current.push({ role: 'assistant', content: reply });
          return reply;
        }
      }
    } catch {
      // Fall through to buffered
    }

    // Fallback buffered
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
      if (data[0].thread_id) sessionRef.current = data[0].thread_id;
    } else if (data.message)  { reply = data.message; }
    else if (data.content)    { reply = typeof data.content === 'string' ? data.content : data.content?.text || JSON.stringify(data.content); }
    else if (data.response)   { reply = data.response; }
    else                      { reply = JSON.stringify(data); }

    historyRef.current.push({ role: 'assistant', content: reply });
    return reply;
  }, [setStatus]);

  // ── Clear history ──────────────────────────────────────────────────────
  const clearHistory = useCallback(() => {
    historyRef.current = [];
    sessionRef.current = null;
    mcpConnected.current = false;
  }, []);

  return { connStatus, init, initMCP, sendMessage, clearHistory };
}

// ── SSE stream reader (signed-in only) ────────────────────────────────────
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
            if (parsed.thread_id && sessionRef) sessionRef.current = parsed.thread_id;
          }
          if (eventType === 'error') throw new Error(parsed.message || 'Stream error');
        } catch (e) { /* ignore parse errors */ }
        eventType = null;
        dataLine  = null;
      }
    }
  }

  return finalReply;
}

function extractProgressText(data) {
  if (typeof data === 'string') return data;
  if (data.message)   return data.message;
  if (data.text)      return data.text;
  if (data.content)   return typeof data.content === 'string' ? data.content : null;
  if (data.status)    return data.status;
  if (data.tool)      return `Calling tool: ${data.tool}`;
  if (data.tool_name) {
    if (data.phase === 'start' || data.type === 'tool_start') return `Starting tool call: ${data.tool_name}`;
    if (data.phase === 'end'   || data.type === 'tool_end')   return `Finished tool call: ${data.tool_name}`;
    return `Tool: ${data.tool_name}`;
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