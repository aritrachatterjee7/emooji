// src/components/ConsentScreens.jsx
// Two-step onboarding flow:
// Screen 1 — Validation Data Consent (mandatory)
// Screen 2 — Location Permission (optional)

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  ScrollView, Animated,
} from 'react-native';
import { Fonts, Radius, Spacing } from '../constants/tokens';

// ── Translations ────────────────────────────────────────────────────────────
const T = {
  en: {
    // Consent screen
    consentTitle:    'Help Improve eMooJI',
    consentSubtitle: 'As part of the PoliRuralPlus project, your interactions with the chatbot will be stored and analysed to improve the platform\'s usability, reliability, and usefulness for farmers and land managers.',
    consentDataLabel:'Data collected may include:',
    consentData: [
      'Chat conversations & questions asked',
      'Language selected',
      'Device information',
      'Feature usage statistics',
    ],
    consentGDPR:     'Personal information will be anonymised and processed according to GDPR requirements. To use eMooJI, you must agree to the collection of validation data.',
    consentCheck:    'I have read and agree to the Privacy Notice',
    consentAgree:    'Agree and Continue',
    consentExit:     'Exit Application',
    declineTitle:    'Consent Required',
    declineBody:     'eMooJI is currently being evaluated as part of a European research project. Participation requires consent for the collection of anonymised validation data. Without consent, the application cannot be used.',
    declineBack:     'Go Back',
    // Location screen
    locationTitle:   'Location Access',
    locationOptional:'Optional',
    locationBody:    'eMooJI can use your location to automatically centre the map and make it easier to explore nearby areas. You can continue without sharing your location.',
    locationAllow:   'Allow Location',
    locationSkip:    'Continue Without Location',
  },
  de: {
    consentTitle:    'eMooJI verbessern',
    consentSubtitle: 'Im Rahmen des PoliRuralPlus-Projekts werden Ihre Interaktionen mit dem Chatbot gespeichert und analysiert, um die Benutzerfreundlichkeit, Zuverlässigkeit und Nützlichkeit der Plattform für Landwirte und Landmanager zu verbessern.',
    consentDataLabel:'Gesammelte Daten können umfassen:',
    consentData: [
      'Chat-Gespräche und gestellte Fragen',
      'Ausgewählte Sprache',
      'Geräteinformationen',
      'Statistiken zur Funktionsnutzung',
    ],
    consentGDPR:     'Persönliche Daten werden anonymisiert und gemäß den DSGVO-Anforderungen verarbeitet. Um eMooJI zu nutzen, müssen Sie der Erhebung von Validierungsdaten zustimmen.',
    consentCheck:    'Ich habe die Datenschutzerklärung gelesen und stimme ihr zu',
    consentAgree:    'Zustimmen und fortfahren',
    consentExit:     'Anwendung beenden',
    declineTitle:    'Zustimmung erforderlich',
    declineBody:     'eMooJI wird derzeit im Rahmen eines europäischen Forschungsprojekts evaluiert. Die Teilnahme erfordert die Zustimmung zur Erhebung anonymisierter Validierungsdaten. Ohne Zustimmung kann die Anwendung nicht genutzt werden.',
    declineBack:     'Zurück',
    locationTitle:   'Standortzugriff',
    locationOptional:'Optional',
    locationBody:    'eMooJI kann Ihren Standort verwenden, um die Karte automatisch zu zentrieren und die Erkundung nahegelegener Gebiete zu erleichtern. Sie können ohne Standortfreigabe fortfahren.',
    locationAllow:   'Standort erlauben',
    locationSkip:    'Ohne Standort fortfahren',
  },
  es: {
    consentTitle:    'Ayuda a mejorar eMooJI',
    consentSubtitle: 'Como parte del proyecto PoliRuralPlus, tus interacciones con el chatbot se almacenarán y analizarán para mejorar la usabilidad, fiabilidad y utilidad de la plataforma para agricultores y gestores del territorio.',
    consentDataLabel:'Los datos recopilados pueden incluir:',
    consentData: [
      'Conversaciones de chat y preguntas formuladas',
      'Idioma seleccionado',
      'Información del dispositivo',
      'Estadísticas de uso de funciones',
    ],
    consentGDPR:     'La información personal será anonimizada y procesada de acuerdo con los requisitos del RGPD. Para usar eMooJI, debes aceptar la recopilación de datos de validación.',
    consentCheck:    'He leído y acepto el Aviso de Privacidad',
    consentAgree:    'Aceptar y continuar',
    consentExit:     'Salir de la aplicación',
    declineTitle:    'Se requiere consentimiento',
    declineBody:     'eMooJI está siendo evaluado como parte de un proyecto de investigación europeo. La participación requiere consentimiento para la recopilación de datos de validación anonimizados. Sin consentimiento, la aplicación no puede utilizarse.',
    declineBack:     'Volver',
    locationTitle:   'Acceso a ubicación',
    locationOptional:'Opcional',
    locationBody:    'eMooJI puede usar tu ubicación para centrar automáticamente el mapa y facilitar la exploración de áreas cercanas. Puedes continuar sin compartir tu ubicación.',
    locationAllow:   'Permitir ubicación',
    locationSkip:    'Continuar sin ubicación',
  },
};

