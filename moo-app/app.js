'use strict';

/* ── Configuration ─────────────────────────────────────────────────────────── */
const CFG = {
  jackdaw: {
    baseUrl:      'https://api.jackdaw.online',
    clientId:     window.JACKDAW_CLIENT_ID     || 'CuAb7Lqa3CO4VvOqS6dqmRXUB1OKfKyItPZpB93',
    clientSecret: window.JACKDAW_CLIENT_SECRET || '0umAYgVipY8CGr9BC4IF8umicqj4oaeOOuxGRFVUpI2m1IvhXOLqprkFY2zzYEBJBcNdZaxVYYWbdNZhIxw634UEpOrZEeVfutC6ZWzBrAlLv5Ru3FerjG54u5USinwR',
  },
  mcp: {
    serverUrl: 'https://lichtwiese-mcp.onrender.com/sse',
    name:      'moofind-emoo-ji-mcp',
  },
  map: {
    center: [49.8731, 8.6673],
    zoom: 14,
  },
};

/* ── State ──────────────────────────────────────────────────────────────────── */
const S = {
  token:        null,
  sessionId:    null,
  polygon:      null,   // GeoJSON geometry string passed to JackDaw
  drawnLayer:   null,
  isBusy:       false,
  history:      [],
  currentView:  'map',   // 'map' | 'chat'
  unreadCount:  0,
  deferredInstall: null,
  currentLayer: 'street',
};

/* ── DOM ───────────────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const Q = sel => document.querySelector(sel);

/* ── Splash progress helper ─────────────────────────────────────────────────── */
function splashProgress(pct, label) {
  const bar = $('splashBar');
  const txt = $('splashStatus');
  if (bar) bar.style.width = pct + '%';
  if (txt) txt.textContent = label;
}

function hideSplash() {
  const splash = $('splash');
  const app    = $('app');
  if (splash) splash.classList.add('hidden');
  if (app)    { app.removeAttribute('aria-hidden'); app.classList.add('visible'); }
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAP SETUP
══════════════════════════════════════════════════════════════════════════════ */
const map = L.map('map', {
  center: CFG.map.center,
  zoom:   CFG.map.zoom,
  zoomControl: true,
  attributionControl: true,
});

// Tile layers
const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://openstreetmap.org">OSM</a>',
  maxZoom: 19,
});

const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: '© Esri World Imagery',
  maxZoom: 19,
});

streetLayer.addTo(map);

// Move Leaflet zoom control to bottom-right
map.zoomControl.setPosition('bottomright');

// Drawn items layer group
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Draw control
const drawControl = new L.Control.Draw({
  position: 'topright',
  draw: {
    polygon: {
      allowIntersection: false,
      showArea: true,
      guidelineDistance: 20,
      shapeOptions: {
        color: '#0bdb6e',
        fillColor: '#0bdb6e',
        fillOpacity: 0.12,
        weight: 2,
        dashArray: null,
      },
    },
    rectangle: {
      shapeOptions: {
        color: '#0bdb6e',
        fillColor: '#0bdb6e',
        fillOpacity: 0.12,
        weight: 2,
      },
    },
    polyline:     false,
    circle:       false,
    marker:       false,
    circlemarker: false,
  },
  edit: {
    featureGroup: drawnItems,
    remove: true,
    edit: { selectedPathOptions: { color: '#0bdb6e', fillColor: '#0bdb6e', fillOpacity: 0.18 } },
  },
});
map.addControl(drawControl);

/* ── Map draw events ─────────────────────────────────────────────────────────── */
map.on(L.Draw.Event.CREATED, e => {
  clearDrawing();
  const layer = e.layer;
  drawnItems.addLayer(layer);
  S.drawnLayer = layer;
  S.polygon = JSON.stringify(layer.toGeoJSON().geometry);
  showFieldStats(layer);
  setMapHint('Field captured ✓ — switch to Analysis →');
  updateSendBtn();
  if (isMobile()) showChatBadge();
});

map.on(L.Draw.Event.EDITED, e => {
  e.layers.eachLayer(layer => {
    S.drawnLayer = layer;
    S.polygon = JSON.stringify(layer.toGeoJSON().geometry);
    showFieldStats(layer);
  });
});

