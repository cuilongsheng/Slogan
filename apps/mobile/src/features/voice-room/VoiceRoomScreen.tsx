import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { RoomAction, RoomHeader, RoomPage, roomPageStyles } from '../../components/ui/RoomPage';
import { RoomShareAction } from '../../components/ui/RoomShareAction';
import { VoicePage } from '../../components/ui/VoicePage';
import { t, tf } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../auth';
import { RoomDiscoveryApi } from '../room-discovery/api';
import { useJoinDraft, type JoinDraft } from '../room-discovery/join';
import { remainingMinutes } from '../room-discovery/presentation';
import { VoiceRoomApi, type RoomMember } from './api';
import { ExpressionAssistanceApi } from './assistanceApi';
import { ExpressionAssistSheet } from './ExpressionAssistSheet';
import { RoomControls } from './RoomControls';
import { RoomExtensionSheet } from './RoomExtensionSheet';
import { RoomSafetyAlertsSheet } from './RoomSafetyAlertsSheet';
import { createVoiceMedia } from './media';
import { VoiceRoomSession, type VoiceSessionSnapshot } from './session';
import micIcon from '../../../assets/icons/mic.png';

const rules = [t('joinRuleOneBody'), t('joinRuleTwoBody'), t('joinRuleThreeBody')];

function voiceError(code: string | null): string {
  switch (code) {
    case 'ROOM_PASSWORD_INVALID':
    case 'ROOM_PASSWORD_REQUIRED':
      return t('voicePasswordInvalid');
    case 'ROOM_FULL':
      return t('roomFull');
    case 'ROOM_ENDED':
    case 'ROOM_CANCELLED':
      return t('roomEnded');
    case 'ROOM_RULES_NOT_ACCEPTED':
      return t('voiceRulesExpired');
    case 'REALTIME_PROVIDER_UNAVAILABLE':
    case 'REALTIME_CONNECT_FAILED':
      return t('voiceProviderUnavailable');
    case 'MICROPHONE_UNAVAILABLE':
      return t('joinDeviceUnavailable');
    case 'ROOM_LEAVE_UNCONFIRMED':
      return t('voiceLeaveUnconfirmed');
    default:
      return t('voiceJoinFailed');
  }
}

function VoiceButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: object;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, style, disabled && styles.disabled]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SessionState({
  snapshot,
  session,
  roomId,
  draft,
}: {
  snapshot: VoiceSessionSnapshot;
  session: VoiceRoomSession;
  roomId: string;
  draft: JoinDraft | null;
}) {
  const router = useRouter();
  const busy = ['joining', 'connecting', 'leaving', 'idle'].includes(snapshot.phase);
  const title =
    snapshot.phase === 'preparationRequired'
      ? t('joinPreparationExpired')
      : snapshot.phase === 'failed'
        ? voiceError(snapshot.errorCode)
        : snapshot.phase === 'active'
          ? t('voiceReconnecting')
          : t('voiceConnecting');
  const needsEarlierStep =
    snapshot.credentialVersion === null &&
    ['ROOM_PASSWORD_INVALID', 'ROOM_PASSWORD_REQUIRED', 'ROOM_RULES_NOT_ACCEPTED'].includes(
      snapshot.errorCode ?? '',
    );
  return (
    <VoicePage>
      <View style={styles.stateHeader}>
        <Text style={styles.stateTitle}>{t('voiceReconnectingTitle')}</Text>
        <Text style={styles.stateSubtitle}>{t('voiceReconnectSubtitle')}</Text>
      </View>
      <View style={styles.stateCard}>
        {busy ? (
          <ActivityIndicator color="#77E1D0" size="large" />
        ) : (
          <Text style={styles.stateIcon}>↻</Text>
        )}
        <Text style={styles.stateMessage}>{title}</Text>
        {snapshot.credentialVersion !== null && snapshot.phase === 'failed' && (
          <Text style={styles.stateHint}>{t('voiceSeatStillActive')}</Text>
        )}
      </View>
      {!busy && (
        <View style={styles.stateActions}>
          {snapshot.phase === 'preparationRequired' || needsEarlierStep ? (
            <VoiceButton
              label={t('voiceBackToPreparation')}
              onPress={() =>
                router.replace(
                  snapshot.errorCode === 'ROOM_RULES_NOT_ACCEPTED'
                    ? `/rooms/${roomId}/rules`
                    : snapshot.errorCode?.startsWith('ROOM_PASSWORD')
                      ? `/rooms/${roomId}/password`
                      : `/rooms/${roomId}`,
                )
              }
            />
          ) : (
            <VoiceButton label={t('retry')} onPress={() => void session.start(draft)} />
          )}
          {snapshot.credentialVersion !== null && (
            <VoiceButton
              label={t('voiceLeave')}
              onPress={() => void session.leave()}
              style={styles.secondaryAction}
            />
          )}
        </View>
      )}
    </VoicePage>
  );
}

