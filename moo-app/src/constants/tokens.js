// src/constants/tokens.js

// ─── Dark theme colors (default) ──────────────────────────────────────────────
export const DarkColors = {
  bgBase:      '#07090e',
  bgSurface:   '#0b1018',
  bgElevated:  '#0f1822',
  bgOverlay:   '#141f2e',
  bgGlass:     'rgba(11,16,24,0.92)',

  green:       '#00e676',
  greenMid:    '#00c462',
  greenDeep:   '#00954a',
  greenGlow:   'rgba(0,230,118,0.15)',
  greenTrace:  'rgba(0,230,118,0.07)',
  greenBorder: 'rgba(0,230,118,0.22)',

  textPrimary:   '#eef2ff',
  textSecondary: '#6e8caa',
  textMuted:     '#334455',
  textDisabled:  '#1e2d3d',

  border:        'rgba(255,255,255,0.055)',
  borderMid:     'rgba(255,255,255,0.10)',
  borderStrong:  'rgba(255,255,255,0.16)',

  danger:  '#ff4f4f',
  warning: '#ffaa33',
  info:    '#3d9eff',

  bubbleUser: '#0f2244',
  bubbleAsst: '#0b1018',
};

// ─── Light theme colors ────────────────────────────────────────────────────────
export const LightColors = {
  bgBase:      '#f0f4f8',
  bgSurface:   '#ffffff',
  bgElevated:  '#e8edf4',
  bgOverlay:   '#dde4ee',
  bgGlass:     'rgba(240,244,248,0.92)',

  green:       '#00954a',
  greenMid:    '#00c462',
  greenDeep:   '#007a3d',
  greenGlow:   'rgba(0,149,74,0.12)',
  greenTrace:  'rgba(0,149,74,0.06)',
  greenBorder: 'rgba(0,149,74,0.25)',

  textPrimary:   '#0a0e17',
  textSecondary: '#3a5068',
  textMuted:     '#7a90a8',
  textDisabled:  '#b0bec8',

  border:        'rgba(0,0,0,0.07)',
  borderMid:     'rgba(0,0,0,0.12)',
  borderStrong:  'rgba(0,0,0,0.18)',

  danger:  '#e53535',
  warning: '#d97706',
  info:    '#1d7de0',

  bubbleUser: '#dbeafe',
  bubbleAsst: '#ffffff',
};

// ─── Default export (dark) — kept for any legacy imports ──────────────────────
// Prefer using useTheme().colors in components going forward.
export const Colors = DarkColors;

// ─── Typography ───────────────────────────────────────────────────────────────
// Expo font keys — must match names loaded in _layout.jsx
export const Fonts = {
  display:      'Outfit_700Bold',
  displayBold:  'Outfit_700Bold',
  body:         'Outfit_400Regular',
  bodyMedium:   'Outfit_500Medium',
  mono:         'JetBrainsMono_400Regular',
  monoMedium:   'JetBrainsMono_500Medium',
};

// ─── Border radius ────────────────────────────────────────────────────────────
export const Radius = {
  sm:   5,
  md:   9,
  lg:   14,
  xl:   20,
  full: 9999,
};

// ─── Spacing ──────────────────────────────────────────────────────────────────
export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
};

// ─── Layout constants ─────────────────────────────────────────────────────────
export const NAV_HEIGHT        = 52;
export const BOTTOM_NAV_HEIGHT = 58;
export const CHAT_WIDTH        = 400;