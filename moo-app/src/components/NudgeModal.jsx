// src/components/NudgeModal.jsx
import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, ActivityIndicator,
} from 'react-native';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { useTheme } from '../context/ThemeContext';
import { Fonts, Radius, Spacing } from '../constants/tokens';

export function NudgeModal({ visible, onClose }) {
  const { colors } = useTheme();
  const [expanded,   setExpanded]  = useState(false);
  const [isRegister, setIsReg]     = useState(false);
  const [email,      setEmail]     = useState('');
  const [password,   setPassword]  = useState('');
  const [loading,    setLoading]   = useState(false);
  const [error,      setError]     = useState('');

  const handleGoogle = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [onClose]);

  const handleEmail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [isRegister, email, password, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <View style={styles.sheetWrapper} pointerEvents="box-none">
        <View style={[styles.sheet, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={[styles.closeText, { color: colors.textMuted }]}>✕</Text>
          </TouchableOpacity>

          <View style={styles.nudgeHeader}>
            <View style={[styles.iconBadge, { backgroundColor: colors.greenTrace, borderColor: colors.greenBorder }]}>
              <Text style={styles.iconEmoji}>🛰️</Text>
            </View>
            <View style={styles.nudgeTextBlock}>
              <Text style={[styles.nudgeTitle, { color: colors.textPrimary }]}>
                Unlock real satellite data
              </Text>
              <Text style={[styles.nudgeSub, { color: colors.textMuted }]}>
                Sign in to connect 16 live tools — NDVI, terrain, weather, Natura 2000 and more.
              </Text>
            </View>
          </View>

          <View style={styles.pills}>
            {['🌿 NDVI', '⛰️ Terrain', '🌤️ Weather', '🦋 Natura 2000', '🐄 Grazing'].map(f => (
              <View key={f} style={[styles.pill, { backgroundColor: colors.greenTrace, borderColor: colors.greenBorder }]}>
                <Text style={[styles.pillText, { color: colors.green }]}>{f}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.googleBtn, { borderColor: colors.borderMid }]}
            onPress={handleGoogle}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color={colors.textPrimary} />
              : <View style={styles.googleInner}>
                  <Text style={styles.googleG}>G</Text>
                  <Text style={[styles.googleText, { color: colors.textPrimary }]}>Continue with Google</Text>
                </View>
            }
          </TouchableOpacity>

          {!expanded ? (
            <TouchableOpacity onPress={() => setExpanded(true)}>
              <Text style={[styles.moreOptions, { color: colors.green }]}>
                Sign in with Email ↓
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.divRow}>
                <View style={[styles.divLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.divText, { color: colors.textMuted }]}>or</Text>
                <View style={[styles.divLine, { backgroundColor: colors.border }]} />
              </View>

              <View style={styles.fields}>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.bgElevated, color: colors.textPrimary, borderColor: colors.borderMid }]}
                  placeholder="Email address"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextInput
                  style={[styles.input, { backgroundColor: colors.bgElevated, color: colors.textPrimary, borderColor: colors.borderMid }]}
                  placeholder="Password"
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: colors.green }]}
                  onPress={handleEmail}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color="#07090e" />
                    : <Text style={styles.primaryBtnText}>{isRegister ? 'Create Account' : 'Sign In'}</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsReg(r => !r)} style={styles.toggleRow}>
                  <Text style={[styles.toggleText, { color: colors.textMuted }]}>
                    {isRegister ? 'Already have an account? ' : "Don't have an account? "}
                    <Text style={{ color: colors.green }}>{isRegister ? 'Sign in' : 'Register'}</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {!!error && (
            <View style={[styles.errorBox, { backgroundColor: colors.bgElevated, borderColor: colors.danger }]}>
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            </View>
          )}

          <TouchableOpacity onPress={onClose} style={styles.skipRow}>
            <Text style={[styles.skipText, { color: colors.textMuted }]}>
              Continue without signing in
            </Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetWrapper: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: Spacing.xl,
    paddingBottom: 36,
    gap: 14,
  },
  closeBtn:  { position: 'absolute', top: 14, right: 16, padding: 6, zIndex: 10 },
  closeText: { fontSize: 16 },
  nudgeHeader:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBadge:      { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconEmoji:      { fontSize: 20 },
  nudgeTextBlock: { flex: 1 },
  nudgeTitle:     { fontFamily: Fonts.displayBold, fontSize: 16, marginBottom: 4 },
  nudgeSub:       { fontFamily: Fonts.body, fontSize: 13, lineHeight: 19 },
  pills:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  pillText: { fontFamily: Fonts.mono, fontSize: 11 },
  googleBtn:   { borderWidth: 1, borderRadius: Radius.lg, padding: 13, alignItems: 'center' },
  googleInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  googleG:     { fontSize: 16, fontWeight: '700', color: '#4285F4' },
  googleText:  { fontFamily: Fonts.bodyMedium, fontSize: 14 },
  moreOptions: { fontFamily: Fonts.body, fontSize: 13, textAlign: 'center' },
  divRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divLine: { flex: 1, height: 1 },
  divText: { fontFamily: Fonts.mono, fontSize: 11 },
  fields:         { gap: 10 },
  input:          { borderRadius: Radius.lg, borderWidth: 1, padding: 13, fontSize: 14, fontFamily: Fonts.body },
  primaryBtn:     { borderRadius: Radius.lg, padding: 14, alignItems: 'center', marginTop: 4 },
  primaryBtnText: { fontFamily: Fonts.displayBold, fontSize: 14, color: '#07090e' },
  toggleRow:      { alignItems: 'center' },
  toggleText:     { fontFamily: Fonts.body, fontSize: 13 },
  errorBox:  { borderRadius: Radius.md, borderWidth: 1, padding: 10 },
  errorText: { fontFamily: Fonts.body, fontSize: 13, textAlign: 'center' },
  skipRow:  { alignItems: 'center', marginTop: 4 },
  skipText: { fontFamily: Fonts.mono, fontSize: 11 },
});