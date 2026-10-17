import { largeAction } from '../../components/ui/largeAction';
import defaultAvatar from '../../../assets/profile/default-avatar.png';
import vocabularyIcon from '../../../assets/profile/me-vocabulary.png';
import restrictionsIcon from '../../../assets/profile/me-restrictions.png';
import profileIcon from '../../../assets/profile/me-profile.png';
import reportsIcon from '../../../assets/profile/me-reports.png';
import updatesIcon from '../../../assets/profile/me-updates.png';
import chevronIcon from '../../../assets/profile/me-chevron.png';
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
    <RoomPage direct ambient hidePreviewIndicator compactStatus>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.settings}>
          <View style={styles.profile}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('profileSettings')}
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
            </TouchableOpacity>
            <View style={styles.identity}>
              <Text
                onPress={editProfile}
                style={styles.profileName}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {state.kind === 'signedIn' ? state.me.profile?.displayName : ''}
              </Text>
              <View accessibilityLabel={t('languageSetting')} style={styles.languages}>
                {(['zh', 'en'] as const).map((value) => (
                  <TouchableOpacity
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: language === value }}
                    hitSlop={{ top: 14, bottom: 14, left: 0, right: 0 }}
                    onPress={() => {
                      setLanguageError(false);
                      void setLanguage(value).catch(() => setLanguageError(true));
                    }}
                    style={styles.language}
                  >
                    <Text style={styles.languageText}>
                      {value === 'zh' ? '\u4e2d\u6587' : 'English'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
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
            <Image source={vocabularyIcon} style={styles.itemIcon} />
            <View style={styles.itemBody}>
              <Text style={styles.title}>{t('meVocabulary')}</Text>
              <Image source={chevronIcon} style={styles.chevron} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.item}
            onPress={() => router.push('/me/restrictions')}
          >
            <Image source={restrictionsIcon} style={styles.itemIcon} />
            <View style={styles.itemBody}>
              <Text style={styles.title}>{t('meRestrictions')}</Text>
              <Image source={chevronIcon} style={styles.chevron} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={styles.item} onPress={editProfile}>
            <Image source={profileIcon} style={styles.itemIcon} />
            <View style={styles.itemBody}>
              <Text style={styles.title}>{t('editProfile')}</Text>
              <Image source={chevronIcon} style={styles.chevron} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.item}
            onPress={() => router.push('/me/reports')}
          >
            <Image
              source={reportsIcon}
              style={styles.itemIcon}
              tintColor={tokens.profile.color.menuInk}
            />
            <View style={[styles.itemBody, !updates.supported && styles.lastItemBody]}>
              <Text style={styles.title}>{t('myReports')}</Text>
              <Image source={chevronIcon} style={styles.chevron} />
            </View>
          </TouchableOpacity>
          {updates.supported && (
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.item}
              disabled={updates.checking}
              onPress={updates.check}
            >
              <Image
                source={updatesIcon}
                style={styles.itemIcon}
                tintColor={tokens.profile.color.menuInk}
              />
              <View style={[styles.itemBody, styles.lastItemBody]}>
                <Text style={styles.title}>
                  {t(updates.checking ? 'updateChecking' : 'updateCheck')}
                </Text>
                <Image source={chevronIcon} style={styles.chevron} />
              </View>
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
          <Text style={styles.exitText}>{t(busy ? 'submitting' : 'logout')}</Text>
        </TouchableOpacity>
      </View>
      <BottomNavigation active={3} unreadMessages={unread.count} />
    </RoomPage>
  );
}
const styles = StyleSheet.create({
  settings: {
    paddingHorizontal: 14,
    paddingTop: 41,
    paddingBottom: 20,
    backgroundColor: tokens.color.panel,
  },
  profile: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  identity: { flex: 1, minWidth: 0 },
  photo: { width: 52, height: 52, borderRadius: 26, marginTop: 4 },
  profileName: {
    minWidth: 0,
    fontSize: 18,
    lineHeight: 27,
    color: tokens.color.headingInk,
    fontWeight: '700',
  },
  languages: { flexDirection: 'row', gap: 8, marginTop: 11 },
  language: {
    height: 24,
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: tokens.profile.color.optionSurface,
  },
  languageText: { color: tokens.color.purple, fontSize: 12, fontWeight: '500', lineHeight: 20 },
  list: {
    marginTop: 10,
    paddingLeft: 19,
    paddingRight: 20,
    paddingTop: 5,
    paddingBottom: 8,
    backgroundColor: tokens.color.panel,
  },
  logoutArea: { paddingHorizontal: 24, paddingBottom: 16 },
  item: {
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
    minHeight: 43,
    borderBottomWidth: 1,
    borderColor: tokens.color.divider,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  lastItemBody: { borderBottomWidth: 0 },
  itemIcon: { width: 24, height: 24 },
  chevron: { width: 24, height: 24, marginLeft: 'auto' },
  title: {
    flexShrink: 1,
    color: tokens.profile.color.menuInk,
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
  exitText: {
    color: tokens.color.panel,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
});
