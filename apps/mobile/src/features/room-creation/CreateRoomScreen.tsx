import { AppText as Text } from '../../components/ui/AppText';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Image, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { RoomAction, RoomHeader, RoomPage, roomPageStyles } from '../../components/ui/RoomPage';
import { t, tf } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import burstIcon from '../../../assets/icons/speech-burst.png';
import { useAuth } from '../auth';
import { CreateRoomError, RoomCreationApi } from './api';
import {
  initialRoomForm,
  roomLevelRanges,
  instantInput,
  scheduledInput,
  validateRoomForm,
  type RoomForm,
  type ValidationError,
} from './form';

const validationText: Record<
  Exclude<ValidationError, null>,
  | 'createRoomTopicInvalid'
  | 'createRoomPasswordInvalid'
  | 'createRoomDateInvalid'
  | 'createRoomTimeInvalid'
  | 'createRoomLevelInvalid'
> = {
  TOPIC: 'createRoomTopicInvalid',
  PASSWORD: 'createRoomPasswordInvalid',
  DATE: 'createRoomDateInvalid',
  TIME: 'createRoomTimeInvalid',
  LEVEL: 'createRoomLevelInvalid',
};
function Chip({
  label,
  selected,
  onPress,
  compact = false,
  soft = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
  soft?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        soft && styles.levelChip,
        compact && styles.compactChip,
        selected && styles.chipSelected,
      ]}
      onPress={onPress}
    >
      <Text
        style={[styles.chipText, soft && styles.levelChipText, selected && styles.chipTextSelected]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function CreateRoomScreen() {
  const router = useRouter();
  const { authorized } = useAuth();
  const api = useMemo(() => new RoomCreationApi(authorized), [authorized]);
  const [form, setForm] = useState<RoomForm>(initialRoomForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  function update(patch: Partial<RoomForm>) {
    setForm((current) => ({ ...current, ...patch }));
    setError('');
  }
  async function submit() {
    if (submitting.current) return;
    const invalid = validateRoomForm(form);
    if (invalid) {
      setError(t(validationText[invalid]));
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      if (form.mode === 'instant') {
        const room = await api.instant(instantInput(form));
        router.replace(`/rooms/${room.id}/session`);
      } else {
        const room = await api.scheduled(scheduledInput(form));
        router.replace(`/rooms/appointments/${room.id}`);
      }
    } catch (cause) {
      const code = cause instanceof CreateRoomError ? cause.code : '';
      setError(
        t(
          code === 'ROOM_SPEECH_UNAVAILABLE' || code === 'POST_ROOM_KEYWORDS_UNAVAILABLE'
            ? 'createRoomProcessingUnavailable'
            : code === 'ROOM_SPEECH_CONSENT_REQUIRED' ||
                code === 'POST_ROOM_KEYWORDS_CONSENT_REQUIRED'
              ? 'createRoomConsentRequired'
              : cause instanceof CreateRoomError && cause.uncertain
                ? 'createRoomUncertain'
                : 'createRoomFailed',
        ),
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <RoomPage ambient>
      <RoomHeader
        title={t('createRoomTitle')}
        style={{ minHeight: 54 }}
        onBack={() => router.back()}
      />
      <ScrollView
        style={roomPageStyles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>{t('createRoomSettings')}</Text>
        <View style={styles.topicCard}>
          <View style={styles.cardTop}>
            <Text style={styles.label}>{t('createRoomTopic')}</Text>
            <Image source={burstIcon} style={styles.burst} />
          </View>
          <TextInput
            accessibilityLabel={t('createRoomTopic')}
            placeholder={t('createRoomTopicPlaceholder')}
            placeholderTextColor="#9C98AB"
            value={form.topic}
            onChangeText={(topic) => update({ topic })}
            maxLength={120}
            style={styles.topicInput}
          />
          <View style={styles.levelRow}>
            <Text style={styles.helper}>{t('createRoomLevel')}</Text>
            <Text style={styles.levelValue}>
              {form.cefrLevelMin === form.cefrLevelMax
                ? form.cefrLevelMin
                : `${form.cefrLevelMin}–${form.cefrLevelMax}`}
            </Text>
          </View>
          <View style={styles.levelChoices}>
            {roomLevelRanges.map((range) => (
              <Chip
                key={range.min}
                soft
                label={range.label}
                selected={form.cefrLevelMin === range.min && form.cefrLevelMax === range.max}
                onPress={() =>
                  update({ cefrLevel: range.min, cefrLevelMin: range.min, cefrLevelMax: range.max })
                }
              />
            ))}
          </View>
        </View>
        <View style={styles.accessCard}>
          <Text style={[styles.label, styles.capacityLabel]}>{t('createRoomCapacity')}</Text>
          <View style={styles.chipRow}>
            {[2, 3, 4, 5, 6].map((capacity) => (
              <Chip
                key={capacity}
                label={tf('createRoomCapacityOption', { count: capacity })}
                selected={form.capacity === capacity}
                onPress={() => update({ capacity })}
              />
            ))}
          </View>
          <View style={styles.accessRow}>
            <Text style={styles.label}>{t('createRoomAccess')}</Text>
            <Chip
              label={t('createRoomOpen')}
              selected={!form.passwordEnabled}
              onPress={() => update({ passwordEnabled: false, password: '' })}
            />
            <Chip
              label={t('createRoomPassword')}
              selected={form.passwordEnabled}
              onPress={() => update({ passwordEnabled: true })}
            />
          </View>
          {form.passwordEnabled && (
            <TextInput
              accessibilityLabel={t('createRoomPassword')}
              placeholder={t('createRoomPasswordPlaceholder')}
              placeholderTextColor="#9C98AB"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              value={form.password}
              onChangeText={(password) =>
                update({ password: password.replace(/\D/g, '').slice(0, 4) })
              }
              style={styles.passwordInput}
            />
          )}
        </View>
        <View style={styles.scheduleCard}>
          <View style={styles.modeRow}>
            <Chip
              compact
              label={t('createRoomInstant')}
              selected={form.mode === 'instant'}
              onPress={() => update({ mode: 'instant' })}
            />
            <Chip
              compact
              label={t('createRoomScheduled')}
              selected={form.mode === 'scheduled'}
              onPress={() => update({ mode: 'scheduled' })}
            />
          </View>
          {form.mode === 'instant' ? (
            <Text style={styles.helper}>{t('createRoomInstantHint')}</Text>
          ) : (
            <>
              <View style={styles.dateRow}>
                <Text style={styles.helper}>{t('createRoomDate')}</Text>
                <TextInput
                  accessibilityLabel={t('createRoomDate')}
                  placeholder={t('createRoomDatePlaceholder')}
                  placeholderTextColor="#9C98AB"
                  value={form.date}
                  onChangeText={(date) => update({ date })}
                  style={styles.dateInput}
                />
              </View>
              <View style={styles.dateRow}>
                <Text style={styles.helper}>{t('createRoomTime')}</Text>
                <TextInput
                  accessibilityLabel={t('createRoomStartTime')}
                  value={form.startTime}
                  onChangeText={(startTime) => update({ startTime })}
                  style={styles.timeInput}
                />
                <Text>→</Text>
                <TextInput
                  accessibilityLabel={t('createRoomEndTime')}
                  value={form.endTime}
                  onChangeText={(endTime) => update({ endTime })}
                  style={styles.timeInput}
                />
              </View>
            </>
          )}
        </View>
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <View style={[roomPageStyles.footer, form.mode === 'scheduled' && styles.scheduledFooter]}>
        <RoomAction
          label={
            busy
              ? t('submitting')
              : t(form.mode === 'instant' ? 'createRoomOpenAction' : 'createRoomScheduleAction')
          }
          disabled={busy}
          onPress={() => void submit()}
        />
      </View>
    </RoomPage>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 145 },
  sectionTitle: {
    marginHorizontal: 20,
    marginTop: 13,
    marginBottom: 14,
    lineHeight: 26,
    color: tokens.color.foreground,
    fontSize: 17,
    fontWeight: '700',
  },
  topicCard: {
    marginHorizontal: 16,
    backgroundColor: tokens.color.purpleSoft,
    borderRadius: 24,
    padding: 14,
    paddingTop: 12,
    minHeight: 207,
  },
  cardTop: { flexDirection: 'row', gap: 6, alignItems: 'center', minHeight: 28 },
  burst: { width: 25, height: 25, marginLeft: 'auto' },
  label: { fontSize: 14, lineHeight: 24, fontWeight: '700', color: tokens.color.foreground },
  topicInput: {
    height: 56,
    marginTop: 18,
    fontFamily: 'NotoSansSC',
    backgroundColor: '#fff',
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    fontSize: 12,
    color: tokens.color.foreground,
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    paddingHorizontal: 1,
  },
  helper: { color: tokens.color.muted, fontSize: 12, lineHeight: 22 },
  levelChip: { flex: 1, minHeight: 44, backgroundColor: '#EEE8FF', borderColor: '#EEE8FF' },
  levelChipText: { color: tokens.color.purple },
  levelValue: {
    width: 64,
    color: tokens.color.purple,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 22,
  },
  levelChoices: { flexDirection: 'row', gap: 8, marginTop: 14 },
  accessCard: {
    marginHorizontal: 16,
    marginTop: 13,
    backgroundColor: tokens.color.blueSoft,
    borderRadius: 24,
    padding: 14,
    minHeight: 173,
  },
  capacityLabel: { marginTop: 13 },
  chipRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 11 },
  chip: {
    minWidth: 48,
    minHeight: 35,
    paddingHorizontal: 10,
    borderRadius: 30,
    backgroundColor: '#fff',
    borderColor: tokens.color.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactChip: { minHeight: 27 },
  chipSelected: { backgroundColor: tokens.color.purple, borderColor: tokens.color.purple },
  chipText: { color: tokens.color.muted, fontSize: 12 },
  chipTextSelected: { color: '#fff', fontWeight: '700' },
  accessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 13,
  },
  passwordInput: {
    height: 39,
    backgroundColor: '#fff',
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 8,
    paddingHorizontal: 12,
  },
  scheduleCard: {
    marginHorizontal: 16,
    marginTop: 13,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 12,
    borderRadius: 24,
    backgroundColor: tokens.color.peach,
    minHeight: 95,
  },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 0 },
  dateRow: {
    height: 43,
    backgroundColor: '#fff',
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: 11,
    marginTop: 7,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scheduledFooter: { bottom: 28 },
  dateInput: { flex: 1, textAlign: 'right', color: tokens.color.foreground, fontSize: 13 },
  timeInput: { width: 70, textAlign: 'center', color: tokens.color.foreground, fontSize: 13 },
  error: { color: tokens.color.error, marginHorizontal: 20, marginTop: 12, fontSize: 12 },
});
