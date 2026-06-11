// src/context/ThemeContext.jsx
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkColors, LightColors } from '../constants/tokens';

export { DarkColors as Colors, LightColors, DarkColors } from '../constants/tokens';
export { Fonts, Radius, Spacing, NAV_HEIGHT, BOTTOM_NAV_HEIGHT, CHAT_WIDTH } from '../constants/tokens';

// ── Language options ──────────────────────────────────────────────────────
export const LANGUAGES = {
  en: { label: 'EN', name: 'English', jackdawLang: 'en' },
  de: { label: 'DE', name: 'Deutsch', jackdawLang: 'de' },
  es: { label: 'ES', name: 'Español', jackdawLang: 'es' },
};

// ── UI strings per language ────────────────────────────────────────────────
export const UI_STRINGS = {
  en: {
    welcome:        'Welcome to eMooJI.',
    welcomeSub:     'I connect to real satellite databases to answer questions about any field in Europe.',
    step1:          'Tap Polygon or Rectangle and draw over any field on the map',
    step2:          'Ask any question by typing or tapping the 🎤 mic button',
    placeholder:    'Ask about this field…',
    noField:        '🗺️ Draw a field on the map to begin…',
    noFieldBanner:  'Draw a field on the map to start asking questions',
    thinking:       'Thinking…',
    listening:      'Listening… speak your question',
    speaking:       'Speaking response…',
    fieldAnalysis:  'Field Analysis',
    analysis:       'Analysis',
    record:         'Record',
    stop:           'Stop',
    startSession:   'Start Session',
    endSession:     'End Session',
    newChat:        'New Chat',
    chatHistory:    'Chat History',
    myRecordings:   'My Recordings',
    signIn:         'Sign In',
    install:        'Install',
    connected:      'Connected',
    connecting:     'Connecting',
    error:          'Error',
    polygon:        'Polygon',
    rectangle:      'Rectangle',
    clear:          'Clear',
    sat:            'Sat',
    street:         'Street',
    drawFieldHint:  'Draw a field to begin',
    chatSubtitle:   'Draw any field · Ask in plain language or by voice · Real satellite data',
    clickDragRect:  'Click and drag to draw a rectangle',
    pointsReady:    'points — ready to finish',
    finishPolygon:  'Finish Polygon',
    undoPoint:      'Undo Point',
    cancel:         'Cancel',
  },
  de: {
    welcome:        'Willkommen bei eMooJI.',
    welcomeSub:     'Ich verbinde mit echten Satellitendatenbanken für Fragen zu jedem Feld in Europa.',
    step1:          'Tippe auf Polygon oder Rechteck und zeichne über ein Feld auf der Karte',
    step2:          'Stelle eine Frage per Texteingabe oder tippe auf das 🎤 Mikrofon',
    placeholder:    'Frage zu diesem Feld…',
    noField:        '🗺️ Zeichne ein Feld auf der Karte um zu beginnen…',
    noFieldBanner:  'Zeichne ein Feld auf der Karte um Fragen zu stellen',
    thinking:       'Nachdenken…',
    listening:      'Zuhören… spreche deine Frage',
    speaking:       'Antwort wird vorgelesen…',
    fieldAnalysis:  'Feldanalyse',
    analysis:       'Analyse',
    record:         'Aufnehmen',
    stop:           'Stopp',
    startSession:   'Sitzung starten',
    endSession:     'Sitzung beenden',
    newChat:        'Neuer Chat',
    chatHistory:    'Chat-Verlauf',
    myRecordings:   'Meine Aufnahmen',
    signIn:         'Anmelden',
    install:        'Installieren',
    connected:      'Verbunden',
    connecting:     'Verbinden…',
    error:          'Fehler',
    polygon:        'Polygon',
    rectangle:      'Rechteck',
    clear:          'Löschen',
    sat:            'Satellit',
    street:         'Straße',
    drawFieldHint:  'Feld zeichnen um zu beginnen',
    chatSubtitle:   'Feld zeichnen · Frage auf Deutsch · Echtzeit-Satellitendaten',
    clickDragRect:  'Klicken und ziehen um ein Rechteck zu zeichnen',
    pointsReady:    'Punkte — bereit zum Fertigstellen',
    finishPolygon:  'Polygon abschließen',
    undoPoint:      'Punkt rückgängig',
    cancel:         'Abbrechen',
  },
  es: {
    welcome:        'Bienvenido a eMooJI.',
    welcomeSub:     'Conecto con bases de datos satelitales reales para responder preguntas sobre cualquier campo en Europa.',
    step1:          'Toca Polígono o Rectángulo y dibuja sobre cualquier campo en el mapa',
    step2:          'Haz una pregunta escribiendo o tocando el botón 🎤 de micrófono',
    placeholder:    'Pregunta sobre este campo…',
    noField:        '🗺️ Dibuja un campo en el mapa para comenzar…',
    noFieldBanner:  'Dibuja un campo en el mapa para hacer preguntas',
    thinking:       'Pensando…',
    listening:      'Escuchando… habla tu pregunta',
    speaking:       'Leyendo respuesta…',
    fieldAnalysis:  'Análisis de campo',
    analysis:       'Análisis',
    record:         'Grabar',
    stop:           'Parar',
    startSession:   'Iniciar sesión',
    endSession:     'Finalizar sesión',
    newChat:        'Nueva conversación',
    chatHistory:    'Historial de chat',
    myRecordings:   'Mis grabaciones',
    signIn:         'Iniciar sesión',
    install:        'Instalar',
    connected:      'Conectado',
    connecting:     'Conectando…',
    error:          'Error',
    polygon:        'Polígono',
    rectangle:      'Rectángulo',
    clear:          'Borrar',
    sat:            'Satélite',
    street:         'Calle',
    drawFieldHint:  'Dibuja un campo para comenzar',
    chatSubtitle:   'Dibuja un campo · Pregunta en español · Datos satelitales reales',
    clickDragRect:  'Haz clic y arrastra para dibujar un rectángulo',
    pointsReady:    'puntos — listo para finalizar',
    finishPolygon:  'Finalizar polígono',
    undoPoint:      'Deshacer punto',
    cancel:         'Cancelar',
  },
};