function Ended({ snapshot }: { snapshot: VoiceSessionSnapshot }) {
  const router = useRouter();
  return (
    <RoomPage ambient>
      <RoomHeader
        title={t('voiceEndedTitle')}
        subtitle={t('voiceEndedSubtitle')}
        onBack={() => router.replace('/rooms')}
      />
      <View style={styles.endedMark}>
        <Text style={styles.endedCheck}>✓</Text>
      </View>
      <Text style={styles.endedHeading}>{t('voiceEndedThanks')}</Text>
      <Text style={styles.endedBody}>{t('voiceEndedExplanation')}</Text>
      <View style={styles.endedSummary}>
        <Text style={styles.endedSummaryLabel}>{t('voiceThisRoom')}</Text>
        <Text style={styles.endedTopic}>{snapshot.room?.topic ?? t('voiceEndedTitle')}</Text>
        {snapshot.room && (
          <Text style={styles.endedMeta}>
            {snapshot.room.cefrLevel} · {tf('roomPeople', { count: snapshot.room.memberCount })}
          </Text>
        )}
      </View>
      <View style={[roomPageStyles.footer, styles.endedFooter]}>
        <RoomAction label={t('voiceBackToDiscover')} onPress={() => router.replace('/rooms')} />
      </View>
    </RoomPage>
  );
}

function MemberSeat({
  member,
  snapshot,
  onPress,
}: {
  member: RoomMember;
  snapshot: VoiceSessionSnapshot;
  onPress: () => void;
}) {
  const media = snapshot.media.participants.find(
    (participant) => participant.identity === member.participantIdentity,
  );
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={member.displayName}
      onPress={onPress}
      style={styles.seat}
    >
      <View style={[styles.avatar, media?.speaking && styles.avatarSpeaking]}>
        <Text style={styles.avatarText}>{member.displayName.slice(0, 1)}</Text>
      </View>
      <Text numberOfLines={1} style={styles.seatName}>
        {member.displayName}
      </Text>
      <Text style={styles.seatState}>
        {member.role === 'HOST' ? '♛ ' : ''}
        {media?.microphoneEnabled ? '●' : '⊘'}
      </Text>
    </TouchableOpacity>
  );
}

