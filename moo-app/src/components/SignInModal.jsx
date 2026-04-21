// src/components/SignInModal.jsx
import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, ActivityIndicator, Platform,
} from 'react-native';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { useTheme } from '../context/ThemeContext';
import { Fonts, Radius, Spacing } from '../constants/tokens';

export function SignInModal({ visible, onClose, pendingMessage }) {
  const { colors } = useTheme();
  const [mode,       setMode]     = useState('email');
  const [isRegister, setIsReg]    = useState(false);
  const [email,      setEmail]    = useState('');
  const [password,   setPassword] = useState('');
  const [phone,      setPhone]    = useState('');
  const [otp,        setOtp]      = useState('');
  const [confirm,    setConfirm]  = useState(null);
  const [loading,    setLoading]  = useState(false);
  const [error,      setError]    = useState('');

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

  const handleSendOtp = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const recaptcha = new RecaptchaVerifier(auth, 'modal-recaptcha', { size: 'invisible' });
      const result = await signInWithPhoneNumber(auth, phone, recaptcha);
      setConfirm(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [phone]);

  const handleVerifyOtp = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await confirm.confirm(otp);
      onClose();
    } catch (e) {
      setError('Invalid OTP. Try again.');
    } finally {
      setLoading(false);
    }
  }, [confirm, otp, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Modal card */}
      <View style={styles.centerer} pointerEvents="box-none">
        <View style={[styles.card, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>

          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={[styles.closeText, { color: colors.textMuted }]}>✕</Text>
          </TouchableOpacity>

          {/* Header */}
          <Text style={styles.emoji}>🐄</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Sign in to chat
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {pendingMessage
              ? `We'll send your message "${pendingMessage.slice(0, 40)}${pendingMessage.length > 40 ? '…' : ''}" after you sign in.`
              : 'Create a free account to analyse fields with real satellite data.'}
          </Text>

          {/* Google */}
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

          {/* Divider */}
          <View style={styles.divRow}>
            <View style={[styles.divLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.divText, { color: colors.textMuted }]}>or</Text>
            <View style={[styles.divLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Mode tabs */}
          <View style={[styles.tabs, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
            {['email', 'phone'].map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.tab, mode === m && { backgroundColor: colors.bgSurface, borderColor: colors.borderMid }]}
                onPress={() => { setMode(m); setError(''); }}
              >
                <Text style={[styles.tabText, { color: mode === m ? colors.green : colors.textMuted }]}>
                  {m === 'email' ? 'Email' : 'Phone OTP'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Email mode */}
          {mode === 'email' && (
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
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#07090e" />
                  : <Text style={styles.primaryBtnText}>{isRegister ? 'Create Account' : 'Sign In'}</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsReg(r => !r)} style={styles.toggleRow}>
                <Text style={[styles.toggleText, { color: colors.textMuted }]}>
                  {isRegister ? 'Already have an account? ' : "Don't have an account? "}
                  <Text style={{ color: colors.green }}>
                    {isRegister ? 'Sign in' : 'Register'}
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Phone mode */}
          {mode === 'phone' && (
            <View style={styles.fields}>
              {!confirm ? (
                <>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.bgElevated, color: colors.textPrimary, borderColor: colors.borderMid }]}
                    placeholder="+91 98765 43210"
                    placeholderTextColor={colors.textMuted}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: colors.green }]}
                    onPress={handleSendOtp}
                    disabled={loading}
                  >
                    {loading ? <ActivityIndicator color="#07090e" /> : <Text style={styles.primaryBtnText}>Send OTP</Text>}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.bgElevated, color: colors.textPrimary, borderColor: colors.borderMid }]}
                    placeholder="Enter 6-digit OTP"
                    placeholderTextColor={colors.textMuted}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: colors.green }]}
                    onPress={handleVerifyOtp}
                    disabled={loading}
                  >
                    {loading ? <ActivityIndicator color="#07090e" /> : <Text style={styles.primaryBtnText}>Verify OTP</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setConfirm(null)} style={styles.toggleRow}>
                    <Text style={[styles.toggleText, { color: colors.green }]}>← Change number</Text>
                  </TouchableOpacity>
                </>
              )}
              {Platform.OS === 'web' && <div id="modal-recaptcha" />}
            </View>
          )}

          {/* Error */}
          {!!error && (
            <View style={[styles.errorBox, { backgroundColor: colors.bgElevated, borderColor: colors.danger }]}>
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  centerer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    paddingTop: 40,
  },
  closeBtn:  { position: 'absolute', top: 14, right: 14, padding: 6 },
  closeText: { fontSize: 16 },
  emoji:     { fontSize: 36, textAlign: 'center', marginBottom: 8 },
  title:     { fontFamily: Fonts.displayBold, fontSize: 20, textAlign: 'center', marginBottom: 8 },
  subtitle:  { fontFamily: Fonts.body, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },

  googleBtn:   { borderWidth: 1, borderRadius: Radius.lg, padding: 13, alignItems: 'center', marginBottom: Spacing.md },
  googleInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  googleG:     { fontSize: 16, fontWeight: '700', color: '#4285F4' },
  googleText:  { fontFamily: Fonts.bodyMedium, fontSize: 14 },

  divRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.md },
  divLine: { flex: 1, height: 1 },
  divText: { fontFamily: Fonts.mono, fontSize: 11 },

  tabs:    { flexDirection: 'row', borderRadius: Radius.lg, borderWidth: 1, padding: 3, marginBottom: Spacing.md },
  tab:     { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: Radius.md, borderWidth: 1, borderColor: 'transparent' },
  tabText: { fontFamily: Fonts.bodyMedium, fontSize: 13 },

  fields:     { gap: 10 },
  input:      { borderRadius: Radius.lg, borderWidth: 1, padding: 13, fontSize: 14, fontFamily: Fonts.body },
  primaryBtn: { borderRadius: Radius.lg, padding: 14, alignItems: 'center', marginTop: 4 },
  primaryBtnText: { fontFamily: Fonts.displayBold, fontSize: 14, color: '#07090e' },
  toggleRow:  { alignItems: 'center', marginTop: 4 },
  toggleText: { fontFamily: Fonts.body, fontSize: 13 },
  errorBox:   { marginTop: Spacing.md, borderRadius: Radius.md, borderWidth: 1, padding: 10 },
  errorText:  { fontFamily: Fonts.body, fontSize: 13, textAlign: 'center' },
});