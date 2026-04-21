// src/components/ChatPanel.jsx
import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Fonts, Radius, Spacing } from '../constants/tokens';
import { useTheme } from '../context/ThemeContext';
import { parseMarkdownNative, parseInline } from '../utils/markdown';

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

function MarkdownSegment({ seg, colors }) {
  if (seg.type === 'spacer') return <View style={{ height: 5 }} />;
  if (seg.type === 'h2')     return <InlineText text={seg.text} style={{ fontFamily: Fonts.displayBold, fontSize: 14, color: colors.textPrimary, marginVertical: 4 }} colors={colors} />;
  if (seg.type === 'h3')     return <InlineText text={seg.text} style={{ fontFamily: Fonts.bodyMedium, fontSize: 13, color: colors.textPrimary, marginVertical: 3 }} colors={colors} />;
  if (seg.type === 'code')   return <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: colors.textSecondary, backgroundColor: colors.bgOverlay, padding: 8, borderRadius: Radius.sm, marginVertical: 4 }}>{seg.text}</Text>;
  if (seg.type === 'bullet') return (
    <View style={{ flexDirection: 'row', gap: 7, marginVertical: 1 }}>
      <Text style={{ fontFamily: Fonts.mono, fontSize: 14, color: colors.green, lineHeight: 20 }}>·</Text>
      <InlineText text={seg.text} style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textPrimary, lineHeight: 20 }} colors={colors} />
    </View>
  );
  return <InlineText text={seg.text} style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textPrimary, lineHeight: 20 }} colors={colors} />;
}

function BubbleContent({ content, colors }) {
  return (
    <View>
      {parseMarkdownNative(content).map((seg, i) => (
        <MarkdownSegment key={i} seg={seg} colors={colors} />
      ))}
    </View>
  );
}

