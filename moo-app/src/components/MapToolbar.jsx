// src/components/MapToolbar.jsx
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '../context/ThemeContext';

function ToolBtn({ label, icon, onPress, variant = 'default', active = false }) {
  return (
    <TouchableOpacity
      style={[
        styles.btn,
        variant === 'primary' && styles.btnPrimary,
        variant === 'danger'  && styles.btnDanger,
        active && styles.btnActive,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.btnIcon,
        variant === 'primary' && styles.btnIconPrimary,
        active && styles.btnIconActive,
      ]}>
        {icon}
      </Text>
      <Text style={[
        styles.btnLabel,
        variant === 'primary' && styles.btnLabelPrimary,
        active && styles.btnLabelActive,
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function MapToolbar({ onPolygon, onRectangle, onClear, onLayerSat, onLayerStreet, mapLayer, drawMode, fieldStats }) {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {/* Draw tools */}
        <ToolBtn
          label="Polygon"
          icon="△"
          variant="primary"
          active={drawMode === 'polygon'}
          onPress={onPolygon}
        />
        <ToolBtn
          label="Rectangle"
          icon="▭"
          active={drawMode === 'rectangle'}
          onPress={onRectangle}
        />
        <ToolBtn
          label="Clear"
          icon="✕"
          variant="danger"
          onPress={onClear}
        />

        <View style={styles.sep} />

        {/* Layer toggle */}
        <ToolBtn
          label="Sat"
          icon="◉"
          active={mapLayer === 'satellite'}
          onPress={onLayerSat}
        />
        <ToolBtn
          label="Street"
          icon="⌂"
          active={mapLayer === 'street'}
          onPress={onLayerStreet}
        />
      </ScrollView>

      {/* Hint */}
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
    backgroundColor: Colors.borderMid,
    marginHorizontal: 5,
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
    borderColor: Colors.border,
  },
  btnPrimary: {
    backgroundColor: Colors.greenTrace,
    borderColor: Colors.greenBorder,
  },
  btnDanger: {
    backgroundColor: Colors.bgElevated,
    borderColor: Colors.border,
  },
  btnActive: {
    backgroundColor: Colors.greenTrace,
    borderColor: Colors.greenBorder,
  },

  btnIcon:        { fontSize: 12, color: Colors.textSecondary },
  btnIconPrimary: { color: Colors.green },
  btnIconActive:  { color: Colors.green },

  btnLabel:        { fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary },
  btnLabelPrimary: { color: Colors.green },
  btnLabelActive:  { color: Colors.green },

  hint: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 6,
  },
  hintText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textMuted,
  },
});