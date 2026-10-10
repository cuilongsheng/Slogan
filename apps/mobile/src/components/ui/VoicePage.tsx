import { AppText as Text } from './AppText';
import type { ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function VoicePage({ children }: { children: ReactNode }) {
  const page = (
    <SafeAreaView
      testID="voice-room-direct-entry-v2"
      edges={['top', 'bottom']}
      style={[styles.safe, Platform.OS === 'web' && styles.webFrame]}
    >
      <StatusBar style="light" />
      {Platform.OS === 'web' && (
        <View style={styles.previewStatus} accessibilityElementsHidden>
          <Text style={styles.previewText}>9:41</Text>
          <Text style={[styles.previewText, styles.previewSystem]}>●●● 100%</Text>
        </View>
      )}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined
        }
      >
        {children}
      </KeyboardAvoidingView>
      {Platform.OS === 'web' && <View pointerEvents="none" style={styles.homeIndicator} />}
    </SafeAreaView>
  );
  return Platform.OS === 'web' ? <View style={styles.canvas}>{page}</View> : page;
}

const styles = StyleSheet.create({
  canvas: { flex: 1, alignItems: 'center', backgroundColor: '#EFF4FC' },
  safe: { flex: 1, backgroundColor: '#2A2149', overflow: 'hidden' },
  webFrame: { width: '100%', maxWidth: 390 },
  previewStatus: {
    height: 44,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 13,
  },
  previewText: { color: '#fff', fontSize: 14, fontWeight: '500', lineHeight: 20 },
  previewSystem: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  homeIndicator: {
    position: 'absolute',
    width: 100,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
    bottom: 6,
    alignSelf: 'center',
  },
});