// ── Live status indicator — replaces three dots ────────────────────────────
// Shows streaming progress from JackDaw: "Analyzing...", "Starting tool call: get_ndvi_for_area" etc.
function ThinkingIndicator({ statusText, colors }) {
  return (
    <View style={styles.msgRow}>
      <View style={[styles.avatar, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
        <Text style={styles.avatarEmoji}>🐄</Text>
      </View>
      <View style={[styles.bubble, { backgroundColor: colors.bubbleAsst, borderColor: colors.border, borderBottomLeftRadius: 4, maxWidth: '88%' }]}>
        <View style={styles.thinkingRow}>
          {/* Animated pulse dot */}
          <View style={[styles.pulseDot, { backgroundColor: colors.green }]} />
          <Text style={[styles.thinkingText, { color: colors.textSecondary }]}>
            {statusText || 'Thinking…'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ChatMessage({ item, colors }) {
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
        <BubbleContent content={item.content} colors={colors} />
        <Text style={[styles.msgTime, { color: colors.textMuted }]}>{item.time}</Text>
      </View>
      {isUser && (
        <View style={[styles.avatar, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
          <Text style={styles.avatarEmoji}>👤</Text>
        </View>
      )}
    </View>
  );
}

function WelcomeMessage({ colors }) {
  return (
    <View style={styles.msgRow}>
      <View style={[styles.avatar, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
        <Text style={styles.avatarEmoji}>🐄</Text>
      </View>
      <View style={[styles.bubble, { backgroundColor: colors.bubbleAsst, borderColor: colors.greenBorder, borderBottomLeftRadius: 4, maxWidth: '90%' }]}>
        <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: colors.textPrimary, lineHeight: 20 }}>
          <Text style={{ fontFamily: Fonts.displayBold, color: colors.textPrimary }}>Welcome to eMooJI.</Text>
          {' '}I connect to real satellite databases to answer questions about any field in Europe.
        </Text>
        {[
          ['1', 'Tap Polygon or Rectangle and draw over any field on the map'],
          ['2', 'Ask any question — or tap a quick-analysis chip above'],
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

export function ChatPanel({ messages, isLoading, streamStatus, onSend, onClearChat }) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [messages.length, isLoading, streamStatus]);

  const handleSend = useCallback(() => {
    const val = text.trim();
    if (!val || isLoading) return;
    onSend(val);
    setText('');
  }, [text, isLoading, onSend]);

  const handleKey = Platform.OS === 'web'
    ? (e) => { if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) { e.preventDefault(); handleSend(); } }
    : undefined;

  const inner = (
    <>
      <View style={[styles.header, { backgroundColor: colors.bgElevated, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Field Analysis</Text>
          <TouchableOpacity onPress={onClearChat} style={styles.clearBtn} activeOpacity={0.7}>
            <Text style={[styles.clearBtnText, { color: colors.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.sub, { color: colors.textMuted }]}>Draw any field · Ask in plain language · Real satellite data</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={[styles.feed, { backgroundColor: colors.bgSurface }]}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <WelcomeMessage colors={colors} />
        {messages.map((m, i) => <ChatMessage key={i} item={m} colors={colors} />)}
        {/* Show live streaming status instead of three dots */}
        {isLoading && <ThinkingIndicator statusText={streamStatus} colors={colors} />}
        <View style={{ height: 12 }} />
      </ScrollView>

      <View style={[styles.inputArea, { borderTopColor: colors.border, backgroundColor: colors.bgSurface }]}>
        <View style={[styles.inputRow, { backgroundColor: colors.bgElevated, borderColor: colors.borderMid }]}>
          <TextInput
            style={[styles.input, { color: colors.textPrimary }]}
            value={text}
            onChangeText={setText}
            placeholder="Ask about this field…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxHeight={100}
            onKeyPress={handleKey}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: (!text.trim() || isLoading) ? colors.bgOverlay : colors.green }]}
            onPress={handleSend}
            disabled={!text.trim() || isLoading}
            activeOpacity={0.8}
          >
            <Text style={[styles.sendIcon, { color: (!text.trim() || isLoading) ? colors.textMuted : '#000' }]}>➤</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.footer, { color: colors.textMuted }]}>JackDaw GeoAI · PoliRuralPlus · Copernicus</Text>
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
    flex: 1,
    flexDirection: 'column',
    ...Platform.select({ web: { overflow: 'hidden' } }),
  },
  header:       { flexShrink: 0, padding: Spacing.md, paddingBottom: 9, borderBottomWidth: 1 },
  headerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  title:        { fontFamily: Fonts.displayBold, fontSize: 15, letterSpacing: -0.3 },
  sub:          { fontFamily: Fonts.mono, fontSize: 10 },
  clearBtn:     { padding: 6 },
  clearBtnText: { fontSize: 14 },
  feed:         { flex: 1, ...Platform.select({ web: { minHeight: 0 } }) },
  feedContent:  { padding: Spacing.md, gap: 12 },
  msgRow:       { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  msgRowUser:   { flexDirection: 'row-reverse' },
  avatar:       { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarEmoji:  { fontSize: 14 },
  bubble:       { maxWidth: '82%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16, borderWidth: 1 },
  msgTime:      { fontFamily: Fonts.mono, fontSize: 9, marginTop: 6 },

  // Thinking indicator
  thinkingRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  pulseDot:     { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  thinkingText: { fontFamily: Fonts.mono, fontSize: 12, flex: 1, flexWrap: 'wrap' },

  step:         { flexDirection: 'row', gap: 8, marginTop: 9, alignItems: 'flex-start' },
  stepNum:      { width: 18, height: 18, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  stepNumText:  { fontFamily: Fonts.mono, fontSize: 9 },
  inputArea:    { flexShrink: 0, padding: Spacing.sm, borderTopWidth: 1 },
  inputRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderRadius: Radius.xl, borderWidth: 1, paddingLeft: 14, paddingRight: 6, paddingVertical: 6 },
  input:        { flex: 1, fontFamily: Fonts.body, fontSize: 14, maxHeight: 100, paddingVertical: 2 },
  sendBtn:      { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  sendIcon:     { fontSize: 14 },
  footer:       { fontFamily: Fonts.mono, fontSize: 9, textAlign: 'center', marginTop: 6 },
});