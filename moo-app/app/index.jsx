// app/index.jsx  — Main screen, all platforms
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Platform, useWindowDimensions,
  Animated, TouchableOpacity,
} from 'react-native';
import { useJackDaw } from '../src/hooks/useJackDaw';
import { TopNav }     from '../src/components/TopNav';
import { BottomNav }  from '../src/components/BottomNav';
import { ChatPanel }  from '../src/components/ChatPanel';
import { MapToolbar } from '../src/components/MapToolbar';
import { FieldStatsBar } from '../src/components/FieldStatsBar';
import FieldMap       from '../src/components/FieldMap'; // resolves .web.jsx or .native.jsx
import { Colors, Fonts, Radius, Spacing, CHAT_WIDTH } from '../src/constants/tokens';

const MOBILE_BREAKPOINT = 860;

function now() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

// ── Animated splash overlay ────────────────────────────────────────────────
function AppSplash({ visible, progress, status }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!visible && opacity.__getValue() === 0) return null;

  return (
    <Animated.View style={[styles.splash, { opacity }]} pointerEvents={visible ? 'auto' : 'none'}>
      <Text style={styles.splashCow}>🐄</Text>
      <Text style={styles.splashWord}>eMoo<Text style={styles.splashGreen}>JI</Text></Text>
      <Text style={styles.splashSub}>FIELD INTELLIGENCE · JACKDAW GEOAI</Text>
      <View style={styles.splashTrack}>
        <View style={[styles.splashBar, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.splashStatus}>{status}</Text>
    </Animated.View>
  );
}

