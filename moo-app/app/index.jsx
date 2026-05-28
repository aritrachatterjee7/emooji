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
import { NudgeModal }       from '../src/components/NudgeModal';
import { HistoryDrawer }    from '../src/components/HistoryDrawer';
import {
  upsertLocalSession,
  upsertRemoteSession,
  migrateLocalToRemote,
} from '../src/hooks/useSessionStorage';
import { Fonts, CHAT_WIDTH, DarkColors } from '../src/constants/tokens';
import { useRecording } from '../src/hooks/useRecording';
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

  const fieldMapRef   = useRef(null);
  // Track current session ID so we upsert instead of creating duplicates
  const sessionIdRef  = useRef(null);

  const [splashVisible,  setSplashVisible]  = useState(true);
  const [splashProgress, setSplashProgress] = useState(0);
  const [splashStatus,   setSplashStatus]   = useState('Initialising…');

  const [polygon,    setPolygon]    = useState(null);
  const [fieldStats, setFieldStats] = useState(null);
  const [mapLayer,   setMapLayer]   = useState('street');
  const [drawMode,   setDrawMode]   = useState(null);

  const [messages,     setMessages]     = useState([]);
  const [isLoading,    setIsLoading]    = useState(false);
  const [streamStatus, setStreamStatus] = useState('');
  const [unreadCount,  setUnreadCount]  = useState(0);
  const [activePanel,  setActivePanel]  = useState('map');

  const [showNudge,    setShowNudge]    = useState(false);
  const nudgeShownRef = useRef(false);

  const [showHistory, setShowHistory] = useState(false);

  const [installPrompt,  setInstallPrompt]  = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  // Keep a ref of messages so we can access latest in callbacks
  const messagesRef  = useRef([]);
  const polygonRef   = useRef(null);
  const fieldStatsRef = useRef(null);

  useEffect(() => { messagesRef.current = messages; },   [messages]);
  useEffect(() => { polygonRef.current = polygon; },     [polygon]);
  useEffect(() => { fieldStatsRef.current = fieldStats; }, [fieldStats]);

  const { connStatus, init, initMCP, sendMessage, clearHistory } = useJackDaw();
  const {
    isSessionActive,
    isRecording,
    sessionIdRef: recordingSessionIdRef,
    startSession:  startRecordingSession,
    startClip,
    pauseClip,
    endSession:    endRecordingSession,
    cancelSession: cancelRecordingSession,
  } = useRecording();

  useEffect(() => {
    init((pct, label) => {
      setSplashProgress(pct);
      setSplashStatus(label);
    }).finally(() => setSplashVisible(false));
  }, [init]);

  // ── Auth state changes ─────────────────────────────────────────
  useEffect(() => {
    const wasSignedIn    = !!prevUserRef.current;
    const wasSignedOut   = !prevUserRef.current;
    const isNowSignedIn  = !!user;
    const isNowSignedOut = !user;
    prevUserRef.current  = user;

    if (wasSignedOut && isNowSignedIn) {
      // Signed in — connect MCP tools + migrate local sessions
      initMCP();
      setShowNudge(false);
      migrateLocalToRemote(user.uid).catch(() => {});
    }

    if (wasSignedIn && isNowSignedOut) {
      // Signed out — disconnect ALL MCP tools so JackDaw returns raw responses
      fetch('/api/mcp/all', { method: 'DELETE' }).catch(() => {});
    }
  }, [user, initMCP]);

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

  // ── Auto-save session after every message exchange ─────────────
  // Uses upsert so the same session gets updated, not duplicated.
  const autoSave = useCallback(async (newMessages, poly, stats) => {
    if (!newMessages || newMessages.length === 0) return;
    if (isSignedIn && user) {
      const id = await upsertRemoteSession(
        user.uid, newMessages, poly, stats, sessionIdRef.current
      );
      if (id) sessionIdRef.current = id;
    } else {
      const id = upsertLocalSession(
        newMessages, poly, stats, sessionIdRef.current
      );
      if (id) sessionIdRef.current = id;
    }
  }, [isSignedIn, user]);

  const appendMsg = useCallback((role, content) => {
    setMessages(prev => [...prev, { role, content, time: now() }]);
  }, []);

  const doSend = useCallback(async (text) => {
    const userMsg = { role: 'user', content: text, time: now() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setStreamStatus('Thinking…');

    // Start recording clip when user sends message
    if (isSessionActive) startClip(text);

    try {
      const reply = await sendMessage(
        text,
        polygonRef.current,
        customerId,
        (status) => setStreamStatus(status),
        isSignedIn,
      );
      const assistantMsg = { role: 'assistant', content: reply, time: now() };
      setMessages(prev => {
        const updated = [...prev, assistantMsg];
        autoSave(updated, polygonRef.current, fieldStatsRef.current);
        return updated;
      });

      // Pause recording after response received
      if (isSessionActive) pauseClip();

      if (isMobile && activePanel === 'map') setUnreadCount(c => c + 1);
      if (!isSignedIn && !nudgeShownRef.current) {
        nudgeShownRef.current = true;
        setTimeout(() => setShowNudge(true), 800);
      }
    } catch (err) {
      appendMsg('assistant', `⚠️ Could not reach analysis service.\n\nError: ${err.message}`);
      if (isSessionActive) pauseClip();
    } finally {
      setIsLoading(false);
      setStreamStatus('');
    }
  }, [sendMessage, customerId, isSignedIn, isMobile, activePanel, autoSave, appendMsg, isSessionActive, startClip, pauseClip]);

  // ── Session recording controls ────────────────────────────────
  const handleStartSession = useCallback(() => {
    const newId = `rec_${Date.now()}`;
    startRecordingSession(newId);
  }, [startRecordingSession]);

  const handleEndSession = useCallback(() => {
    const title = messagesRef.current.find(m => m.role === 'user')?.content?.slice(0, 60) || 'Session';
    endRecordingSession(sessionIdRef.current, title);
  }, [endRecordingSession, sessionIdRef]);

  const handleSend = useCallback((text) => { doSend(text); }, [doSend]);

  // ── New chat: reset session ID and clear ───────────────────────
  const handleClearChat = useCallback(() => {
    sessionIdRef.current = null; // force new session next time
    setMessages([]);
    setUnreadCount(0);
    nudgeShownRef.current = false;
    clearHistory();
  }, [clearHistory]);

  // ── Load session from history ───────────────────────────────────
  const handleLoadSession = useCallback((session) => {
    // Set session ID so future messages update this session
    sessionIdRef.current = session.local ? null : session.id;
    setMessages(session.messages || []);
    if (session.polygon) setPolygon(session.polygon);
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
    <View style={[styles.root, { backgroundColor: colors.bgBase }]}>

      <TopNav
        connStatus={connStatus}
        fieldStats={fieldStats}
        showInstall={showInstallBtn}
        onInstall={handleInstall}
        onSignIn={() => setShowNudge(true)}
        onHistory={() => setShowHistory(true)}
      />

      <View style={[styles.workspace, !isMobile && styles.workspaceDesktop]}>

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

      <HistoryDrawer
        visible={showHistory}
        onClose={() => setShowHistory(false)}
        userId={user?.uid || null}
        onLoadSession={handleLoadSession}
        onNewChat={handleClearChat}
      />

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