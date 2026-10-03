import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { RoomHeader, RoomPage } from '../../components/ui/RoomPage';
import { t } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { RoomConsentPanel } from './RoomConsentPanel';

export function RoomPrivacyScreen() {
  const router = useRouter();
  return <RoomPage ambient>
    <RoomHeader title={t('roomPrivacyTitle')} subtitle={t('roomPrivacySubtitle')} onBack={() => router.back()} />
    <ScrollView contentContainerStyle={styles.scroll}>
      <RoomConsentPanel safety keywords allowRevoke />
      <Text style={styles.note}>{t('roomPrivacyHistoryNote')}</Text>
    </ScrollView>
  </RoomPage>;
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 90 },
  note: { marginHorizontal: 20, marginTop: 20, color: tokens.color.muted, fontSize: 12, lineHeight: 19 },
});