function VoiceRoomBody({
  snapshot,
  session,
  api,
  assistanceApi,
}: {
  snapshot: VoiceSessionSnapshot;
  session: VoiceRoomSession;
  api: VoiceRoomApi;
  assistanceApi: ExpressionAssistanceApi;
}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [endConfirm, setEndConfirm] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [assistanceOpen, setAssistanceOpen] = useState(false);
  const [safetyAlertsOpen, setSafetyAlertsOpen] = useState(false);
  const [assistanceMode, setAssistanceMode] = useState<'audio' | 'text'>('audio');
  const [extendResult, setExtendResult] = useState<{
    endsAt: string;
    providerStatus: 'COMPLETED' | 'PENDING' | 'UNAVAILABLE';
  } | null>(null);
  const [successorMembershipId, setSuccessorMembershipId] = useState<string | null>(null);
  const members = [...snapshot.members].sort((a, b) => a.position - b.position);
  const speaker = members.find((member) =>
    snapshot.media.participants.some(
      (participant) => participant.identity === member.participantIdentity && participant.speaking,
    ),
  );
  const room = snapshot.room;
  if (!room) return null;
  return (
    <VoicePage>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" onPress={() => setLeaveConfirm(true)}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerMiddle}>
          <Text numberOfLines={1} style={styles.headerTopic}>
            {room.topic}
          </Text>
          <Text style={styles.headerMeta}>
            {room.memberCount}/{room.capacity} {t('voiceOnline')} ·{' '}
            {tf('roomRemainingMinutes', { minutes: remainingMinutes(room.endsAt) })}
          </Text>
          <Text style={styles.headerLevel}>{room.cefrLevel}</Text>
        </View>
        {snapshot.role === 'HOST' && (
          <TouchableOpacity accessibilityRole="button" onPress={() => setEndConfirm(true)}>
            <Text style={styles.power}>⏻</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.live}>● LIVE</Text>
      </View>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setRulesOpen(!rulesOpen)}
          style={styles.rulesBanner}
        >
          <Text style={styles.rulesIcon}>◖</Text>
          <View style={styles.rulesText}>
            <Text style={styles.rulesTitle}>{t('voiceRoomRules')}</Text>
            <Text numberOfLines={rulesOpen ? undefined : 2} style={styles.rulesPreview}>
              {rules.join(' ')}
            </Text>
          </View>
        </TouchableOpacity>
        {snapshot.role === 'HOST' &&
          room.sensitiveSpeechDetectionEnabled &&
          !snapshot.safetyAlertsDenied && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setSafetyAlertsOpen(true)}
              style={styles.safetyAlertsBanner}
            >
              <View style={styles.safetyAlertsCopy}>
                <Text style={styles.safetyAlertsTitle}>{t('safetyAlertsTitle')}</Text>
                <Text style={styles.safetyAlertsHint}>{t('safetyAlertsHint')}</Text>
              </View>
              <Text style={styles.safetyAlertsCount}>{snapshot.safetyAlerts.length} ›</Text>
            </TouchableOpacity>
          )}
        <View style={styles.roomTools}>
          <TouchableOpacity accessibilityRole="button" onPress={() => setShareOpen(true)}>
            <Text style={styles.roomToolText}>{t('roomShareAction')}</Text>
          </TouchableOpacity>
          {snapshot.role === 'HOST' && (
            <TouchableOpacity accessibilityRole="button" onPress={() => setExtendOpen(true)}>
              <Text style={styles.roomToolText}>{t('roomExtendAction')}</Text>
            </TouchableOpacity>
          )}
        </View>
        {extendResult && (
          <View style={styles.extensionNotice}>
            <Text style={styles.extensionNoticeText}>
              {tf('roomExtendSucceeded', {
                endsAt: new Date(extendResult.endsAt).toLocaleString(),
              })}
            </Text>
            {extendResult.providerStatus !== 'COMPLETED' && (
              <Text style={styles.extensionNoticeText}>{t('roomExtendSyncPending')}</Text>
            )}
          </View>
        )}
        <View style={styles.speakerCard}>
          <View pointerEvents="none" style={styles.speakerDecorTop} />
          <View pointerEvents="none" style={styles.speakerDecorRing} />
          {speaker && (
            <View pointerEvents="none" style={styles.speakerWave}>
              {[13, 25, 34, 19, 29].map((height, index) => (
                <View key={index} style={[styles.speakerWaveBar, { height }]} />
              ))}
            </View>
          )}
          <Text style={styles.speakingPill}>
            {speaker ? t('voiceSpeakingNow') : t('voiceWaitingForSpeech')}
          </Text>
          <View style={styles.speakerMain}>
            <View style={styles.speakerAvatar}>
              <Text style={styles.speakerInitial}>{speaker?.displayName.slice(0, 1) ?? '♪'}</Text>
            </View>
            <View>
              <Text style={styles.speakerName}>
                {speaker ? tf('voiceSpeakingName', { name: speaker.displayName }) : t('voiceQuiet')}
              </Text>
              <Text style={styles.speakerMeta}>
                {speaker
                  ? `${speaker.role === 'HOST' ? t('roomHost') : t('roomMember')} · ${speaker.cefrLevel.replace('_', '–')}`
                  : t('voiceMutedByDefault')}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={() => setControlsOpen(true)}>
          <Text style={styles.membersHeading}>
            {t('voiceRoomMembers')} · {members.length}/{room.capacity} ›
          </Text>
        </TouchableOpacity>
        <View style={styles.membersGrid}>
          {members.map((member) => (
            <MemberSeat
              key={member.membershipId}
              member={member}
              snapshot={snapshot}
              onPress={() => setControlsOpen(true)}
            />
          ))}
          {Array.from({ length: Math.max(0, room.capacity - members.length) }, (_, index) => (
            <View key={`empty-${index}`} style={styles.seat}>
              <View style={styles.emptySeat}>
                <Text style={styles.emptyPlus}>+</Text>
              </View>
              <Text style={styles.emptyLabel}>{t('voiceEmptySeat')}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.composer}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => {
            setAssistanceMode('audio');
            setAssistanceOpen(true);
          }}
          style={styles.assistanceDisabled}
        >
          <Text style={styles.assistanceText}>{t('voiceAssistanceLater')}</Text>
        </TouchableOpacity>
        {!snapshot.media.audioPlaybackAllowed ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => void session.enableAudioPlayback()}
            style={styles.soundNotice}
          >
            <Text style={styles.soundNoticeText}>{t('voiceEnableSound')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.soundNotice}>
            <Text style={styles.soundNoticeText}>{t('voiceMutedByDefault')}</Text>
          </View>
        )}
        <View style={styles.controls}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => {
              setAssistanceMode('text');
              setAssistanceOpen(true);
            }}
            style={styles.composerInput}
          >
            <Text style={styles.composerText}>{t('voiceComposerLater')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              snapshot.media.microphoneEnabled ? t('voiceMute') : t('voiceUnmute')
            }
            onPress={() => void session.setMicrophoneEnabled(!snapshot.media.microphoneEnabled)}
            style={[styles.micButton, snapshot.media.microphoneEnabled && styles.micOn]}
          >
            <Image source={micIcon} style={styles.micImage} />
            {!snapshot.media.microphoneEnabled && <View style={styles.micSlash} />}
          </TouchableOpacity>
        </View>
      </View>
      {(endConfirm || leaveConfirm) && (
        <View style={styles.overlay}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>
              {endConfirm ? t('voiceEndConfirmTitle') : t('voiceLeaveConfirmTitle')}
            </Text>
            <Text style={styles.confirmBody}>
              {endConfirm ? t('voiceEndConfirmBody') : t('voiceLeaveConfirmBody')}
            </Text>
            {leaveConfirm && snapshot.role === 'HOST' && (
              <View style={styles.successors}>
                {members.filter(
                  (member) => member.role !== 'HOST' && member.presence === 'CONNECTED',
                ).length === 0 ? (
                  <Text style={styles.successorHint}>{t('roomLeaveNoSuccessor')}</Text>
                ) : (
                  <>
                    <Text style={styles.successorHint}>{t('roomLeaveSuccessor')}</Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      onPress={() => setSuccessorMembershipId(null)}
                      style={[
                        styles.successorOption,
                        successorMembershipId === null && styles.successorSelected,
                      ]}
                    >
                      <Text style={styles.successorText}>{t('roomLeaveDefaultSuccessor')}</Text>
                    </TouchableOpacity>
                    {members
                      .filter((member) => member.role !== 'HOST' && member.presence === 'CONNECTED')
                      .map((member) => (
                        <TouchableOpacity
                          key={member.membershipId}
                          accessibilityRole="button"
                          onPress={() => setSuccessorMembershipId(member.membershipId)}
                          style={[
                            styles.successorOption,
                            successorMembershipId === member.membershipId &&
                              styles.successorSelected,
                          ]}
                        >
                          <Text style={styles.successorText}>{member.displayName}</Text>
                        </TouchableOpacity>
                      ))}
                  </>
                )}
              </View>
            )}
            <VoiceButton
              label={
                endConfirm
                  ? t('voiceEndRoom')
                  : leaveConfirm && snapshot.role === 'HOST' && successorMembershipId
                    ? t('roomLeaveTransferAction')
                    : t('voiceLeave')
              }
              onPress={() => {
                if (endConfirm) void session.end();
                else void session.leave(successorMembershipId ?? undefined);
                setEndConfirm(false);
                setLeaveConfirm(false);
                setSuccessorMembershipId(null);
              }}
            />
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                setEndConfirm(false);
                setLeaveConfirm(false);
              }}
            >
              <Text style={styles.cancel}>{t('cancelAction')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {shareOpen && (
        <View style={styles.overlay}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>{t('roomShareAction')}</Text>
            <View style={styles.shareContent}>
              <RoomShareAction url={room.shareUrl} />
            </View>
            <TouchableOpacity accessibilityRole="button" onPress={() => setShareOpen(false)}>
              <Text style={styles.cancel}>{t('roomCloseSheet')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {extendOpen && snapshot.role === 'HOST' && (
        <RoomExtensionSheet
          roomId={room.id}
          remainingMinutes={remainingMinutes(room.endsAt)}
          api={api}
          onUpdated={(result) =>
            setExtendResult({ endsAt: result.endsAt, providerStatus: result.providerStatus })
          }
          onRefresh={() => session.refresh()}
          onClose={() => setExtendOpen(false)}
        />
      )}
      {controlsOpen && (
        <RoomControls
          roomId={room.id}
          members={members}
          ownMembershipId={room.currentMembership?.id ?? null}
          isHost={snapshot.role === 'HOST'}
          api={api}
          refresh={() => session.refresh()}
          onClose={() => setControlsOpen(false)}
        />
      )}
      {assistanceOpen && (
        <ExpressionAssistSheet
          roomId={room.id}
          api={assistanceApi}
          initialMode={assistanceMode}
          muteRoomMicrophone={async () => {
            await session.setMicrophoneEnabled(false);
            return !session.snapshot.media.microphoneEnabled;
          }}
          onClose={() => setAssistanceOpen(false)}
        />
      )}
      {safetyAlertsOpen &&
        snapshot.role === 'HOST' &&
        room.sensitiveSpeechDetectionEnabled &&
        !snapshot.safetyAlertsDenied && (
          <RoomSafetyAlertsSheet
            snapshot={snapshot}
            session={session}
            members={members}
            onClose={() => setSafetyAlertsOpen(false)}
          />
        )}
    </VoicePage>
  );
}

export function VoiceRoomScreen({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { authorized } = useAuth();
  const { draft, clear } = useJoinDraft();
  const initialDraft = useRef(draft);
  const api = useMemo(() => new VoiceRoomApi(authorized), [authorized]);
  const assistanceApi = useMemo(() => new ExpressionAssistanceApi(authorized), [authorized]);
  const session = useMemo(
    () => new VoiceRoomSession(roomId, new RoomDiscoveryApi(authorized), api, createVoiceMedia()),
    [roomId, authorized, api],
  );
  const [snapshot, setSnapshot] = useState(session.snapshot);

  useEffect(() => {
    const unsubscribe = session.subscribe(setSnapshot);
    void session.start(initialDraft.current);
    return () => {
      unsubscribe();
      void session.dispose();
    };
  }, [session]);

  useEffect(() => {
    if (snapshot.phase === 'active' && draft) clear();
  }, [snapshot.phase, draft, clear]);

  useEffect(() => {
    if (snapshot.phase === 'left') router.replace('/rooms');
  }, [snapshot.phase, router]);

  useEffect(() => {
    if (snapshot.phase !== 'active') return;
    const interval = setInterval(() => void session.refresh(), 15_000);
    return () => clearInterval(interval);
  }, [session, snapshot.phase]);

  const participantIdentities = snapshot.media.participants
    .map((participant) => participant.identity)
    .sort()
    .join('|');
  useEffect(() => {
    if (snapshot.phase === 'active' && snapshot.media.connection === 'connected') {
      void session.refresh();
    }
  }, [session, snapshot.phase, snapshot.media.connection, participantIdentities]);

  if (snapshot.phase === 'ended') return <Ended snapshot={snapshot} />;
  if (snapshot.phase === 'active' && snapshot.media.connection === 'connected') {
    return (
      <VoiceRoomBody
        snapshot={snapshot}
        session={session}
        api={api}
        assistanceApi={assistanceApi}
      />
    );
  }
  return <SessionState snapshot={snapshot} session={session} roomId={roomId} draft={draft} />;
}

const styles = StyleSheet.create({
  action: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: tokens.color.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  secondaryAction: { backgroundColor: '#EDE6FF', marginTop: 12 },
  stateHeader: { marginHorizontal: 24, marginTop: 10 },
  stateTitle: { color: '#fff', fontSize: 27, fontWeight: '700' },
  stateSubtitle: { color: '#BEB4D3', fontSize: 12, marginTop: 8 },
  stateCard: {
    marginHorizontal: 16,
    marginTop: 138,
    height: 345,
    borderRadius: 24,
    backgroundColor: '#3C2C60',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  stateIcon: { color: '#77E1D0', fontSize: 55 },
  stateMessage: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '700',
    marginTop: 24,
    textAlign: 'center',
  },
  stateHint: { color: '#C8BEE1', fontSize: 12, marginTop: 17, textAlign: 'center' },
  stateActions: { marginHorizontal: 20, marginTop: 104 },
  endedMark: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#E4FAF3',
    alignSelf: 'center',
    marginTop: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endedCheck: { color: '#24C7A6', fontSize: 54 },
  endedHeading: {
    color: tokens.color.foreground,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 36,
  },
  endedBody: { color: tokens.color.muted, fontSize: 12, textAlign: 'center', marginTop: 26 },
  endedSummary: {
    marginHorizontal: 16,
    marginTop: 88,
    height: 140,
    borderRadius: 24,
    backgroundColor: tokens.color.peach,
    padding: 18,
  },
  endedFooter: { bottom: Platform.OS === 'web' ? 104 : 82 },
  endedSummaryLabel: { color: tokens.color.foreground, fontSize: 16, fontWeight: '700' },
  endedTopic: { color: tokens.color.foreground, fontSize: 17, fontWeight: '700', marginTop: 16 },
  endedMeta: { color: tokens.color.muted, fontSize: 12, marginTop: 18 },
  header: {
    height: 91,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  back: { color: '#fff', fontSize: 35, lineHeight: 39 },
  headerMiddle: { flex: 1 },
  headerTopic: { color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 5 },
  headerMeta: { color: '#C1B6D9', fontSize: 11, marginTop: 14 },
  headerLevel: { color: '#C1B6D9', fontSize: 11, marginTop: 9 },
  power: { color: '#fff', fontSize: 29, lineHeight: 38 },
  live: { color: '#71E8CD', fontSize: 10, marginTop: 50 },
  body: { flex: 1 },
  bodyContent: { paddingBottom: 155 },
  rulesBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    minHeight: 76,
    borderRadius: 18,
    backgroundColor: '#150F29',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  rulesIcon: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: '#6943DF',
    color: '#fff',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 23,
  },
  rulesText: { flex: 1 },
  safetyAlertsBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    minHeight: 62,
    borderRadius: 18,
    backgroundColor: '#150F29',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  safetyAlertsCopy: { flex: 1 },
  safetyAlertsTitle: { color: '#fff', fontSize: 12, fontWeight: '700' },
  safetyAlertsHint: { color: '#C7B8E4', fontSize: 10, marginTop: 5 },
  safetyAlertsCount: { color: '#77E5D4', fontSize: 14, fontWeight: '700' },
  rulesTitle: { color: '#fff', fontSize: 11, fontWeight: '700' },
  rulesPreview: { color: '#fff', fontSize: 10, lineHeight: 15, marginTop: 5 },
  speakerCard: {
    marginHorizontal: 16,
    marginTop: 7,
    height: 172,
    borderRadius: 24,
    backgroundColor: '#6542D4',
    padding: 16,
    overflow: 'hidden',
  },
  speakerDecorTop: {
    position: 'absolute',
    right: -34,
    top: -72,
    width: 155,
    height: 155,
    borderRadius: 78,
    backgroundColor: '#E792C0',
    opacity: 0.55,
  },
  speakerDecorRing: {
    position: 'absolute',
    left: -52,
    bottom: -89,
    width: 161,
    height: 161,
    borderRadius: 81,
    borderWidth: 18,
    borderColor: '#A47CE8',
    opacity: 0.58,
  },
  speakerWave: {
    position: 'absolute',
    right: 19,
    bottom: 30,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  speakerWaveBar: { width: 4, borderRadius: 3, backgroundColor: '#77E5D4' },
  speakingPill: {
    color: '#fff',
    backgroundColor: '#3E2987',
    alignSelf: 'flex-start',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: 'hidden',
    fontSize: 11,
  },
  speakerMain: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 19 },
  speakerAvatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 3,
    borderColor: '#6EECD6',
    backgroundColor: '#A888E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakerInitial: { color: '#fff', fontSize: 29, fontWeight: '700' },
  speakerName: { color: '#fff', fontSize: 19, fontWeight: '700' },
  speakerMeta: { color: '#E8DFFF', fontSize: 11, marginTop: 13 },
  membersHeading: { color: '#E9E3F4', fontSize: 12, marginHorizontal: 16, marginTop: 27 },
  membersGrid: {
    marginHorizontal: 16,
    marginTop: 13,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  seat: { width: 78, height: 100, alignItems: 'center' },
  avatar: {
    width: 51,
    height: 51,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#8880A6',
    backgroundColor: '#B4A7D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSpeaking: { borderColor: '#66E6D1' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  seatName: { color: '#fff', fontSize: 11, marginTop: 6 },
  seatState: { color: '#9BD9F4', fontSize: 12, marginTop: 3 },
  emptySeat: {
    width: 51,
    height: 51,
    borderRadius: 26,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#B8A9D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPlus: { color: '#fff', fontSize: 31, lineHeight: 37 },
  emptyLabel: { color: '#C2B5D8', fontSize: 10, marginTop: 7 },
  composer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 25,
    height: 185,
    backgroundColor: '#24183F',
    paddingHorizontal: 16,
    paddingTop: 19,
  },
  assistanceDisabled: {
    height: 60,
    borderRadius: 20,
    backgroundColor: '#49336D',
    justifyContent: 'center',
    paddingHorizontal: 17,
  },
  assistanceText: { color: '#C7B8E4', fontSize: 12 },
  soundNotice: {
    height: 46,
    borderRadius: 14,
    marginTop: 4,
    backgroundColor: '#5A3D95',
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  soundNoticeText: { color: '#E4DDF4', fontSize: 11, fontWeight: '700' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  composerInput: {
    flex: 1,
    height: 49,
    borderRadius: 25,
    backgroundColor: '#34264F',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  composerText: { color: '#C3B8DB', fontSize: 13 },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#5D498D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micOn: { backgroundColor: '#6943DF' },
  micImage: { width: 29, height: 29, tintColor: '#fff' },
  micSlash: {
    position: 'absolute',
    width: 34,
    height: 2,
    backgroundColor: '#fff',
    transform: [{ rotate: '45deg' }],
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0008',
    justifyContent: 'flex-end',
  },
  confirmSheet: {
    minHeight: 306,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: tokens.color.surface,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 50,
  },
  confirmTitle: { color: tokens.color.foreground, fontSize: 21, fontWeight: '700' },
  confirmBody: { color: tokens.color.muted, fontSize: 13, marginTop: 17, marginBottom: 32 },
  roomTools: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginTop: 14,
  },
  roomToolText: { color: '#D9C9FF', fontSize: 13, fontWeight: '700', paddingVertical: 8 },
  extensionNotice: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#493965',
  },
  extensionNoticeText: { color: '#E7DFFA', fontSize: 12, lineHeight: 18 },
  shareContent: { marginTop: 22 },
  successors: { marginBottom: 20, gap: 7 },
  successorHint: { color: tokens.color.muted, fontSize: 12, marginBottom: 5 },
  successorOption: {
    minHeight: 40,
    borderRadius: 16,
    backgroundColor: '#EEE9F7',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  successorSelected: { borderWidth: 2, borderColor: tokens.color.purple },
  successorText: { color: tokens.color.foreground, fontSize: 13 },
  cancel: {
    color: tokens.color.purple,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 22,
  },
});
