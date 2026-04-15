// src/components/MapToolbar.jsx
// Shared toolbar — React Native StyleSheet so works on iOS, Android, Web

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../constants/tokens';

function ToolBtn({ label, icon, onPress, variant = 'default', active = false }) {
  return (
    <TouchableOpacity
      style={[styles.btn, styles[`btn_${variant}`], active && styles.btnActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.btnIcon}>{icon}</Text>
      <Text style={[styles.btnLabel, active && styles.btnLabelActive, variant === 'primary' && styles.btnLabelPrimary]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function MapToolbar({ onPolygon, onRectangle, onDemo, onClear, onLayerSat, onLayerStreet, mapLayer, drawMode, fieldStats }) {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {/* Draw tools */}
        <ToolBtn label="Polygon"   icon="△" variant="primary"  active={drawMode === 'polygon'}   onPress={onPolygon} />
        <ToolBtn label="Rectangle" icon="▭" variant="default"  active={drawMode === 'rectangle'} onPress={onRectangle} />

        <View style={styles.sep} />

        {/* Utility */}
        <ToolBtn label="Demo"  icon="+" onPress={onDemo} />
        <ToolBtn label="Clear" icon="✕" variant="danger" onPress={onClear} />

        <View style={styles.sep} />

        {/* Layer toggle */}
        <ToolBtn label="Sat"    icon="◉" active={mapLayer === 'satellite'} onPress={onLayerSat} />
        <ToolBtn label="Street" icon="⌂" active={mapLayer === 'street'}    onPress={onLayerStreet} />
      </ScrollView>

      {/* Hint text */}
      {!fieldStats && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>△ Draw a field to begin</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.bgGlass,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Platform.select({
      ios:     { paddingTop: 0 },
      android: { paddingTop: 0 },
      web:     { backdropFilter: 'blur(16px)' },
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
    gap: 4,
  },
  sep: {
    width: 1,
    height: 20,
    backgroundColor: Colors.borderMid,
    marginHorizontal: 4,
  },

  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderMid,
  },
  btn_primary: {
    backgroundColor: Colors.greenTrace,
    borderColor: Colors.greenBorder,
  },
  btn_danger: {
    backgroundColor: Colors.bgElevated,
    borderColor: Colors.borderMid,
  },
  btnActive: {
    backgroundColor: Colors.greenTrace,
    borderColor: Colors.greenBorder,
  },

  btnIcon: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  btnLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  btnLabelPrimary: {
    color: Colors.green,
  },
  btnLabelActive: {
    color: Colors.green,
  },

  hint: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 6,
    alignItems: 'flex-start',
  },
  hintText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textMuted,
  },
});
