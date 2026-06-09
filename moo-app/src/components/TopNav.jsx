// src/components/TopNav.jsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  Alert, Modal, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts, Radius, Spacing, NAV_HEIGHT, DarkColors } from '../constants/tokens';
import { FONT_SIZES, LANGUAGES } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

function StatusDot({ state, colors }) {
  const color = state === 'online' ? colors.green : state === 'connecting' ? colors.warning : colors.danger;
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

function getInstallPlatform() {
  if (Platform.OS !== 'web') return null;
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  if (isStandalone) return null;
  if (isIOS) return 'ios';
  if (isAndroid) return 'android';
  return 'desktop';
}

function IOSInstallModal({ visible, onClose, colors }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={iosStyles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[iosStyles.sheet, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
        <TouchableOpacity style={iosStyles.closeBtn} onPress={onClose}>
          <Text style={[iosStyles.closeText, { color: colors.textMuted }]}>✕</Text>
        </TouchableOpacity>
        <Text style={[iosStyles.title, { color: colors.textPrimary }]}>Install eMooJI</Text>
        <Text style={[iosStyles.sub, { color: colors.textMuted }]}>Add to your Home Screen for the best experience</Text>
        {[
          { step: '1', icon: '⬆️', text: 'Tap the Share button at the bottom of Safari' },
          { step: '2', icon: '📲', text: 'Scroll down and tap "Add to Home Screen"' },
          { step: '3', icon: '✅', text: 'Tap "Add" in the top right corner' },
        ].map(({ step, icon, text }) => (
          <View key={step} style={[iosStyles.row, { borderColor: colors.border }]}>
            <View style={[iosStyles.stepBadge, { backgroundColor: colors.greenTrace, borderColor: colors.greenBorder }]}>
              <Text style={[iosStyles.stepNum, { color: colors.green }]}>{step}</Text>
            </View>
            <Text style={iosStyles.stepIcon}>{icon}</Text>
            <Text style={[iosStyles.stepText, { color: colors.textPrimary }]}>{text}</Text>
          </View>
        ))}
        <TouchableOpacity style={[iosStyles.doneBtn, { backgroundColor: colors.green }]} onPress={onClose}>
          <Text style={iosStyles.doneBtnText}>Got it</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

export function TopNav({ connStatus, fieldStats, showInstall, onInstall, onSignIn, onHistory, onRecordings }) {
  const insets         = useSafeAreaInsets();
  const { width }      = useWindowDimensions();
  const isMobile       = width < 860;
  const { state, label } = connStatus;

  const { logout, user } = useAuth() ?? { logout: () => {}, user: null };
  const { isDark, toggleTheme, colors, fontSize, setFontSize, language, setLanguage } = useTheme() ?? { isDark: false, toggleTheme: () => {}, colors: DarkColors, fontSize: 'medium', setFontSize: () => {}, language: 'en', setLanguage: () => {} };

  const [installPlatform, setInstallPlatform] = useState(null);
  const [showIOSModal,    setShowIOSModal]    = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') setInstallPlatform(getInstallPlatform());
  }, []);

  const handleInstallPress = () => {
    if (installPlatform === 'ios') {
      setShowIOSModal(true);
    } else if (installPlatform === 'android' || installPlatform === 'desktop') {
      if (onInstall) onInstall();
    }
  };

  const showInstallButton = showInstall || installPlatform === 'ios';

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) logout();
    } else {
      Alert.alert('Sign out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: logout },
      ]);
    }
  };

  return (
    <>
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

        {/* Field info — hide on small mobile to save space */}
        {fieldStats && !isMobile && (
          <View style={styles.center}>
            <Text style={[styles.centerArea, { color: colors.textSecondary }]}>{fieldStats.areaHa} ha</Text>
            <Text style={[styles.centerDot, { color: colors.textMuted }]}>·</Text>
            <Text style={[styles.centerCoords, { color: colors.textMuted }]} numberOfLines={1}>{fieldStats.centroid}</Text>
          </View>
        )}

        {/* Field area only on mobile */}
        {fieldStats && isMobile && (
          <View style={styles.centerMobile}>
            <Text style={[styles.centerArea, { color: colors.green }]}>{fieldStats.areaHa} ha</Text>
          </View>
        )}

        {/* Right side */}
        <View style={styles.right}>

          {/* Status badge — hide label on mobile */}
          <View style={[
            styles.badge,
            { borderColor: colors.borderMid, backgroundColor: colors.bgElevated },
            state === 'online' && { borderColor: colors.greenBorder },
          ]}>
            <StatusDot state={state} colors={colors} />
            {!isMobile && (
              <Text style={[
                styles.badgeLabel,
                { color: state === 'online' ? colors.green : state === 'connecting' ? colors.warning : colors.danger }
              ]}>{label}</Text>
            )}
          </View>

          {/* Font size buttons */}
          <View style={[styles.fontSizeBtns, { backgroundColor: colors.bgElevated, borderColor: colors.borderMid }]}>
            {Object.keys(FONT_SIZES).map(size => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.fontSizeBtn,
                  fontSize === size && { backgroundColor: colors.green },
                ]}
                onPress={() => setFontSize(size)}
              >
                <Text style={[
                  styles.fontSizeBtnText,
                  { color: fontSize === size ? '#07090e' : colors.textMuted }
                ]}>
                  {FONT_SIZES[size].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Language switcher */}
          <View style={[styles.fontSizeBtns, { backgroundColor: colors.bgElevated, borderColor: colors.borderMid }]}>
            {Object.keys(LANGUAGES).map(lang => (
              <TouchableOpacity
                key={lang}
                style={[
                  styles.fontSizeBtn,
                  language === lang && { backgroundColor: colors.green },
                ]}
                onPress={() => setLanguage(lang)}
              >
                <Text style={[
                  styles.fontSizeBtnText,
                  { color: language === lang ? '#07090e' : colors.textMuted }
                ]}>
                  {LANGUAGES[lang].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Theme toggle */}
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.bgElevated, borderColor: colors.borderMid }]}
            onPress={toggleTheme}
          >
            <Text style={styles.iconBtnText}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>

          {/* Recordings — always visible */}
          {onRecordings && (
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.bgElevated, borderColor: colors.borderMid }]}
              onPress={onRecordings}
            >
              <Text style={styles.iconBtnText}>🎬</Text>
            </TouchableOpacity>
          )}

          {/* History — signed in only */}
          {onHistory && (
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.bgElevated, borderColor: colors.borderMid }]}
              onPress={onHistory}
            >
              <Text style={styles.iconBtnText}>🕐</Text>
            </TouchableOpacity>
          )}

          {/* Install — hide on mobile if signed in to save space */}
          {showInstallButton && (!isMobile || !user) && (
            <TouchableOpacity
              style={[styles.installBtn, { backgroundColor: colors.green }]}
              onPress={handleInstallPress}
              activeOpacity={0.85}
            >
              <Text style={styles.installText}>
                {installPlatform === 'ios' ? '⊕' : 'Install'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Sign In */}
          {!user && (
            <TouchableOpacity
              style={[styles.signInBtn, { backgroundColor: colors.green }]}
              onPress={onSignIn}
              activeOpacity={0.85}
            >
              <Text style={styles.signInText}>Sign In</Text>
            </TouchableOpacity>
          )}

          {/* Avatar */}
          {user && (
            <TouchableOpacity style={styles.avatarBtn} onPress={handleLogout} activeOpacity={0.7}>
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

      <IOSInstallModal
        visible={showIOSModal}
        onClose={() => setShowIOSModal(false)}
        colors={colors}
      />
    </>
  );
}

const styles = StyleSheet.create({
  nav: {
    height: NAV_HEIGHT + (Platform.OS === 'ios' ? 0 : 8),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: 6,
    borderBottomWidth: 1,
    zIndex: 100,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
    }),
  },
  brand:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cow:          { fontSize: 18 },
  name:         { fontFamily: Fonts.displayBold, fontSize: 16, letterSpacing: -0.3 },
  center:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, overflow: 'hidden' },
  centerMobile: { flex: 1, alignItems: 'center' },
  centerArea:   { fontFamily: Fonts.mono, fontSize: 11 },
  centerDot:    { fontFamily: Fonts.mono, fontSize: 11 },
  centerCoords: { fontFamily: Fonts.mono, fontSize: 11, flexShrink: 1 },
  right:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  badge:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
  dot:          { width: 6, height: 6, borderRadius: 3 },
  badgeLabel:   { fontFamily: Fonts.mono, fontSize: 10 },
  fontSizeBtns: { flexDirection: 'row', borderRadius: Radius.full, borderWidth: 1, overflow: 'hidden' },
  fontSizeBtn:  { paddingHorizontal: 7, paddingVertical: 5, alignItems: 'center', justifyContent: 'center' },
  fontSizeBtnText: { fontFamily: Fonts.displayBold, fontSize: 10 },
  iconBtn:      { width: 30, height: 30, borderRadius: Radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  iconBtnText:  { fontSize: 13 },
  installBtn:   { paddingHorizontal: 8, paddingVertical: 5, borderRadius: Radius.md },
  installText:  { fontFamily: Fonts.body, fontSize: 12, fontWeight: '700', color: '#07090e' },
  signInBtn:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.md },
  signInText:   { fontFamily: Fonts.displayBold, fontSize: 12, color: '#07090e' },
  avatarBtn:      { marginLeft: 2 },
  avatarFallback: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText:     { fontFamily: Fonts.displayBold, fontSize: 13, color: '#07090e' },
});

const iosStyles = StyleSheet.create({
  backdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderBottomWidth: 0,
    padding: Spacing.xl, paddingBottom: 40, gap: 16,
  },
  closeBtn:    { position: 'absolute', top: 14, right: 16, padding: 6, zIndex: 10 },
  closeText:   { fontSize: 16 },
  title:       { fontFamily: Fonts.displayBold, fontSize: 20, textAlign: 'center' },
  sub:         { fontFamily: Fonts.body, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  stepBadge:   { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNum:     { fontFamily: Fonts.mono, fontSize: 12 },
  stepIcon:    { fontSize: 20, flexShrink: 0 },
  stepText:    { fontFamily: Fonts.body, fontSize: 14, flex: 1, lineHeight: 20 },
  doneBtn:     { borderRadius: Radius.lg, padding: 15, alignItems: 'center', marginTop: 4 },
  doneBtnText: { fontFamily: Fonts.displayBold, fontSize: 15, color: '#07090e' },
});