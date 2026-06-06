// app/index.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Platform, useWindowDimensions,
  Animated, PanResponder,
} from 'react-native';
import { useJackDaw }          from '../src/hooks/useJackDaw';
import { TopNav }              from '../src/components/TopNav';
import { BottomNav }           from '../src/components/BottomNav';
import { ChatPanel }           from '../src/components/ChatPanel';
import { MapToolbar }          from '../src/components/MapToolbar';
import { FieldStatsBar }       from '../src/components/FieldStatsBar';
import FieldMap                from '../src/components/FieldMap';
import { NudgeModal }          from '../src/components/NudgeModal';
import { HistoryDrawer }       from '../src/components/HistoryDrawer';
import { RecordingsDrawer }    from '../src/components/RecordingsDrawer';
import { useRecording }        from '../src/hooks/useRecording';
import {
  upsertLocalSession,
  upsertRemoteSession,
  migrateLocalToRemote,
} from '../src/hooks/useSessionStorage';
import { Fonts, CHAT_WIDTH, DarkColors } from '../src/constants/tokens';
import { useAuth }             from '../src/context/AuthContext';
import { useTheme }            from '../src/context/ThemeContext';

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
        toValue: 0, duration: 500, useNativeDriver: Platform.OS !== 'web',
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

// ── Location tip modal ────────────────────────────────────────────────────
function LocationTipModal({ colors, onClose }) {
  return (
    <View style={locationStyles.overlay} pointerEvents="box-none">
      <View style={[locationStyles.card, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
        <Text style={locationStyles.icon}>📍</Text>
        <Text style={[locationStyles.title, { color: colors.textPrimary }]}>Enable Location</Text>
        <Text style={[locationStyles.body, { color: colors.textMuted }]}>
          Allow location access so the map centres on your area automatically — making it faster to draw your field and get satellite analysis.
        </Text>
        <Text style={[locationStyles.hint, { color: colors.textMuted }]}>
          To enable: tap the lock icon in your browser address bar → Site settings → Location → Allow
        </Text>
        <TouchableOpacity
          style={[locationStyles.btn, { backgroundColor: colors.green }]}
          onPress={onClose}
        >
          <Text style={locationStyles.btnText}>Got it</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const locationStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 500,
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    ...Platform.select({
      web: { boxShadow: '0 8px 32px rgba(0,0,0,0.3)' },
      ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 16 },
    }),
  },
  icon:  { fontSize: 36 },
  title: { fontFamily: Fonts.displayBold, fontSize: 18, textAlign: 'center' },
  body:  { fontFamily: Fonts.body, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  hint:  { fontFamily: Fonts.mono, fontSize: 10, textAlign: 'center', lineHeight: 16, opacity: 0.7 },
  btn:   { borderRadius: 12, paddingHorizontal: 32, paddingVertical: 12, marginTop: 4 },
  btnText: { fontFamily: Fonts.displayBold, fontSize: 14, color: '#07090e' },
});

export default function MainScreen() {
  const { width }  = useWindowDimensions();
  const isMobile   = width < MOBILE_BREAKPOINT;

  const theme  = useTheme();
  const colors = theme?.colors ?? DarkColors;

  const auth        = useAuth();
  const user        = auth?.user ?? null;
  const customerId  = user?.uid || null;
  const isSignedIn  = !!user;
  const prevUserRef = useRef(null);

  const fieldMapRef    = useRef(null);
  const sessionIdRef   = useRef(null);

  // ── Generate session ID and init in DB on app start ────────────
  const initFullSession = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions-full/init', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.uid ? { 'X-User-Id': user.uid } : {}),
        },
        body: JSON.stringify({
          polygon:    polygonRef.current    || null,
          fieldStats: fieldStatsRef.current || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        sessionIdRef.current = data.id;
        console.log('Session initialized:', data.id);
      }
    } catch (e) {
      console.error('Session init failed:', e);
    }
  }, [user]);
  const messagesRef    = useRef([]);
  const polygonRef     = useRef(null);
  const fieldStatsRef  = useRef(null);

  // ── Splash ─────────────────────────────────────────────────────
  const [splashVisible,  setSplashVisible]  = useState(true);
  const [splashProgress, setSplashProgress] = useState(0);
  const [splashStatus,   setSplashStatus]   = useState('Initialising…');

  // ── Map ────────────────────────────────────────────────────────
  const [polygon,    setPolygon]    = useState(null);
  const [fieldStats, setFieldStats] = useState(null);
  const [mapLayer,   setMapLayer]   = useState('street');
  const [drawMode,   setDrawMode]   = useState(null);

  // ── Chat ───────────────────────────────────────────────────────
  const [messages,     setMessages]     = useState([]);
  const [isLoading,    setIsLoading]    = useState(false);
  const [streamStatus, setStreamStatus] = useState('');
  const [unreadCount,  setUnreadCount]  = useState(0);
  const [activePanel,  setActivePanel]  = useState('map');

  // ── Modals & Drawers ───────────────────────────────────────────
  const [showNudge,      setShowNudge]      = useState(false);
  const [showLocationTip, setShowLocationTip] = useState(false);
  const [showHistory,    setShowHistory]    = useState(false);
  const [showRecordings, setShowRecordings] = useState(false);
  const nudgeShownRef = useRef(false);

  // ── PWA install ────────────────────────────────────────────────
  const [installPrompt,  setInstallPrompt]  = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  // ── Hooks ──────────────────────────────────────────────────────
  const { connStatus, init, initMCP, sendMessage, clearHistory } = useJackDaw();
  const {
    isSessionActive,
    isRecording,
    sessionIdRef: recordingSessionIdRef,
    startSession:  startRecordingSession,
    startClip,
    pauseClip,
    endSession:    endRecordingSession,
  } = useRecording();

  // ── Swipe from left edge to open history drawer (mobile) ───────
  const swipeStartX = useRef(null);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        swipeStartX.current = evt.nativeEvent.pageX;
        return evt.nativeEvent.pageX < 30;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return swipeStartX.current !== null && swipeStartX.current < 30 && gestureState.dx > 10;
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (swipeStartX.current !== null && swipeStartX.current < 30 && gestureState.dx > 50) {
          setShowHistory(true);
        }
        swipeStartX.current = null;
      },
      onPanResponderTerminate: () => { swipeStartX.current = null; },
    })
  ).current;

  // Keep refs in sync
  useEffect(() => { messagesRef.current  = messages;   }, [messages]);
  useEffect(() => { polygonRef.current   = polygon;    }, [polygon]);
  useEffect(() => { fieldStatsRef.current = fieldStats; }, [fieldStats]);

  // ── Request location permission on first load ─────────────────
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      () => {}, // success — map already handles centering
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          // Show tip after splash is gone
          setTimeout(() => setShowLocationTip(true), 1500);
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  // ── Request location permission on app load ───────────────────
  useEffect(() => {
    if (Platform.OS !== 'web' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      () => {},
      (err) => {
        if (err.code === 1) { // PERMISSION_DENIED
          setTimeout(() => setShowLocationTip(true), 1800);
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // ── Init ───────────────────────────────────────────────────────
  useEffect(() => {
    init((pct, label) => {
      setSplashProgress(pct);
      setSplashStatus(label);
    }).finally(() => {
      setSplashVisible(false);
      initFullSession(); // init session in DB after app loads
    });
  }, [init, initFullSession]);

  // ── Auth state changes ─────────────────────────────────────────
  useEffect(() => {
    const wasSignedIn    = !!prevUserRef.current;
    const wasSignedOut   = !prevUserRef.current;
    const isNowSignedIn  = !!user;
    const isNowSignedOut = !user;
    prevUserRef.current  = user;

    if (wasSignedOut && isNowSignedIn) {
      // MCP disabled for now — using pure JackDaw for all users
      // initMCP(); // re-enable when MCP tools are ready
      setShowNudge(false);
      migrateLocalToRemote(user.uid).catch(() => {});
    }

    if (wasSignedIn && isNowSignedOut) {
      fetch('/api/mcp/all', { method: 'DELETE' }).catch(() => {});
    }
  }, [user, initMCP]);

  // ── PWA install ────────────────────────────────────────────────
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

  // ── Field handlers ─────────────────────────────────────────────
  const handleFieldDrawn = useCallback((poly, stats) => {
    setPolygon(poly);
    setFieldStats(stats);
    if (isMobile) setUnreadCount(c => c + 1);
  }, [isMobile]);

  const handleFieldCleared = useCallback(() => {
    setPolygon(null);
    setFieldStats(null);
    setDrawMode(null);
    fieldMapRef.current?.clearField();
  }, []);

  // ── Auto-save ──────────────────────────────────────────────────
  const autoSave = useCallback(async (msgs, poly, stats) => {
    if (!msgs || msgs.length === 0) return;
    if (isSignedIn && user) {
      const id = await upsertRemoteSession(user.uid, msgs, poly, stats, sessionIdRef.current);
      if (id) sessionIdRef.current = id;
    } else {
      const id = upsertLocalSession(msgs, poly, stats, sessionIdRef.current);
      if (id) sessionIdRef.current = id;
    }
  }, [isSignedIn, user]);

  const appendMsg = useCallback((role, content) => {
    setMessages(prev => [...prev, { role, content, time: now() }]);
  }, []);

  // ── Send message ───────────────────────────────────────────────
  const doSend = useCallback(async (text) => {
    const userMsg = { role: 'user', content: text, time: now() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setStreamStatus('Thinking…');

    if (isSessionActive) startClip(text);

    try {
      const reply = await sendMessage(
        text,
        polygonRef.current,
        customerId,
        (status) => setStreamStatus(status),
        isSignedIn,
        sessionIdRef.current, // pass sessions_full UUID for thinking trace storage
      );
      const assistantMsg = { role: 'assistant', content: reply, time: now() };
      setMessages(prev => {
        const updated = [...prev, assistantMsg];
        autoSave(updated, polygonRef.current, fieldStatsRef.current);
        return updated;
      });
      if (isSessionActive) setTimeout(() => pauseClip(), 2000);
      if (isMobile && activePanel === 'map') setUnreadCount(c => c + 1);
      if (!isSignedIn && !nudgeShownRef.current) {
        nudgeShownRef.current = true;
        setTimeout(() => setShowNudge(true), 800);
      }
    } catch (err) {
      appendMsg('assistant', `⚠️ Could not reach analysis service.\n\nError: ${err.message}`);
      if (isSessionActive) setTimeout(() => pauseClip(), 2000);
    } finally {
      setIsLoading(false);
      setStreamStatus('');
    }
  }, [sendMessage, customerId, isSignedIn, isMobile, activePanel, autoSave, appendMsg, isSessionActive, startClip, pauseClip]);

  const handleSend = useCallback((text) => {
    if (!polygon) {
      // No field drawn — show inline prompt instead of sending
      setMessages(prev => [
        ...prev,
        { role: 'user', content: text, time: now() },
        {
          role: 'assistant',
          content: "🗺️ **Please draw a field first.**\n\nTap **Polygon** or **Rectangle** in the toolbar above the map, draw over any field in Europe, and then ask your question — I'll analyse that specific area using real satellite data.",
          time: now(),
        },
      ]);
      // Switch to chat on mobile so user sees the message
      if (isMobile) setActivePanel('chat');
      return;
    }
    doSend(text);
  }, [doSend, polygon, isMobile]);

  // ── Recording ──────────────────────────────────────────────────
  const handleStartSession = useCallback(() => {
    startRecordingSession(`rec_${Date.now()}`);
  }, [startRecordingSession]);

  const handleEndSession = useCallback(() => {
    const title = messagesRef.current.find(m => m.role === 'user')?.content?.slice(0, 60) || 'Session';
    const chatSessionId = sessionIdRef.current || recordingSessionIdRef.current;
    endRecordingSession(chatSessionId, title);
  }, [endRecordingSession, recordingSessionIdRef]);

  // ── Clear chat ─────────────────────────────────────────────────
  const handleClearChat = useCallback(() => {
    setMessages([]);
    setUnreadCount(0);
    nudgeShownRef.current = false;
    clearHistory();
    initFullSession(); // start a fresh session in DB
  }, [clearHistory, initFullSession]);

  // ── Load session from history ──────────────────────────────────
  const handleLoadSession = useCallback((session) => {
    sessionIdRef.current = session.local ? null : session.id;
    setMessages(session.messages || []);

    if (session.polygon) {
      setPolygon(session.polygon);
      // Restore polygon on Leaflet map
      fieldMapRef.current?.loadField(session.polygon);
    }

    if (session.field_stats) {
      try {
        setFieldStats(
          typeof session.field_stats === 'string'
            ? JSON.parse(session.field_stats)
            : session.field_stats
        );
      } catch {}
    }

    if (isMobile) setActivePanel('chat');
  }, [isMobile]);

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
    <View
      style={[styles.root, { backgroundColor: colors.bgBase }]}
      {...(isMobile ? panResponder.panHandlers : {})}
    >
      <TopNav
        connStatus={connStatus}
        fieldStats={fieldStats}
        showInstall={showInstallBtn}
        onInstall={handleInstall}
        onSignIn={() => setShowNudge(true)}
        onHistory={isSignedIn ? () => setShowHistory(true) : null}
        onRecordings={() => setShowRecordings(true)}
      />

      <View style={[styles.workspace, !isMobile && styles.workspaceDesktop]}>

        {/* Map */}
        <View style={[
          styles.mapSection,
          { backgroundColor: colors.bgBase },
          isMobile && !mapVisible && styles.hidden,
        ]}>
          <MapToolbar
            onPolygon={() => setDrawMode('polygon')}
            onRectangle={() => setDrawMode('rectangle')}
            onClear={handleFieldCleared}
            onLayerSat={() => setMapLayer('satellite')}
            onLayerStreet={() => setMapLayer('street')}
            mapLayer={mapLayer}
            drawMode={drawMode}
            fieldStats={fieldStats}
          />
          <View style={styles.mapContainer}>
            <FieldMap
              ref={fieldMapRef}
              onFieldDrawn={handleFieldDrawn}
              onFieldCleared={handleFieldCleared}
              mapLayer={mapLayer}
              drawMode={drawMode}
              onDrawModeChange={setDrawMode}
            />
            <FieldStatsBar stats={fieldStats} />
          </View>
        </View>

        {/* Chat */}
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
            isSessionActive={isSessionActive}
            isRecording={isRecording}
            onStartSession={handleStartSession}
            onEndSession={handleEndSession}
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

      {/* Drawers — rendered at root level so they appear above everything */}
      <RecordingsDrawer
        visible={showRecordings}
        onClose={() => setShowRecordings(false)}
      />

      <HistoryDrawer
        visible={showHistory}
        onClose={() => setShowHistory(false)}
        userId={user?.uid || null}
        onLoadSession={handleLoadSession}
        onNewChat={handleClearChat}
      />

      {/* Location permission tip */}
      {showLocationTip && (
        <LocationTip onClose={() => setShowLocationTip(false)} colors={colors} />
      )}

      {/* Location tip — shown when user denies location permission */}
      {showLocationTip && (
        <LocationTipModal
          colors={colors}
          onClose={() => setShowLocationTip(false)}
        />
      )}

      <NudgeModal
        visible={showNudge}
        onClose={() => setShowNudge(false)}
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
  root:               { flex: 1, ...Platform.select({ web: { height: '100vh', overflow: 'hidden' } }) },
  workspace:          { flex: 1, ...Platform.select({ web: { minHeight: 0, overflow: 'hidden' } }) },
  workspaceDesktop:   { flexDirection: 'row' },
  mapSection:         { flex: 1, ...Platform.select({ web: { minHeight: 0 } }) },
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