// src/constants/tokens.js
// Shared design tokens — used in both StyleSheet (native) and inline web styles

export const Colors = {
  bgBase:      '#080c10',
  bgSurface:   '#0d1520',
  bgElevated:  '#111d2e',
  bgOverlay:   '#162035',
  bgGlass:     'rgba(13,21,32,0.88)',

  green:       '#0bdb6e',
  greenMid:    '#08b558',
  greenDeep:   '#066b35',
  greenGlow:   'rgba(11,219,110,0.18)',
  greenTrace:  'rgba(11,219,110,0.06)',
  greenBorder: 'rgba(11,219,110,0.25)',

  textPrimary:   '#e8f0fe',
  textSecondary: '#7a9abf',
  textMuted:     '#3a5070',
  textDisabled:  '#243040',

  border:        'rgba(255,255,255,0.07)',
  borderMid:     'rgba(255,255,255,0.12)',
  borderStrong:  'rgba(255,255,255,0.18)',

  danger:  '#f04f4f',
  warning: '#f0a040',
  info:    '#4090f0',

  bubbleUser: '#1a3a6e',
  bubbleAsst: '#0d1520',
};

export const Fonts = {
  display: 'Syne_700Bold',
  displayBold: 'Syne_800ExtraBold',
  mono:    'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
  body:    'Syne_400Regular',
  bodyMedium: 'Syne_500Medium',
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 22,
  full: 9999,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const NAV_HEIGHT        = 54;
export const BOTTOM_NAV_HEIGHT = 62;
export const CHAT_WIDTH        = 420; // desktop only
