// src/components/ChatPanel.jsx
import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, KeyboardAvoidingView, useWindowDimensions,
} from 'react-native';
import { Fonts, Radius, Spacing } from '../constants/tokens';
import { useTheme } from '../context/ThemeContext';
import { parseMarkdownNative, parseInline } from '../utils/markdown';
import { useVoice } from '../hooks/useVoice';

function InlineText({ text, style, colors }) {
  const parts = parseInline(text);
  return (
    <Text style={style}>
      {parts.map((p, i) => (
        <Text key={i} style={[
          p.bold   && { fontFamily: Fonts.displayBold, color: colors.textPrimary },
          p.italic && { fontStyle: 'italic', color: colors.textSecondary },
          p.code   && { fontFamily: Fonts.mono, fontSize: 11, color: colors.green },
        ]}>
          {p.text}
        </Text>
      ))}
    </Text>
  );
}

function MarkdownSegment({ seg, colors, fontScale }) {
  const fs = fontScale || { bubble: 13, heading: 15, mono: 10, lineHeight: 20 };
  if (seg.type === 'spacer') return <View style={{ height: 5 }} />;
  if (seg.type === 'h2') return <InlineText text={seg.text} style={{ fontFamily: Fonts.displayBold, fontSize: fs.heading + 1, color: colors.textPrimary, marginVertical: 4 }} colors={colors} />;
  if (seg.type === 'h3') return <InlineText text={seg.text} style={{ fontFamily: Fonts.bodyMedium, fontSize: fs.heading, color: colors.textPrimary, marginVertical: 3 }} colors={colors} />;
  if (seg.type === 'code') return <Text style={{ fontFamily: Fonts.mono, fontSize: fs.mono + 1, color: colors.textSecondary, backgroundColor: colors.bgOverlay, padding: 8, borderRadius: Radius.sm, marginVertical: 4 }}>{seg.text}</Text>;
  if (seg.type === 'bullet') return (
    <View style={{ flexDirection: 'row', gap: 7, marginVertical: 1 }}>
      <Text style={{ fontFamily: Fonts.mono, fontSize: fs.bubble + 1, color: colors.green, lineHeight: fs.lineHeight }}>·</Text>
      <InlineText text={seg.text} style={{ fontFamily: Fonts.body, fontSize: fs.bubble, color: colors.textPrimary, lineHeight: fs.lineHeight }} colors={colors} />
    </View>
  );
  return <InlineText text={seg.text} style={{ fontFamily: Fonts.body, fontSize: fs.bubble, color: colors.textPrimary, lineHeight: fs.lineHeight }} colors={colors} />;
}

function BubbleContent({ content, colors, fontScale }) {
  return (
    <View>
      {parseMarkdownNative(content).map((seg, i) => (
        <MarkdownSegment key={i} seg={seg} colors={colors} fontScale={fontScale} />
      ))}
    </View>
  );
}

