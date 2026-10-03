import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { RoomHeader, RoomPage } from '../../components/ui/RoomPage';
import { t } from '../../services/locale';
import { tokens } from '../../styles/tokens';

export function MeScreen() {
  const router = useRouter();
  return <RoomPage ambient>
    <RoomHeader title={t('meTitle')} subtitle={t('meSubtitle')} onBack={() => router.back()} />
    <View style={styles.list}>
      <TouchableOpacity accessibilityRole="button" style={styles.item} onPress={() => router.push('/me/restrictions')}>
        <View><Text style={styles.title}>{t('safetyTitle')}</Text><Text style={styles.subtitle}>{t('meSafetyDescription')}</Text></View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" style={styles.item} onPress={() => router.push('/me/history')}>
        <View><Text style={styles.title}>{t('historyTitle')}</Text><Text style={styles.subtitle}>{t('meHistoryDescription')}</Text></View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" style={styles.item} onPress={() => router.push('/me/vocabulary')}>
        <View><Text style={styles.title}>{t('vocabularyTitle')}</Text><Text style={styles.subtitle}>{t('meVocabularyDescription')}</Text></View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" style={styles.item} onPress={() => router.push('/me/social')}>
        <View><Text style={styles.title}>{t('socialTitle')}</Text><Text style={styles.subtitle}>{t('meSocialDescription')}</Text></View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" style={styles.item} onPress={() => router.push('/me/room-processing')}>
        <View><Text style={styles.title}>{t('roomPrivacyTitle')}</Text><Text style={styles.subtitle}>{t('roomPrivacySubtitle')}</Text></View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    </View>
  </RoomPage>;
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  item: { minHeight: 84, backgroundColor: tokens.color.panel, borderColor: tokens.color.border, borderWidth: 1, borderRadius: tokens.radius.lg, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: tokens.color.foreground, fontSize: 17, fontWeight: '700' },
  subtitle: { color: tokens.color.muted, fontSize: 12, marginTop: 5 },
  chevron: { color: tokens.color.purple, fontSize: 28 },
});
