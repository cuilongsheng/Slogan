import type { ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import backIcon from '../../../assets/icons/back.png';

export function RoomPage({
  children,
  ambient = false,
}: {
  children: ReactNode;
  ambient?: boolean;
}) {
  const content = (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.safe, Platform.OS === 'web' && styles.webFrame]}
    >
      <StatusBar style="dark" />
      {ambient && <View pointerEvents="none" style={styles.ambient} />}
      {Platform.OS === 'web' && (
        <View style={styles.previewStatus} accessibilityElementsHidden>
          <Text style={styles.previewTime}>9:41</Text>
          <Text style={styles.previewSystem}>●●● 100%</Text>
        </View>
      )}
      {children}
      {Platform.OS === 'web' && <View pointerEvents="none" style={styles.homeIndicator} />}
    </SafeAreaView>
  );
  return Platform.OS === 'web' ? <View style={styles.webCanvas}>{content}</View> : content;
}

export function RoomHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack?: () => void;
}) {
  return (
    <View style={styles.header}>
      {onBack && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          onPress={onBack}
          style={styles.back}
        >
          <Image source={backIcon} style={styles.backIcon} />
        </TouchableOpacity>
      )}
      <View style={[styles.heading, !onBack && styles.headingFull]}>
        <Text accessibilityRole="header" style={[styles.title, !onBack && styles.listTitle]}>
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

export function RoomAction({
  label,
  onPress,
  disabled = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={[styles.action, disabled && styles.actionDisabled]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

export const roomPageStyles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 126 },
  sectionTitle: {
    marginHorizontal: 20,
    color: tokens.color.foreground,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 27,
  },
  footer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: Platform.OS === 'web' ? 44 : 22,
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.color.surface, overflow: 'hidden' },
  webCanvas: { flex: 1, alignItems: 'center', backgroundColor: '#EFF4FC' },
  webFrame: { width: '100%', maxWidth: 390, minHeight: 844 },
  previewStatus: {
    height: 49,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 10,
  },
  previewTime: { color: tokens.color.foreground, fontSize: 14, fontWeight: '500' },
  previewSystem: { color: tokens.color.foreground, fontSize: 12, fontWeight: '500' },
  homeIndicator: {
    position: 'absolute',
    width: 100,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.color.foreground,
    bottom: 6,
    alignSelf: 'center',
  },
  ambient: {
    position: 'absolute',
    top: -52,
    right: -66,
    width: 154,
    height: 154,
    borderRadius: 77,
    backgroundColor: tokens.color.peach,
  },
  header: { flexDirection: 'row', minHeight: 76, paddingHorizontal: 16 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon: { width: 24, height: 24 },
  heading: { marginLeft: 8, flex: 1 },
  headingFull: { marginLeft: 4 },
  title: { color: tokens.color.foreground, fontSize: 28, fontWeight: '700', lineHeight: 42 },
  listTitle: { fontSize: 24, lineHeight: 34 },
  subtitle: { color: tokens.color.muted, fontSize: 12, lineHeight: 21 },
  action: {
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.color.purple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionDisabled: { opacity: 0.45 },
  actionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
