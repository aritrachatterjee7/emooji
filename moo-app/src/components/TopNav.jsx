// src/components/TopNav.jsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Radius, Spacing, NAV_HEIGHT } from '../constants/tokens';

function StatusDot({ state }) {
  const color = state === 'online' ? Colors.green : state === 'connecting' ? Colors.warning : Colors.danger;
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

export function TopNav({ connStatus, fieldStats, showInstall, onInstall }) {
  const insets = useSafeAreaInsets();
  const { state, label } = connStatus;

  return (
    <View style={[styles.nav, { paddingTop: insets.top || (Platform.OS === 'android' ? 8 : 0) }]}>
      {/* Brand */}
      <View style={styles.brand}>
        <Text style={styles.cow}>🐄</Text>
        <Text style={styles.name}>eMoo<Text style={styles.nameGreen}>JI</Text></Text>
      </View>

      {/* Field info (centre) */}
      {fieldStats && (
        <View style={styles.center}>
          <Text style={styles.centerArea}>{fieldStats.areaHa} ha</Text>
          <Text style={styles.centerDot}>·</Text>
          <Text style={styles.centerCoords} numberOfLines={1}>{fieldStats.centroid}</Text>
        </View>
      )}

      {/* Status badge */}
      <View style={styles.right}>
        <View style={[styles.badge, styles[`badge_${state}`]]}>
          <StatusDot state={state} />
          <Text style={[styles.badgeLabel, styles[`badgeLabel_${state}`]]}>{label}</Text>
        </View>
        {showInstall && (
          <TouchableOpacity style={styles.installBtn} onPress={onInstall}>
            <Text style={styles.installText}>Install</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    height: NAV_HEIGHT + (Platform.OS === 'ios' ? 0 : 8),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: 10,
    backgroundColor: Colors.bgGlass,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    zIndex: 100,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
    }),
  },

  brand:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cow:      { fontSize: 20 },
  name:     { fontFamily: Fonts.displayBold, fontSize: 17, color: Colors.textPrimary, letterSpacing: -0.3 },
  nameGreen:{ color: Colors.green },

  center:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, overflow: 'hidden' },
  centerArea:   { fontFamily: Fonts.mono, fontSize: 11, color: Colors.textSecondary },
  centerDot:    { fontFamily: Fonts.mono, fontSize: 11, color: Colors.textMuted },
  centerCoords: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.textMuted, flexShrink: 1 },

  right:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },

  badge:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.borderMid, backgroundColor: Colors.bgElevated },
  badge_online:      { borderColor: Colors.greenBorder },
  badge_connecting:  {},
  badge_error:       {},

  dot: { width: 6, height: 6, borderRadius: 3 },

  badgeLabel:           { fontFamily: Fonts.mono, fontSize: 10, color: Colors.textMuted },
  badgeLabel_online:    { color: Colors.green },
  badgeLabel_connecting:{ color: Colors.warning },
  badgeLabel_error:     { color: Colors.danger },

  installBtn:  { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: Colors.green, borderRadius: Radius.md },
  installText: { fontFamily: Fonts.body, fontSize: 12, fontWeight: '700', color: '#000' },
});
