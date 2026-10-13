import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Image,
  type ScrollView,
  type TextInput,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { AuthPage, FormField, PrimaryButton, StepHeader } from '../../components/ui/AuthPage';
import { selectAvatar } from './avatar';
import { t, useLanguage } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../auth/context';
import { onboardingRoute } from '../auth/routes';
import { SessionError, validAvatarUrl } from '../auth/session';
import {
  toProfileInput,
  useProfileDraft,
  validateBasic,
  validatePreferences,
  profileServerErrors,
  type ProfileDraft,
} from './draft';

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
  useLanguage();
  const router = useRouter();
  const { logout, authorized, state } = useAuth();
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const { draft, setDraft, serverErrors = {}, setServerErrors } = useProfileDraft();
  const [submitted, setSubmitted] = useState(false);
  const errors = { ...serverErrors, ...(submitted ? validateBasic(draft) : {}) };
  const scroll = useRef<ScrollView>(null);
  const name = useRef<TextInput>(null);
  const city = useRef<TextInput>(null);
  const year = useRef<TextInput>(null);
  const month = useRef<TextInput>(null);
  const confirmationY = useRef(0);
  useEffect(() => {
    if (serverErrors.displayName) name.current?.focus();
    else if (serverErrors.city) city.current?.focus();
    else if (serverErrors.birthYear) year.current?.focus();
    else if (serverErrors.birthMonth) month.current?.focus();
    else if (serverErrors.adultConfirmed)
      scroll.current?.scrollTo({ y: confirmationY.current, animated: true });
  }, [
    serverErrors.displayName,
    serverErrors.city,
    serverErrors.birthYear,
    serverErrors.birthMonth,
    serverErrors.adultConfirmed,
  ]);
  const update = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setServerErrors?.((current) => ({ ...current, [key]: undefined }));
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const continueToPreferences = () => {
    setSubmitted(true);
    const invalid = validateBasic(draft);
    if (Object.keys(invalid).length) {
      if (invalid.displayName) name.current?.focus();
      else if (invalid.city) city.current?.focus();
      else if (invalid.birthYear) year.current?.focus();
      else if (invalid.birthMonth) month.current?.focus();
      else scroll.current?.scrollTo({ y: confirmationY.current, animated: true });
      return;
    }
    router.push('/profile/preferences');
  };
  return (
    <AuthPage scroll scrollRef={scroll}>
      <StepHeader
        title={t(state.kind === 'signedIn' && state.me.profile ? 'editProfile' : 'profileTitle')}
        description={t('profileDescription')}
        step={1}
        onBack={() => {
          if (state.kind === 'signedIn' && state.me.profile) router.back();
          else void logout();
        }}
      />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('changeAvatar')}
        disabled={avatarBusy}
        style={styles.avatarRow}
        onPress={() => {
          setAvatarBusy(true);
          setAvatarError(false);
          void selectAvatar(authorized)
            .then((url) => {
              if (url) update('avatarUrl', url);
            })
            .catch(() => setAvatarError(true))
            .finally(() => setAvatarBusy(false));
        }}
      >
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
            {t(avatarBusy ? 'avatarUploading' : 'avatarHelper')}
          </Text>
        </View>
      </TouchableOpacity>
      {avatarError && (
        <Text accessibilityRole="alert" style={styles.notice}>
          {t('avatarUploadFailed')}
        </Text>
      )}
      {!validAvatarUrl(draft.avatarUrl) && <Text style={styles.notice}>{t('avatarMissing')}</Text>}
      <FormField
        label={`${t('displayName')} · ${t('requiredField')}`}
        inputRef={name}
        testID="profile-name"
        error={errors.displayName && t(errors.displayName)}
        value={draft.displayName}
        onChangeText={(value) => update('displayName', value)}
        placeholder={t('displayName')}
        maxLength={40}
      />
      <Text style={styles.label}>
        {t('gender')} · {t('optionalField')}
      </Text>
      <View style={styles.row}>
        <Choice
          label={t('male')}
          selected={draft.genderCode === 'male'}
          onPress={() => update('genderCode', draft.genderCode === 'male' ? '' : 'male')}
          color={tokens.color.mint}
        />
        <Choice
          label={t('female')}
          selected={draft.genderCode === 'female'}
          onPress={() => update('genderCode', draft.genderCode === 'female' ? '' : 'female')}
        />
        <Choice
          label={t('privateGender')}
          selected={draft.genderCode === 'prefer_not_to_say'}
          onPress={() =>
            update(
              'genderCode',
              draft.genderCode === 'prefer_not_to_say' ? '' : 'prefer_not_to_say',
            )
          }
        />
      </View>
      <FormField
        label={`${t('city')} · ${t('optionalField')}`}
        inputRef={city}
        error={errors.city && t(errors.city)}
        value={draft.city}
        onChangeText={(value) => update('city', value)}
        placeholder={t('cityPlaceholder')}
        maxLength={100}
      />
      <Text style={styles.label}>
        {t('birth')} · {t('optionalField')}
      </Text>
      <View style={styles.birthRow}>
        <View style={styles.birthField}>
          <FormField
            label={t('birthYear')}
            inputRef={year}
            error={errors.birthYear && t(errors.birthYear)}
            value={draft.birthYear}
            onChangeText={(value) => update('birthYear', value)}
            placeholder={t('birthYear')}
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>
        <View style={styles.birthField}>
          <FormField
            label={t('birthMonth')}
            inputRef={month}
            error={errors.birthMonth && t(errors.birthMonth)}
            value={draft.birthMonth}
            onChangeText={(value) => update('birthMonth', value)}
            placeholder={t('birthMonth')}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
      </View>
      <View
        onLayout={(event) => {
          confirmationY.current = event.nativeEvent.layout.y;
        }}
      >
        <TouchableOpacity
          accessibilityRole="checkbox"
          accessibilityState={{ checked: draft.adultConfirmed === true }}
          testID="adult-confirmation"
          onPress={() => update('adultConfirmed', !draft.adultConfirmed)}
          style={styles.confirmation}
        >
          <View style={[styles.checkbox, draft.adultConfirmed && styles.checkboxChecked]}>
            {draft.adultConfirmed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.confirmationText}>
            {t('adultConfirmation')} · {t('requiredField')}
          </Text>
        </TouchableOpacity>
        {errors.adultConfirmed && (
          <Text accessibilityRole="alert" style={styles.error}>
            {t(errors.adultConfirmed)}
          </Text>
        )}
      </View>
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
  useLanguage();
  const router = useRouter();
  const { draft, setDraft, serverErrors = {}, setServerErrors } = useProfileDraft();
  const { putProfile, state } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const interestsY = useRef(0);
  const levelsY = useRef(0);
  const errors = submitted ? { ...serverErrors, ...validatePreferences(draft) } : serverErrors;
  const toggleInterest = (code: string) =>
    setDraft((current) => ({
      ...current,
      interestCodes: current.interestCodes.includes(code)
        ? current.interestCodes.filter((item) => item !== code)
        : [...current.interestCodes, code],
    }));
  const save = async () => {
    setSubmitted(true);
    const invalid = validatePreferences(draft);
    const body = toProfileInput(draft);
    if (Object.keys(invalid).length || !body) {
      if (invalid.interestCodes)
        scroll.current?.scrollTo({ y: interestsY.current, animated: true });
      else if (invalid.cefrLevel) scroll.current?.scrollTo({ y: levelsY.current, animated: true });
      else {
        setError(t('profileFailed'));
        router.push('/profile/basic');
      }
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const me = await putProfile(body);
      if (state.kind === 'signedIn' && state.me.profile && me.onboardingState === 'ELIGIBLE') {
        router.dismissTo('/me');
      } else {
        router.replace(onboardingRoute(me.onboardingState));
      }
    } catch (failure) {
      const fields = failure instanceof SessionError ? profileServerErrors(failure.violations) : {};
      setServerErrors?.(fields);
      if (Object.keys(fields).length) {
        const firstStep = Object.keys(fields).some(
          (field) => !['interestCodes', 'cefrLevel'].includes(field),
        );
        setError(null);
        if (firstStep) {
          router.back();
          return;
        }
        scroll.current?.scrollTo({
          y: fields.interestCodes ? interestsY.current : levelsY.current,
          animated: true,
        });
      } else setError(t('profileFailed'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <AuthPage scroll scrollRef={scroll}>
      <StepHeader
        title={t('preferencesTitle')}
        description={t('preferencesDescription')}
        step={2}
        onBack={() => router.back()}
      />
      <Text
        onLayout={(event) => {
          interestsY.current = event.nativeEvent.layout.y;
        }}
        style={[styles.label, styles.firstLabel]}
      >
        {t('interests')} · {t('requiredField')}
      </Text>
      <View style={styles.grid}>
        {interests.map((item) => (
          <Choice
            key={item.code}
            testID={`interest-${item.code}`}
            label={t(item.label)}
            selected={draft.interestCodes.includes(item.code)}
            onPress={() => {
              setServerErrors?.((current) => ({ ...current, interestCodes: undefined }));
              toggleInterest(item.code);
            }}
            color={item.color}
          />
        ))}
      </View>
      <Text style={styles.hint}>{t('interestHint')}</Text>
      {errors.interestCodes && (
        <Text accessibilityRole="alert" style={styles.error}>
          {t(errors.interestCodes)}
        </Text>
      )}
      <Text
        onLayout={(event) => {
          levelsY.current = event.nativeEvent.layout.y;
        }}
        style={[styles.label, styles.levelLabel]}
      >
        {t('level')} · {t('requiredField')}
      </Text>
      <View style={styles.grid}>
        {levels.map((item) => (
          <Choice
            key={item.value}
            testID={`level-${item.value}`}
            label={item.label}
            selected={draft.cefrLevel === item.value}
            onPress={() => {
              setServerErrors?.((current) => ({ ...current, cefrLevel: undefined }));
              setDraft((current) => ({ ...current, cefrLevel: item.value }));
            }}
            color={item.color}
          />
        ))}
      </View>
      {errors.cefrLevel && (
        <Text accessibilityRole="alert" style={styles.error}>
          {t(errors.cefrLevel)}
        </Text>
      )}
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
          label={t(
            saving
              ? 'saving'
              : state.kind === 'signedIn' && state.me.profile
                ? 'saveProfile'
                : 'finish',
          )}
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
  confirmation: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { borderColor: tokens.color.purple, backgroundColor: tokens.color.purple },
  checkmark: { color: '#FFFFFF', fontSize: 16 },
  confirmationText: { flex: 1, fontSize: 13, lineHeight: 20, color: tokens.color.foreground },

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
