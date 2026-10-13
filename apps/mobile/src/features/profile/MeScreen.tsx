import defaultAvatar from '../../../assets/profile/default-avatar.png';
import { AppText as Text } from '../../components/ui/AppText';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { BottomNavigation } from '../../components/ui/BottomNavigation';
import { useMessageUnread } from '../direct';
import { RoomPage } from '../../components/ui/RoomPage';
import { setLanguage, t, useLanguage } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { useProfileDraft } from './draft';
import { useAuth } from '../auth';

export function MeScreen() {
  const language = useLanguage();
  const router = useRouter();
  const unread = useMessageUnread();
  const { logout, state } = useAuth();
  const [languageError, setLanguageError] = useState(false);
  const { resetFromProfile } = useProfileDraft();
  const editProfile = () => {
    resetFromProfile?.();
    router.push('/profile/basic');
  };
  const [busy, setBusy] = useState(false);
  return (
    <RoomPage direct hidePreviewIndicator>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.settings}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('profileSettings')}
            style={styles.profile}
            onPress={editProfile}
          >
            <Image
              source={
                state.kind === 'signedIn' && state.me.profile?.avatarUrl
                  ? { uri: state.me.profile.avatarUrl }
                  : defaultAvatar
              }
              style={styles.photo}
            />
            <Text style={styles.profileName}>
              {state.kind === 'signedIn' ? state.me.profile?.displayName : ''}
            </Text>
          </TouchableOpacity>
          <View accessibilityLabel={t('languageSetting')} style={styles.languages}>
            {(['zh', 'en'] as const).map((value) => (
              <TouchableOpacity
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: language === value }}
                onPress={() => {
                  setLanguageError(false);
                  void setLanguage(value).catch(() => setLanguageError(true));
                }}
                style={[
                  styles.language,
                  { width: value === 'zh' ? 102 : 112 },
                  language === value && styles.languageSelected,
                ]}
              >
                <Text style={styles.languageText}>
                  {value === 'zh' ? '\u4e2d\u6587' : 'English'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {languageError && (
          <Text
            accessibilityRole="alert"
            style={{ color: tokens.color.error, textAlign: 'center', fontSize: 12 }}
          >
            {t('languageSaveFailed')}
          </Text>
        )}
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
          <TouchableOpacity accessibilityRole="button" style={styles.item} onPress={editProfile}>
            <Text style={styles.title}>{t('editProfile')}</Text>
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
      </ScrollView>
      <BottomNavigation active={3} unreadMessages={unread.count} />
    </RoomPage>
  );
}
const styles = StyleSheet.create({
  settings: { paddingHorizontal: 20, paddingTop: 24, gap: 20 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: 52, height: 52, borderRadius: 26 },
  profileName: { fontSize: 18, color: tokens.color.foreground, fontWeight: '700' },
  languages: { flexDirection: 'row', gap: 8 },
  language: {
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: tokens.color.purpleSoft,
  },
  languageSelected: { backgroundColor: tokens.color.purpleSoft },
  languageText: { color: tokens.color.purple, fontSize: 14, fontWeight: '500', lineHeight: 20 },
  list: { paddingHorizontal: 20, paddingTop: 24, gap: 16 },
  item: {
    height: 72,
    backgroundColor: tokens.color.purpleSoft,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#5538D8', fontSize: 14, fontWeight: '500' },
  exit: { height: 56, borderRadius: 28, backgroundColor: tokens.color.purple },
  exitText: { color: '#FFFFFF' },
});
