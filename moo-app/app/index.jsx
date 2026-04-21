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
import { SignInModal }      from '../src/components/SignInModal';
import { Fonts, CHAT_WIDTH, DarkColors } from '../src/constants/tokens';
import { useAuth }          from '../src/context/AuthContext';
import { useTheme }         from '../src/context/ThemeContext';

const MOBILE_BREAKPOINT = 860;

function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function AppSplash({ visible, progress, status }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const theme   = useTheme();
  const colors  = theme?.colors ?? DarkColors;

  useEffect(() => {
    if (!visible) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [visible]);

  return (
    <Animated.View
      style={[styles.splash, { opacity, backgroundColor: colors.bgBase }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Text style={styles.splashCow}>🐄</Text>
      <Text style={[styles.splashWord, { color: colors.textPrimary }]}>
        eMoo<Text style={{ color: colors.green }}>JI</Text>
      </Text>
      <Text style={[styles.splashSub, { color: colors.textMuted }]}>
        FIELD INTELLIGENCE · JACKDAW GEOAI
      </Text>
      <View style={styles.splashTrack}>
        <View style={[styles.splashBar, { width: `${progress}%`, backgroundColor: colors.green }]} />
      </View>
      <Text style={[styles.splashStatus, { color: colors.textMuted }]}>{status}</Text>
    </Animated.View>
  );
}

export default function MainScreen() {
  const { width }  = useWindowDimensions();
  const isMobile   = width < MOBILE_BREAKPOINT;

  const theme  = useTheme();
  const colors = theme?.colors ?? DarkColors;

  // ── Firebase auth ──────────────────────────────────────────────
  const auth       = useAuth();
  const user       = auth?.user ?? null;
  const customerId = user?.uid || null;

  // ── Splash ─────────────────────────────────────────────────────
  const [splashVisible,  setSplashVisible]  = useState(true);
  const [splashProgress, setSplashProgress] = useState(0);
  const [splashStatus,   setSplashStatus]   = useState('Initialising…');

  // ── Map state ──────────────────────────────────────────────────
  const [polygon,    setPolygon]    = useState(null);
  const [fieldStats, setFieldStats] = useState(null);
  const [mapLayer,   setMapLayer]   = useState('street');
  const [drawMode,   setDrawMode]   = useState(null);

  // ── Chat state ─────────────────────────────────────────────────
  const [messages,     setMessages]     = useState([]);
  const [isLoading,    setIsLoading]    = useState(false);
  const [streamStatus, setStreamStatus] = useState('');
  const [unreadCount,  setUnreadCount]  = useState(0);
  const [activePanel,  setActivePanel]  = useState('map');

  // ── Sign-in modal ──────────────────────────────────────────────
  // pendingMessage holds the text the user tried to send before signing in.
  // After sign-in succeeds, we send it automatically.
  const [showSignIn,      setShowSignIn]      = useState(false);
  const [pendingMessage,  setPendingMessage]  = useState('');

  // ── PWA install ────────────────────────────────────────────────
  const [installPrompt,  setInstallPrompt]  = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  const { connStatus, init, sendMessage, clearHistory } = useJackDaw();

  // ── Init JackDaw on mount ──────────────────────────────────────
  useEffect(() => {
    init((pct, label) => {
      setSplashProgress(pct);
      setSplashStatus(label);
    }).finally(() => setSplashVisible(false));
  }, [init]);

  // ── Auto-send pending message after sign-in ────────────────────
  useEffect(() => {
    if (user && pendingMessage) {
      const msg = pendingMessage;
      setPendingMessage('');
      setShowSignIn(false);
      // Small delay so modal closes smoothly before sending
      setTimeout(() => doSend(msg), 400);
    }
  }, [user]);

  // ── PWA install prompt ─────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBtn(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setShowInstallBtn(false);
      setInstallPrompt(null);
    });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // ── Field drawn ────────────────────────────────────────────────
  const handleFieldDrawn = useCallback((poly, stats) => {
    setPolygon(poly);
    setFieldStats(stats);
    if (isMobile) setUnreadCount(c => c + 1);
  }, [isMobile]);

  const handleFieldCleared = useCallback(() => {
    setPolygon(null);
    setFieldStats(null);
  }, []);

  // ── Core send function ─────────────────────────────────────────
  const appendMsg = (role, content) =>
    setMessages(prev => [...prev, { role, content, time: now() }]);

  const doSend = useCallback(async (text) => {
    appendMsg('user', text);
    setIsLoading(true);
    setStreamStatus('Thinking…');
    try {
      const reply = await sendMessage(
        text,
        polygon,
        customerId,
        (status) => setStreamStatus(status),
      );
      appendMsg('assistant', reply);
      if (isMobile && activePanel === 'map') setUnreadCount(c => c + 1);
    } catch (err) {
      appendMsg('assistant', `⚠️ Could not reach analysis service.\n\nError: ${err.message}`);
    } finally {
      setIsLoading(false);
      setStreamStatus('');
    }
  }, [sendMessage, polygon, customerId, isMobile, activePanel]);

  // ── handleSend — gate behind auth ─────────────────────────────
  // If user is not signed in, save the message and show sign-in modal.
  // After sign-in, the useEffect above auto-sends it.
  const handleSend = useCallback((text) => {
    if (!user) {
      setPendingMessage(text);
      setShowSignIn(true);
      return;
    }
    doSend(text);
  }, [user, doSend]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    setUnreadCount(0);
    clearHistory();
  }, [clearHistory]);

  const switchPanel = useCallback((panel) => {
    setActivePanel(panel);
    if (panel === 'chat') setUnreadCount(0);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
      setInstallPrompt(null);
    }
  };

  const mapVisible  = !isMobile || activePanel === 'map';
  const chatVisible = !isMobile || activePanel === 'chat';

  return (
    <View style={[styles.root, { backgroundColor: colors.bgBase }]}>

      <TopNav
        connStatus={connStatus}
        fieldStats={fieldStats}
        showInstall={showInstallBtn}
        onInstall={handleInstall}
      />

      <View style={[styles.workspace, !isMobile && styles.workspaceDesktop]}>

        {/* Map section */}
        <View style={[
          styles.mapSection,
          { backgroundColor: colors.bgBase },
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
          { backgroundColor: colors.bgSurface },
          isMobile ? styles.chatSectionMobile : [
            styles.chatSectionDesktop,
            { borderLeftColor: colors.border },
          ],
          isMobile && !chatVisible && styles.hidden,
        ]}>
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            streamStatus={streamStatus}
            onSend={handleSend}
            onClearChat={handleClearChat}
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

      {/* Sign-in modal — shown when unauthenticated user tries to chat */}
      <SignInModal
        visible={showSignIn}
        onClose={() => setShowSignIn(false)}
        pendingMessage={pendingMessage}
      />

      <AppSplash
        visible={splashVisible}
        progress={splashProgress}
        status={splashStatus}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    ...Platform.select({ web: { height: '100vh', overflow: 'hidden' } }),
  },
  workspace: {
    flex: 1,
    ...Platform.select({ web: { minHeight: 0, overflow: 'hidden' } }),
  },
  workspaceDesktop:   { flexDirection: 'row' },
  mapSection: {
    flex: 1,
    ...Platform.select({ web: { minHeight: 0 } }),
  },
  chatSectionDesktop: { width: CHAT_WIDTH, flexShrink: 0, borderLeftWidth: 1 },
  chatSection:        { ...Platform.select({ web: { minHeight: 0 } }) },
  chatSectionMobile:  { flex: 1 },
  hidden:             { display: 'none' },
  mapContainer:       { flex: 1, position: 'relative' },
  splash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  splashCow:    { fontSize: 48 },
  splashWord:   { fontFamily: Fonts.displayBold, fontSize: 30, letterSpacing: -1 },
  splashSub:    { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 1.5, marginTop: 3 },
  splashTrack:  { width: 140, height: 1.5, backgroundColor: 'rgba(128,128,128,0.15)', borderRadius: 1, marginTop: 18, overflow: 'hidden' },
  splashBar:    { height: 1.5, borderRadius: 1 },
  splashStatus: { fontFamily: Fonts.mono, fontSize: 10 },
});