map.on(L.Draw.Event.DELETED, () => {
  S.polygon = null;
  S.drawnLayer = null;
  hideFieldStats();
  updateSendBtn();
  setMapHint('Draw a field to begin');
});

/* ── Toolbar button handlers ─────────────────────────────────────────────────── */
$('btnDrawPolygon').addEventListener('click', () => {
  new L.Draw.Polygon(map, drawControl.options.draw.polygon).enable();
  setMapHint('Click to add vertices · Double-click to finish');
});

$('btnDrawRect').addEventListener('click', () => {
  new L.Draw.Rectangle(map, drawControl.options.draw.rectangle).enable();
  setMapHint('Click and drag to draw rectangle');
});

$('btnClear').addEventListener('click', () => {
  clearDrawing();
  setMapHint('Draw a field to begin');
  updateSendBtn();
});

$('btnDemo').addEventListener('click', loadDemo);

/* ── Layer switcher ──────────────────────────────────────────────────────────── */
$('btnLayerSat').addEventListener('click', () => {
  if (S.currentLayer === 'satellite') return;
  map.removeLayer(streetLayer);
  map.addLayer(satelliteLayer);
  S.currentLayer = 'satellite';
  Q('.map-panel').setAttribute('data-layer', 'satellite');
  $('btnLayerSat').setAttribute('data-active', 'true');
  $('btnLayerStreet').removeAttribute('data-active');
});

$('btnLayerStreet').addEventListener('click', () => {
  if (S.currentLayer === 'street') return;
  map.removeLayer(satelliteLayer);
  map.addLayer(streetLayer);
  S.currentLayer = 'street';
  Q('.map-panel').setAttribute('data-layer', 'street');
  $('btnLayerStreet').setAttribute('data-active', 'true');
  $('btnLayerSat').removeAttribute('data-active');
});

/* ── Field stats helpers ─────────────────────────────────────────────────────── */
function showFieldStats(layer) {
  const stats = $('fieldStats');
  const geo   = layer.toGeoJSON();
  const ll    = layer.getLatLngs ? layer.getLatLngs()[0] : [];

  // Area
  const areaM2  = L.GeometryUtil ? L.GeometryUtil.geodesicArea(ll) : approxArea(ll);
  const areaHa  = (areaM2 / 10000).toFixed(2);

  // Centroid
  const bounds   = layer.getBounds();
  const center   = bounds.getCenter();
  const centroid = `${center.lat.toFixed(4)}°N ${center.lng.toFixed(4)}°E`;

  // Perimeter (approximate, sum of edge distances)
  let perimM = 0;
  for (let i = 0; i < ll.length; i++) {
    perimM += ll[i].distanceTo(ll[(i + 1) % ll.length]);
  }
  const perimKm = (perimM / 1000).toFixed(2);

  // Vertex count
  const pts = geo.geometry.type === 'Polygon'
    ? geo.geometry.coordinates[0].length - 1
    : 4;

  $('statArea').textContent    = `${areaHa} ha`;
  $('statCentroid').textContent = centroid;
  $('statPerim').textContent   = `${perimKm} km`;
  $('statPoints').textContent  = `${pts}`;

  stats.classList.add('visible');

  // Update nav bar info
  $('navPolygonInfo').style.display = 'flex';
  $('navArea').textContent    = `${areaHa} ha`;
  $('navCoords').textContent  = centroid;
}

function hideFieldStats() {
  $('fieldStats').classList.remove('visible');
  $('navPolygonInfo').style.display = 'none';
}

function approxArea(latlngs) {
  if (!latlngs || latlngs.length < 3) return 0;
  let area = 0;
  const n = latlngs.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += latlngs[i].lng * latlngs[j].lat;
    area -= latlngs[j].lng * latlngs[i].lat;
  }
  const latRad = (latlngs[0].lat * Math.PI) / 180;
  return Math.abs(area / 2) * 111320 * 111320 * Math.cos(latRad);
}

function setMapHint(text) {
  $('mapHint').childNodes[1].textContent = ' ' + text;
}

