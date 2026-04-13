'use strict';

const CFG = {
  jackdaw: {
    baseUrl: 'https://api.jackdaw.online',
  },
  proxy: {
    tokenUrl: '/api/token',
    chatUrl:  '/api/chat',
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

const S = {
  token:        null,
  sessionId:    null,
  polygon:      null,
  drawnLayer:   null,
  isBusy:       false,
  history:      [],
  currentView:  'map',
  unreadCount:  0,
  deferredInstall: null,
  currentLayer: 'street',
};

const $ = id => document.getElementById(id);
const Q = sel => document.querySelector(sel);

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

const map = L.map('map', {
  center: CFG.map.center,
  zoom:   CFG.map.zoom,
  zoomControl: true,
  attributionControl: true,
});

const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://openstreetmap.org">OSM</a>',
  maxZoom: 19,
});

const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: '© Esri World Imagery',
  maxZoom: 19,
});

streetLayer.addTo(map);
map.zoomControl.setPosition('bottomright');

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

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
    polyline: false,
    circle: false,
    marker: false,
    circlemarker: false,
  },
  edit: {
    featureGroup: drawnItems,
    remove: true,
    edit: { selectedPathOptions: { color: '#0bdb6e', fillColor: '#0bdb6e', fillOpacity: 0.18 } },
  },
});
map.addControl(drawControl);

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