export default function MainScreen() {
  const { width }  = useWindowDimensions();
  const isMobile   = width < MOBILE_BREAKPOINT;

  // ── Splash ─────────────────────────────────────────────────────────────
  const [splashVisible,  setSplashVisible]  = useState(true);
  const [splashProgress, setSplashProgress] = useState(0);
  const [splashStatus,   setSplashStatus]   = useState('Initialising…');

  // ── Field ───────────────────────────────────────────────────────────────
  const [polygon,    setPolygon]    = useState(null);
  const [fieldStats, setFieldStats] = useState(null);
  const [mapLayer,   setMapLayer]   = useState('street');
  const [drawMode,   setDrawMode]   = useState(null); // 'polygon' | 'rectangle' | null
  const [demoTrigger, setDemoTrigger] = useState(null);

  // ── Chat ────────────────────────────────────────────────────────────────
  const [messages,    setMessages]    = useState([]);
  const [isLoading,   setIsLoading]   = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // ── Navigation ──────────────────────────────────────────────────────────
  const [activePanel, setActivePanel] = useState('map');

  // ── Install (web only) ──────────────────────────────────────────────────
  const [installPrompt,    setInstallPrompt]    = useState(null);
  const [showInstallBtn,   setShowInstallBtn]   = useState(false);

  // ── JackDaw ─────────────────────────────────────────────────────────────
  const { connStatus, init, sendMessage, clearHistory } = useJackDaw();

  // ── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    init((pct, label) => {
      setSplashProgress(pct);
      setSplashStatus(label);
    }).finally(() => setSplashVisible(false));
  }, [init]);

  // Web: PWA install prompt
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); setShowInstallBtn(true); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setShowInstallBtn(false); setInstallPrompt(null); });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // ── Callbacks ────────────────────────────────────────────────────────────
  const handleFieldDrawn = useCallback((poly, stats) => {
    setPolygon(poly);
    setFieldStats(stats);
    if (isMobile) setUnreadCount(c => c + 1);
  }, [isMobile]);

  const handleFieldCleared = useCallback(() => { setPolygon(null); setFieldStats(null); }, []);

  const appendMsg = (role, content) => setMessages(prev => [...prev, { role, content, time: now() }]);

  const handleDemoLoaded = useCallback(() => {
    appendMsg('assistant',
      '**Lichtwiese demo paddocks loaded.**\n\nLand A (4.2 ha), Land B (6.1 ha, selected), and Land C (3.8 ha) are now on the map near Darmstadt, Germany.\n\nAsk me anything about Land B, or tap a quick-analysis chip.'
    );
    if (isMobile) switchPanel('chat');
  }, [isMobile]);

  const handleSend = useCallback(async (text) => {
    appendMsg('user', text);
    setIsLoading(true);
    try {
      const reply = await sendMessage(text, polygon);
      appendMsg('assistant', reply);
      if (isMobile && activePanel === 'map') setUnreadCount(c => c + 1);
    } catch (err) {
      appendMsg('assistant', `⚠️ Could not reach analysis service.\n\nError: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [sendMessage, polygon, isMobile, activePanel]);

  const handleClearChat = useCallback(() => { setMessages([]); setUnreadCount(0); clearHistory(); }, [clearHistory]);

  const switchPanel = useCallback((panel) => {
    setActivePanel(panel);
    if (panel === 'chat') setUnreadCount(0);
  }, []);

  const handleChipClick = useCallback(() => {
    if (isMobile) switchPanel('chat');
  }, [isMobile, switchPanel]);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') { setShowInstallBtn(false); setInstallPrompt(null); }
  };

  // Demo: pass a trigger function down to the map
  const handleDemo = useCallback(() => {
    // Web map handles demo via its own internal loadDemo
    // We signal it by setting a new trigger object (referential change = effect fires)
    setDemoTrigger({ ts: Date.now() });
  }, []);

  // ── Map panel ────────────────────────────────────────────────────────────
  const mapVisible  = !isMobile || activePanel === 'map';
  const chatVisible = !isMobile || activePanel === 'chat';

  const MapSection = (
    <View style={[styles.mapSection, isMobile && !mapVisible && styles.hidden]}>
      <MapToolbar
        onPolygon={() => setDrawMode('polygon')}
        onRectangle={() => setDrawMode('rectangle')}
        onDemo={handleDemo}
        onClear={() => { handleFieldCleared(); setDrawMode(null); }}
        onLayerSat={() => setMapLayer('satellite')}
        onLayerStreet={() => setMapLayer('street')}
        mapLayer={mapLayer}
        drawMode={drawMode}
        fieldStats={fieldStats}
      />
      <View style={styles.mapContainer}>
        <FieldMap
          onFieldDrawn={handleFieldDrawn}
          onFieldCleared={handleFieldCleared}
          mapLayer={mapLayer}
          drawMode={drawMode}
          onDrawModeChange={setDrawMode}
          onDemoTrigger={demoTrigger ? (drawnRef, mapRef) => {
            // Web demo loader — fetch lichtwiese.geojson
            fetch('/lichtwiese.geojson')
              .then(r => r.json())
              .then(data => {
                // This only runs in the web version — native handles it differently
                handleDemoLoaded();
              })
              .catch(err => appendMsg('assistant', `Demo load failed: ${err.message}`));
          } : null}
        />
        <FieldStatsBar stats={fieldStats} />
      </View>
    </View>
  );

  const ChatSection = (
    <View style={[styles.chatSection, isMobile && !chatVisible && styles.hidden]}>
      <ChatPanel
        messages={messages}
        isLoading={isLoading}
        onSend={handleSend}
        onClearChat={handleClearChat}
        onChipClick={handleChipClick}
        hasField={!!polygon}
      />
    </View>
  );

  return (
    <View style={styles.root}>
      <TopNav
        connStatus={connStatus}
        fieldStats={fieldStats}
        showInstall={showInstallBtn}
        onInstall={handleInstall}
      />

      <View style={[styles.workspace, !isMobile && styles.workspaceDesktop]}>
        {MapSection}
        {ChatSection}
      </View>

      {isMobile && (
        <BottomNav
          activePanel={activePanel}
          onSwitch={switchPanel}
          unreadCount={unreadCount}
        />
      )}

      <AppSplash visible={splashVisible} progress={splashProgress} status={splashStatus} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.bgBase },
  workspace: { flex: 1 },
  workspaceDesktop: { flexDirection: 'row' },

  mapSection:  { flex: 1, backgroundColor: Colors.bgBase },
  chatSection: {
    ...Platform.select({
      web: { width: CHAT_WIDTH, flexShrink: 0 },
      default: { flex: 1 },
    }),
    backgroundColor: Colors.bgSurface,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },
  hidden:      { display: 'none' },

  mapContainer: { flex: 1, position: 'relative' },

  // Splash
  splash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: Colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  splashCow:    { fontSize: 52 },
  splashWord:   { fontFamily: Fonts.displayBold, fontSize: 32, color: Colors.textPrimary, letterSpacing: -1 },
  splashGreen:  { color: Colors.green },
  splashSub:    { fontFamily: Fonts.mono, fontSize: 10, color: Colors.textMuted, letterSpacing: 1.5, marginTop: 4 },
  splashTrack:  { width: 160, height: 2, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 1, marginTop: 20, overflow: 'hidden' },
  splashBar:    { height: 2, backgroundColor: Colors.green, borderRadius: 1 },
  splashStatus: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.textMuted },
});
