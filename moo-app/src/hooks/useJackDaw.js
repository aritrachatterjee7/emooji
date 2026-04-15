// src/hooks/useJackDaw.js
import { useState, useRef, useCallback } from 'react';
import Constants from 'expo-constants';

// On native dev: use the machine IP (set EXPO_PUBLIC_PROXY_URL in .env)
// On web dev: use relative /api path — Expo web serves from the same origin
const PROXY_BASE =
  Constants.expoConfig?.extra?.proxyUrl ||
  process.env.EXPO_PUBLIC_PROXY_URL ||
  '';

const CFG = {
  jackdaw: { baseUrl: 'https://api.jackdaw.online' },
  proxy: {
    tokenUrl: `${PROXY_BASE}/api/token`,
    chatUrl:  `${PROXY_BASE}/api/chat`,
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
  const tokenRef   = useRef(null);
  const sessionRef = useRef(null);
  const historyRef = useRef([]);

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

  const connectMCP = useCallback(async () => {
    if (!tokenRef.current) return false;
    try {
      const res = await fetch(`${CFG.jackdaw.baseUrl}/mcp/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenRef.current}`,
        },
        body: JSON.stringify({ server_url: CFG.mcp.serverUrl, name: CFG.mcp.name }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      sessionRef.current = data.session_id || data.id || null;
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

      const tokenOk = await Promise.race([fetchToken(), sleep(6000).then(() => false)]);

      if (tokenOk) {
        onProgress(65, 'Registering tools…');
        setStatus('connecting', 'Registering');
        await Promise.race([connectMCP(), sleep(4000).then(() => false)]).catch(() => {});
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
  }, [fetchToken, connectMCP, setStatus]);

  const sendMessage = useCallback(async (userText, polygon) => {
    const systemCtx = polygon
      ? `You are an expert agricultural and environmental analyst. The farmer has drawn a polygon on the map. Use this GeoJSON geometry in ALL relevant MCP tool calls: ${polygon}\n\nAlways fetch real data. Never fabricate NDVI, weather, or terrain values.`
      : 'You are an expert agricultural analyst. No polygon drawn yet — ask the farmer to draw a field first.';

    historyRef.current.push({ role: 'user', content: userText });

    const payload = {
      messages: historyRef.current,
      system: systemCtx,
    };
    if (sessionRef.current) payload.session_id = sessionRef.current;
    if (polygon) {
      const wkt = geojsonToWKT(polygon);
      if (wkt) payload.wkt = { srid: 4326, wkt };
    }

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
    else if (data.content)    { reply = typeof data.content === 'string' ? data.content : data.content.text || JSON.stringify(data.content); }
    else if (data.response)   { reply = data.response; }
    else                      { reply = JSON.stringify(data); }

    historyRef.current.push({ role: 'assistant', content: reply });
    return reply;
  }, [setStatus]);

  const clearHistory = useCallback(() => { historyRef.current = []; }, []);

  return { connStatus, init, sendMessage, clearHistory };
}
