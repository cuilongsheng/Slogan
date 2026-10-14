import { largeAction } from '../../components/ui/largeAction';
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
import { useAppUpdates } from '../app-updates';

export function MeScreen() {
  const language = useLanguage();
  const router = useRouter();
  const unread = useMessageUnread();
  const updates = useAppUpdates();
  const { logout, state } = useAuth();
  const [languageError, setLanguageError] = useState(false);
  const { resetFromProfile } = useProfileDraft();
  const editProfile = () => {
    resetFromProfile?.();
    router.push('/profile/basic');
  };
  const [busy, setBusy] = useState(false);
  return (
    <RoomPage direct ambient hidePreviewIndicator>
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
            <Text style={styles.profileName} numberOfLines={1} ellipsizeMode="tail">
              {state.kind === 'signedIn' ? state.me.profile?.displayName : ''}
            </Text>
          </TouchableOpacity>
          <View accessibilityLabel={t('languageSetting')} style={styles.languages}>
            {(['zh', 'en'] as const).map((value) => (
              <TouchableOpacity
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: language === value }}
                hitSlop={{ top: 9, bottom: 9, left: 0, right: 0 }}
                onPress={() => {
                  setLanguageError(false);
                  void setLanguage(value).catch(() => setLanguageError(true));
                }}
                style={[styles.language, { width: value === 'zh' ? 102 : 112 }]}
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
            onPress={() => router.push('/me/vocabulary')}
          >
            <Text style={styles.title}>{t('meVocabulary')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.item}
            onPress={() => router.push('/me/restrictions')}
          >
            <Text style={styles.title}>{t('meRestrictions')}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={styles.item} onPress={editProfile}>
            <Text style={styles.title}>{t('editProfile')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.item}
            onPress={() => router.push('/me/reports')}
          >
            <Text style={styles.title}>{t('myReports')}</Text>
          </TouchableOpacity>
          {updates.supported && (
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.item}
              disabled={updates.checking}
              onPress={updates.check}
            >
              <Text style={styles.title}>
                {t(updates.checking ? 'updateChecking' : 'updateCheck')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      <View style={styles.logoutArea}>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={busy}
          style={styles.exit}
          onPress={() => {
            if (busy) return;
            setBusy(true);
            void logout().finally(() => setBusy(false));
          }}
        >
          <Text style={[styles.title, styles.exitText]}>{t(busy ? 'submitting' : 'logout')}</Text>
        </TouchableOpacity>
      </View>
      <BottomNavigation active={3} unreadMessages={unread.count} />
    </RoomPage>
  );
}
const styles = StyleSheet.create({
  settings: { paddingHorizontal: 20, gap: 14 },
  profile: { flexDirection: 'row', alignItems: 'flex-end', paddingLeft: 3, gap: 8 },
  photo: { width: 52, height: 52, borderRadius: 26 },
  profileName: {
    flex: 1,
    minWidth: 0,
    marginBottom: 6,
    fontSize: 18,
    lineHeight: 27,
    color: tokens.color.headingInk,
    fontWeight: '700',
  },
  languages: { height: 42, flexDirection: 'row', gap: 8 },
  language: {
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: tokens.color.purpleSoft,
  },
  languageText: { color: tokens.color.purple, fontSize: 14, fontWeight: '500', lineHeight: 20 },
  list: {
    marginHorizontal: 20,
    borderTopWidth: 1,
    borderColor: tokens.color.divider,
  },
  logoutArea: { paddingHorizontal: 24, paddingBottom: 16 },
  item: {
    minHeight: 44,
    borderBottomWidth: 1,
    borderColor: tokens.color.divider,
    alignItems: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  title: {
    color: tokens.discovery.color.tabAccent,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  exit: {
    backgroundColor: tokens.color.purple,
    alignItems: 'center',
    justifyContent: 'center',
    ...largeAction,
    borderRadius: 14,
  },
  exitText: { color: tokens.color.panel },
});