const CONSENT_KEY  = 'emooji_consent_given';
const LANG_KEY     = 'emooji_language';

function getStoredLang() {
  try { return localStorage.getItem(LANG_KEY) || 'en'; } catch { return 'en'; }
}

export function hasConsent() {
  try { return localStorage.getItem(CONSENT_KEY) === 'true'; } catch { return false; }
}

// ── Screen 1: Consent ───────────────────────────────────────────────────────
function ConsentScreen({ onAgree, onExit, colors, lang, setLang }) {
  const t          = T[lang] || T.en;
  const [checked,  setChecked]  = useState(false);
  const [declined, setDeclined] = useState(false);

  if (declined) {
    return (
      <View style={[s.overlay, { backgroundColor: colors.bgBase }]}>
        <View style={[s.card, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
          <Text style={s.declineEmoji}>⚠️</Text>
          <Text style={[s.declineTitle, { color: colors.textPrimary }]}>{t.declineTitle}</Text>
          <Text style={[s.declineBody, { color: colors.textMuted }]}>{t.declineBody}</Text>
          <TouchableOpacity
            style={[s.btnOutline, { borderColor: colors.green }]}
            onPress={() => setDeclined(false)}
          >
            <Text style={[s.btnOutlineText, { color: colors.green }]}>{t.declineBack}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.overlay, { backgroundColor: colors.bgBase }]}>
      {/* Language picker */}
      <View style={s.langRow}>
        {['en', 'de', 'es'].map(l => (
          <TouchableOpacity
            key={l}
            style={[s.langBtn, { borderColor: colors.borderMid, backgroundColor: colors.bgElevated },
              lang === l && { backgroundColor: colors.green, borderColor: colors.green }]}
            onPress={() => { setLang(l); try { localStorage.setItem(LANG_KEY, l); } catch {} }}
          >
            <Text style={[s.langBtnText, { color: lang === l ? '#07090e' : colors.textMuted }]}>
              {l.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <Text style={s.logoEmoji}>🐄</Text>
        <Text style={[s.logo, { color: colors.textPrimary }]}>
          eMoo<Text style={{ color: colors.green }}>JI</Text>
        </Text>
        <Text style={[s.logoSub, { color: colors.textMuted }]}>FIELD INTELLIGENCE · POLIRURALPLUS</Text>

        {/* Card */}
        <View style={[s.card, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
          <Text style={[s.cardTitle, { color: colors.textPrimary }]}>{t.consentTitle}</Text>
          <Text style={[s.cardBody, { color: colors.textMuted }]}>{t.consentSubtitle}</Text>

          <Text style={[s.dataLabel, { color: colors.textSecondary }]}>{t.consentDataLabel}</Text>
          {t.consentData.map((item, i) => (
            <View key={i} style={s.dataRow}>
              <Text style={[s.dataDot, { color: colors.green }]}>·</Text>
              <Text style={[s.dataItem, { color: colors.textMuted }]}>{item}</Text>
            </View>
          ))}

          <View style={[s.gdprBox, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
            <Text style={[s.gdprText, { color: colors.textMuted }]}>{t.consentGDPR}</Text>
          </View>

          {/* Checkbox */}
          <TouchableOpacity
            style={s.checkRow}
            onPress={() => setChecked(v => !v)}
            activeOpacity={0.8}
          >
            <View style={[s.checkbox,
              { borderColor: checked ? colors.green : colors.borderMid, backgroundColor: checked ? colors.green : 'transparent' }
            ]}>
              {checked && <Text style={s.checkmark}>✓</Text>}
            </View>
            <Text style={[s.checkLabel, { color: colors.textPrimary }]}>{t.consentCheck}</Text>
          </TouchableOpacity>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={[s.btnPrimary, { backgroundColor: checked ? colors.green : colors.bgOverlay }]}
          onPress={() => { if (checked) onAgree(); }}
          activeOpacity={checked ? 0.85 : 1}
          disabled={!checked}
        >
          <Text style={[s.btnPrimaryText, { color: checked ? '#07090e' : colors.textMuted }]}>
            {t.consentAgree}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.btnGhost]}
          onPress={() => setDeclined(true)}
        >
          <Text style={[s.btnGhostText, { color: colors.textMuted }]}>{t.consentExit}</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ── Screen 2: Location ──────────────────────────────────────────────────────
function LocationScreen({ onAllow, onSkip, colors, lang }) {
  const t = T[lang] || T.en;
  return (
    <View style={[s.overlay, { backgroundColor: colors.bgBase }]}>
      <View style={[s.card, s.locationCard, { backgroundColor: colors.bgSurface, borderColor: colors.border }]}>
        <Text style={s.locationEmoji}>📍</Text>
        <View style={s.locationTitleRow}>
          <Text style={[s.cardTitle, { color: colors.textPrimary }]}>{t.locationTitle}</Text>
          <View style={[s.optionalBadge, { backgroundColor: colors.bgElevated, borderColor: colors.borderMid }]}>
            <Text style={[s.optionalText, { color: colors.textMuted }]}>{t.locationOptional}</Text>
          </View>
        </View>
        <Text style={[s.cardBody, { color: colors.textMuted }]}>{t.locationBody}</Text>

        <TouchableOpacity
          style={[s.btnPrimary, { backgroundColor: colors.green, marginTop: 8 }]}
          onPress={onAllow}
        >
          <Text style={[s.btnPrimaryText, { color: '#07090e' }]}>{t.locationAllow}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.btnOutline, { borderColor: colors.borderMid }]}
          onPress={onSkip}
        >
          <Text style={[s.btnOutlineText, { color: colors.textMuted }]}>{t.locationSkip}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main export ─────────────────────────────────────────────────────────────
export function ConsentFlow({ colors, onComplete }) {
  const [lang,   setLang]   = useState(getStoredLang());
  const [screen, setScreen] = useState('consent'); // 'consent' | 'location' | 'done'

  const handleConsentAgree = () => {
    try { localStorage.setItem(CONSENT_KEY, 'true'); } catch {}
    setScreen('location');
  };

  const handleLocationAllow = () => {
    if (Platform.OS === 'web' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => onComplete(lang),
        () => onComplete(lang),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      onComplete(lang);
    }
  };

  const handleLocationSkip = () => {
    onComplete(lang);
  };

  if (screen === 'consent') {
    return (
      <ConsentScreen
        onAgree={handleConsentAgree}
        onExit={() => {
          if (Platform.OS === 'web') window.close();
        }}
        colors={colors}
        lang={lang}
        setLang={setLang}
      />
    );
  }

  if (screen === 'location') {
    return (
      <LocationScreen
        onAllow={handleLocationAllow}
        onSkip={handleLocationSkip}
        colors={colors}
        lang={lang}
      />
    );
  }

  return null;
}

// ── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll:        { width: '100%' },
  scrollContent: { alignItems: 'center', padding: Spacing.lg, paddingTop: 48 },

  logoEmoji: { fontSize: 48, marginBottom: 4 },
  logo:      { fontFamily: Fonts.displayBold, fontSize: 28, letterSpacing: -1 },
  logoSub:   { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 1.5, marginBottom: 24, marginTop: 2 },

  langRow: {
    position: 'absolute',
    top: 20, right: 20,
    flexDirection: 'row',
    gap: 6,
    zIndex: 10,
  },
  langBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full, borderWidth: 1,
  },
  langBtnText: { fontFamily: Fonts.displayBold, fontSize: 10 },

  card: {
    width: '100%', maxWidth: 460,
    borderRadius: 20, borderWidth: 1,
    padding: 24, gap: 12,
    ...Platform.select({
      web: { boxShadow: '0 8px 40px rgba(0,0,0,0.2)' },
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 12 },
    }),
  },
  cardTitle: { fontFamily: Fonts.displayBold, fontSize: 19 },
  cardBody:  { fontFamily: Fonts.body, fontSize: 13, lineHeight: 21 },

  dataLabel: { fontFamily: Fonts.bodyMedium, fontSize: 12, marginTop: 4 },
  dataRow:   { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  dataDot:   { fontFamily: Fonts.mono, fontSize: 16, lineHeight: 20 },
  dataItem:  { fontFamily: Fonts.body, fontSize: 12, lineHeight: 20, flex: 1 },

  gdprBox: {
    borderRadius: Radius.md, borderWidth: 1,
    padding: 12, marginTop: 4,
  },
  gdprText: { fontFamily: Fonts.mono, fontSize: 10, lineHeight: 16 },

  checkRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 4 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  checkmark:  { color: '#07090e', fontSize: 12, fontFamily: Fonts.displayBold },
  checkLabel: { fontFamily: Fonts.body, fontSize: 13, lineHeight: 20, flex: 1 },

  btnPrimary: {
    width: '100%', maxWidth: 460,
    borderRadius: Radius.lg, padding: 15,
    alignItems: 'center', marginTop: 12,
  },
  btnPrimaryText: { fontFamily: Fonts.displayBold, fontSize: 15 },

  btnOutline: {
    width: '100%', maxWidth: 460,
    borderRadius: Radius.lg, padding: 14,
    alignItems: 'center', borderWidth: 1, marginTop: 8,
  },
  btnOutlineText: { fontFamily: Fonts.displayBold, fontSize: 14 },

  btnGhost: {
    width: '100%', maxWidth: 460,
    padding: 14, alignItems: 'center', marginTop: 4,
  },
  btnGhostText: { fontFamily: Fonts.body, fontSize: 13 },

  // Decline screen
  declineEmoji: { fontSize: 40, textAlign: 'center' },
  declineTitle: { fontFamily: Fonts.displayBold, fontSize: 18, textAlign: 'center' },
  declineBody:  { fontFamily: Fonts.body, fontSize: 13, lineHeight: 21, textAlign: 'center' },

  // Location screen
  locationCard:    { maxWidth: 400 },
  locationEmoji:   { fontSize: 44, textAlign: 'center' },
  locationTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionalBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
  optionalText:    { fontFamily: Fonts.mono, fontSize: 10 },
});