/* ── Demo loader ─────────────────────────────────────────────────────────────── */
async function loadDemo() {
  clearDrawing();
  try {
    const res  = await fetch('lichtwiese.geojson');
    const data = await res.json();

    const gl = L.geoJSON(data, {
      style: () => ({
        color: '#0bdb6e',
        fillColor: '#0bdb6e',
        fillOpacity: 0.12,
        weight: 2,
      }),
      onEachFeature: (feature, layer) => {
        const name = feature.properties?.name;
        if (name) {
          layer.bindTooltip(name, {
            permanent: true,
            direction: 'center',
            className: 'paddock-label',
          });
        }
        drawnItems.addLayer(layer);
      },
    });

    map.fitBounds(gl.getBounds(), { padding: [40, 40] });

    // Use Land B as the active polygon
    const landB = data.features.find(f => f.properties?.name === 'Land B');
    if (landB) {
      S.polygon = JSON.stringify(landB.geometry);
      // Fake a layer for stats
      const fakeLayer = L.geoJSON(landB);
      const ll = fakeLayer.getLayers()[0].getLatLngs()[0];
      showFieldStats(fakeLayer.getLayers()[0]);
    }

    setMapHint('Lichtwiese paddocks loaded · Land B selected');
    updateSendBtn();
    appendMessage('assistant',
      '**Lichtwiese demo paddocks loaded.**\n\nLand A (4.2 ha), Land B (6.1 ha, selected), and Land C (3.8 ha) are now on the map — all near Darmstadt, Germany.\n\nAsk me anything about Land B, or tap a quick-analysis chip.'
    );
    if (isMobile()) switchPanel('chat');
  } catch (err) {
    console.error('Demo load failed:', err);
    appendMessage('assistant', `Could not load demo data: ${err.message}`);
  }
}

function clearDrawing() {
  drawnItems.clearLayers();
  S.polygon     = null;
  S.drawnLayer  = null;
  hideFieldStats();
}

