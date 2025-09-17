const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable TypeScript support
config.resolver.sourceExts.push('ts', 'tsx');

module.exports = config;