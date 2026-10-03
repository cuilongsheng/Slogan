import { type ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  Platform,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { t } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import statusBarPreview from '../../../assets/icons/statusbar-v2.png';

export function AuthPage({ children, scroll = false }: { children: ReactNode; scroll?: boolean }) {
  const page = (
    <SafeAreaView
      style={[styles.safe, Platform.OS === 'web' && styles.webPage]}
      edges={['top', 'bottom']}
    >
      <StatusBar style="dark" />
      <View style={styles.ambient} />
      {Platform.OS === 'web' && (
        <>
          <Image
            accessibilityElementsHidden
            source={statusBarPreview}
            style={styles.previewStatusBar}
            resizeMode="contain"
          />
          <View pointerEvents="none" style={styles.homeIndicator} />
        </>
      )}
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
    </SafeAreaView>
  );
  return Platform.OS === 'web' ? <View style={styles.webCanvas}>{page}</View> : page;
}

export function PrimaryButton({
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
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'number-pad';
  maxLength?: number;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.color.muted}
        keyboardType={keyboardType}
        maxLength={maxLength}
        style={styles.field}
      />
    </View>
  );
}

export function StepHeader({
  title,
  description,
  step,
  onBack,
}: {
  title: string;
  description: string;
  step: 1 | 2;
  onBack?: () => void;
}) {
  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          onPress={onBack}
          style={styles.back}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text accessibilityRole="header" style={styles.headerTitle}>
          {title}
        </Text>
      </View>
      <Text style={styles.description}>{description}</Text>
      <Text style={styles.step}>{step === 1 ? t('stepOne') : t('stepTwo')}</Text>
      <View style={styles.track}>
        <View style={[styles.progress, { width: step === 1 ? '50%' : '100%' }]} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tokens.color.surface },
  webCanvas: { flex: 1, alignItems: 'center', backgroundColor: '#EFF4FC' },
  webPage: { flex: 1, width: '100%', maxWidth: 390, minHeight: 844, paddingTop: 48 },
  ambient: {
    position: 'absolute',
    top: -52,
    right: -66,
    width: 154,
    height: 154,
    borderRadius: 77,
    backgroundColor: tokens.color.ambientGold,
    opacity: 0.16,
  },
  previewStatusBar: { position: 'absolute', top: 14, left: 20, width: 350, height: 24 },
  homeIndicator: {
    position: 'absolute',
    bottom: 9,
    left: '50%',
    marginLeft: -55,
    width: 110,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.color.foreground,
    zIndex: 1,
  },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 22 },
  button: {
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: tokens.color.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.48 },
  fieldGroup: { marginTop: 16 },
  label: { color: tokens.color.foreground, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  field: {
    height: 54,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.panel,
    paddingHorizontal: 16,
    color: tokens.color.foreground,
    fontSize: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', height: 42 },
  back: { width: 38, height: 38, justifyContent: 'center' },
  backText: { color: tokens.color.foreground, fontSize: 34, lineHeight: 36 },
  headerTitle: { color: tokens.color.foreground, fontSize: 24, fontWeight: '700' },
  description: {
    marginTop: 12,
    minHeight: 42,
    color: tokens.color.muted,
    fontSize: 12,
    lineHeight: 22,
  },
  step: { color: tokens.color.purple, fontSize: 12, lineHeight: 24, fontWeight: '600' },
  track: { marginTop: 7, height: 4, borderRadius: 2, backgroundColor: tokens.color.border },
  progress: { height: 4, borderRadius: 2, backgroundColor: tokens.color.coral },
});
