// src/components/HistoryDrawer.jsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, Animated, Pressable, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { Fonts, Radius, Spacing } from '../constants/tokens';

const DRAWER_WIDTH = 300;
const PROXY_BASE = '';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function HistoryDrawer({ visible, onClose, userId, onLoadSession }) {
  const { colors } = useTheme();
  const insets     = useSafeAreaInsets();
  const slideAnim  = React.useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  const [sessions,  setSessions]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [deleting,  setDeleting]  = useState(null);

  // ── Animate in/out ─────────────────────────────────────────────
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue:         visible ? 0 : -DRAWER_WIDTH,
      useNativeDriver: Platform.OS !== 'web',
      tension:         80,
      friction:        12,
    }).start();
  }, [visible]);

  // ── Load sessions ───────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`${PROXY_BASE}/api/sessions`, {
        headers: { 'X-User-Id': userId },
      });
      if (res.ok) setSessions(await res.json());
    } catch (e) {
      console.error('Failed to load sessions:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (visible && userId) loadSessions();
  }, [visible, userId]);

  // ── Load a session ──────────────────────────────────────────────
  const handleLoad = useCallback(async (session) => {
    try {
      const res = await fetch(`${PROXY_BASE}/api/sessions/${session.id}`, {
        headers: { 'X-User-Id': userId },
      });
      if (res.ok) {
        const data = await res.json();
        onLoadSession(data);
        onClose();
      }
    } catch (e) {
      console.error('Failed to load session:', e);
    }
  }, [userId, onLoadSession, onClose]);

  // ── Delete a session ────────────────────────────────────────────
  const handleDelete = useCallback(async (e, sessionId) => {
    e.stopPropagation();
    setDeleting(sessionId);
    try {
      await fetch(`${PROXY_BASE}/api/sessions/${sessionId}`, {
        method:  'DELETE',
        headers: { 'X-User-Id': userId },
      });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (e) {
      console.error('Failed to delete session:', e);
    } finally {
      setDeleting(null);
    }
  }, [userId]);

  if (!visible && Platform.OS !== 'web') return null;

  return (
    <>
      {/* Backdrop */}
      {visible && (
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
        />
      )}

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          {
            transform: [{ translateX: slideAnim }],
            backgroundColor: colors.bgSurface,
            borderRightColor: colors.border,
            paddingTop: insets.top || 0,
          }
        ]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Chat History</Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              {sessions.length} saved session{sessions.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={[styles.closeIcon, { color: colors.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Session list */}
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.green} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading history…</Text>
            </View>
          ) : sessions.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyEmoji}>🗂️</Text>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No saved chats yet</Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                Start a new chat and it will appear here when you begin a new session.
              </Text>
            </View>
          ) : (
            sessions.map(session => (
              <TouchableOpacity
                key={session.id}
                style={[styles.sessionCard, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
                onPress={() => handleLoad(session)}
                activeOpacity={0.75}
              >
                <View style={styles.sessionMain}>
                  <Text style={[styles.sessionTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                    {session.title}
                  </Text>
                  <View style={styles.sessionMeta}>
                    {session.field_stats && (
                      <View style={[styles.fieldBadge, { backgroundColor: colors.greenTrace, borderColor: colors.greenBorder }]}>
                        <Text style={[styles.fieldBadgeText, { color: colors.green }]}>
                          🌿 {JSON.parse(session.field_stats)?.areaHa || '?'} ha
                        </Text>
                      </View>
                    )}
                    <Text style={[styles.sessionTime, { color: colors.textMuted }]}>
                      {timeAgo(session.updated_at)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={(e) => handleDelete(e, session.id)}
                  style={styles.deleteBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {deleting === session.id
                    ? <ActivityIndicator size="small" color={colors.danger} />
                    : <Text style={[styles.deleteIcon, { color: colors.textMuted }]}>🗑</Text>
                  }
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Sessions save automatically when you start a new chat
          </Text>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 200,
  },
  drawer: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    width: DRAWER_WIDTH,
    zIndex: 201,
    borderRightWidth: 1,
    flexDirection: 'column',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 4, height: 0 } },
      android: { elevation: 16 },
      web:     { boxShadow: '4px 0 24px rgba(0,0,0,0.2)' },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
    borderBottomWidth: 1,
  },
  title:     { fontFamily: Fonts.displayBold, fontSize: 17 },
  sub:       { fontFamily: Fonts.mono, fontSize: 10, marginTop: 2 },
  closeBtn:  { padding: 6 },
  closeIcon: { fontSize: 16 },

  list:        { flex: 1 },
  listContent: { padding: Spacing.md, gap: 8 },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: Spacing.lg,
    gap: 10,
  },
  loadingText: { fontFamily: Fonts.mono, fontSize: 12, marginTop: 8 },
  emptyEmoji:  { fontSize: 36 },
  emptyTitle:  { fontFamily: Fonts.displayBold, fontSize: 15, textAlign: 'center' },
  emptySub:    { fontFamily: Fonts.body, fontSize: 12, textAlign: 'center', lineHeight: 18 },

  sessionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  sessionMain:  { flex: 1, gap: 6 },
  sessionTitle: { fontFamily: Fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  sessionMeta:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  fieldBadge:   { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  fieldBadgeText: { fontFamily: Fonts.mono, fontSize: 10 },
  sessionTime:  { fontFamily: Fonts.mono, fontSize: 10 },
  deleteBtn:    { padding: 4, marginTop: 2 },
  deleteIcon:   { fontSize: 14 },

  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
  },
  footerText: { fontFamily: Fonts.mono, fontSize: 10, textAlign: 'center', lineHeight: 16 },
});