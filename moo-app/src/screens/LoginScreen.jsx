// src/screens/LoginScreen.jsx
import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, useWindowDimensions, ScrollView,
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

export default function LoginScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 640;

  const [mode,       setMode]      = useState('email');
  const [isRegister, setIsReg]     = useState(false);
  const [email,      setEmail]     = useState('');
  const [password,   setPassword]  = useState('');
  const [phone,      setPhone]     = useState('');
  const [otp,        setOtp]       = useState('');
  const [confirm,    setConfirm]   = useState(null);
  const [loading,    setLoading]   = useState(false);
  const [error,      setError]     = useState('');

  const handleGoogle = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleEmail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [isRegister, email, password]);

  const handleSendOtp = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const recaptcha = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
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
    } catch (e) {
      setError('Invalid OTP. Try again.');
    } finally {
      setLoading(false);
    }
  }, [confirm, otp]);

  const cardStyle = {
    backgroundColor: colors.bgSurface,
    borderColor:     colors.border,
    width:           isWide ? 420 : '100%',
    maxWidth:        420,
  };

  const inputStyle = {
    backgroundColor:  colors.bgElevated,
    color:            colors.textPrimary,
    borderColor:      colors.borderMid,
  };

  return (
    <ScrollView
      contentContainerStyle={[s.outer, { backgroundColor: colors.bgBase }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Theme toggle top right */}
      <TouchableOpacity
        style={[s.themeToggle, { backgroundColor: colors.bgElevated, borderColor: colors.borderMid }]}
        onPress={toggleTheme}
      >
        <Text style={s.themeIcon}>{isDark ? '☀️' : '🌙'}</Text>
      </TouchableOpacity>

      {/* Hero */}
      <View style={s.hero}>
        <Text style={s.cow}>🐄</Text>
        <Text style={[s.appName, { color: colors.textPrimary }]}>
          eMoo<Text style={{ color: colors.green }}>JI</Text>
        </Text>
        <Text style={[s.tagline, { color: colors.green }]}>FIELD INTELLIGENCE</Text>
        <Text style={[s.sub, { color: colors.textMuted }]}>
          Draw any field in Europe.{'\n'}Get real satellite insights instantly.
        </Text>
      </View>

      {/* Card */}
      <View style={[s.card, cardStyle]}>

        {/* Google */}
        <TouchableOpacity
          style={[s.googleBtn, { borderColor: colors.borderMid }]}
          onPress={handleGoogle}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <View style={s.googleInner}>
              <Text style={s.googleIcon}>G</Text>
              <Text style={[s.googleText, { color: colors.textPrimary }]}>Continue with Google</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={s.dividerRow}>
          <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[s.dividerText, { color: colors.textMuted }]}>or</Text>
          <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* Mode tabs */}
        <View style={[s.tabs, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
          {['email', 'phone'].map(m => (
            <TouchableOpacity
              key={m}
              style={[s.tab, mode === m && { backgroundColor: colors.bgSurface, borderColor: colors.borderMid }]}
              onPress={() => { setMode(m); setError(''); }}
            >
              <Text style={[s.tabText, { color: mode === m ? colors.green : colors.textMuted }]}>
                {m === 'email' ? 'Email' : 'Phone OTP'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Email mode */}
        {mode === 'email' && (
          <View style={s.fields}>
            <TextInput
              style={[s.input, inputStyle]}
              placeholder="Email address"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={[s.input, inputStyle]}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TouchableOpacity
              style={[s.primaryBtn, { backgroundColor: colors.green }]}
              onPress={handleEmail}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#07090e" />
                : <Text style={s.primaryBtnText}>{isRegister ? 'Create Account' : 'Sign In'}</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsReg(r => !r)} style={s.toggleRow}>
              <Text style={[s.toggleText, { color: colors.textMuted }]}>
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
          <View style={s.fields}>
            {!confirm ? (
              <>
                <TextInput
                  style={[s.input, inputStyle]}
                  placeholder="+91 98765 43210"
                  placeholderTextColor={colors.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
                <TouchableOpacity
                  style={[s.primaryBtn, { backgroundColor: colors.green }]}
                  onPress={handleSendOtp}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color="#07090e" />
                    : <Text style={s.primaryBtnText}>Send OTP</Text>
                  }
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[s.otpHint, { color: colors.textMuted }]}>
                  OTP sent to {phone}
                </Text>
                <TextInput
                  style={[s.input, inputStyle]}
                  placeholder="Enter 6-digit OTP"
                  placeholderTextColor={colors.textMuted}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <TouchableOpacity
                  style={[s.primaryBtn, { backgroundColor: colors.green }]}
                  onPress={handleVerifyOtp}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color="#07090e" />
                    : <Text style={s.primaryBtnText}>Verify OTP</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setConfirm(null)} style={s.toggleRow}>
                  <Text style={[s.toggleText, { color: colors.green }]}>← Change number</Text>
                </TouchableOpacity>
              </>
            )}
            {Platform.OS === 'web' && <div id="recaptcha-container" />}
          </View>
        )}

        {/* Error */}
        {!!error && (
          <View style={[s.errorBox, { backgroundColor: colors.bgElevated, borderColor: colors.danger }]}>
            <Text style={[s.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <Text style={[s.footer, { color: colors.textMuted }]}>
        JackDaw GeoAI · PoliRuralPlus · Copernicus
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  outer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    paddingTop: 60,
    paddingBottom: 40,
    minHeight: '100%',
  },

  themeToggle: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { position: 'fixed' } }),
  },
  themeIcon: { fontSize: 16 },

  hero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  cow:     { fontSize: 52, marginBottom: 8 },
  appName: { fontFamily: Fonts.displayBold, fontSize: 32, letterSpacing: -1, marginBottom: 6 },
  tagline: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 3, marginBottom: 10 },
  sub:     { fontFamily: Fonts.body, fontSize: 14, textAlign: 'center', lineHeight: 22 },

  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    marginBottom: 24,
  },

  googleBtn: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: 14,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    backgroundColor: 'transparent',
  },
  googleInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  googleIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4285F4',
  },
  googleText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.lg,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontFamily: Fonts.mono, fontSize: 11 },

  tabs: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 3,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabText: { fontFamily: Fonts.bodyMedium, fontSize: 13 },

  fields: { gap: 10 },

  input: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 14,
    fontSize: 14,
    fontFamily: Fonts.body,
  },

  primaryBtn: {
    borderRadius: Radius.lg,
    padding: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    fontFamily: Fonts.displayBold,
    fontSize: 15,
    color: '#07090e',
  },

  toggleRow:  { alignItems: 'center', marginTop: 4 },
  toggleText: { fontFamily: Fonts.body, fontSize: 13 },

  otpHint: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },

  errorBox: {
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: 12,
  },
  errorText: { fontFamily: Fonts.body, fontSize: 13, textAlign: 'center' },

  footer: { fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 1, textAlign: 'center' },
});