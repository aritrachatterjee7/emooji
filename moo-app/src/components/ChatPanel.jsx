// src/components/ChatPanel.jsx
import React, { useRef, useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, KeyboardAvoidingView, FlatList,
} from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../constants/tokens';
import { parseMarkdownNative, parseInline } from '../utils/markdown';

const CHIPS = [
  { emoji: '🌿', label: 'Veg health',    prompt: 'Show vegetation health and slope suitability for grazing in this field.' },
  { emoji: '🌡', label: 'Heat stress',   prompt: 'Which pastures are most vulnerable to heat stress this week?' },
  { emoji: '⛰',  label: 'Erosion risk',  prompt: 'Find areas with highest erosion risk after last week\'s rainfall.' },
  { emoji: '🦋', label: 'Natura 2000',   prompt: 'Which parcels overlap with Natura 2000 zones?' },
  { emoji: '📈', label: 'NDVI trend',    prompt: 'How has pasture productivity changed over the past two seasons?' },
  { emoji: '🐄', label: 'Herd move',     prompt: 'Which parts of the farm are most suitable for moving the herd tomorrow?' },
  { emoji: '🛰', label: 'NDVI now',      prompt: 'What is the current vegetation health (NDVI) for this area?' },
  { emoji: '🗺',  label: 'Land cover',   prompt: 'What type of land cover is this area classified as?' },
  { emoji: '📐', label: 'Terrain',       prompt: 'Give me a complete terrain analysis — elevation, slope and grazing suitability.' },
];

