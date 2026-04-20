// src/components/BottomNav.jsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Radius, BOTTOM_NAV_HEIGHT } from '../constants/tokens';

export function BottomNav({ activePanel, onSwitch, unreadCount }) {
  const insets = useSafeAreaInsets();

  const tabs = [
    { key: 'map',  label: 'Map',      icon: '🗺' },
    { key: 'chat', label: 'Analysis', icon: '💬' },
  ];

  return (
    <View style={[styles.nav, { paddingBottom: insets.bottom || 8 }]}>
      {tabs.map(tab => {
        const active = activePanel === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => onSwitch(tab.key)}
            activeOpacity={0.7}
          >
            {active && <View style={styles.activeBar} />}
            <Text style={styles.icon}>{tab.icon}</Text>
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
            {tab.key === 'chat' && unreadCount > 0 && (
              <View style={styles.badge}>
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
    backgroundColor: Colors.bgGlass,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
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
    backgroundColor: Colors.green,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  icon:        { fontSize: 18 },
  label:       { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  labelActive: { color: Colors.green },
  badge: {
    position: 'absolute',
    top: 6, right: 24,
    minWidth: 16, height: 16,
    borderRadius: 8,
    backgroundColor: Colors.danger,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontFamily: Fonts.mono, fontSize: 9, color: '#fff' },
});