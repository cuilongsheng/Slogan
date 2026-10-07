import { roomLevelLabel } from './presentation';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
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
import micIcon from '../../../assets/icons/mic.png';
import { useJoinDraft, validRoomPassword } from './join';
import { roomAvailability, remainingMinutes } from './presentation';
import { useRoomDetail } from './useRoomDetail';
import type { MicrophoneStatus } from './microphone';
import { RoomConsentPanel } from '../room-processing-consents/RoomConsentPanel';

function Expired({ roomId }: { roomId: string }) {
  const router = useRouter();
  return (
    <View style={styles.expired}>
      <Text style={styles.helper}>{t('joinPreparationExpired')}</Text>
      <TouchableOpacity onPress={() => router.replace(`/rooms/${roomId}`)}>
        <Text style={styles.link}>{t('roomRetry')}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function JoinPasswordScreen({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { draft, password } = useJoinDraft();
  const { room, loading } = useRoomDetail(roomId);
  const [touched, setTouched] = useState(false);
  const valid = validRoomPassword(draft?.password ?? '');
  return (
    <RoomPage ambient>
      <RoomHeader
        title={t('joinPasswordTitle')}
        subtitle={t('joinPasswordSubtitle')}
        onBack={() => router.back()}
      />
      {loading && !room ? (
        <ActivityIndicator style={styles.expired} color={tokens.color.purple} />
      ) : !draft ||
        draft.roomId !== roomId ||
        !room ||
        !room.passwordProtected ||
        roomAvailability(room) !== 'available' ? (
        <Expired roomId={roomId} />
      ) : (
        <>
          <ScrollView
            style={roomPageStyles.scroll}
            contentContainerStyle={roomPageStyles.scrollContent}
          >
            <Text style={styles.section}>{t('joinTargetRoom')}</Text>
            <View style={styles.targetCard}>
              <View style={styles.targetHeader}>
                <Text style={styles.targetLevel}>{roomLevelLabel(room)}</Text>
                <Text style={styles.targetState}>
                  {room.passwordProtected ? t('roomPasswordProtected') : t('roomAvailable')}
                </Text>
              </View>
              <Text style={styles.targetTopic}>{room.topic}</Text>
              <View style={styles.targetFooter}>
                <View style={styles.targetAvatar}>
                  <Text style={styles.targetAvatarText}>{room.hostDisplayName.slice(0, 1)}</Text>
                </View>
                <Text numberOfLines={1} style={styles.targetHost}>
                  {room.hostDisplayName} · {t('roomHost')}
                </Text>
                <Text style={styles.targetTime}>
                  {tf('roomRemainingMinutes', { minutes: remainingMinutes(room.endsAt) })}
                </Text>
                <View style={styles.targetCapacity}>
                  <Text style={styles.targetCapacityText}>
                    {room.memberCount}/{room.capacity}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.section}>{t('joinPasswordHeading')}</Text>
            <View style={styles.passwordCard}>
              <Text style={styles.pill}>{t('joinFourDigitPassword')}</Text>
              <Text style={styles.helperLeft}>{t('joinPasswordHelper')}</Text>
              <View style={styles.digitRow}>
                {[0, 1, 2, 3].map((index) => (
                  <View key={index} style={styles.digit}>
                    <Text style={styles.digitText}>{draft.password[index] ? '●' : ''}</Text>
                  </View>
                ))}
                <TextInput
                  testID="room-password"
                  value={draft.password}
                  onChangeText={(value) => {
                    password(value);
                    setTouched(true);
                  }}
                  keyboardType="number-pad"
                  maxLength={4}
                  autoComplete="off"
                  secureTextEntry
                  accessibilityLabel={t('joinFourDigitPassword')}
                  style={styles.hiddenInput}
                />
              </View>
              <Text style={styles.privacy}>{t('joinPasswordPrivacy')}</Text>
              {touched && !valid && <Text style={styles.error}>{t('joinPasswordInvalid')}</Text>}
            </View>
            <View style={styles.reminder}>
              <Text style={styles.pill}>{t('joinRulesReminder')}</Text>
              <Text style={styles.helperLeft}>{t('joinRulesReminderBody')}</Text>
            </View>
            <Text style={styles.disclosure}>{t('joinPasswordNotVerified')}</Text>
          </ScrollView>
          <View style={roomPageStyles.footer}>
            <RoomAction
              label={t('continue')}
              disabled={!valid}
              onPress={() => router.push(`/rooms/${roomId}/rules`)}
            />
          </View>
        </>
      )}
    </RoomPage>
  );
}

const rules = [
  ['joinRuleOneTitle', 'joinRuleOneBody'],
  ['joinRuleTwoTitle', 'joinRuleTwoBody'],
  ['joinRuleThreeTitle', 'joinRuleThreeBody'],
] as const;

export function JoinRulesScreen({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { draft, acceptRules } = useJoinDraft();
  const { room, loading } = useRoomDetail(roomId);
  const [consentReady, setConsentReady] = useState(false);
  const processingRequired = Boolean(
    room?.sensitiveSpeechDetectionEnabled || room?.postRoomKeywordsEnabled,
  );
  const valid =
    draft?.roomId === roomId &&
    room &&
    roomAvailability(room) === 'available' &&
    (!room.passwordProtected || validRoomPassword(draft.password));
  return (
    <RoomPage ambient>
      <RoomHeader
        title={t('joinRulesTitle')}
        subtitle={t('joinRulesSubtitle')}
        onBack={() => router.back()}
      />
      {loading && !room ? (
        <ActivityIndicator style={styles.expired} color={tokens.color.purple} />
      ) : !valid ? (
        <Expired roomId={roomId} />
      ) : (
        <>
          <ScrollView
            style={roomPageStyles.scroll}
            contentContainerStyle={[
              roomPageStyles.scrollContent,
              processingRequired && styles.rulesProcessingScroll,
            ]}
          >
            <Text style={styles.rulesIntro}>{t('joinRulesIntro')}</Text>
            {rules.map(([title, body], index) => (
              <View
                key={title}
                style={[
                  styles.ruleCard,
                  index === 0 ? styles.peach : index === 1 ? styles.lavender : styles.mint,
                ]}
              >
                <View style={styles.ruleRow}>
                  <Text style={styles.ruleIndex}>0{index + 1}</Text>
                  <Text style={styles.ruleTitle}>{t(title)}</Text>
                </View>
                <Text style={styles.ruleBody}>{t(body)}</Text>
              </View>
            ))}
            {processingRequired ? (
              <RoomConsentPanel
                safety={Boolean(room?.sensitiveSpeechDetectionEnabled)}
                keywords={Boolean(room?.postRoomKeywordsEnabled)}
                onReadyChange={setConsentReady}
              />
            ) : null}
            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityState={{ checked: draft.rulesAccepted }}
              onPress={() => acceptRules(!draft.rulesAccepted)}
              style={styles.accept}
            >
              <View style={[styles.checkbox, draft.rulesAccepted && styles.checked]}>
                {draft.rulesAccepted && <Text style={styles.tick}>✓</Text>}
              </View>
              <View>
                <Text style={styles.acceptTitle}>{t('joinRulesAccept')}</Text>
                <Text style={styles.acceptHint}>{t('joinRulesUnchecked')}</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
          <View style={[roomPageStyles.footer, styles.rulesFooter]}>
            <RoomAction
              label={t('joinRulesContinue')}
              disabled={!draft.rulesAccepted || (processingRequired && !consentReady)}
              onPress={() => router.push(`/rooms/${roomId}/device`)}
            />
          </View>
        </>
      )}
    </RoomPage>
  );
}

export function JoinDeviceScreen({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { draft } = useJoinDraft();
  const { room, loading } = useRoomDetail(roomId);
  const valid =
    draft?.roomId === roomId &&
    draft.rulesAccepted &&
    room &&
    roomAvailability(room) === 'available' &&
    (!room.passwordProtected || validRoomPassword(draft.password));
  return (
    <RoomPage ambient>
      <RoomHeader
        title={t('joinDeviceTitle')}
        subtitle={t('joinDeviceSubtitle')}
        onBack={() => router.back()}
      />
      {loading && !room ? (
        <ActivityIndicator style={styles.expired} color={tokens.color.purple} />
      ) : !valid ? (
        <Expired roomId={roomId} />
      ) : (
        <DeviceCheck roomId={roomId} />
      )}
    </RoomPage>
  );
}

function DeviceCheck({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'checking' | MicrophoneStatus>('idle');
  const check = async () => {
    setStatus('checking');
    try {
      const { checkMicrophone } = await import('./microphone');
      setStatus(await checkMicrophone());
    } catch {
      setStatus('unavailable');
    }
  };
  const title = t(
    status === 'ready'
      ? 'joinDeviceReady'
      : status === 'denied'
        ? 'joinDeviceDenied'
        : status === 'blocked'
          ? 'joinDeviceBlocked'
          : status === 'unavailable'
            ? 'joinDeviceUnavailable'
            : status === 'checking'
              ? 'joinDeviceChecking'
              : 'joinDeviceNotChecked',
  );
  return (
    <>
      <ScrollView
        style={roomPageStyles.scroll}
        contentContainerStyle={roomPageStyles.scrollContent}
      >
        <View style={styles.deviceHero}>
          <View style={styles.micRing}>
            <View style={styles.micWhite}>
              <Image source={micIcon} style={styles.micIcon} />
            </View>
          </View>
          <Text style={styles.deviceTitle}>{title}</Text>
          <Text style={styles.helper}>{t('joinDeviceNote')}</Text>
        </View>
        <View style={styles.deviceChecklist}>
          <Text style={styles.checklistTitle}>{t('joinDeviceChecklist')}</Text>
          <Text style={styles.checkline}>
            {status === 'ready' ? '●' : '○'}{' '}
            {t(status === 'ready' ? 'joinDevicePermissionReady' : 'joinDevicePermissionNeeded')}
          </Text>
          <Text style={styles.checkline}>
            {status === 'ready' ? '●' : '○'}{' '}
            {t(status === 'ready' ? 'joinDeviceAudioReady' : 'joinDeviceAudioUnavailable')}
          </Text>
          <Text style={styles.checkHint}>{t('joinDeviceSettings')}</Text>
          {status === 'blocked' && Platform.OS !== 'web' && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => void Linking.openSettings()}
            >
              <Text style={styles.link}>{t('joinDeviceOpenSettings')}</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.disclosure}>{t('joinDeviceSeatNotice')}</Text>
      </ScrollView>
      <View style={[roomPageStyles.footer, styles.rulesFooter]}>
        <RoomAction
          label={t(
            status === 'ready'
              ? 'joinDeviceEnterRoom'
              : status === 'idle'
                ? 'joinDeviceCheck'
                : 'joinDeviceRetry',
          )}
          disabled={status === 'checking'}
          onPress={() => {
            if (status === 'ready') router.push(`/rooms/${roomId}/session`);
            else void check();
          }}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  expired: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  helper: { color: tokens.color.muted, fontSize: 12, textAlign: 'center' },
  link: { color: tokens.color.purple, fontWeight: '700', marginTop: 16 },
  section: {
    color: tokens.color.foreground,
    fontSize: 17,
    fontWeight: '700',
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 16,
  },
  targetCard: {
    marginHorizontal: 16,
    height: 124,
    borderRadius: 24,
    padding: 14,
    backgroundColor: '#F3EFFF',
  },
  targetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  targetLevel: {
    color: tokens.color.purple,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  targetState: { color: tokens.color.purple, fontSize: 11, fontWeight: '700' },
  targetTopic: { color: tokens.color.foreground, fontSize: 18, fontWeight: '700', marginTop: 9 },
  targetFooter: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  targetAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EAE5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetAvatarText: { color: tokens.color.purple, fontSize: 11, fontWeight: '700' },
  targetHost: { color: tokens.color.muted, fontSize: 11, flex: 1 },
  targetTime: { color: tokens.color.muted, fontSize: 10 },
  targetCapacity: {
    minWidth: 36,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetCapacityText: { color: tokens.color.foreground, fontSize: 10, fontWeight: '700' },
  passwordCard: {
    marginHorizontal: 16,
    minHeight: 188,
    borderRadius: 24,
    padding: 14,
    backgroundColor: tokens.color.blueSoft,
  },
  pill: {
    alignSelf: 'flex-start',
    color: tokens.color.purple,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '700',
  },
  helperLeft: { color: tokens.color.muted, fontSize: 12, marginTop: 14 },
  digitRow: { flexDirection: 'row', gap: 16, marginTop: 16, position: 'relative' },
  digit: {
    height: 60,
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitText: { color: tokens.color.purple, fontSize: 17 },
  hiddenInput: { position: 'absolute', width: '100%', height: 60, opacity: 0.02, zIndex: 1 },
  privacy: { color: tokens.color.muted, fontSize: 11, marginTop: 13 },
  error: { color: tokens.color.error, fontSize: 11, marginTop: 5 },
  reminder: {
    height: 88,
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 24,
    padding: 14,
    backgroundColor: tokens.color.peach,
  },
  disclosure: {
    color: tokens.color.muted,
    fontSize: 11,
    textAlign: 'center',
    marginHorizontal: 20,
    marginTop: 16,
  },
  rulesIntro: {
    color: tokens.color.foreground,
    fontSize: 17,
    fontWeight: '700',
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 20,
  },
  ruleCard: {
    height: 104,
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 14,
  },
  peach: { backgroundColor: tokens.color.peach },
  lavender: { backgroundColor: '#F5F1FF' },
  mint: { backgroundColor: tokens.color.mint },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ruleIndex: {
    color: tokens.color.purple,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
  },
  ruleTitle: { color: tokens.color.foreground, fontSize: 15, fontWeight: '700' },
  ruleBody: { color: tokens.color.muted, fontSize: 12, marginTop: 12 },
  accept: {
    marginHorizontal: 16,
    marginTop: 20,
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: { backgroundColor: tokens.color.purple, borderColor: tokens.color.purple },
  tick: { color: '#fff', fontSize: 14 },
  acceptTitle: { color: tokens.color.foreground, fontSize: 13 },
  acceptHint: { color: tokens.color.muted, fontSize: 11, marginTop: 5 },
  rulesFooter: { bottom: 98 },
  rulesProcessingScroll: { paddingBottom: 210 },
  deviceHero: {
    height: 254,
    marginHorizontal: 16,
    marginTop: 32,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.mint,
    alignItems: 'center',
  },
  micRing: {
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: '#F9F0C9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  micWhite: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIcon: { width: 28, height: 28 },
  deviceTitle: {
    color: tokens.color.foreground,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 12,
  },
  deviceChecklist: {
    height: 168,
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: '#fff',
    padding: 18,
  },
  checklistTitle: {
    color: tokens.color.foreground,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 22,
  },
  checkline: { color: tokens.color.mintInk, fontSize: 13, marginBottom: 12 },
  checkHint: { color: tokens.color.muted, fontSize: 11, marginTop: 2 },
});
