// src/context/ThemeContext.jsx
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkColors, LightColors } from '../constants/tokens';

// ── Default value ensures useTheme() never returns null ─────────────────────
// This prevents crashes during Expo static rendering when the provider
// hasn't mounted yet but components are already being evaluated.
const ThemeContext = createContext({
  isDark:      true,
  toggleTheme: () => {},
  colors:      DarkColors,
});

const STORAGE_KEY = 'emooji_theme';

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true); // default dark until loaded

  // ── Load saved preference on mount ────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(val => {
      if (val !== null) setIsDark(val === 'dark');
    }).catch(() => {
      // if storage fails, stay on default dark
    });
  }, []);

  // ── Toggle and persist ─────────────────────────────────────────
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