// ── Font size scale ────────────────────────────────────────────────────────
export const FONT_SIZES = {
  small:  { label: 'S', body: 12, bubble: 12, heading: 13, mono: 9,  lineHeight: 18 },
  medium: { label: 'M', body: 14, bubble: 13, heading: 15, mono: 10, lineHeight: 20 },
  large:  { label: 'L', body: 16, bubble: 15, heading: 17, mono: 12, lineHeight: 24 },
};

const ThemeContext = createContext({
  isDark:        false,
  toggleTheme:   () => {},
  colors:        LightColors,
  fontSize:      'medium',
  fontScale:     FONT_SIZES.medium,
  setFontSize:   () => {},
  language:      'en',
  setLanguage:   () => {},
  strings:       UI_STRINGS.en,
});

const THEME_KEY    = 'emooji_theme';
const FONTSIZE_KEY = 'emooji_fontsize';
const LANG_KEY     = 'emooji_language';

export function ThemeProvider({ children }) {
  const [isDark,    setIsDark]    = useState(false);
  const [fontSize,  setFontSizeState] = useState('medium');
  const [language,  setLanguageState] = useState('en');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(val => {
      if (val !== null) setIsDark(val === 'dark');
    }).catch(() => {});

    AsyncStorage.getItem(FONTSIZE_KEY).then(val => {
      if (val && FONT_SIZES[val]) setFontSizeState(val);
    }).catch(() => {});

    AsyncStorage.getItem(LANG_KEY).then(val => {
      if (val && LANGUAGES[val]) setLanguageState(val);
    }).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light').catch(() => {});
      return next;
    });
  }, []);

  const setLanguage = useCallback((lang) => {
    if (!LANGUAGES[lang]) return;
    setLanguageState(lang);
    AsyncStorage.setItem(LANG_KEY, lang).catch(() => {});
  }, []);

  const setFontSize = useCallback((size) => {
    if (!FONT_SIZES[size]) return;
    setFontSizeState(size);
    AsyncStorage.setItem(FONTSIZE_KEY, size).catch(() => {});
  }, []);

  const colors    = isDark ? DarkColors : LightColors;
  const fontScale = FONT_SIZES[fontSize];
  const strings   = UI_STRINGS[language];

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors, fontSize, fontScale, setFontSize, language, setLanguage, strings }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);