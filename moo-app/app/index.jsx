// app/index.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Platform, useWindowDimensions, Animated,
} from 'react-native';
import { useJackDaw }       from '../src/hooks/useJackDaw';
import { TopNav }           from '../src/components/TopNav';
import { BottomNav }        from '../src/components/BottomNav';
import { ChatPanel }        from '../src/components/ChatPanel';
import { MapToolbar }       from '../src/components/MapToolbar';
import { FieldStatsBar }    from '../src/components/FieldStatsBar';
import FieldMap             from '../src/components/FieldMap';
import { Colors, Fonts, Spacing, CHAT_WIDTH } from '../src/constants/tokens';

const MOBILE_BREAKPOINT = 860;

function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function AppSplash({ visible, progress, status }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }).start();
    }
  }, [visible]);

  return (
    <Animated.View
      style={[styles.splash, { opacity }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
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

  const [splashVisible,  setSplashVisible]  = useState(true);
  const [splashProgress, setSplashProgress] = useState(0);
  const [splashStatus,   setSplashStatus]   = useState('Initialising…');

  const [polygon,    setPolygon]    = useState(null);
  const [fieldStats, setFieldStats] = useState(null);
  const [mapLayer,   setMapLayer]   = useState('street');
  const [drawMode,   setDrawMode]   = useState(null);

  const [messages,    setMessages]    = useState([]);
  const [isLoading,   setIsLoading]   = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activePanel, setActivePanel] = useState('map');

  const [installPrompt,  setInstallPrompt]  = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  const { connStatus, init, sendMessage, clearHistory } = useJackDaw();

  useEffect(() => {
    init((pct, label) => {
      setSplashProgress(pct);
      setSplashStatus(label);
    }).finally(() => setSplashVisible(false));
  }, [init]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); setShowInstallBtn(true); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setShowInstallBtn(false); setInstallPrompt(null); });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleFieldDrawn = useCallback((poly, stats) => {
    setPolygon(poly);
    setFieldStats(stats);
    if (isMobile) setUnreadCount(c => c + 1);
  }, [isMobile]);

  const handleFieldCleared = useCallback(() => {
    setPolygon(null);
    setFieldStats(null);
  }, []);

  const appendMsg = (role, content) =>
    setMessages(prev => [...prev, { role, content, time: now() }]);

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

  const handleClearChat = useCallback(() => {
    setMessages([]);
    setUnreadCount(0);
    clearHistory();
  }, [clearHistory]);

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

  const mapVisible  = !isMobile || activePanel === 'map';
  const chatVisible = !isMobile || activePanel === 'chat';

  return (
    <View style={styles.root}>
      <TopNav
        connStatus={connStatus}
        fieldStats={fieldStats}
        showInstall={showInstallBtn}
        onInstall={handleInstall}
      />

      {/* Workspace — row on desktop, stacked on mobile */}
      <View style={[styles.workspace, !isMobile && styles.workspaceDesktop]}>

        {/* Map section */}
        <View style={[
          styles.mapSection,
          isMobile && !mapVisible && styles.hidden,
        ]}>
          <MapToolbar
            onPolygon={() => setDrawMode('polygon')}
            onRectangle={() => setDrawMode('rectangle')}
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
            />
            <FieldStatsBar stats={fieldStats} />
          </View>
        </View>

        {/* Chat section */}
        <View style={[
          styles.chatSection,
          isMobile ? styles.chatSectionMobile : styles.chatSectionDesktop,
          isMobile && !chatVisible && styles.hidden,
        ]}>
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            onSend={handleSend}
            onClearChat={handleClearChat}
            onChipClick={handleChipClick}
            hasField={!!polygon}
          />
        </View>
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
  root: {
    flex: 1,
    backgroundColor: Colors.bgBase,
    // On web, ensure root fills the full viewport height
    ...Platform.select({ web: { height: '100vh', overflow: 'hidden' } }),
  },

  workspace: {
    flex: 1,
    // minHeight:0 is the web fix — without it flex children can overflow
    ...Platform.select({ web: { minHeight: 0, overflow: 'hidden' } }),
  },
  workspaceDesktop: {
    flexDirection: 'row',
  },

  mapSection: {
    flex: 1,
    backgroundColor: Colors.bgBase,
    ...Platform.select({ web: { minHeight: 0 } }),
  },

  // Desktop chat sidebar — fixed width, never grows or shrinks
  chatSectionDesktop: {
    width: CHAT_WIDTH,
    flexShrink: 0,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },

  // Chat section base
  chatSection: {
    backgroundColor: Colors.bgSurface,
    ...Platform.select({ web: { minHeight: 0 } }),
  },

  // Mobile chat — fill available space
  chatSectionMobile: {
    flex: 1,
  },

  hidden:       { display: 'none' },
  mapContainer: { flex: 1, position: 'relative' },

  // Splash
  splash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: Colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  splashCow:    { fontSize: 48 },
  splashWord:   { fontFamily: Fonts.displayBold, fontSize: 30, color: Colors.textPrimary, letterSpacing: -1 },
  splashGreen:  { color: Colors.green },
  splashSub:    { fontFamily: Fonts.mono, fontSize: 9, color: Colors.textMuted, letterSpacing: 1.5, marginTop: 3 },
  splashTrack:  { width: 140, height: 1.5, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 1, marginTop: 18, overflow: 'hidden' },
  splashBar:    { height: 1.5, backgroundColor: Colors.green, borderRadius: 1 },
  splashStatus: { fontFamily: Fonts.mono, fontSize: 10, color: Colors.textMuted },
});