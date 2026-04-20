import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth';
import { auth } from '../config/firebase';

export default function LoginScreen() {
  const [mode, setMode]         = useState('email'); // 'email' | 'phone'
  const [isRegister, setIsReg]  = useState(false);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone]       = useState('');
  const [otp, setOtp]           = useState('');
  const [confirm, setConfirm]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // ── Google ──────────────────────────────────────────
  const handleGoogle = async () => {
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
  };

  // ── Email / Password ─────────────────────────────────
  const handleEmail = async () => {
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
  };

  // ── Phone OTP ────────────────────────────────────────
  const handleSendOtp = async () => {
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
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    setError('');
    try {
      await confirm.confirm(otp);
    } catch (e) {
      setError('Invalid OTP. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.logo}>🐄 eMooJI</Text>
      <Text style={s.tagline}>Field Intelligence</Text>

      {/* Google Button */}
      <TouchableOpacity style={s.googleBtn} onPress={handleGoogle} disabled={loading}>
        <Text style={s.googleText}>Continue with Google</Text>
      </TouchableOpacity>

      <Text style={s.or}>── or ──</Text>

      {/* Mode Toggle */}
      <View style={s.modeRow}>
        <TouchableOpacity onPress={() => setMode('email')}>
          <Text style={[s.modeTab, mode === 'email' && s.modeActive]}>Email</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode('phone')}>
          <Text style={[s.modeTab, mode === 'phone' && s.modeActive]}>Phone OTP</Text>
        </TouchableOpacity>
      </View>

      {/* Email Mode */}
      {mode === 'email' && (
        <>
          <TextInput style={s.input} placeholder="Email" placeholderTextColor="#555"
            value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={s.input} placeholder="Password" placeholderTextColor="#555"
            value={password} onChangeText={setPassword} secureTextEntry />
          <TouchableOpacity style={s.btn} onPress={handleEmail} disabled={loading}>
            {loading ? <ActivityIndicator color="#07090e" /> : <Text style={s.btnText}>{isRegister ? 'Create Account' : 'Sign In'}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsReg(!isRegister)}>
            <Text style={s.toggle}>{isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Phone Mode */}
      {mode === 'phone' && (
        <>
          {!confirm ? (
            <>
              <TextInput style={s.input} placeholder="+91 9876543210" placeholderTextColor="#555"
                value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <TouchableOpacity style={s.btn} onPress={handleSendOtp} disabled={loading}>
                {loading ? <ActivityIndicator color="#07090e" /> : <Text style={s.btnText}>Send OTP</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput style={s.input} placeholder="Enter OTP" placeholderTextColor="#555"
                value={otp} onChangeText={setOtp} keyboardType="number-pad" />
              <TouchableOpacity style={s.btn} onPress={handleVerifyOtp} disabled={loading}>
                {loading ? <ActivityIndicator color="#07090e" /> : <Text style={s.btnText}>Verify OTP</Text>}
              </TouchableOpacity>
            </>
          )}
          <div id="recaptcha-container" />
        </>
      )}

      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#07090e', justifyContent: 'center', alignItems: 'center', padding: 32 },
  logo:       { fontSize: 48, marginBottom: 4 },
  tagline:    { color: '#00e676', fontSize: 14, letterSpacing: 4, marginBottom: 40, textTransform: 'uppercase' },
  googleBtn:  { width: '100%', backgroundColor: '#ffffff', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 24 },
  googleText: { color: '#07090e', fontWeight: '600', fontSize: 15 },
  or:         { color: '#444', marginBottom: 20 },
  modeRow:    { flexDirection: 'row', gap: 24, marginBottom: 20 },
  modeTab:    { color: '#555', fontSize: 14 },
  modeActive: { color: '#00e676', borderBottomWidth: 1, borderBottomColor: '#00e676' },
  input:      { width: '100%', backgroundColor: '#111620', color: '#fff', borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 14 },
  btn:        { width: '100%', backgroundColor: '#00e676', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 12 },
  btnText:    { color: '#07090e', fontWeight: '700', fontSize: 15 },
  toggle:     { color: '#555', fontSize: 13, marginTop: 4 },
  error:      { color: '#ff4444', fontSize: 13, marginTop: 12, textAlign: 'center' },
});