function ThinkingIndicator({ statusText, colors }) {
  return (
    <View style={styles.msgRow}>
      <View style={[styles.avatar, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
        <Text style={styles.avatarEmoji}>🐄</Text>
      </View>
      <View style={[styles.bubble, { backgroundColor: colors.bubbleAsst, borderColor: colors.border, borderBottomLeftRadius: 4, maxWidth: '88%' }]}>
        <View style={styles.thinkingRow}>
          <View style={[styles.pulseDot, { backgroundColor: colors.green }]} />
          <Text style={[styles.thinkingText, { color: colors.textSecondary }]}>
            {statusText || strings?.thinking || 'Thinking…'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ChatMessage({ item, colors, onSpeak, isSpeaking, fontScale }) {
  const isUser = item.role === 'user';
  return (
    <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
          <Text style={styles.avatarEmoji}>🐄</Text>
        </View>
      )}
      <View style={[
        styles.bubble,
        isUser
          ? { backgroundColor: colors.bubbleUser, borderColor: 'rgba(15,34,68,0.7)', borderBottomRightRadius: 4 }
          : { backgroundColor: colors.bubbleAsst, borderColor: colors.border, borderBottomLeftRadius: 4 },
      ]}>
        <BubbleContent content={item.content} colors={colors} fontScale={fontScale} />
        <View style={styles.msgFooter}>
          <Text style={[styles.msgTime, { color: colors.textMuted }]}>{item.time}</Text>
          {/* Speak button on assistant messages */}
          {!isUser && onSpeak && (
            <TouchableOpacity
              onPress={() => onSpeak(item.content)}
              style={styles.speakBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.speakBtnIcon, { color: colors.textMuted }]}>
                {isSpeaking ? '⏹' : '🔊'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {isUser && (
        <View style={[styles.avatar, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
          <Text style={styles.avatarEmoji}>{item.voice ? '🎤' : '👤'}</Text>
        </View>
      )}
    </View>
  );
}

function WelcomeMessage({ colors, fontScale, strings }) {
  return (
    <View style={styles.msgRow}>
      <View style={[styles.avatar, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
        <Text style={styles.avatarEmoji}>🐄</Text>
      </View>
      <View style={[styles.bubble, { backgroundColor: colors.bubbleAsst, borderColor: colors.greenBorder, borderBottomLeftRadius: 4, maxWidth: '90%' }]}>
        <Text style={{ fontFamily: Fonts.body, fontSize: fontScale?.bubble || 13, color: colors.textPrimary, lineHeight: fontScale?.lineHeight || 20 }}>
          <Text style={{ fontFamily: Fonts.displayBold, color: colors.textPrimary }}>{strings?.welcome || 'Welcome to eMooJI.'}</Text>
          {' '}{strings?.welcomeSub || 'I connect to real satellite databases to answer questions about any field in Europe.'}
        </Text>
        {[
          ['1', strings?.step1 || 'Tap Polygon or Rectangle and draw over any field on the map'],
          ['2', strings?.step2 || 'Ask any question by typing or tapping the 🎤 mic button'],
        ].map(([n, t]) => (
          <View key={n} style={styles.step}>
            <View style={[styles.stepNum, { backgroundColor: colors.greenTrace, borderColor: colors.greenBorder }]}>
              <Text style={[styles.stepNumText, { color: colors.green }]}>{n}</Text>
            </View>
            <Text style={{ flex: 1, fontFamily: Fonts.body, fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>{t}</Text>
          </View>
        ))}
        <Text style={[styles.msgTime, { color: colors.textMuted }]}>now</Text>
      </View>
    </View>
  );
}

function RecordingBar({ isRecording, colors }) {
  return (
    <View style={[
      styles.recordingBar,
      {
        backgroundColor: isRecording ? 'rgba(220,38,38,0.12)' : 'rgba(11,219,110,0.08)',
        borderColor: isRecording ? 'rgba(220,38,38,0.3)' : colors.greenBorder,
      }
    ]}>
      <View style={[styles.recordingDot, { backgroundColor: isRecording ? '#dc2626' : colors.green }]} />
      <Text style={[styles.recordingText, { color: isRecording ? '#dc2626' : colors.green }]}>
        {isRecording ? '● Recording…' : '● Session active — paused between questions'}
      </Text>
    </View>
  );
}

export function ChatPanel({
  messages, isLoading, streamStatus, onSend, onClearChat,
  isSessionActive, isRecording, onStartSession, onEndSession,
  hasField,
}) {
  const { colors, fontScale, strings } = useTheme();
  const { width }   = useWindowDimensions();
  const isMobile    = width < 860;
  const [text, setText] = useState('');
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState(null);
  const scrollRef = useRef(null);

  // ── Voice hook ─────────────────────────────────────────────────
  const {
    supported: voiceSupported,
    isListening,
    isSpeaking,
    voiceEnabled,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    toggleVoice,
  } = useVoice({
    onTranscript: (transcript, isFinal) => {
      setText(transcript);
      // Auto-send when final transcript received via voice
      if (isFinal && transcript.trim()) {
        setTimeout(() => {
          onSend(transcript.trim());
          setText('');
        }, 300);
      }
    },
    onSpeakStart: () => {},
    onSpeakEnd:   () => setSpeakingMsgIdx(null),
  });

  // ── Auto-speak last assistant message ──────────────────────────
  const lastMsgRef = useRef(null);
  useEffect(() => {
    if (!voiceEnabled || isLoading) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return;
    if (lastMsg === lastMsgRef.current) return;
    lastMsgRef.current = lastMsg;
    setSpeakingMsgIdx(messages.length - 1);
    speak(lastMsg.content);
  }, [messages, isLoading, voiceEnabled, speak]);

  // ── Scroll to bottom ───────────────────────────────────────────
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [messages.length, isLoading, streamStatus]);

  const handleSend = useCallback(() => {
    const val = text.trim();
    if (!val || isLoading) return;
    if (isListening) stopListening();
    if (isSpeaking) stopSpeaking();
    onSend(val);
    setText('');
  }, [text, isLoading, isListening, isSpeaking, stopListening, stopSpeaking, onSend]);

  const handleMicPress = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      if (isSpeaking) stopSpeaking();
      startListening();
    }
  }, [isListening, isSpeaking, startListening, stopListening, stopSpeaking]);

  const handleSpeakMsg = useCallback((content, idx) => {
    if (isSpeaking) {
      stopSpeaking();
      setSpeakingMsgIdx(null);
    } else {
      setSpeakingMsgIdx(idx);
      speak(content);
    }
  }, [isSpeaking, speak, stopSpeaking]);

  const handleKey = Platform.OS === 'web'
    ? (e) => { if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) { e.preventDefault(); handleSend(); } }
    : undefined;

  const inner = (
    <>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bgElevated, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {isMobile ? (strings?.analysis || 'Analysis') : (strings?.fieldAnalysis || 'Field Analysis')}
          </Text>
          <View style={styles.headerBtns}>
            {/* Voice toggle */}
            {voiceSupported && (
              <TouchableOpacity
                style={[
                  styles.headerIconBtn,
                  { backgroundColor: voiceEnabled ? colors.greenTrace : colors.bgOverlay,
                    borderColor: voiceEnabled ? colors.greenBorder : colors.borderMid }
                ]}
                onPress={toggleVoice}
                activeOpacity={0.8}
              >
                <Text style={styles.headerIconBtnText}>
                  {voiceEnabled ? '🔊' : '🔇'}
                </Text>
              </TouchableOpacity>
            )}
            {/* Session record button */}
            {!isSessionActive ? (
              <TouchableOpacity
                style={[styles.sessionBtn, { backgroundColor: colors.greenTrace, borderColor: colors.greenBorder }]}
                onPress={onStartSession}
                activeOpacity={0.8}
              >
                <Text style={styles.sessionBtnIcon}>⏺</Text>
                <Text style={[styles.sessionBtnText, { color: colors.green }]}>
                  {isMobile ? (strings?.record || 'Record') : (strings?.startSession || 'Start Session')}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.sessionBtn, { backgroundColor: 'rgba(220,38,38,0.1)', borderColor: 'rgba(220,38,38,0.3)' }]}
                onPress={onEndSession}
                activeOpacity={0.8}
              >
                <Text style={styles.sessionBtnIcon}>⏹</Text>
                <Text style={[styles.sessionBtnText, { color: '#dc2626' }]}>
                  {isMobile ? (strings?.stop || 'Stop') : (strings?.endSession || 'End Session')}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClearChat} style={styles.clearBtn} activeOpacity={0.7}>
              <Text style={[styles.clearBtnText, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
        {!isMobile && (
          <Text style={[styles.sub, { color: colors.textMuted }]}>
            Draw any field · Ask in plain language or by voice · Real satellite data
          </Text>
        )}
      </View>

      {/* Recording bar */}
      {isSessionActive && (
        <RecordingBar isRecording={isRecording} colors={colors} />
      )}

      {/* Voice listening indicator */}
      {isListening && (
        <View style={[styles.listeningBar, { backgroundColor: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.3)' }]}>
          <View style={[styles.listeningDot, { backgroundColor: '#dc2626' }]} />
          <Text style={[styles.listeningText, { color: '#dc2626' }]}>
            {strings?.listening || 'Listening… speak your question'}
          </Text>
          <TouchableOpacity onPress={stopListening} style={styles.listeningStop}>
            <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: '#dc2626' }}>Stop</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Speaking indicator */}
      {isSpeaking && (
        <View style={[styles.listeningBar, { backgroundColor: 'rgba(11,219,110,0.08)', borderColor: colors.greenBorder }]}>
          <View style={[styles.listeningDot, { backgroundColor: colors.green }]} />
          <Text style={[styles.listeningText, { color: colors.green }]}>
            {strings?.speaking || 'Speaking response…'}
          </Text>
          <TouchableOpacity onPress={stopSpeaking} style={styles.listeningStop}>
            <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: colors.green }}>Stop</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={[styles.feed, { backgroundColor: colors.bgSurface }]}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <WelcomeMessage colors={colors} fontScale={fontScale} strings={strings} />
        {messages.map((m, i) => (
          <ChatMessage
            key={i}
            item={m}
            colors={colors}
            fontScale={fontScale}
            onSpeak={m.role === 'assistant' ? (content) => handleSpeakMsg(content, i) : null}
            isSpeaking={speakingMsgIdx === i && isSpeaking}
          />
        ))}
        {isLoading && <ThinkingIndicator statusText={streamStatus} colors={colors} />}
        <View style={{ height: 12 }} />
      </ScrollView>

      {/* No field banner */}
      {!hasField && (
        <View style={[styles.noFieldBanner, { backgroundColor: colors.bgElevated, borderTopColor: colors.border }]}>
          <Text style={styles.noFieldEmoji}>🗺️</Text>
          <Text style={[styles.noFieldText, { color: colors.textMuted }]}>
            {strings?.noFieldBanner || 'Draw a field on the map to start asking questions'}
          </Text>
        </View>
      )}

      {/* Input area */}
      <View style={[styles.inputArea, { borderTopColor: colors.border, backgroundColor: colors.bgSurface }]}>
        {/* Live voice transcript preview */}
        {isListening && text ? (
          <Text style={[styles.voicePreview, { color: colors.textMuted, backgroundColor: colors.bgElevated }]}>
            "{text}"
          </Text>
        ) : null}
        <View style={[styles.inputRow, { backgroundColor: colors.bgElevated, borderColor: isListening ? '#dc2626' : colors.borderMid }]}>
          <TextInput
            style={[styles.input, { color: hasField ? colors.textPrimary : colors.textMuted, fontSize: fontScale?.body || 14 }]}
            value={text}
            onChangeText={setText}
            placeholder={
              !hasField
                ? (strings?.noField || '🗺️ Draw a field on the map to begin…')
                : isListening
                  ? (strings?.listening || 'Listening…')
                  : (strings?.placeholder || 'Ask about this field…')
            }
            placeholderTextColor={!hasField ? colors.textMuted : isListening ? '#dc2626' : colors.textMuted}
            multiline
            maxHeight={100}
            onKeyPress={handleKey}
            blurOnSubmit={false}
            editable={!!hasField && !isListening}
          />

          {/* Mic button */}
          {voiceSupported && (
            <TouchableOpacity
              style={[
                styles.micBtn,
                { backgroundColor: isListening ? '#dc2626' : colors.bgOverlay,
                  opacity: hasField ? 1 : 0.4 }
              ]}
              onPress={hasField ? handleMicPress : undefined}
              activeOpacity={0.8}
            >
              <Text style={styles.micBtnIcon}>
                {isListening ? '⏹' : '🎤'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Send button */}
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: (hasField && text.trim() && !isLoading) ? colors.green : colors.bgOverlay }]}
            onPress={handleSend}
            disabled={!hasField || (!text.trim() && !isListening) || isLoading}
            activeOpacity={0.8}
          >
            <Text style={[styles.sendIcon, { color: (!text.trim() || isLoading) ? colors.textMuted : '#000' }]}>➤</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.footer, { color: colors.textMuted }]}>
          JackDaw GeoAI · PoliRuralPlus · Copernicus
        </Text>
      </View>
    </>
  );

  return Platform.OS === 'web' ? (
    <View style={[styles.panel, { backgroundColor: colors.bgSurface }]}>{inner}</View>
  ) : (
    <KeyboardAvoidingView
      style={[styles.panel, { backgroundColor: colors.bgSurface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={52}
    >
      {inner}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1, flexDirection: 'column',
    ...Platform.select({ web: { overflow: 'hidden' } }),
  },
  header:     { flexShrink: 0, padding: Spacing.md, paddingBottom: 9, borderBottomWidth: 1 },
  headerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title:      { fontFamily: Fonts.displayBold, fontSize: 15, letterSpacing: -0.3 },
  sub:        { fontFamily: Fonts.mono, fontSize: 10 },

  headerIconBtn: {
    width: 30, height: 30, borderRadius: Radius.full,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  headerIconBtnText: { fontSize: 13 },

  sessionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Radius.md, borderWidth: 1,
  },
  sessionBtnIcon: { fontSize: 10 },
  sessionBtnText: { fontFamily: Fonts.mono, fontSize: 11 },
  clearBtn:       { padding: 6 },
  clearBtnText:   { fontSize: 14 },

  recordingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: Spacing.md, paddingVertical: 7, borderBottomWidth: 1,
  },
  recordingDot:  { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  recordingText: { fontFamily: Fonts.mono, fontSize: 11, flex: 1 },

  listeningBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: Spacing.md, paddingVertical: 8, borderBottomWidth: 1,
  },
  listeningDot:  { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  listeningText: { fontFamily: Fonts.mono, fontSize: 11, flex: 1 },
  listeningStop: { paddingHorizontal: 8, paddingVertical: 4 },

  feed:        { flex: 1, ...Platform.select({ web: { minHeight: 0 } }) },
  feedContent: { padding: Spacing.md, gap: 12 },
  msgRow:      { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  msgRowUser:  { flexDirection: 'row-reverse' },
  avatar:      { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarEmoji: { fontSize: 14 },
  bubble:      { maxWidth: '82%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16, borderWidth: 1 },
  msgFooter:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  msgTime:     { fontFamily: Fonts.mono, fontSize: 9 },
  speakBtn:    { padding: 2 },
  speakBtnIcon:{ fontSize: 12 },

  thinkingRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  pulseDot:     { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  thinkingText: { fontFamily: Fonts.mono, fontSize: 12, flex: 1, flexWrap: 'wrap' },

  step:        { flexDirection: 'row', gap: 8, marginTop: 9, alignItems: 'flex-start' },
  stepNum:     { width: 18, height: 18, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  stepNumText: { fontFamily: Fonts.mono, fontSize: 9 },

  voicePreview: {
    fontFamily: Fonts.body, fontSize: 12, fontStyle: 'italic',
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: Radius.md, marginBottom: 6, marginHorizontal: 2,
  },

  inputArea: { flexShrink: 0, padding: Spacing.sm, borderTopWidth: 1 },
  inputRow:  {
    flexDirection: 'row', alignItems: 'flex-end', gap: 6,
    borderRadius: Radius.xl, borderWidth: 1,
    paddingLeft: 14, paddingRight: 6, paddingVertical: 6,
  },
  input:    { flex: 1, fontFamily: Fonts.body, fontSize: 14, maxHeight: 100, paddingVertical: 2 },
  micBtn:   { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  micBtnIcon:{ fontSize: 16 },
  sendBtn:  { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { fontSize: 14 },
  footer:   { fontFamily: Fonts.mono, fontSize: 9, textAlign: 'center', marginTop: 6 },
  noFieldBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  noFieldEmoji: { fontSize: 16 },
  noFieldText:  { fontFamily: Fonts.mono, fontSize: 11, flex: 1 },
});