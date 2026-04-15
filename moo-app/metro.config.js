const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Support Leaflet CSS imports on web
config.resolver.assetExts.push('css');

// Ensure platform-specific files resolve correctly
// .native.jsx wins on iOS/Android, .web.jsx wins on web
config.resolver.sourceExts = [
  'native.jsx', 'native.js', 'native.ts', 'native.tsx',
  ...config.resolver.sourceExts,
];

module.exports = config;
