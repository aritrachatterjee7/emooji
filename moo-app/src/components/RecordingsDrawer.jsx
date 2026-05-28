// src/components/RecordingsDrawer.jsx
// Shows all locally stored session recordings for ANY user (signed in or not).
// Allows replay and HTML download of each recording.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, Animated, Pressable, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { Fonts, Radius, Spacing } from '../constants/tokens';
import { getRecording, deleteRecording, exportRecordingAsHTML } from '../hooks/useRecording';
import { ReplayModal } from './ReplayModal';

const DRAWER_WIDTH  = 300;
const STORAGE_KEY   = 'emooji_recordings';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getAllRecordings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

export function RecordingsDrawer({ visible, onClose }) {
  const { colors }   = useTheme();
  const insets       = useSafeAreaInsets();
  const slideAnim    = React.useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  const [recordings,    setRecordings]    = useState([]);
  const [deleting,      setDeleting]      = useState(null);
  const [replaySession, setReplaySession] = useState(null);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue:         visible ? 0 : -DRAWER_WIDTH,
      useNativeDriver: Platform.OS !== 'web',
      tension:         80,
      friction:        12,
    }).start();
  }, [visible]);

  useEffect(() => {
    if (visible) setRecordings(getAllRecordings());
  }, [visible]);

  const handleDelete = useCallback((id) => {
    setDeleting(id);
    deleteRecording(id);
    setRecordings(prev => prev.filter(r => r.sessionId !== id));
    setDeleting(null);
  }, []);

  return (
    <>
      {visible && <Pressable style={styles.backdrop} onPress={onClose} />}

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
            <Text style={[styles.title, { color: colors.textPrimary }]}>My Recordings</Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              {recordings.length} recording{recordings.length !== 1 ? 's' : ''} · stored on this device
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={[styles.closeIcon, { color: colors.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Info banner */}
        <View style={[styles.infoBanner, { backgroundColor: colors.greenTrace, borderColor: colors.greenBorder }]}>
          <Text style={[styles.infoText, { color: colors.green }]}>
            🎬 Recordings are stored on this device only. Download as HTML to keep them.
          </Text>
        </View>

        {/* List */}
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          {recordings.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyEmoji}>🎬</Text>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No recordings yet</Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                Click "Start Session" in the chat panel, then "End Session" when done to save a recording.
              </Text>
            </View>
          ) : (
            recordings.map(rec => (
              <View
                key={rec.sessionId}
                style={[styles.card, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
              >
                <View style={styles.cardMain}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                    {rec.title || 'Session Recording'}
                  </Text>
                  <View style={styles.cardMeta}>
                    <View style={[styles.clipsBadge, { backgroundColor: colors.greenTrace, borderColor: colors.greenBorder }]}>
                      <Text style={[styles.clipsBadgeText, { color: colors.green }]}>
                        🎬 {rec.totalClips} clip{rec.totalClips !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Text style={[styles.cardTime, { color: colors.textMuted }]}>
                      {timeAgo(rec.recordedAt)}
                    </Text>
                  </View>

                  {/* Action buttons */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.green }]}
                      onPress={() => setReplaySession({ id: rec.sessionId, title: rec.title })}
                    >
                      <Text style={styles.actionBtnText}>▶ Replay</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.bgOverlay, borderColor: colors.greenBorder, borderWidth: 1 }]}
                      onPress={() => exportRecordingAsHTML(rec.sessionId, rec.title)}
                    >
                      <Text style={[styles.actionBtnText, { color: colors.green }]}>⬇ Download</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(rec.sessionId)}
                    >
                      {deleting === rec.sessionId
                        ? <ActivityIndicator size="small" color={colors.danger} />
                        : <Text style={[styles.deleteIcon, { color: colors.textMuted }]}>🗑</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Download as HTML to keep recordings permanently
          </Text>
        </View>
      </Animated.View>

      {replaySession && (
        <ReplayModal
          visible={!!replaySession}
          onClose={() => setReplaySession(null)}
          sessionId={replaySession?.id}
          sessionTitle={replaySession?.title}
        />
      )}
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
      web: { boxShadow: '4px 0 24px rgba(0,0,0,0.2)' },
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

  infoBanner: {
    margin: Spacing.md,
    marginBottom: 0,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  infoText: { fontFamily: Fonts.mono, fontSize: 10, lineHeight: 16 },

  list:        { flex: 1 },
  listContent: { padding: Spacing.md, gap: 8 },

  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: Spacing.lg,
    gap: 10,
  },
  emptyEmoji:  { fontSize: 36 },
  emptyTitle:  { fontFamily: Fonts.displayBold, fontSize: 15, textAlign: 'center' },
  emptySub:    { fontFamily: Fonts.body, fontSize: 12, textAlign: 'center', lineHeight: 18 },

  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 12,
  },
  cardMain:  { gap: 8 },
  cardTitle: { fontFamily: Fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  cardMeta:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  clipsBadge:     { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  clipsBadgeText: { fontFamily: Fonts.mono, fontSize: 10 },
  cardTime:       { fontFamily: Fonts.mono, fontSize: 10 },

  cardActions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.md,
    flex: 1,
    alignItems: 'center',
  },
  actionBtnText: { fontFamily: Fonts.mono, fontSize: 11, color: '#07090e' },
  deleteBtn:     { padding: 6 },
  deleteIcon:    { fontSize: 14 },

  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
  },
  footerText: { fontFamily: Fonts.mono, fontSize: 10, textAlign: 'center', lineHeight: 16 },
});