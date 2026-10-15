const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { createHash } = require('node:crypto');
const config = getSentryExpoConfig(__dirname);
// Expo's transform cache must not retain a previous monitoring flag/release.
const publicEnvironment = Object.entries(process.env)
  .filter(([key]) => key.startsWith('EXPO_PUBLIC_'))
  .sort(([left], [right]) => left.localeCompare(right));
config.cacheVersion = `${config.cacheVersion ?? ''}:${createHash('sha256').update(JSON.stringify(publicEnvironment)).digest('hex')}`;
module.exports = config;