function InlineText({ text, style }) {
  const parts = parseInline(text);
  return (
    <Text style={style}>
      {parts.map((p, i) => (
        <Text key={i} style={[p.bold && styles.bold, p.italic && styles.italic, p.code && styles.inlineCode]}>
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
    <View style={styles.mdBulletRow}>
      <Text style={styles.mdBulletDot}>·</Text>
      <InlineText text={seg.text} style={styles.mdBulletText} />
    </View>
  );
  return <InlineText text={seg.text} style={styles.mdPara} />;
}

function BubbleContent({ content }) {
  return (
    <View>
      {parseMarkdownNative(content).map((seg, i) => <MarkdownSegment key={i} seg={seg} />)}
    </View>
  );
}

function TypingIndicator() {
  return (
    <View style={styles.typing}>
      {[0, 1, 2].map(i => <View key={i} style={styles.typingDot} />)}
    </View>
  );
}

function ChatMessage({ item }) {
  const isUser = item.role === 'user';
  return (
    <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
      {!isUser && <View style={styles.avatar}><Text style={styles.avatarText}>🐄</Text></View>}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAsst]}>
        {item.isLoading
          ? <TypingIndicator />
          : <BubbleContent content={item.content} />
        }
        {!item.isLoading && <Text style={styles.msgTime}>{item.time}</Text>}
      </View>
      {isUser && <View style={styles.avatar}><Text style={styles.avatarText}>👤</Text></View>}
    </View>
  );
}

function WelcomeMessage() {
  return (
    <View style={styles.msgRow}>
      <View style={styles.avatar}><Text style={styles.avatarText}>🐄</Text></View>
      <View style={[styles.bubble, styles.bubbleAsst, styles.bubbleWelcome]}>
        <Text style={styles.mdPara}>
          <Text style={styles.bold}>Welcome to eMooJI.</Text>
          {' '}I connect to real satellite databases to answer questions about any agricultural field in Europe.
        </Text>
        {[
          ['1', 'Tap Polygon or Rectangle and draw over any field on the map'],
          ['2', 'Ask any question — or tap a quick-analysis chip above'],
        ].map(([num, text]) => (
          <View key={num} style={styles.step}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>{num}</Text></View>
            <Text style={styles.stepText}>{text}</Text>
          </View>
        ))}
        <Text style={styles.msgTime}>now</Text>
      </View>
    </View>
  );
}

export function ChatPanel({ messages, isLoading, onSend, onClearChat, onChipClick }) {
  const [text, setText] = useState('');
  const listRef = useRef(null);

  const handleSend = useCallback(() => {
    const val = text.trim();
    if (!val || isLoading) return;
    onSend(val);
    setText('');
  }, [text, isLoading, onSend]);

  const handleChip = (prompt) => {
    setText(prompt);
    onChipClick?.();
  };

  const allMessages = isLoading
    ? [...messages, { id: '__loading', role: 'assistant', isLoading: true }]
    : messages;

  return (
    <KeyboardAvoidingView
      style={styles.panel}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Field Analysis</Text>
          <TouchableOpacity style={styles.clearBtn} onPress={onClearChat} activeOpacity={0.7}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sub}>Draw any field · Ask in plain language · Real satellite data</Text>
      </View>

      {/* Source badges */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.badgesScroll}
        contentContainerStyle={styles.badgesRow}
      >
        {['🛰 Sentinel-2', '🌤 Open-Meteo', '🗺 OpenTopo', '🦋 Natura 2000'].map(b => (
          <View key={b} style={styles.badge}>
            <Text style={styles.badgeText}>{b}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsRow}
      >
        {CHIPS.map(c => (
          <TouchableOpacity key={c.label} style={styles.chip} onPress={() => handleChip(c.prompt)} activeOpacity={0.7}>
            <Text style={styles.chipText}>{c.emoji} {c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={allMessages}
        keyExtractor={(item, i) => item.id || String(i)}
        renderItem={({ item }) => <ChatMessage item={item} />}
        ListHeaderComponent={<WelcomeMessage />}
        contentContainerStyle={styles.feedContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
      />

      {/* Input */}
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
            returnKeyType="send"
            onSubmitEditing={Platform.OS !== 'web' ? handleSend : undefined}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || isLoading) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || isLoading}
            activeOpacity={0.8}
          >
            <Text style={[styles.sendIcon, (!text.trim() || isLoading) && styles.sendIconDisabled]}>➤</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.footer}>JackDaw GeoAI · PoliRuralPlus · Copernicus</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: Colors.bgSurface },

  // Header
  header: {
    padding: Spacing.md,
    paddingBottom: 9,
    backgroundColor: Colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  title: { fontFamily: Fonts.display, fontSize: 15, fontWeight: '600', color: Colors.textPrimary, letterSpacing: -0.2 },
  sub:   { fontFamily: Fonts.mono, fontSize: 10, color: Colors.textMuted },

  clearBtn:     { padding: 5 },
  clearBtnText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted },

  // Badges
  badgesScroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: Colors.border },
  badgesRow:    { flexDirection: 'row', paddingHorizontal: Spacing.sm, paddingVertical: 6, gap: 5 },
  badge:        { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: Colors.bgOverlay, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  badgeText:    { fontFamily: Fonts.mono, fontSize: 10, color: Colors.textMuted },

  // Chips
  chipsScroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: Colors.border },
  chipsRow:    { flexDirection: 'row', paddingHorizontal: Spacing.sm, paddingVertical: 7, gap: 5 },
  chip:        { paddingHorizontal: 11, paddingVertical: 5, backgroundColor: Colors.bgElevated, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  chipText:    { fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary },

  // Feed
  feedContent: { padding: Spacing.md, gap: 12, paddingBottom: Spacing.xl },

  // Messages
  msgRow:     { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  msgRowUser: { flexDirection: 'row-reverse' },

  avatar:     { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 13 },

  bubble:        { maxWidth: '84%', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: Colors.border },
  bubbleUser:    { backgroundColor: Colors.bubbleUser, borderColor: 'rgba(15,34,68,0.6)', borderBottomRightRadius: 3 },
  bubbleAsst:    { backgroundColor: Colors.bubbleAsst, borderBottomLeftRadius: 3 },
  bubbleWelcome: { borderColor: Colors.greenBorder },

  msgTime: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.textMuted, marginTop: 5 },

  // Markdown
  mdPara:       { fontFamily: Fonts.body,       fontSize: 13, color: Colors.textPrimary, lineHeight: 20 },
  mdH2:         { fontFamily: Fonts.display,    fontSize: 14, color: Colors.textPrimary, marginVertical: 4 },
  mdH3:         { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.textPrimary, marginVertical: 3 },
  mdCode:       { fontFamily: Fonts.mono, fontSize: 11, color: Colors.textSecondary, backgroundColor: Colors.bgOverlay, padding: 8, borderRadius: Radius.sm, marginVertical: 4 },
  mdBulletRow:  { flexDirection: 'row', gap: 7, marginVertical: 1 },
  mdBulletDot:  { fontFamily: Fonts.mono, fontSize: 13, color: Colors.green, lineHeight: 20 },
  mdBulletText: { flex: 1, fontFamily: Fonts.body, fontSize: 13, color: Colors.textPrimary, lineHeight: 20 },

  bold:       { fontFamily: Fonts.display, color: Colors.textPrimary },
  italic:     { fontStyle: 'italic', color: Colors.textSecondary },
  inlineCode: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.green, backgroundColor: Colors.bgOverlay },

  // Welcome steps
  step:        { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'flex-start' },
  stepNum:     { width: 17, height: 17, borderRadius: 9, backgroundColor: Colors.greenTrace, borderWidth: 1, borderColor: Colors.greenBorder, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  stepNumText: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.green },
  stepText:    { flex: 1, fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },

  // Typing
  typing:    { flexDirection: 'row', gap: 4, padding: 3, alignItems: 'center' },
  typingDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.green },

  // Input
  inputArea: { borderTopWidth: 1, borderTopColor: Colors.border, padding: Spacing.sm, paddingBottom: Spacing.sm, backgroundColor: Colors.bgSurface },
  inputRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 7, backgroundColor: Colors.bgElevated, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.borderMid, paddingLeft: 14, paddingRight: 6, paddingVertical: 6 },
  input:     { flex: 1, fontFamily: Fonts.body, fontSize: 14, color: Colors.textPrimary, maxHeight: 100, paddingVertical: 2 },

  sendBtn:         { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.green, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: Colors.bgOverlay },
  sendIcon:        { fontSize: 13, color: '#000' },
  sendIconDisabled:{ color: Colors.textMuted },

  footer: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.textMuted, textAlign: 'center', marginTop: 6 },
});