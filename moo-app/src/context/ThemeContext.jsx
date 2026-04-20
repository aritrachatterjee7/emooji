// src/context/ThemeContext.jsx
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkColors, LightColors } from '../constants/tokens';

// ── Re-export tokens so all existing component imports keep working ──────────
export { DarkColors as Colors, LightColors, DarkColors } from '../constants/tokens';
export { Fonts, Radius, Spacing, NAV_HEIGHT, BOTTOM_NAV_HEIGHT, CHAT_WIDTH } from '../constants/tokens';

// ── Default value ensures useTheme() never returns null ──────────────────────
const ThemeContext = createContext({
  isDark:      false,
  toggleTheme: () => {},
  colors:      LightColors,
});

const STORAGE_KEY = 'emooji_theme';

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false); // default light

  // Load saved preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(val => {
      if (val !== null) setIsDark(val === 'dark');
    }).catch(() => {});
  }, []);

  // Toggle and persist
  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light').catch(() => {});
      return next;
    });
  }, []);

  const colors = isDark ? DarkColors : LightColors;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);