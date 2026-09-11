import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { tokens } from '../src/styles/tokens';

export default function BootstrapRoute() {
  return (
    <View style={styles.screen}>
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>ENGINEERING BOOTSTRAP</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Slogan Mobile is ready
        </Text>
        <Text style={styles.body}>
          This route verifies Expo Router, native styles, bundle, and tests. It is not a voice room.
        </Text>
      </View>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.space.lg,
    backgroundColor: tokens.color.surface,
  },
  panel: {
    width: '100%',
    maxWidth: 520,
    padding: tokens.space.xl,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.panel,
  },
  eyebrow: {
    color: tokens.color.muted,
    fontSize: tokens.font.sm,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  title: {
    marginTop: tokens.space.sm,
    color: tokens.color.foreground,
    fontSize: tokens.font.xl,
    fontWeight: '700',
  },
  body: {
    marginTop: tokens.space.md,
    color: tokens.color.muted,
    fontSize: tokens.font.md,
    lineHeight: 24,
  },
});
