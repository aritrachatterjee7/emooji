// src/components/FieldStatsBar.jsx
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../context/ThemeContext';

export function FieldStatsBar({ stats }) {
  if (!stats) return null;
  const items = [
    { label: 'Area',      val: `${stats.areaHa} ha` },
    { label: 'Centroid',  val: stats.centroid },
    { label: 'Perimeter', val: `${stats.perimKm} km` },
    { label: 'Points',    val: `${stats.pts}` },
  ];
  return (
    <View style={styles.bar}>
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {i > 0 && <View style={styles.sep} />}
          <View style={styles.stat}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.val} numberOfLines={1}>{item.val}</Text>
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
    backgroundColor: Colors.bgGlass,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderMid,
    paddingVertical: 8,
    paddingHorizontal: 4,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 8 },
    }),
  },
  sep:   { width: 1, height: 28, backgroundColor: Colors.border },
  stat:  { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  label: { fontFamily: Fonts.mono, fontSize: 9, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  val:   { fontFamily: Fonts.mono, fontSize: 11, color: Colors.textPrimary, marginTop: 2 },
});
