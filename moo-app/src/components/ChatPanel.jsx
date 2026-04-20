// src/components/ChatPanel.jsx
import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../context/ThemeContext';
import { parseMarkdownNative, parseInline } from '../utils/markdown';



// ── Inline markdown ────────────────────────────────────────────────────────
function InlineText({ text, style }) {
  const parts = parseInline(text);
  return (
    <Text style={style}>
      {parts.map((p, i) => (
        <Text key={i} style={[
          p.bold   && styles.bold,
          p.italic && styles.italic,
          p.code   && styles.inlineCode,
        ]}>
          {p.text}
        </Text>
      ))}
    </Text>
  );
}

function MarkdownSegment({ seg }) {
  if (seg.type === 'spacer')  return <View style={{ height: 5 }} />;
  if (seg.type === 'h2')      return <InlineText text={seg.text} style={styles.mdH2} />;
  if (seg.type === 'h3')      return <InlineText text={seg.text} style={styles.mdH3} />;
  if (seg.type === 'code')    return <Text style={styles.mdCode}>{seg.text}</Text>;
  if (seg.type === 'bullet')  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>·</Text>
      <InlineText text={seg.text} style={styles.mdPara} />
    </View>
  );
  return <InlineText text={seg.text} style={styles.mdPara} />;
}

function BubbleContent({ content }) {
  return (
    <View>
      {parseMarkdownNative(content).map((seg, i) => (
        <MarkdownSegment key={i} seg={seg} />
      ))}
    </View>
  );
}

// ── Typing indicator ───────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <View style={styles.msgRow}>
      <View style={styles.avatar}><Text style={styles.avatarEmoji}>🐄</Text></View>
      <View style={[styles.bubble, styles.bubbleAsst]}>
        <View style={styles.dots}>
          <View style={[styles.dot, { opacity: 1.0 }]} />
          <View style={[styles.dot, { opacity: 0.6 }]} />
          <View style={[styles.dot, { opacity: 0.3 }]} />
        </View>
      </View>
    </View>
  );
}

// ── Single message ─────────────────────────────────────────────────────────
function ChatMessage({ item }) {
  const isUser = item.role === 'user';
  return (
    <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
      {!isUser && <View style={styles.avatar}><Text style={styles.avatarEmoji}>🐄</Text></View>}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAsst]}>
        <BubbleContent content={item.content} />
        <Text style={styles.msgTime}>{item.time}</Text>
      </View>
      {isUser && <View style={styles.avatar}><Text style={styles.avatarEmoji}>👤</Text></View>}
    </View>
  );
}

// ── Welcome ────────────────────────────────────────────────────────────────
function WelcomeMessage() {
  return (
    <View style={styles.msgRow}>
      <View style={styles.avatar}><Text style={styles.avatarEmoji}>🐄</Text></View>
      <View style={[styles.bubble, styles.bubbleAsst, styles.bubbleWelcome]}>
        <Text style={styles.mdPara}>
          <Text style={styles.bold}>Welcome to eMooJI.</Text>
          {' '}I connect to real satellite databases to answer questions about any field in Europe.
        </Text>
        {[
          ['1', 'Tap Polygon or Rectangle and draw over any field on the map'],
          ['2', 'Ask any question — or tap a quick-analysis chip above'],
        ].map(([n, t]) => (
          <View key={n} style={styles.step}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
            <Text style={styles.stepText}>{t}</Text>
          </View>
        ))}
        <Text style={styles.msgTime}>now</Text>
      </View>
    </View>
  );
}

// ── Main export ────────────────────────────────────────────────────────────
export function ChatPanel({ messages, isLoading, onSend, onClearChat }) {
  const [text, setText] = useState('');
  const scrollRef = useRef(null);

  // Scroll to bottom after every render that adds content
  useEffect(() => {
    // requestAnimationFrame ensures DOM has painted before we scroll
    const raf = requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [messages.length, isLoading]);

  const handleSend = useCallback(() => {
    const val = text.trim();
    if (!val || isLoading) return;
    onSend(val);
    setText('');
  }, [text, isLoading, onSend]);

  const handleKey = Platform.OS === 'web'
    ? (e) => { if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) { e.preventDefault(); handleSend(); } }
    : undefined;

  return (
    // On web: use a plain View because KeyboardAvoidingView causes height issues in browsers
    // On native: use KeyboardAvoidingView to push content above keyboard
    Platform.OS === 'web' ? (
      <View style={styles.panel}>
        <Inner
          text={text} setText={setText}
          messages={messages} isLoading={isLoading}
          scrollRef={scrollRef}
          handleSend={handleSend} handleKey={handleKey}
          onClearChat={onClearChat}
        />
      </View>
    ) : (
      <KeyboardAvoidingView
        style={styles.panel}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={52}
      >
        <Inner
          text={text} setText={setText}
          messages={messages} isLoading={isLoading}
          scrollRef={scrollRef}
          handleSend={handleSend} handleKey={handleKey}
          onClearChat={onClearChat}
        />
      </KeyboardAvoidingView>
    )
  );
}

