// src/components/ReplayModal.jsx
// Plays back a recorded session using rrweb Replayer.
// Shows each clip (question → response cycle) in sequence.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Platform, ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Fonts, Radius, Spacing } from '../constants/tokens';
import { getRecording } from '../hooks/useRecording';

export function ReplayModal({ visible, onClose, sessionId, sessionTitle }) {
  const { colors }     = useTheme();
  const iframeRef      = useRef(null);
  const [loading,      setLoading]      = useState(true);
  const [clipIndex,    setClipIndex]    = useState(0);
  const [totalClips,   setTotalClips]   = useState(0);
  const [error,        setError]        = useState(null);
  const [playing,      setPlaying]      = useState(false);

  // ── Build replay HTML for an iframe ────────────────────────────────────
  const buildReplayHTML = useCallback((clips, index) => {
    const clip = clips[index];
    if (!clip || !clip.events || clip.events.length === 0) return null;

    const eventsJson = JSON.stringify(clip.events);
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #07090e; overflow: hidden; }
    .rr-player { width: 100% !important; height: 100vh !important; }
    .rr-player__frame { width: 100% !important; height: 100% !important; }
  </style>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/rrweb-player@latest/dist/style.css"/>
</head>
<body>
  <div id="player"></div>
  <script src="https://cdn.jsdelivr.net/npm/rrweb-player@latest/dist/index.js"></script>
  <script>
    const events = ${eventsJson};
    new rrwebPlayer({
      target: document.getElementById('player'),
      props: {
        events,
        autoPlay: true,
        showController: true,
        width: window.innerWidth,
        height: window.innerHeight,
        skipInactive: true,
        speed: 1,
      }
    });
  </script>
</body>
</html>`;
  }, []);

  useEffect(() => {
    if (!visible || !sessionId) return;
    setLoading(true);
    setClipIndex(0);
    setError(null);
    setPlaying(false);

    const recording = getRecording(sessionId);
    if (!recording || !recording.clips || recording.clips.length === 0) {
      setError('No recording found for this session.');
      setLoading(false);
      return;
    }
    setTotalClips(recording.clips.length);
    setLoading(false);
  }, [visible, sessionId]);

  const handlePlayClip = useCallback((index) => {
    if (!sessionId) return;
    const recording = getRecording(sessionId);
    if (!recording) return;

    const html = buildReplayHTML(recording.clips, index);
    if (!html || !iframeRef.current) return;

    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    iframeRef.current.src = url;
    setClipIndex(index);
    setPlaying(true);
  }, [sessionId, buildReplayHTML]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.bgBase }]}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.bgSurface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Text style={[styles.backIcon, { color: colors.textPrimary }]}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {sessionTitle || 'Session Replay'}
            </Text>
            {totalClips > 0 && (
              <Text style={[styles.headerSub, { color: colors.textMuted }]}>
                {totalClips} clip{totalClips !== 1 ? 's' : ''} recorded
              </Text>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.green} size="large" />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading recording…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorEmoji}>📭</Text>
            <Text style={[styles.errorText, { color: colors.textPrimary }]}>{error}</Text>
            <Text style={[styles.errorSub, { color: colors.textMuted }]}>
              Recordings are only available on the device where the session was recorded.
            </Text>
          </View>
        ) : (
          <>
            {/* Clip selector */}
            <View style={[styles.clipBar, { backgroundColor: colors.bgSurface, borderBottomColor: colors.border }]}>
              <Text style={[styles.clipBarLabel, { color: colors.textMuted }]}>Select clip:</Text>
              <View style={styles.clipBtns}>
                {Array.from({ length: totalClips }, (_, i) => {
                  const recording = getRecording(sessionId);
                  const clip = recording?.clips[i];
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.clipBtn,
                        { backgroundColor: colors.bgElevated, borderColor: colors.border },
                        clipIndex === i && playing && { backgroundColor: colors.greenTrace, borderColor: colors.greenBorder },
                      ]}
                      onPress={() => handlePlayClip(i)}
                    >
                      <Text style={[styles.clipBtnNum, { color: clipIndex === i && playing ? colors.green : colors.textSecondary }]}>
                        #{i + 1}
                      </Text>
                      {clip?.question && (
                        <Text style={[styles.clipBtnText, { color: colors.textMuted }]} numberOfLines={1}>
                          {clip.question.slice(0, 25)}…
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Replay frame */}
            {playing ? (
              <iframe
                ref={iframeRef}
                style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
                title="Session Replay"
                sandbox="allow-scripts allow-same-origin"
              />
            ) : (
              <View style={styles.center}>
                <Text style={styles.playEmoji}>▶️</Text>
                <Text style={[styles.playText, { color: colors.textPrimary }]}>
                  Select a clip above to start replay
                </Text>
                <Text style={[styles.playSub, { color: colors.textMuted }]}>
                  Each clip shows one question → response cycle
                </Text>
                <TouchableOpacity
                  style={[styles.playBtn, { backgroundColor: colors.green }]}
                  onPress={() => handlePlayClip(0)}
                >
                  <Text style={styles.playBtnText}>▶ Play from Beginning</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
  },
  backBtn:      { padding: 4 },
  backIcon:     { fontSize: 22 },
  headerCenter: { flex: 1 },
  headerTitle:  { fontFamily: Fonts.displayBold, fontSize: 16 },
  headerSub:    { fontFamily: Fonts.mono, fontSize: 10, marginTop: 2 },

  clipBar: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    gap: 8,
  },
  clipBarLabel: { fontFamily: Fonts.mono, fontSize: 11 },
  clipBtns:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  clipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
    maxWidth: 140,
  },
  clipBtnNum:  { fontFamily: Fonts.displayBold, fontSize: 11 },
  clipBtnText: { fontFamily: Fonts.mono, fontSize: 10, marginTop: 2 },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: Spacing.xl,
  },
  loadingText: { fontFamily: Fonts.mono, fontSize: 12 },
  errorEmoji:  { fontSize: 40 },
  errorText:   { fontFamily: Fonts.displayBold, fontSize: 16, textAlign: 'center' },
  errorSub:    { fontFamily: Fonts.body, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  playEmoji:   { fontSize: 48 },
  playText:    { fontFamily: Fonts.displayBold, fontSize: 16, textAlign: 'center' },
  playSub:     { fontFamily: Fonts.body, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  playBtn:     { paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.lg, marginTop: 8 },
  playBtnText: { fontFamily: Fonts.displayBold, fontSize: 14, color: '#07090e' },
});