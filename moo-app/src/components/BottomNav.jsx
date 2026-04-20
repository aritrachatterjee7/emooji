// src/components/BottomNav.jsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts, Radius, BOTTOM_NAV_HEIGHT } from '../constants/tokens';
import { useTheme } from '../context/ThemeContext';

export function BottomNav({ activePanel, onSwitch, unreadCount }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const tabs = [
    { key: 'map',  label: 'Map',      icon: '🗺' },
    { key: 'chat', label: 'Analysis', icon: '💬' },
  ];

  return (
    <View style={[
      styles.nav,
      {
        paddingBottom: insets.bottom || 8,
        backgroundColor: colors.bgGlass,
        borderTopColor: colors.border,
      }
    ]}>
      {tabs.map(tab => {
        const active = activePanel === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => onSwitch(tab.key)}
            activeOpacity={0.7}
          >
            {active && <View style={[styles.activeBar, { backgroundColor: colors.green }]} />}
            <Text style={styles.icon}>{tab.icon}</Text>
            <Text style={[styles.label, { color: active ? colors.green : colors.textMuted }]}>
              {tab.label}
            </Text>
            {tab.key === 'chat' && unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    height: BOTTOM_NAV_HEIGHT,
    borderTopWidth: 1,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: -2 } },
      android: { elevation: 8 },
    }),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    position: 'relative',
    paddingVertical: 8,
  },
  activeBar: {
    position: 'absolute',
    top: 0, left: '50%',
    marginLeft: -12,
    width: 24, height: 2,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  icon:      { fontSize: 18 },
  label:     { fontFamily: Fonts.body, fontSize: 11 },
  badge: {
    position: 'absolute',
    top: 6, right: 24,
    minWidth: 16, height: 16,
    borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontFamily: Fonts.mono, fontSize: 9, color: '#fff' },
});