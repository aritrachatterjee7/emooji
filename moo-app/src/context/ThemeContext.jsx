// src/context/ThemeContext.jsx
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkColors, LightColors } from '../constants/tokens';

export { DarkColors as Colors, LightColors, DarkColors } from '../constants/tokens';
export { Fonts, Radius, Spacing, NAV_HEIGHT, BOTTOM_NAV_HEIGHT, CHAT_WIDTH } from '../constants/tokens';

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
});

const THEME_KEY    = 'emooji_theme';
const FONTSIZE_KEY = 'emooji_fontsize';

export function ThemeProvider({ children }) {
  const [isDark,    setIsDark]    = useState(false);
  const [fontSize,  setFontSizeState] = useState('medium');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(val => {
      if (val !== null) setIsDark(val === 'dark');
    }).catch(() => {});

    AsyncStorage.getItem(FONTSIZE_KEY).then(val => {
      if (val && FONT_SIZES[val]) setFontSizeState(val);
    }).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light').catch(() => {});
      return next;
    });
  }, []);

  const setFontSize = useCallback((size) => {
    if (!FONT_SIZES[size]) return;
    setFontSizeState(size);
    AsyncStorage.setItem(FONTSIZE_KEY, size).catch(() => {});
  }, []);

  const colors    = isDark ? DarkColors : LightColors;
  const fontScale = FONT_SIZES[fontSize];

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors, fontSize, fontScale, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);