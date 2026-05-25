// src/components/HistoryDrawer.jsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, Animated, Pressable, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { Fonts, Radius, Spacing } from '../constants/tokens';
import {
  getLocalSessionList, deleteLocalSession, getLocalSession,
  getRemoteSessions, getRemoteSession, deleteRemoteSession,
} from '../hooks/useSessionStorage';

const DRAWER_WIDTH = 300;

function timeAgo(dateStr) {
  if (!dateStr) return '';
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

export function HistoryDrawer({ visible, onClose, userId, onLoadSession, onNewChat }) {
  const { colors } = useTheme();
  const insets     = useSafeAreaInsets();
  const slideAnim  = React.useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [deleting, setDeleting] = useState(null);

  // ── Animate ────────────────────────────────────────────────────
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
    setLoading(true);
    try {
      if (userId) {
        // Signed in — load from PostgreSQL
        const remote = await getRemoteSessions(userId);
        setSessions(remote.map(s => ({ ...s, local: false })));
      } else {
        // Not signed in — load from localStorage
        setSessions(getLocalSessionList());
      }
    } catch (e) {
      console.error('Failed to load sessions:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (visible) loadSessions();
  }, [visible, loadSessions]);

  // ── Load single session ─────────────────────────────────────────
  const handleLoad = useCallback(async (session) => {
    try {
      let data;
      if (session.local) {
        data = getLocalSession(session.id);
      } else {
        data = await getRemoteSession(userId, session.id);
      }
      if (data) {
        onLoadSession(data);
        onClose();
      }
    } catch (e) {
      console.error('Failed to load session:', e);
    }
  }, [userId, onLoadSession, onClose]);

  // ── Delete session ──────────────────────────────────────────────
  const handleDelete = useCallback(async (e, session) => {
    e.stopPropagation();
    setDeleting(session.id);
    try {
      if (session.local) {
        deleteLocalSession(session.id);
      } else {
        await deleteRemoteSession(userId, session.id);
      }
      setSessions(prev => prev.filter(s => s.id !== session.id));
    } catch (e) {
      console.error('Failed to delete:', e);
    } finally {
      setDeleting(null);
    }
  }, [userId]);

  const getFieldStats = (session) => {
    try {
      if (!session.field_stats) return null;
      const stats = typeof session.field_stats === 'string'
        ? JSON.parse(session.field_stats)
        : session.field_stats;
      return stats?.areaHa;
    } catch { return null; }
  };

  return (
    <>
      {visible && (
        <Pressable style={styles.backdrop} onPress={onClose} />
      )}

      <Animated.View style={[
        styles.drawer,
        {
          transform: [{ translateX: slideAnim }],
          backgroundColor: colors.bgSurface,
          borderRightColor: colors.border,
          paddingTop: insets.top || 0,
        }
      ]}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Chat History</Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
              {!userId && ' · local only'}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={[styles.closeIcon, { color: colors.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* New Chat button */}
        <TouchableOpacity
          style={[styles.newChatBtn, { backgroundColor: colors.green }]}
          onPress={() => { onNewChat && onNewChat(); onClose(); }}
          activeOpacity={0.85}
        >
          <Text style={styles.newChatIcon}>✏️</Text>
          <Text style={styles.newChatText}>New Chat</Text>
        </TouchableOpacity>

        {/* Sign-in prompt for unauthenticated */}
        {!userId && (
          <View style={[styles.signInBanner, { backgroundColor: colors.greenTrace, borderColor: colors.greenBorder }]}>
            <Text style={[styles.signInBannerText, { color: colors.green }]}>
              🔒 Sign in to sync history across devices
            </Text>
          </View>
        )}

        {/* Session list */}
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.green} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading…</Text>
            </View>
          ) : sessions.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyEmoji}>🗂️</Text>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No saved chats yet</Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                Your chats save automatically when you start a new session.
              </Text>
            </View>
          ) : (
            sessions.map(session => {
              const areaHa = getFieldStats(session);
              return (
                <TouchableOpacity
                  key={session.id}
                  style={[styles.card, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
                  onPress={() => handleLoad(session)}
                  activeOpacity={0.75}
                >
                  <View style={styles.cardMain}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                      {session.title}
                    </Text>
                    <View style={styles.cardMeta}>
                      {session.local && (
                        <View style={[styles.localBadge, { backgroundColor: colors.bgOverlay, borderColor: colors.borderMid }]}>
                          <Text style={[styles.localBadgeText, { color: colors.textMuted }]}>local</Text>
                        </View>
                      )}
                      {areaHa && (
                        <View style={[styles.fieldBadge, { backgroundColor: colors.greenTrace, borderColor: colors.greenBorder }]}>
                          <Text style={[styles.fieldBadgeText, { color: colors.green }]}>🌿 {areaHa} ha</Text>
                        </View>
                      )}
                      <Text style={[styles.cardTime, { color: colors.textMuted }]}>
                        {timeAgo(session.updated_at || session.created_at)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={(e) => handleDelete(e, session)}
                    style={styles.deleteBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {deleting === session.id
                      ? <ActivityIndicator size="small" color={colors.danger} />
                      : <Text style={[styles.deleteIcon, { color: colors.textMuted }]}>🗑</Text>
                    }
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Sessions save when you start a new chat
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

  signInBanner: {
    margin: Spacing.md,
    marginBottom: 0,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  signInBannerText: { fontFamily: Fonts.mono, fontSize: 11, textAlign: 'center' },

  list:        { flex: 1 },
  listContent: { padding: Spacing.md, gap: 8 },

  center: {
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

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  cardMain:      { flex: 1, gap: 6 },
  cardTitle:     { fontFamily: Fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  cardMeta:      { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  localBadge:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  localBadgeText:{ fontFamily: Fonts.mono, fontSize: 9 },
  fieldBadge:    { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  fieldBadgeText:{ fontFamily: Fonts.mono, fontSize: 10 },
  cardTime:      { fontFamily: Fonts.mono, fontSize: 10 },
  deleteBtn:     { padding: 4, marginTop: 2 },
  deleteIcon:    { fontSize: 14 },

  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: Spacing.md,
    marginBottom: 4,
    padding: 12,
    borderRadius: Radius.lg,
  },
  newChatIcon: { fontSize: 15 },
  newChatText: { fontFamily: Fonts.displayBold, fontSize: 14, color: '#07090e' },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
  },
  footerText: { fontFamily: Fonts.mono, fontSize: 10, textAlign: 'center', lineHeight: 16 },
});