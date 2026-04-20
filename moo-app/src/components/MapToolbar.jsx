// src/components/MapToolbar.jsx
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ScrollView } from 'react-native';
import { Fonts, Radius, Spacing } from '../constants/tokens';
import { useTheme } from '../context/ThemeContext';

function ToolBtn({ label, icon, onPress, variant = 'default', active = false, colors }) {
  return (
    <TouchableOpacity
      style={[
        styles.btn,
        { backgroundColor: colors.bgElevated, borderColor: colors.border },
        variant === 'primary' && { backgroundColor: colors.greenTrace, borderColor: colors.greenBorder },
        active && { backgroundColor: colors.greenTrace, borderColor: colors.greenBorder },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.btnIcon,
        { color: colors.textSecondary },
        (variant === 'primary' || active) && { color: colors.green },
      ]}>
        {icon}
      </Text>
      <Text style={[
        styles.btnLabel,
        { color: colors.textSecondary },
        (variant === 'primary' || active) && { color: colors.green },
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function MapToolbar({ onPolygon, onRectangle, onClear, onLayerSat, onLayerStreet, mapLayer, drawMode, fieldStats }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.bgGlass, borderBottomColor: colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <ToolBtn label="Polygon"   icon="△" variant="primary" active={drawMode === 'polygon'}   onPress={onPolygon}    colors={colors} />
        <ToolBtn label="Rectangle" icon="▭"                   active={drawMode === 'rectangle'} onPress={onRectangle}  colors={colors} />
        <ToolBtn label="Clear"     icon="✕" variant="danger"                                    onPress={onClear}      colors={colors} />
        <View style={[styles.sep, { backgroundColor: colors.borderMid }]} />
        <ToolBtn label="Sat"    icon="◉" active={mapLayer === 'satellite'} onPress={onLayerSat}    colors={colors} />
        <ToolBtn label="Street" icon="⌂" active={mapLayer === 'street'}   onPress={onLayerStreet} colors={colors} />
      </ScrollView>

      {!fieldStats && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={[styles.hintText, { color: colors.textMuted }]}>△ Draw a field to begin</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
    gap: 3,
  },
  sep: {
    width: 1,
    height: 18,
    marginHorizontal: 5,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  btnIcon:  { fontSize: 12 },
  btnLabel: { fontFamily: Fonts.body, fontSize: 12 },
  hint: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 6,
  },
  hintText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
  },
});