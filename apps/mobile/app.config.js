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
    android: {
      package: 'com.slogan.mobile',
      softwareKeyboardLayoutMode: 'resize',
      icon: '../../assets/brand/android-icon.png',
      adaptiveIcon: {
        foregroundImage: '../../assets/brand/android-adaptive-foreground.png',
        backgroundColor: '#FFFFFF',
      },
    },
    plugins: [
      'expo-font',
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
