import { AppText as Text } from '../../components/ui/AppText';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { RoomAction, RoomHeader, RoomPage, roomPageStyles } from '../../components/ui/RoomPage';
import { t, tf, useLanguage } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import burstIcon from '../../../assets/icons/speech-burst.png';
import { useAuth } from '../auth';
import { useJoinDraft } from '../room-discovery/join';
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
  style,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
  soft?: boolean;
  style?: StyleProp<ViewStyle>;
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
        style,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.chipText,
          soft && styles.levelChipText,
          selected && styles.chipTextSelected,
          compact && {
            fontSize: selected ? 11 : 12,
            lineHeight: 16,
            fontWeight: selected ? '700' : '500',
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function CreateRoomScreen() {
  const language = useLanguage();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const instantEnd = new Date(now + 2 * 60 * 60_000).toLocaleTimeString(
    language === 'zh' ? 'zh-CN' : 'en-GB',
    { hour: '2-digit', minute: '2-digit', hour12: false },
  );
  const router = useRouter();
  const { authorized } = useAuth();
  const joinDraft = useJoinDraft();
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
    const entryStartedAt = performance.now();
    try {
      if (form.mode === 'instant') {
        const room = await api.instant(instantInput(form));
        if (room.currentMembership)
          joinDraft.created(room, room.currentMembership.userId, entryStartedAt);
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
        style={{ minHeight: 40 }}
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
            <Text style={[styles.label, styles.levelLabel]}>{t('createRoomLevel')}</Text>
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
                style={styles.capacityChip}
                label={tf('createRoomCapacityOption', { count: capacity })}
                selected={form.capacity === capacity}
                onPress={() => update({ capacity })}
              />
            ))}
          </View>
          <View style={styles.accessRow}>
            <Text style={[styles.label, styles.accessLabel]}>{t('createRoomAccess')}</Text>
            <View style={styles.accessChoices}>
              <Chip
                style={[styles.accessChip, { width: language === 'zh' ? 83 : 110 }]}
                label={t('createRoomOpen')}
                selected={!form.passwordEnabled}
                onPress={() => update({ passwordEnabled: false, password: '' })}
              />
              <Chip
                style={[styles.accessChip, { width: language === 'zh' ? 89 : 133 }]}
                label={t('createRoomPassword')}
                selected={form.passwordEnabled}
                onPress={() => update({ passwordEnabled: true })}
              />
            </View>
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
            <View style={styles.instantDetails}>
              <Text style={styles.helper}>{t('createRoomInstantHint')}</Text>
              <Text style={styles.instantTime}>
                {tf('createRoomInstantTiming', { time: instantEnd })}
              </Text>
            </View>
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
      <View style={styles.footer}>
        <RoomAction
          labelStyle={{ fontWeight: '500' }}
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
    marginBottom: 11,
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
    minHeight: 223,
  },
  cardTop: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', minHeight: 28 },
  burst: { width: 25, height: 25, position: 'absolute', right: 39, top: -4 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: tokens.color.foreground },
  topicInput: {
    height: 56,
    marginTop: 10,
    fontFamily: 'NotoSansSC',
    backgroundColor: '#fff',
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    fontSize: 14,
    paddingVertical: 0,
    lineHeight: 20,
    color: tokens.color.foreground,
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  helper: { color: tokens.color.muted, fontSize: 12, lineHeight: 18 },
  levelChip: {
    flex: 1,
    minHeight: 44,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderRadius: 16,
  },
  levelChipText: { color: tokens.color.purple, fontWeight: '700' },
  levelLabel: { lineHeight: 20 },
  levelChoices: { flexDirection: 'row', gap: 8, marginTop: 16 },
  accessCard: {
    marginLeft: 13,
    marginRight: 14,
    marginTop: 18,
    backgroundColor: tokens.color.blueSoft,
    borderRadius: 24,
    padding: 14,
    minHeight: 224,
  },
  capacityLabel: { marginTop: 4, marginLeft: 2, lineHeight: 20 },
  chipRow: { flexDirection: 'row', gap: 9, width: '100%', maxWidth: 326, marginTop: 20 },
  capacityChip: { flex: 1, minWidth: 0, minHeight: 36, paddingHorizontal: 0 },
  accessChip: { minHeight: 32, minWidth: 0, flexShrink: 1, paddingHorizontal: 6 },
  accessLabel: { width: 96, flexShrink: 1, lineHeight: 20 },
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
  compactChip: { minHeight: 24, borderRadius: 8, paddingHorizontal: 8 },
  chipSelected: { backgroundColor: tokens.color.purple, borderColor: tokens.color.purple },
  chipText: { color: tokens.color.muted, fontSize: 12 },
  chipTextSelected: { color: '#fff', fontWeight: '700' },
  accessRow: { alignItems: 'flex-start', gap: 24, marginTop: 22 },
  accessChoices: { flexDirection: 'row', gap: 11 },
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
    marginTop: 9,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 12,
    borderRadius: 24,
    backgroundColor: tokens.color.peach,
    minHeight: 111,
  },
  instantDetails: { marginTop: 16 },
  instantTime: { fontSize: 11, lineHeight: 16, marginTop: 6, color: tokens.color.muted },
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
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'web' ? 37 : 16,
    backgroundColor: tokens.color.surface,
  },
  dateInput: { flex: 1, textAlign: 'right', color: tokens.color.foreground, fontSize: 13 },
  timeInput: { width: 70, textAlign: 'center', color: tokens.color.foreground, fontSize: 13 },
  error: { color: tokens.color.error, marginHorizontal: 20, marginTop: 12, fontSize: 12 },
});