// Inner layout — separated so it's reused by both web View and native KAV
function Inner({ text, setText, messages, isLoading, scrollRef, handleSend, handleKey, onClearChat }) {
  return (
    <>
      {/* Header — never scrolls */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Field Analysis</Text>
          <TouchableOpacity onPress={onClearChat} style={styles.clearBtn} activeOpacity={0.7}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sub}>Draw any field · Ask in plain language · Real satellite data</Text>
      </View>



      {/* Messages — THIS is the key fix:
          flex:1 + minHeight:0 forces it to fill remaining space on web.
          Without minHeight:0, react-native-web ignores flex:1 on ScrollView. */}
      <ScrollView
        ref={scrollRef}
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <WelcomeMessage />
        {messages.map((m, i) => <ChatMessage key={i} item={m} />)}
        {isLoading && <TypingIndicator />}
        <View style={{ height: 12 }} />
      </ScrollView>

      {/* Input — flexShrink:0 = always visible, always at bottom */}
      <View style={styles.inputArea}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Ask about this field…"
            placeholderTextColor={Colors.textMuted}
            multiline
            maxHeight={100}
            onKeyPress={handleKey}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || isLoading) && styles.sendDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || isLoading}
            activeOpacity={0.8}
          >
            <Text style={[styles.sendIcon, (!text.trim() || isLoading) && { color: Colors.textMuted }]}>➤</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.footer}>JackDaw GeoAI · PoliRuralPlus · Copernicus</Text>
      </View>
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Root — column, fills ALL available height from parent
  panel: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: Colors.bgSurface,
    // Critical for web: without overflow hidden the panel can grow past viewport
    ...Platform.select({ web: { overflow: 'hidden' } }),
  },

  // Header
  header: {
    flexShrink: 0,
    padding: Spacing.md,
    paddingBottom: 9,
    backgroundColor: Colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  title:        { fontFamily: Fonts.display, fontSize: 15, color: Colors.textPrimary, letterSpacing: -0.3 },
  sub:          { fontFamily: Fonts.mono, fontSize: 10, color: Colors.textMuted },
  clearBtn:     { padding: 6 },
  clearBtnText: { fontSize: 14, color: Colors.textMuted },

  // Badges + chips horizontal scrolls
  rowScroll:   { flexShrink: 0 },
  rowContent:  {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
    gap: 5,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  // Feed — THE critical fix for web
  feed: {
    flex: 1,
    // minHeight: 0 is the web-specific fix that makes flex:1 work on ScrollView
    // react-native-web maps this to CSS min-height:0 which prevents overflow
    ...Platform.select({ web: { minHeight: 0 } }),
  },
  feedContent: {
    padding: Spacing.md,
    gap: 12,
  },

  // Messages
  msgRow:     { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  msgRowUser: { flexDirection: 'row-reverse' },

  avatar:      { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarEmoji: { fontSize: 14 },

  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleUser:    { backgroundColor: Colors.bubbleUser, borderColor: 'rgba(15,34,68,0.7)', borderBottomRightRadius: 4 },
  bubbleAsst:    { backgroundColor: Colors.bubbleAsst, borderBottomLeftRadius: 4 },
  bubbleWelcome: { borderColor: Colors.greenBorder, maxWidth: '90%' },

  msgTime: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.textMuted, marginTop: 6 },

  // Typing dots
  dots: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 4 },
  dot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green },

  // Markdown
  mdPara:    { fontFamily: Fonts.body, fontSize: 13, color: Colors.textPrimary, lineHeight: 20 },
  mdH2:      { fontFamily: Fonts.display, fontSize: 14, color: Colors.textPrimary, marginVertical: 4 },
  mdH3:      { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.textPrimary, marginVertical: 3 },
  mdCode:    { fontFamily: Fonts.mono, fontSize: 11, color: Colors.textSecondary, backgroundColor: Colors.bgOverlay, padding: 8, borderRadius: Radius.sm, marginVertical: 4 },
  bulletRow: { flexDirection: 'row', gap: 7, marginVertical: 1 },
  bulletDot: { fontFamily: Fonts.mono, fontSize: 14, color: Colors.green, lineHeight: 20 },
  bold:       { fontFamily: Fonts.display, color: Colors.textPrimary },
  italic:     { fontStyle: 'italic', color: Colors.textSecondary },
  inlineCode: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.green },

  // Welcome steps
  step:        { flexDirection: 'row', gap: 8, marginTop: 9, alignItems: 'flex-start' },
  stepNum:     { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.greenTrace, borderWidth: 1, borderColor: Colors.greenBorder, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  stepNumText: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.green },
  stepText:    { flex: 1, fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },

  // Input — flexShrink:0 guarantees it never moves
  inputArea: {
    flexShrink: 0,
    padding: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bgSurface,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderMid,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input:       { flex: 1, fontFamily: Fonts.body, fontSize: 14, color: Colors.textPrimary, maxHeight: 100, paddingVertical: 2 },
  sendBtn:     { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.green, alignItems: 'center', justifyContent: 'center' },
  sendDisabled:{ backgroundColor: Colors.bgOverlay },
  sendIcon:    { fontSize: 14, color: '#000' },
  footer:      { fontFamily: Fonts.mono, fontSize: 9, color: Colors.textMuted, textAlign: 'center', marginTop: 6 },
});