function showFieldStats(layer) {
  const stats = $('fieldStats');
  const geo = layer.toGeoJSON();
  const ll = layer.getLatLngs ? layer.getLatLngs()[0] : [];

  const areaM2 = L.GeometryUtil ? L.GeometryUtil.geodesicArea(ll) : approxArea(ll);
  const areaHa = (areaM2 / 10000).toFixed(2);

  const bounds = layer.getBounds();
  const center = bounds.getCenter();
  const centroid = `${center.lat.toFixed(4)}°N ${center.lng.toFixed(4)}°E`;

  let perimM = 0;
  for (let i = 0; i < ll.length; i++) {
    perimM += ll[i].distanceTo(ll[(i + 1) % ll.length]);
  }
  const perimKm = (perimM / 1000).toFixed(2);

  const pts = geo.geometry.type === 'Polygon'
    ? geo.geometry.coordinates[0].length - 1
    : 4;

  $('statArea').textContent = `${areaHa} ha`;
  $('statCentroid').textContent = centroid;
  $('statPerim').textContent = `${perimKm} km`;
  $('statPoints').textContent = `${pts}`;

  stats.classList.add('visible');

  $('navPolygonInfo').style.display = 'flex';
  $('navArea').textContent = `${areaHa} ha`;
  $('navCoords').textContent = centroid;
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

async function loadDemo() {
  clearDrawing();
  try {
    const res = await fetch('lichtwiese.geojson');
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

    const landB = data.features.find(f => f.properties?.name === 'Land B');
    if (landB) {
      S.polygon = JSON.stringify(landB.geometry);
      const fakeLayer = L.geoJSON(landB);
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
  S.polygon = null;
  S.drawnLayer = null;
  hideFieldStats();
}

async function fetchToken() {
  try {
    console.log('[Auth] Requesting token from proxy:', CFG.proxy.tokenUrl);
    const res = await fetch(CFG.proxy.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      console.error('[Auth] Proxy token error:', res.status, err);
      if (res.status === 503) {
        console.error('[Auth] Proxy not configured — set JACKDAW_CLIENT_ID and JACKDAW_CLIENT_SECRET in Render env vars');
      } else if (res.status === 502) {
        console.error('[Auth] Proxy could not reach JackDaw — check JackDaw API status');
      }
      return false;
    }

    const data = await res.json();
    if (!data.access_token) {
      console.error('[Auth] Proxy returned no access_token:', data);
      return false;
    }

    S.token = data.access_token;
    console.log('[Auth] Token acquired ✓');
    return true;
  } catch (err) {
    console.error('[Auth] Could not reach token proxy:', err.message);
    return false;
  }
}

async function connectMCP() {
  if (!S.token) return false;
  try {
    const res = await fetch(`${CFG.jackdaw.baseUrl}/mcp/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${S.token}`,
      },
      body: JSON.stringify({
        server_url: CFG.mcp.serverUrl,
        name: CFG.mcp.name,
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

function geojsonToWKT(geometry) {
  if (!geometry) return null;
  const geom = typeof geometry === 'string' ? JSON.parse(geometry) : geometry;
  
  if (geom.type === 'Polygon') {
    const ring = geom.coordinates[0];
    
    // Ensure longitude, latitude order (WKT standard)
    const points = ring.map(coord => {
      const lng = coord[0];
      const lat = coord[1];
      return `${lng} ${lat}`;
    });
    
    // Close the ring if not already closed
    const first = points[0];
    const last = points[points.length - 1];
    if (first !== last) {
      points.push(first);
    }
    
    const wkt = `POLYGON((${points.join(', ')}))`;
    console.log('[WKT] First point (lng lat):', points[0]);
    console.log('[WKT] Full WKT:', wkt);
    return wkt;
  }
  return null;
}

async function sendToJackDaw(userText) {
  const systemCtx = S.polygon
    ? `You are an expert agricultural and environmental analyst helping farmers understand their land. Use the provided tools to fetch real data. Never make up NDVI values, weather data, or terrain information.`
    : 'You are an expert agricultural analyst. No field polygon has been drawn yet. Politely ask the farmer to draw a field on the map first.';

  S.history.push({ role: 'user', content: userText });

  const payload = {
    messages: S.history,
    system: systemCtx,
  };

  if (S.sessionId) payload.session_id = S.sessionId;

  if (S.polygon) {
    const wkt = geojsonToWKT(S.polygon);
    if (wkt) {
      // JackDaw expects a "geometry" object containing wkt and srid
      payload.geometry = {
        wkt: wkt,
        srid: 4326
      };
    }
  }

  console.log('[Chat] Payload:', JSON.stringify(payload, null, 2));

  try {
    const res = await fetch(CFG.proxy.chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 401) {
      return 'Session expired. Please refresh the page.';
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const reply = data.message || data.content || data.response
      || (Array.isArray(data.content) ? data.content.map(c => c.text || '').join('\n') : null)
      || JSON.stringify(data);

    S.history.push({ role: 'assistant', content: reply });
    return reply;
  } catch (err) {
    console.error('[Chat] Proxy error:', err);
    return `⚠️ Could not reach analysis service.\n\nError: ${err.message}`;
  }
}

function appendMessage(role, content, isLoading = false) {
  const feed = $('messages');
  const div = document.createElement('div');
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
  return text
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre class="result-card"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<strong style="font-size:0.95em">$1</strong>')
    .replace(/^## (.+)$/gm, '<strong>$1</strong>')
    .replace(/^[•\-\*] (.+)$/gm, '<span style="display:block;padding-left:12px;margin:2px 0">· $1</span>')
    .replace(/^\d+\. (.+)$/gm, '<span style="display:block;padding-left:12px;margin:2px 0">$1</span>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(.*)$/, '<p>$1</p>');
}

async function handleSend() {
  const input = $('chatInput');
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
  const btn = $('sendBtn');
  const hasText = $('chatInput').value.trim().length > 0;
  btn.disabled = !hasText || S.isBusy;
}

function showChatBadge() {
  const badge = $('chatBadge');
  badge.textContent = S.unreadCount > 9 ? '9+' : S.unreadCount;
  badge.hidden = false;
}

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
  while (feed.children.length > 1) feed.removeChild(feed.lastChild);
  S.history = [];
  S.unreadCount = 0;
  $('chatBadge').hidden = true;
});

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

document.querySelectorAll('.chip').forEach(btn => {
  btn.addEventListener('click', () => {
    $('chatInput').value = btn.dataset.prompt;
    updateSendBtn();
    autoResizeTextarea($('chatInput'));
    $('chatInput').focus();
    if (isMobile()) switchPanel('chat');
  });
});

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
  }
  if (panel === 'map') {
    setTimeout(() => map.invalidateSize(), 350);
  }
}

$('tabMap').addEventListener('click', () => switchPanel('map'));
$('tabChat').addEventListener('click', () => switchPanel('chat'));

if (isMobile()) Q('.workspace').setAttribute('data-view', 'map');

window.addEventListener('resize', () => {
  if (!isMobile()) {
    Q('.workspace').removeAttribute('data-view');
    map.invalidateSize();
  }
});

function setConnectionStatus(state, label) {
  const badge = $('connectionBadge');
  badge.className = `connection-badge connection-badge--${state}`;
  $('connectionLabel').textContent = label;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[SW] Registered:', reg.scope))
      .catch(err => console.warn('[SW] Registration failed:', err));
  });
}

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

async function init() {
  const splashTimeout = setTimeout(() => {
    console.warn('[init] Timeout — forcing splash clear');
    hideSplash();
    setConnectionStatus('error', 'Timeout');
    updateSendBtn();
  }, 8000);

  try {
    splashProgress(10, 'Loading map…');
    await sleep(200);

    splashProgress(30, 'Connecting to JackDaw…');
    setConnectionStatus('connecting', 'Connecting');

    const tokenOk = await Promise.race([
      fetchToken(),
      sleep(6000).then(() => { console.warn('[init] Token fetch timed out'); return false; }),
    ]);

    if (tokenOk) {
      splashProgress(65, 'Registering tools…');
      setConnectionStatus('connecting', 'Registering');

      await Promise.race([
        connectMCP(),
        sleep(4000).then(() => false),
      ]).catch(err => console.warn('[init] MCP connect non-fatal:', err.message));

      splashProgress(90, 'Ready.');
      setConnectionStatus('online', 'Connected');
    } else {
      splashProgress(90, 'Auth failed — map ready');
      setConnectionStatus('error', 'Auth failed');
    }

    await sleep(300);
    splashProgress(100, 'Launching…');
    await sleep(250);

  } catch (err) {
    console.error('[init] Unexpected error:', err);
    setConnectionStatus('error', 'Error');
  } finally {
    clearTimeout(splashTimeout);
    hideSplash();
    updateSendBtn();

    if (new URLSearchParams(location.search).get('mode') === 'demo') {
      setTimeout(loadDemo, 600);
    }

    window.dispatchEvent(new CustomEvent('appReady'));
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

init().catch(err => {
  console.error('[init] Uncaught:', err);
  hideSplash();
  setConnectionStatus('error', 'Error');
  updateSendBtn();
});