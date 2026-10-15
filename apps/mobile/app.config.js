const base = require('./app.json').expo;

module.exports = () => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const iosUrlScheme = iosClientId?.match(/^([^.]+)\.apps\.googleusercontent\.com$/)?.[1];

  return {
    ...base,
    ios: {
      bundleIdentifier: 'com.slogan.mobile',
      ...(process.env.EXPO_APPLE_TEAM_ID ? { appleTeamId: process.env.EXPO_APPLE_TEAM_ID } : {}),
    },
    android: { package: 'com.slogan.mobile' },
    plugins: [
      [
        '@sentry/react-native/expo',
        {
          organization: process.env.SENTRY_ORG || '',
          project: process.env.SENTRY_PROJECT || '',
          useNativeInit: false,
          disableAutoUpload: process.env.EXPO_PUBLIC_OBSERVABILITY_ENABLED !== 'true',
        },
      ],
      [
        './plugins/with-observability.cjs',
        {
          enabled: process.env.EXPO_PUBLIC_OBSERVABILITY_ENABLED === 'true',
          dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
          environment: process.env.EXPO_PUBLIC_OBSERVABILITY_ENVIRONMENT,
          release: process.env.EXPO_PUBLIC_OBSERVABILITY_RELEASE,
          build: process.env.EXPO_PUBLIC_OBSERVABILITY_BUILD,
        },
      ],
      ...base.plugins,
      ['expo-build-properties', { ios: { enableSceneSupport: true } }],
      ...(iosUrlScheme
        ? [
            [
              '@react-native-google-signin/google-signin',
              { iosUrlScheme: `com.googleusercontent.apps.${iosUrlScheme}` },
            ],
          ]
        : []),
    ],
  };
};
