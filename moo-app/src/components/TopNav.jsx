// src/components/TopNav.jsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts, Radius, Spacing, NAV_HEIGHT, DarkColors } from '../constants/tokens';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

function StatusDot({ state, colors }) {
  const color = state === 'online' ? colors.green : state === 'connecting' ? colors.warning : colors.danger;
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

export function TopNav({ connStatus, fieldStats, showInstall, onInstall, onSignIn }) {
  const insets = useSafeAreaInsets();
  const { state, label } = connStatus;

  const { logout, user } = useAuth() ?? { logout: () => {}, user: null };
  const { isDark, toggleTheme, colors } = useTheme() ?? { isDark: false, toggleTheme: () => {}, colors: DarkColors };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) {
        logout();
      }
    } else {
      Alert.alert(
        'Sign out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign out', style: 'destructive', onPress: logout },
        ]
      );
    }
  };

  return (
    <View style={[
      styles.nav,
      {
        paddingTop: insets.top || (Platform.OS === 'android' ? 8 : 0),
        backgroundColor: colors.bgGlass,
        borderBottomColor: colors.border,
      }
    ]}>

      {/* Brand */}
      <View style={styles.brand}>
        <Text style={styles.cow}>🐄</Text>
        <Text style={[styles.name, { color: colors.textPrimary }]}>
          eMoo<Text style={{ color: colors.green }}>JI</Text>
        </Text>
      </View>

      {/* Field info (centre) */}
      {fieldStats && (
        <View style={styles.center}>
          <Text style={[styles.centerArea, { color: colors.textSecondary }]}>{fieldStats.areaHa} ha</Text>
          <Text style={[styles.centerDot, { color: colors.textMuted }]}>·</Text>
          <Text style={[styles.centerCoords, { color: colors.textMuted }]} numberOfLines={1}>{fieldStats.centroid}</Text>
        </View>
      )}

      {/* Right side */}
      <View style={styles.right}>

        {/* Status badge */}
        <View style={[
          styles.badge,
          { borderColor: colors.borderMid, backgroundColor: colors.bgElevated },
          state === 'online' && { borderColor: colors.greenBorder },
        ]}>
          <StatusDot state={state} colors={colors} />
          <Text style={[
            styles.badgeLabel,
            { color: state === 'online' ? colors.green : state === 'connecting' ? colors.warning : colors.danger }
          ]}>{label}</Text>
        </View>

        {/* Dark / Light toggle */}
        <TouchableOpacity
          style={[styles.themeBtn, { backgroundColor: colors.bgElevated, borderColor: colors.borderMid }]}
          onPress={toggleTheme}
          accessibilityLabel="Toggle dark/light mode"
        >
          <Text style={styles.themeIcon}>{isDark ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>

        {/* Install PWA button */}
        {showInstall && (
          <TouchableOpacity style={[styles.installBtn, { backgroundColor: colors.green }]} onPress={onInstall}>
            <Text style={styles.installText}>Install</Text>
          </TouchableOpacity>
        )}

        {/* Sign In button — shown when not logged in */}
        {!user && (
          <TouchableOpacity
            style={[styles.signInBtn, { backgroundColor: colors.green }]}
            onPress={onSignIn}
            activeOpacity={0.85}
          >
            <Text style={styles.signInText}>Sign In</Text>
          </TouchableOpacity>
        )}

        {/* User avatar + logout — shown when logged in */}
        {user && (
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                style={{ width: 28, height: 28, borderRadius: 14, cursor: 'pointer' }}
                alt="avatar"
                title="Click to sign out"
              />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: colors.green }]}>
                <Text style={styles.avatarText}>
                  {(user.displayName || user.email || '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
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
    borderBottomWidth: 1,
    zIndex: 100,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
    }),
  },

  brand:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cow:       { fontSize: 20 },
  name:      { fontFamily: Fonts.displayBold, fontSize: 17, letterSpacing: -0.3 },

  center:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, overflow: 'hidden' },
  centerArea:   { fontFamily: Fonts.mono, fontSize: 11 },
  centerDot:    { fontFamily: Fonts.mono, fontSize: 11 },
  centerCoords: { fontFamily: Fonts.mono, fontSize: 11, flexShrink: 1 },

  right: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },

  badge:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
  dot:        { width: 6, height: 6, borderRadius: 3 },
  badgeLabel: { fontFamily: Fonts.mono, fontSize: 10 },

  themeBtn:  { width: 30, height: 30, borderRadius: Radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  themeIcon: { fontSize: 14 },

  installBtn:  { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.md },
  installText: { fontFamily: Fonts.body, fontSize: 12, fontWeight: '700', color: '#000' },

  signInBtn:  { paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.md },
  signInText: { fontFamily: Fonts.displayBold, fontSize: 12, color: '#07090e' },

  avatarBtn:      { marginLeft: 4 },
  avatarFallback: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText:     { fontFamily: Fonts.displayBold, fontSize: 13, color: '#07090e' },
});