import { StyleSheet, Text, View } from 'react-native';

import { AuthPage, PrimaryButton } from '../../components/ui/AuthPage';
import { t } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../auth/context';

export function AgeRestrictedScreen() {
  const { logout } = useAuth();
  return (
    <AuthPage>
      <View style={styles.ageIcon}>
        <Text style={styles.ageMark}>18</Text>
      </View>
      <Text accessibilityRole="header" style={styles.ageTitle}>
        {t('ageTitle')}
      </Text>
      <Text style={styles.ageExplanation}>{t('ageExplanation')}</Text>
      <View style={styles.info}>
        <Text style={styles.infoTitle}>{t('ageInfoTitle')}</Text>
        <Text style={styles.infoDescription}>{t('ageInfoDescription')}</Text>
      </View>
      <View style={styles.action}>
        <PrimaryButton
          label={t('understood')}
          onPress={() => {
            void logout();
          }}
        />
      </View>
    </AuthPage>
  );
}

export function EligibleScreen() {
  const { logout } = useAuth();
  return (
    <AuthPage>
      <View style={styles.ready}>
        <Text accessibilityRole="header" style={styles.ageTitle}>
          {t('eligibleTitle')}
        </Text>
        <Text style={styles.ageExplanation}>{t('eligibleDescription')}</Text>
        <View style={styles.readyAction}>
          <PrimaryButton
            label={t('logout')}
            onPress={() => {
              void logout();
            }}
          />
        </View>
      </View>
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  ageIcon: {
    alignSelf: 'center',
    marginTop: 122,
    width: 116,
    height: 116,
    borderRadius: 28,
    backgroundColor: tokens.color.peach,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ageMark: { color: tokens.color.foreground, fontSize: 35, fontWeight: '700' },
  ageTitle: {
    marginTop: 45,
    textAlign: 'center',
    color: tokens.color.foreground,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 43,
  },
  ageExplanation: {
    marginTop: 14,
    minHeight: 54,
    textAlign: 'center',
    color: tokens.color.muted,
    fontSize: 14,
    lineHeight: 23,
  },
  info: {
    marginTop: 45,
    minHeight: 104,
    padding: 18,
    borderRadius: 24,
    backgroundColor: tokens.color.peach,
  },
  infoTitle: { color: tokens.color.foreground, fontSize: 15, fontWeight: '700' },
  infoDescription: { color: tokens.color.muted, fontSize: 13, lineHeight: 20, marginTop: 8 },
  action: { marginTop: 64 },
  ready: { marginTop: 150 },
  readyAction: { marginTop: 40 },
});
