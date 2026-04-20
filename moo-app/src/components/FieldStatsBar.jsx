// src/components/FieldStatsBar.jsx
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Fonts, Radius } from '../constants/tokens';
import { useTheme } from '../context/ThemeContext';

export function FieldStatsBar({ stats }) {
  const { colors } = useTheme();

  if (!stats) return null;

  const items = [
    { label: 'Area',      val: `${stats.areaHa} ha` },
    { label: 'Centroid',  val: stats.centroid },
    { label: 'Perimeter', val: `${stats.perimKm} km` },
    { label: 'Points',    val: `${stats.pts}` },
  ];

  return (
    <View style={[
      styles.bar,
      {
        backgroundColor: colors.bgGlass,
        borderColor: colors.borderMid,
      }
    ]}>
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {i > 0 && <View style={[styles.sep, { backgroundColor: colors.border }]} />}
          <View style={styles.stat}>
            <Text style={[styles.label, { color: colors.textMuted }]}>{item.label}</Text>
            <Text style={[styles.val, { color: colors.textPrimary }]} numberOfLines={1}>{item.val}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 8 },
    }),
  },
  sep:   { width: 1, height: 28 },
  stat:  { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  label: { fontFamily: Fonts.mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  val:   { fontFamily: Fonts.mono, fontSize: 11, marginTop: 2 },
});