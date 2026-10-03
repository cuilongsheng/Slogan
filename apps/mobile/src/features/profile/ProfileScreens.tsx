import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AuthPage, FormField, PrimaryButton, StepHeader } from '../../components/ui/AuthPage';
import { t } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../auth/context';
import { onboardingRoute } from '../auth/routes';
import { validAvatarUrl } from '../auth/session';
import { toProfileInput, useProfileDraft, validateBasic, type ProfileDraft } from './draft';

const interests = [
  { code: 'travel', label: 'travel', color: tokens.color.peach },
  { code: 'movies', label: 'movies', color: tokens.color.peach },
  { code: 'music', label: 'music', color: tokens.color.mint },
  { code: 'technology', label: 'technology', color: tokens.color.blueSoft },
  { code: 'sports', label: 'sports', color: tokens.color.goldSoft },
  { code: 'food', label: 'food', color: tokens.color.peach },
] as const;
const levels = [
  { value: 'A1_A2', label: 'A1–A2', color: tokens.color.blueSoft },
  { value: 'B1_B2', label: 'B1–B2', color: tokens.color.mint },
  { value: 'C1_C2', label: 'C1–C2', color: tokens.color.peach },
] as const;

function Choice({
  label,
  selected,
  onPress,
  color,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
      onPress={onPress}
      style={[
        styles.choice,
        { backgroundColor: selected ? tokens.color.coral : (color ?? tokens.color.purpleSoft) },
      ]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function BasicProfileScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { draft, setDraft } = useProfileDraft();
  const [error, setError] = useState<string | null>(null);
  const update = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const continueToPreferences = () => {
    const invalid = validateBasic(draft);
    if (invalid) {
      setError(t(invalid === 'birth' ? 'invalidBirth' : 'required'));
      return;
    }
    setError(null);
    router.push('/profile/preferences');
  };
  return (
    <AuthPage scroll>
      <StepHeader
        title={t('profileTitle')}
        description={t('profileDescription')}
        step={1}
        onBack={() => {
          void logout();
        }}
      />
      <View style={styles.avatarRow}>
        <View style={styles.avatar}>
          {validAvatarUrl(draft.avatarUrl) ? (
            <Image source={{ uri: draft.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.plus}>+</Text>
          )}
        </View>
        <View style={styles.avatarText}>
          <Text style={styles.avatarTitle}>{t('addAvatar')}</Text>
          <Text style={styles.avatarHelper}>
            {validAvatarUrl(draft.avatarUrl) ? t('avatarUnavailable') : t('avatarHelper')}
          </Text>
        </View>
      </View>
      {!validAvatarUrl(draft.avatarUrl) && <Text style={styles.notice}>{t('avatarMissing')}</Text>}
      <FormField
        label={t('displayName')}
        value={draft.displayName}
        onChangeText={(value) => update('displayName', value)}
        placeholder={t('displayName')}
        maxLength={40}
      />
      <Text style={styles.label}>{t('gender')}</Text>
      <View style={styles.row}>
        <Choice
          label={t('male')}
          selected={draft.genderCode === 'male'}
          onPress={() => update('genderCode', 'male')}
          color={tokens.color.mint}
        />
        <Choice
          label={t('female')}
          selected={draft.genderCode === 'female'}
          onPress={() => update('genderCode', 'female')}
        />
        <Choice
          label={t('privateGender')}
          selected={draft.genderCode === 'prefer_not_to_say'}
          onPress={() => update('genderCode', 'prefer_not_to_say')}
        />
      </View>
      <FormField
        label={t('city')}
        value={draft.city}
        onChangeText={(value) => update('city', value)}
        placeholder={t('cityPlaceholder')}
        maxLength={100}
      />
      <Text style={styles.label}>{t('birth')}</Text>
      <View style={styles.birthRow}>
        <View style={styles.birthField}>
          <FormField
            label=""
            value={draft.birthYear}
            onChangeText={(value) => update('birthYear', value)}
            placeholder={t('birthYear')}
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>
        <View style={styles.birthField}>
          <FormField
            label=""
            value={draft.birthMonth}
            onChangeText={(value) => update('birthMonth', value)}
            placeholder={t('birthMonth')}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
      </View>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <View style={styles.action}>
        <PrimaryButton
          label={t('continue')}
          onPress={continueToPreferences}
          testID="basic-continue"
        />
      </View>
    </AuthPage>
  );
}

export function PreferencesScreen() {
  const router = useRouter();
  const { draft, setDraft } = useProfileDraft();
  const { putProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggleInterest = (code: string) =>
    setDraft((current) => ({
      ...current,
      interestCodes: current.interestCodes.includes(code)
        ? current.interestCodes.filter((item) => item !== code)
        : [...current.interestCodes, code],
    }));
  const save = async () => {
    if (!validAvatarUrl(draft.avatarUrl)) {
      setError(t('avatarMissing'));
      return;
    }
    const body = toProfileInput(draft);
    if (!body) {
      setError(t('required'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const me = await putProfile(body);
      router.replace(onboardingRoute(me.onboardingState));
    } catch {
      setError(t('profileFailed'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <AuthPage scroll>
      <StepHeader
        title={t('preferencesTitle')}
        description={t('preferencesDescription')}
        step={2}
        onBack={() => router.back()}
      />
      <Text style={[styles.label, styles.firstLabel]}>{t('interests')}</Text>
      <View style={styles.grid}>
        {interests.map((item) => (
          <Choice
            key={item.code}
            testID={`interest-${item.code}`}
            label={t(item.label)}
            selected={draft.interestCodes.includes(item.code)}
            onPress={() => toggleInterest(item.code)}
            color={item.color}
          />
        ))}
      </View>
      <Text style={styles.hint}>{t('interestHint')}</Text>
      <Text style={[styles.label, styles.levelLabel]}>{t('level')}</Text>
      <View style={styles.grid}>
        {levels.map((item) => (
          <Choice
            key={item.value}
            testID={`level-${item.value}`}
            label={item.label}
            selected={draft.cefrLevel === item.value}
            onPress={() => setDraft((current) => ({ ...current, cefrLevel: item.value }))}
            color={item.color}
          />
        ))}
      </View>
      <View style={styles.levelNote}>
        <Text style={styles.levelNoteText}>{t('levelNote')}</Text>
      </View>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <View style={styles.action}>
        <PrimaryButton
          label={saving ? t('saving') : t('finish')}
          disabled={saving || !validAvatarUrl(draft.avatarUrl)}
          onPress={() => {
            void save();
          }}
          testID="profile-submit"
        />
      </View>
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 2 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: tokens.color.peach,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 72, height: 72 },
  plus: { color: tokens.color.coral, fontSize: 44, fontWeight: '300' },
  avatarText: { marginLeft: 16, flex: 1 },
  avatarTitle: { color: tokens.color.foreground, fontSize: 15, fontWeight: '700' },
  avatarHelper: { color: tokens.color.muted, fontSize: 12, marginTop: 3 },
  notice: { color: tokens.color.error, fontSize: 13, marginTop: 10 },
  label: {
    color: tokens.color.foreground,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', gap: 12 },
  choice: {
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  choiceText: { color: tokens.color.foreground, fontSize: 13, fontWeight: '600' },
  choiceSelected: { color: '#FFFFFF' },
  birthRow: { flexDirection: 'row', gap: 14 },
  birthField: { flex: 1 },
  action: { marginTop: 30, marginBottom: 12 },
  error: { color: tokens.color.error, fontSize: 14, marginTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  firstLabel: { marginTop: 24, lineHeight: 28, marginBottom: 12, fontSize: 15, fontWeight: '700' },
  hint: { color: tokens.color.muted, marginTop: 14, fontSize: 13 },
  levelLabel: { marginTop: 48, lineHeight: 27, marginBottom: 15, fontSize: 15, fontWeight: '700' },
  levelNote: {
    marginTop: 30,
    borderRadius: 18,
    padding: 16,
    backgroundColor: tokens.color.purpleSoft,
  },
  levelNoteText: { color: tokens.color.foreground, fontSize: 13, lineHeight: 20 },
});
