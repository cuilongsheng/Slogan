import { AppText as Text } from '../../components/ui/AppText';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { RoomHeader, RoomPage } from '../../components/ui/RoomPage';
import { t } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../auth';

export function MeScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <RoomPage ambient>
      <RoomHeader title={t('meTitle')} onBack={() => router.back()} />
      <View style={styles.list}>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.item}
          onPress={() => router.push('/me/restrictions')}
        >
          <Text style={styles.title}>{t('meRestrictions')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.item}
          onPress={() => router.push('/me/vocabulary')}
        >
          <Text style={styles.title}>{t('meVocabulary')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={busy}
          style={[styles.item, styles.exit]}
          onPress={() => {
            if (busy) return;
            setBusy(true);
            void logout().finally(() => setBusy(false));
          }}
        >
          <Text style={[styles.title, styles.exitText]}>{t(busy ? 'submitting' : 'logout')}</Text>
        </TouchableOpacity>
      </View>
    </RoomPage>
  );
}
const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingTop: 31, gap: 16 },
  item: {
    height: 72,
    backgroundColor: tokens.color.purpleSoft,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#5538D8', fontSize: 14, fontWeight: '500' },
  exit: { height: 56, borderRadius: 14, backgroundColor: tokens.color.purple },
  exitText: { color: '#FFFFFF' },
});
