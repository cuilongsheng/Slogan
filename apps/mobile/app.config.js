const base = require('./app.json').expo;

module.exports = () => {
  const versionCode = Number(process.env.SLOGAN_ANDROID_VERSION_CODE || '1');
  if (!Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode > 2100000000) {
    throw new Error('Invalid Android versionCode');
  }
  const releaseCommit = process.env.SLOGAN_RELEASE_COMMIT;
  if (releaseCommit && !/^[a-f0-9]{40}$/.test(releaseCommit))
    throw new Error('Invalid release commit');
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const iosUrlScheme = iosClientId?.match(/^([^.]+)\.apps\.googleusercontent\.com$/)?.[1];

  return {
    ...base,
    version: process.env.SLOGAN_ANDROID_VERSION_NAME || base.version,
    extra: {
      ...base.extra,
      ...(releaseCommit
        ? { release: { commit: releaseCommit, apiOrigin: process.env.EXPO_PUBLIC_API_BASE_URL } }
        : {}),
    },
    ios: {
      bundleIdentifier: 'com.slogan.mobile',
      ...(process.env.EXPO_APPLE_TEAM_ID ? { appleTeamId: process.env.EXPO_APPLE_TEAM_ID } : {}),
    },
    android: {
      package: 'com.slogan.mobile',
      versionCode,
      softwareKeyboardLayoutMode: 'resize',
      permissions: ['android.permission.RECORD_AUDIO'],
      icon: '../../assets/brand/android-icon.png',
      adaptiveIcon: {
        foregroundImage: '../../assets/brand/android-adaptive-foreground.png',
        backgroundColor: '#FFFFFF',
      },
    },
    plugins: [
      [
        '@sentry/react-native/expo',
        {
          organization: process.env.SENTRY_ORG || '',
          project: process.env.SENTRY_PROJECT || '',
          useNativeInit: false,
          experimental_android: {
            enableAndroidGradlePlugin: process.env.EXPO_PUBLIC_OBSERVABILITY_ENABLED === 'true',
            includeProguardMapping: true,
            autoUploadProguardMapping: true,
            uploadNativeSymbols: false,
            autoUploadNativeSymbols: false,
            includeNativeSources: false,
            includeSourceContext: false,
          },
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
      'expo-font',
      [
        'expo-image-picker',
        {
          photosPermission: 'Choose a profile picture for your Slogan account.',
          cameraPermission: false,
          microphonePermission: 'Allow Slogan to use your microphone in voice rooms.',
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
