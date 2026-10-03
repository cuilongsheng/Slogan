import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { RoomAction, RoomHeader, RoomPage, roomPageStyles } from '../../components/ui/RoomPage';
import { t, tf } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import burstIcon from '../../../assets/icons/speech-burst.png';
import { useAuth } from '../auth';
import { CreateRoomError, RoomCreationApi } from './api';
import { RoomConsentPanel } from '../room-processing-consents/RoomConsentPanel';
import {
  initialRoomForm,
  instantInput,
  scheduledInput,
  validateRoomForm,
  type RoomForm,
  type ValidationError,
} from './form';

const levels: RoomForm['cefrLevel'][] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const validationText: Record<
  Exclude<ValidationError, null>,
  | 'createRoomTopicInvalid'
  | 'createRoomPasswordInvalid'
  | 'createRoomDateInvalid'
  | 'createRoomTimeInvalid'
> = {
  TOPIC: 'createRoomTopicInvalid',
  PASSWORD: 'createRoomPasswordInvalid',
  DATE: 'createRoomDateInvalid',
  TIME: 'createRoomTimeInvalid',
};
function Chip({
  label,
  selected,
  onPress,
  compact = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, compact && styles.compactChip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function CreateRoomScreen() {
  const router = useRouter();
  const { authorized } = useAuth();
  const api = useMemo(() => new RoomCreationApi(authorized), [authorized]);
  const [form, setForm] = useState<RoomForm>(initialRoomForm);
  const [levelOpen, setLevelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [consentReady, setConsentReady] = useState(false);
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
    if ((form.sensitiveSpeechDetectionEnabled || form.postRoomKeywordsEnabled) && !consentReady) {
      setError(t('createRoomConsentRequired'));
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
      setError(t(code === 'ROOM_SPEECH_UNAVAILABLE' || code === 'POST_ROOM_KEYWORDS_UNAVAILABLE'
        ? 'createRoomProcessingUnavailable'
        : code === 'ROOM_SPEECH_CONSENT_REQUIRED' || code === 'POST_ROOM_KEYWORDS_CONSENT_REQUIRED'
          ? 'createRoomConsentRequired'
          : cause instanceof CreateRoomError && cause.uncertain ? 'createRoomUncertain' : 'createRoomFailed'));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <RoomPage ambient>
      <RoomHeader
        title={t('createRoomTitle')}
        subtitle={t('createRoomSubtitle')}
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
            <Text style={styles.whiteTag}>{t('createRoomTopic')}</Text>
            <Text style={styles.whiteTag}>{form.cefrLevel}</Text>
            <Image source={burstIcon} style={styles.burst} />
          </View>
          <Text style={styles.label}>{t('createRoomTopic')}</Text>
          <TextInput
            accessibilityLabel={t('createRoomTopic')}
            placeholder={t('createRoomTopicPlaceholder')}
            placeholderTextColor="#9C98AB"
            value={form.topic}
            onChangeText={(topic) => update({ topic })}
            maxLength={120}
            style={styles.topicInput}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ expanded: levelOpen }}
            style={styles.levelRow}
            onPress={() => setLevelOpen((open) => !open)}
          >
            <Text style={styles.helper}>{t('createRoomLevel')}</Text>
            <Text style={styles.levelValue}>{form.cefrLevel} ›</Text>
          </TouchableOpacity>
          {levelOpen && (
            <View style={styles.levelChoices}>
              {levels.map((level) => (
                <Chip
                  key={level}
                  label={level}
                  selected={form.cefrLevel === level}
                  onPress={() => {
                    update({ cefrLevel: level });
                    setLevelOpen(false);
                  }}
                />
              ))}
            </View>
          )}
        </View>
        <View style={styles.accessCard}>
          <Text style={styles.whiteTag}>{t('createRoomSettings')}</Text>
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
          <View style={styles.visibilityRow}>
            <Text style={styles.helper}>{t('createRoomVisibility')}</Text>
            <TouchableOpacity
              onPress={() =>
                update({ visibility: form.visibility === 'PUBLIC' ? 'LINK_ONLY' : 'PUBLIC' })
              }
              accessibilityRole="button"
            >
              <Text style={styles.visibilityLink}>
                {t(form.visibility === 'PUBLIC' ? 'createRoomPublic' : 'createRoomLinkOnly')} ▾
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.processingCard}>
          <Text style={styles.label}>{t('createRoomProcessingTitle')}</Text>
          <Text style={styles.helper}>{t('createRoomProcessingHint')}</Text>
          <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: form.sensitiveSpeechDetectionEnabled }} onPress={() => update({ sensitiveSpeechDetectionEnabled: !form.sensitiveSpeechDetectionEnabled })} style={styles.processingRow}><Text style={styles.processingName}>{t('consentSafetyTitle')}</Text><Text style={styles.processingValue}>{form.sensitiveSpeechDetectionEnabled ? t('createRoomProcessingOn') : t('createRoomProcessingOff')}</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: form.postRoomKeywordsEnabled }} onPress={() => update({ postRoomKeywordsEnabled: !form.postRoomKeywordsEnabled })} style={styles.processingRow}><Text style={styles.processingName}>{t('consentKeywordsTitle')}</Text><Text style={styles.processingValue}>{form.postRoomKeywordsEnabled ? t('createRoomProcessingOn') : t('createRoomProcessingOff')}</Text></TouchableOpacity>
        </View>
        <RoomConsentPanel safety={form.sensitiveSpeechDetectionEnabled} keywords={form.postRoomKeywordsEnabled} onReadyChange={setConsentReady} />
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
    marginBottom: 15,
    color: tokens.color.foreground,
    fontSize: 17,
    fontWeight: '700',
  },
  topicCard: {
    marginHorizontal: 16,
    backgroundColor: tokens.color.purpleSoft,
    borderRadius: 24,
    padding: 14,
    minHeight: 198,
  },
  cardTop: { flexDirection: 'row', gap: 6, alignItems: 'center', height: 24 },
  whiteTag: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    backgroundColor: '#fff',
    color: tokens.color.purple,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  burst: { width: 25, height: 25, marginLeft: 'auto' },
  label: { fontSize: 14, fontWeight: '700', color: tokens.color.foreground },
  topicInput: {
    height: 55,
    marginTop: 8,
    backgroundColor: '#fff',
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    fontSize: 14,
    color: tokens.color.foreground,
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    paddingHorizontal: 1,
  },
  helper: { color: tokens.color.muted, fontSize: 12 },
  levelValue: { color: tokens.color.purple, fontSize: 12, fontWeight: '700' },
  levelChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  accessCard: {
    marginHorizontal: 16,
    marginTop: 13,
    backgroundColor: tokens.color.blueSoft,
    borderRadius: 24,
    padding: 14,
    minHeight: 193,
  },
  processingCard: { marginHorizontal: 16, marginTop: 13, padding: 14, borderRadius: 24, backgroundColor: tokens.color.panel, borderWidth: 1, borderColor: tokens.color.border, gap: 9 },
  processingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 34 },
  processingName: { color: tokens.color.foreground, fontSize: 13 },
  processingValue: { color: tokens.color.purple, fontSize: 12, fontWeight: '700' },
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
  visibilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  visibilityLink: { fontSize: 12, color: tokens.color.purple, fontWeight: '700' },
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