/* ══════════════════════════════════════════════════════════════════════════════
   JACKDAW API
══════════════════════════════════════════════════════════════════════════════ */
async function fetchToken() {
  try {
    const res = await fetch(`${CFG.jackdaw.baseUrl}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     CFG.jackdaw.clientId,
        client_secret: CFG.jackdaw.clientSecret,
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    S.token = data.access_token;
    return true;
  } catch (err) {
    console.error('[JackDaw] Token error:', err);
    return false;
  }
}

async function connectMCP() {
  if (!S.token) return false;
  try {
    const res = await fetch(`${CFG.jackdaw.baseUrl}/mcp/connect`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${S.token}`,
      },
      body: JSON.stringify({
        server_url: CFG.mcp.serverUrl,
        name:       CFG.mcp.name,
      }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    S.sessionId = data.session_id || data.id || null;
    return true;
  } catch (err) {
    console.warn('[JackDaw] MCP connect (non-fatal):', err.message);
    return false;
  }
}

async function sendToJackDaw(userText) {
  // Ensure token
  if (!S.token) {
    const ok = await fetchToken();
    if (!ok) return 'Authentication failed. Please refresh the page and try again.';
  }

  // Build system context
  const systemCtx = S.polygon
    ? `You are an expert agricultural and environmental analyst helping farmers understand their land. The farmer has drawn a polygon on an interactive map. Use this GeoJSON polygon geometry in ALL relevant tool calls: ${S.polygon}\n\nAlways use the provided tools to fetch real data. Never make up NDVI values, weather data, or terrain information.`
    : 'You are an expert agricultural analyst. No field polygon has been drawn yet. Politely ask the farmer to draw a field on the map first before you can run analysis tools, or answer general questions about farming and land management.';

  S.history.push({ role: 'user', content: userText });

  const payload = {
    messages: S.history,
    system:   systemCtx,
  };
  if (S.sessionId) payload.session_id = S.sessionId;

  try {
    const res = await fetch(`${CFG.jackdaw.baseUrl}/chat_v2`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${S.token}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 401) {
      S.token = null;
      const ok = await fetchToken();
      if (!ok) return 'Session expired. Please refresh the page.';
      return sendToJackDaw(userText);
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => res.statusText);
      throw new Error(`${res.status}: ${txt.slice(0, 200)}`);
    }

    const data = await res.json();
    const reply = data.message || data.content || data.response
      || (Array.isArray(data.content) ? data.content.map(c => c.text || '').join('\n') : null)
      || JSON.stringify(data);

    S.history.push({ role: 'assistant', content: reply });
    return reply;

  } catch (err) {
    console.error('[JackDaw] Chat error:', err);
    return `Error contacting JackDaw: ${err.message}`;
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   CHAT UI
══════════════════════════════════════════════════════════════════════════════ */
function appendMessage(role, content, isLoading = false) {
  const feed = $('messages');
  const div  = document.createElement('div');
  div.className = `message message--${role}`;
  if (isLoading) div.id = 'typingMsg';

  const avatar = document.createElement('div');
  avatar.className = 'message__avatar';
  avatar.textContent = role === 'user' ? '👤' : '🐄';

  const body = document.createElement('div');
  body.className = 'message__body';

  const bubble = document.createElement('div');
  bubble.className = 'message__bubble';

  if (isLoading) {
    bubble.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
  } else {
    bubble.innerHTML = renderMarkdown(content);
  }

  const time = document.createElement('span');
  time.className = 'message__time';
  time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  body.appendChild(bubble);
  body.appendChild(time);

  if (role === 'user') {
    div.appendChild(body);
    div.appendChild(avatar);
  } else {
    div.appendChild(avatar);
    div.appendChild(body);
  }

  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
  return div;
}

function renderMarkdown(text) {
  // Convert simple markdown-ish syntax to HTML
  return text
    // Code blocks
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre class="result-card"><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Headers
    .replace(/^### (.+)$/gm, '<strong style="font-size:0.95em">$1</strong>')
    .replace(/^## (.+)$/gm,  '<strong>$1</strong>')
    // Bullet lists
    .replace(/^[•\-\*] (.+)$/gm, '<span style="display:block;padding-left:12px;margin:2px 0">· $1</span>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<span style="display:block;padding-left:12px;margin:2px 0">$1</span>')
    // Paragraphs
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(.*)$/, '<p>$1</p>');
}

async function handleSend() {
  const input   = $('chatInput');
  const userText = input.value.trim();
  if (!userText || S.isBusy) return;

  input.value = '';
  autoResizeTextarea(input);
  updateSendBtn();

  appendMessage('user', userText);

  S.isBusy = true;
  $('sendBtn').disabled = true;

  const loadingEl = appendMessage('assistant', '', true);

  try {
    const reply = await sendToJackDaw(userText);
    loadingEl.remove();
    appendMessage('assistant', reply);

    // If on mobile and user is viewing map, show badge
    if (isMobile() && S.currentView === 'map') {
      S.unreadCount++;
      showChatBadge();
    }
  } catch (err) {
    loadingEl.remove();
    appendMessage('assistant', `Something went wrong: ${err.message}`);
  } finally {
    S.isBusy = false;
    updateSendBtn();
  }
}

function updateSendBtn() {
  const btn     = $('sendBtn');
  const hasText = $('chatInput').value.trim().length > 0;
  btn.disabled  = !hasText || S.isBusy;
}

function showChatBadge() {
  const badge = $('chatBadge');
  badge.textContent = S.unreadCount > 9 ? '9+' : S.unreadCount;
  badge.hidden = false;
}

/* ── Input events ─────────────────────────────────────────────────────────────── */
$('sendBtn').addEventListener('click', handleSend);

$('chatInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

$('chatInput').addEventListener('input', () => {
  updateSendBtn();
  autoResizeTextarea($('chatInput'));
});

$('btnClearChat').addEventListener('click', () => {
  const feed = $('messages');
  // Keep only the welcome message
  while (feed.children.length > 1) feed.removeChild(feed.lastChild);
  S.history = [];
  S.unreadCount = 0;
  const badge = $('chatBadge');
  badge.hidden = true;
});

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

/* ── Quick-prompt chips ──────────────────────────────────────────────────────── */
document.querySelectorAll('.chip').forEach(btn => {
  btn.addEventListener('click', () => {
    $('chatInput').value = btn.dataset.prompt;
    updateSendBtn();
    autoResizeTextarea($('chatInput'));
    $('chatInput').focus();
    if (isMobile()) switchPanel('chat');
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   MOBILE PANEL SWITCHING
══════════════════════════════════════════════════════════════════════════════ */
function isMobile() { return window.innerWidth <= 860; }

function switchPanel(panel) {
  S.currentView = panel;
  const workspace = Q('.workspace');
  workspace.setAttribute('data-view', panel);

  document.querySelectorAll('.bottom-nav__btn').forEach(btn => {
    btn.classList.toggle('bottom-nav__btn--active', btn.dataset.panel === panel);
  });

  if (panel === 'chat') {
    S.unreadCount = 0;
    $('chatBadge').hidden = true;
    // Refresh map when switching back
  }
  if (panel === 'map') {
    setTimeout(() => map.invalidateSize(), 350);
  }
}

$('tabMap').addEventListener('click',  () => switchPanel('map'));
$('tabChat').addEventListener('click', () => switchPanel('chat'));

// Set initial workspace view on mobile
if (isMobile()) Q('.workspace').setAttribute('data-view', 'map');

window.addEventListener('resize', () => {
  if (!isMobile()) {
    Q('.workspace').removeAttribute('data-view');
    map.invalidateSize();
  }
});

/* ══════════════════════════════════════════════════════════════════════════════
   CONNECTION STATUS
══════════════════════════════════════════════════════════════════════════════ */
function setConnectionStatus(state, label) {
  const badge = $('connectionBadge');
  badge.className = `connection-badge connection-badge--${state}`;
  $('connectionLabel').textContent = label;
}

/* ══════════════════════════════════════════════════════════════════════════════
   PWA — Service Worker + Install Prompt
══════════════════════════════════════════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[SW] Registered:', reg.scope))
      .catch(err => console.warn('[SW] Registration failed:', err));
  });
}

// Capture install prompt
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  S.deferredInstall = e;
  $('installBanner').hidden = false;
  $('btnInstall').style.display = 'flex';
});

$('installBtn')?.addEventListener('click', async () => {
  if (!S.deferredInstall) return;
  S.deferredInstall.prompt();
  const { outcome } = await S.deferredInstall.userChoice;
  if (outcome === 'accepted') {
    $('installBanner').hidden = true;
    $('btnInstall').style.display = 'none';
  }
  S.deferredInstall = null;
});

$('installDismiss')?.addEventListener('click', () => {
  $('installBanner').hidden = true;
});

$('btnInstall')?.addEventListener('click', async () => {
  if (!S.deferredInstall) return;
  S.deferredInstall.prompt();
  const { outcome } = await S.deferredInstall.userChoice;
  $('installBanner').hidden = true;
  $('btnInstall').style.display = 'none';
  S.deferredInstall = null;
});

window.addEventListener('appinstalled', () => {
  $('installBanner').hidden = true;
  $('btnInstall').style.display = 'none';
  S.deferredInstall = null;
});

// Handle URL params (from manifest shortcuts)
const urlParams = new URLSearchParams(location.search);
if (urlParams.get('mode') === 'demo') {
  window.addEventListener('appReady', loadDemo, { once: true });
}

/* ══════════════════════════════════════════════════════════════════════════════
   INITIALISATION — Animated splash sequence
══════════════════════════════════════════════════════════════════════════════ */
async function init() {
  splashProgress(10, 'Loading map…');
  await sleep(300);

  splashProgress(30, 'Connecting to JackDaw…');
  setConnectionStatus('connecting', 'Connecting');

  const tokenOk = await fetchToken();

  if (tokenOk) {
    splashProgress(60, 'Registering tools…');
    setConnectionStatus('connecting', 'Registering');
    await connectMCP();
    splashProgress(85, 'Ready.');
    setConnectionStatus('online', 'Connected');
  } else {
    splashProgress(85, 'Offline mode');
    setConnectionStatus('error', 'Auth failed');
  }

  await sleep(400);
  splashProgress(100, 'Launching…');
  await sleep(300);

  hideSplash();
  updateSendBtn();

  // Handle demo shortcut
  if (urlParams.get('mode') === 'demo') {
    setTimeout(loadDemo, 600);
  }

  window.dispatchEvent(new CustomEvent('appReady'));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

init().catch(err => {
  console.error('Init error:', err);
  splashProgress(100, 'Error — see console');
  hideSplash();
  setConnectionStatus('error', 'Error');
});
