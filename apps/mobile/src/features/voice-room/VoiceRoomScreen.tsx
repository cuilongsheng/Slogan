import { AppText as Text } from '../../components/ui/AppText';
import { roomLevelLabel } from '../room-discovery/presentation';
import { useRoomMessages } from './useRoomMessages';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  AppState,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
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
import { beginDirectJoin, useJoinDraft, type JoinDraft } from '../room-discovery/join';
import { RoomPasswordDialog } from '../room-discovery/RoomPasswordDialog';
import { RoomConsentPanel } from '../room-processing-consents';
import { remainingMinutes } from '../room-discovery/presentation';
import { VoiceRoomApi, type RoomMember } from './api';
import { ExpressionAssistanceApi } from './assistanceApi';
import { ExpressionAssistSheet } from './ExpressionAssistSheet';
import { RoomControls } from './RoomControls';
import { RoomExtensionSheet } from './RoomExtensionSheet';
import { RoomSafetyAlertsSheet } from './RoomSafetyAlertsSheet';
import { createVoiceMedia } from './media';
import { VoiceRoomSession, type VoiceSessionSnapshot } from './session';
import profileIcon from '../../../assets/icons/profile.png';
import micIcon from '../../../assets/icons/mic.png';
import backIcon from '../../../assets/icons/voice-back.png';
import exitIcon from '../../../assets/icons/voice-exit.png';
import moreIcon from '../../../assets/icons/voice-more.png';
import rulesIcon from '../../../assets/icons/voice-rules.png';
import sparklesIcon from '../../../assets/icons/voice-sparkles.png';
import hostIcon from '../../../assets/icons/voice-host.png';
import sendIcon from '../../../assets/icons/voice-send.png';
import roomMicIcon from '../../../assets/icons/voice-mic.png';
import micOffIcon from '../../../assets/icons/voice-mic-off.png';
import gbFlag from '../../../assets/icons/flag-gb.png';
import jpFlag from '../../../assets/icons/flag-jp.png';
import usFlag from '../../../assets/icons/flag-us.png';
import inFlag from '../../../assets/icons/flag-in.png';

const countryFlags: Record<string, number> = { GB: gbFlag, JP: jpFlag, US: usFlag, IN: inFlag };

const rules = [t('voiceRulesBody')];

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
    case 'ROOM_SPEECH_CONSENT_REQUIRED':
    case 'POST_ROOM_KEYWORDS_CONSENT_REQUIRED':
      return t('voiceProcessingConsentRequired');
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
  textStyle,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: object;
  textStyle?: object;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, style, disabled && styles.disabled]}
    >
      <Text style={[styles.actionText, textStyle]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SessionState({
  snapshot,
  session,
  roomId,
  draft,
  onPassword,
}: {
  snapshot: VoiceSessionSnapshot;
  session: VoiceRoomSession;
  roomId: string;
  draft: JoinDraft | null;
  onPassword: (password: string) => void;
}) {
  const router = useRouter();
  const [successor, setSuccessor] = useState<string | null>(null);
  const [consentReady, setConsentReady] = useState(false);
  const needsPassword =
    snapshot.credentialVersion === null &&
    ['ROOM_PASSWORD_REQUIRED', 'ROOM_PASSWORD_INVALID'].includes(snapshot.errorCode ?? '');
  const needsProcessingConsent = [
    'ROOM_SPEECH_CONSENT_REQUIRED',
    'POST_ROOM_KEYWORDS_CONSENT_REQUIRED',
  ].includes(snapshot.errorCode ?? '');
  const exiting = ['leaving', 'leaveUnconfirmed'].includes(snapshot.phase);
  const chooseSuccessor = snapshot.errorCode === 'ROOM_SUCCESSOR_INVALID';
  const busy = ['joining', 'connecting', 'leaving', 'idle'].includes(snapshot.phase);
  const title = exiting
    ? t(snapshot.phase === 'leaving' ? 'voiceLeaving' : 'voiceLeaveUnconfirmed')
    : snapshot.phase === 'preparationRequired'
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
  if (needsPassword)
    return (
      <VoicePage>
        <RoomPasswordDialog
          invalid={snapshot.errorCode === 'ROOM_PASSWORD_INVALID'}
          onCancel={() => router.replace('/rooms')}
          onSubmit={onPassword}
        />
      </VoicePage>
    );
  return (
    <VoicePage>
      <ScrollView contentContainerStyle={styles.entryScroll}>
        <View style={styles.stateHeader}>
          <Text style={styles.stateTitle}>
            {t(
              exiting
                ? 'voiceLeave'
                : snapshot.credentialVersion === null
                  ? 'voiceJoiningTitle'
                  : 'voiceReconnectingTitle',
            )}
          </Text>
          <Text style={styles.stateSubtitle}>
            {t(
              exiting
                ? 'voiceLocalAudioStopped'
                : snapshot.credentialVersion === null
                  ? 'voiceJoiningSubtitle'
                  : 'voiceReconnectSubtitle',
            )}
          </Text>
        </View>
        {needsProcessingConsent && snapshot.room && (
          <RoomConsentPanel
            safety={snapshot.room.sensitiveSpeechDetectionEnabled}
            keywords={snapshot.room.postRoomKeywordsEnabled}
            onReadyChange={setConsentReady}
            headingStyle={styles.consentHeading}
          />
        )}
        <View style={[styles.stateCard, needsProcessingConsent && styles.consentStateCard]}>
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
            {chooseSuccessor &&
              snapshot.members
                .filter((member) => member.role !== 'HOST' && member.presence === 'CONNECTED')
                .map((member) => (
                  <TouchableOpacity
                    key={member.membershipId}
                    accessibilityRole="button"
                    onPress={() => setSuccessor(member.membershipId)}
                    style={[
                      styles.successorOption,
                      successor === member.membershipId && styles.successorSelected,
                    ]}
                  >
                    <Text style={styles.successorText}>{member.displayName}</Text>
                  </TouchableOpacity>
                ))}
            {snapshot.phase === 'preparationRequired' || needsEarlierStep ? (
              <VoiceButton
                label={t(
                  snapshot.errorCode?.startsWith('ROOM_PASSWORD')
                    ? 'joinPasswordTitle'
                    : 'voiceBackToDiscover',
                )}
                onPress={() =>
                  router.replace(
                    snapshot.errorCode?.startsWith('ROOM_PASSWORD')
                      ? `/rooms/${roomId}/password`
                      : '/rooms',
                  )
                }
              />
            ) : (
              <VoiceButton
                disabled={
                  (needsProcessingConsent && !consentReady) ||
                  (chooseSuccessor &&
                    !successor &&
                    snapshot.members.some(
                      (member) => member.role !== 'HOST' && member.presence === 'CONNECTED',
                    ))
                }
                label={t('retry')}
                onPress={() =>
                  exiting ? void session.leave(successor ?? undefined) : void session.start(draft)
                }
              />
            )}
            {snapshot.credentialVersion !== null && !exiting && (
              <VoiceButton
                label={t('voiceLeave')}
                onPress={() => void session.leave()}
                style={styles.secondaryAction}
              />
            )}
            {snapshot.credentialVersion === null &&
              snapshot.phase !== 'preparationRequired' &&
              !needsEarlierStep && (
                <VoiceButton
                  label={t('voiceBackToDiscover')}
                  onPress={() => router.replace('/rooms')}
                  style={styles.secondaryAction}
                />
              )}
          </View>
        )}
      </ScrollView>
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
            {roomLevelLabel(snapshot.room)} ·{' '}
            {tf('roomPeople', { count: snapshot.room.memberCount })}
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
  onRemove,
}: {
  member: RoomMember;
  snapshot: VoiceSessionSnapshot;
  onPress: () => void;
  onRemove: (() => void) | undefined;
}) {
  const media = snapshot.media.participants.find(
    (participant) => participant.identity === member.participantIdentity,
  );
  return (
    <View style={styles.seat}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={member.displayName}
        onPress={onPress}
        style={styles.seatPress}
      >
        <View
          style={[
            styles.avatar,
            member.role === 'HOST' && styles.avatarHost,
            media?.speaking && styles.avatarSpeaking,
          ]}
        >
          <Image
            source={member.avatarUrl ? { uri: member.avatarUrl } : profileIcon}
            style={styles.avatarPhoto}
          />
          {member.nationalityCode && countryFlags[member.nationalityCode] && (
            <View style={styles.flagBadge}>
              <Image source={countryFlags[member.nationalityCode]} style={styles.countryFlag} />
            </View>
          )}
          {!media?.microphoneEnabled && (
            <View style={styles.seatMuted}>
              <Image source={micOffIcon} style={styles.seatMic} />
            </View>
          )}
        </View>
        <View style={styles.seatIdentity}>
          <View style={[styles.roleBadge, member.role === 'HOST' && styles.hostBadge]}>
            {member.role === 'HOST' ? (
              <Image source={hostIcon} style={styles.hostIcon} />
            ) : (
              <>
                <View style={styles.roleHead} />
                <View style={styles.roleShoulders} />
              </>
            )}
          </View>
          <Text numberOfLines={1} style={styles.seatName}>
            {member.displayName}
          </Text>
        </View>
      </TouchableOpacity>
      {onRemove && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${t('roomRemoveMember')} ${member.displayName}`}
          onPress={onRemove}
          style={styles.removeBadge}
        >
          <View style={styles.removeMark} />
        </TouchableOpacity>
      )}
    </View>
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
  const chat = useRoomMessages(api, snapshot.room!.id);
  const messageScroll = useRef<ScrollView>(null);
  const messageAtBottom = useRef(true);
  const muteRoomMicrophone = useCallback(async () => {
    if (session.snapshot.phase !== 'active' || session.snapshot.media.connection !== 'connected')
      return false;
    await session.setMicrophoneEnabled(false);
    return !session.snapshot.media.microphoneEnabled;
  }, [session]);
  const restoreRoomMicrophone = useCallback(async () => {
    if (
      AppState.currentState === 'background' ||
      AppState.currentState === 'inactive' ||
      session.snapshot.phase !== 'active' ||
      session.snapshot.media.connection !== 'connected'
    )
      return;
    await session.setMicrophoneEnabled(true);
    if (!session.snapshot.media.microphoneEnabled) throw new Error('ROOM_MIC_RESTORE_FAILED');
  }, [session]);
  const [endConfirm, setEndConfirm] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<RoomMember | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [assistanceOpen, setAssistanceOpen] = useState(false);
  const [safetyAlertsOpen, setSafetyAlertsOpen] = useState(false);
  const [extendResult, setExtendResult] = useState<{
    endsAt: string;
    providerStatus: 'COMPLETED' | 'PENDING' | 'UNAVAILABLE';
  } | null>(null);
  const [successorMembershipId, setSuccessorMembershipId] = useState<string | null>(null);
  const members = [...snapshot.members].sort((a, b) => a.position - b.position);
  const room = snapshot.room;
  if (!room) return null;
  return (
    <VoicePage>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          style={styles.backHit}
          onPress={() => {
            if (
              snapshot.role === 'HOST' &&
              members.some((member) => member.role !== 'HOST' && member.presence === 'CONNECTED')
            )
              setLeaveConfirm(true);
            else void session.leave();
          }}
        >
          <Image source={backIcon} style={styles.backIcon} />
        </TouchableOpacity>
        <View style={styles.headerMiddle}>
          <Text numberOfLines={1} style={styles.headerTopic}>
            {room.topic}
          </Text>
          <Text style={styles.headerMeta}>
            {room.memberCount} / {room.capacity} {t('voiceOnline')} ·{' '}
            {tf('roomRemainingMinutes', { minutes: remainingMinutes(room.endsAt) })}
          </Text>
          <Text style={styles.headerLevel}>{roomLevelLabel(room).replace('–', ' · ')}</Text>
        </View>
        {
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('voiceLeave')}
            style={styles.exitHit}
            onPress={() => {
              if (
                snapshot.role === 'HOST' &&
                members.some((member) => member.role !== 'HOST' && member.presence === 'CONNECTED')
              )
                setLeaveConfirm(true);
              else void session.leave();
            }}
          >
            <Image source={exitIcon} style={styles.exitIcon} />
          </TouchableOpacity>
        }
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('roomShareAction')}
          style={styles.moreHit}
          onPress={() => setShareOpen(true)}
        >
          <Image source={moreIcon} style={styles.moreIcon} />
        </TouchableOpacity>
        <Text style={styles.live}>● LIVE</Text>
      </View>
      <ScrollView style={styles.memberScroll} contentContainerStyle={styles.bodyContent}>
        <View style={styles.rulesBanner}>
          <View style={styles.rulesIcon}>
            <Image source={rulesIcon} style={styles.rulesImage} />
          </View>
          <View style={styles.rulesText}>
            <Text style={styles.rulesTitle}>{t('voiceRoomRules')}</Text>
            <Text style={styles.rulesPreview}>{rules.join(' ')}</Text>
          </View>
        </View>
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
        <View style={styles.participantStrip}>
          <TouchableOpacity accessibilityRole="button" onPress={() => setControlsOpen(true)}>
            <Text style={styles.membersHeading}>
              {t('voiceRoomMembers')} · {members.length} / {room.capacity} {t('voicePeople')}
            </Text>
          </TouchableOpacity>
          <View style={styles.membersGrid}>
            {members.map((member) => (
              <MemberSeat
                key={member.membershipId}
                member={member}
                snapshot={snapshot}
                onPress={() => setControlsOpen(true)}
                onRemove={
                  snapshot.role === 'HOST' && member.role !== 'HOST'
                    ? () => {
                        setRemoveTarget(member);
                        setControlsOpen(true);
                      }
                    : undefined
                }
              />
            ))}
            {Array.from({ length: Math.max(0, room.capacity - members.length) }, (_, index) => (
              <TouchableOpacity
                key={`empty-${index}`}
                accessibilityRole="button"
                accessibilityLabel={t('voiceEmptySeat')}
                onPress={() => setShareOpen(true)}
                style={[styles.seat, styles.inviteSeat]}
              >
                <View style={styles.emptySeat}>
                  <Text style={styles.emptyPlus}>+</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={styles.chatArea}>
        <View pointerEvents="none" style={styles.chatAmbientGold} />
        <View pointerEvents="none" style={styles.chatAmbientCoral} />
        <View style={styles.chatRow}>
          <ScrollView
            ref={messageScroll}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => {
              if (messageAtBottom.current) messageScroll.current?.scrollToEnd({ animated: true });
            }}
            onScroll={({ nativeEvent }) => {
              messageAtBottom.current =
                nativeEvent.contentOffset.y + nativeEvent.layoutMeasurement.height >=
                nativeEvent.contentSize.height - 24;
            }}
            scrollEventThrottle={100}
            keyboardShouldPersistTaps="handled"
          >
            {chat.messages.map((message) => (
              <View key={message.id} style={styles.message}>
                <Text style={styles.messageName}>{message.senderDisplayName}</Text>
                <Text selectable style={styles.messageText}>
                  {message.text}
                </Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('voiceAssistanceLater')}
            onPress={() => setAssistanceOpen(true)}
            style={styles.assistanceButton}
          >
            <Image source={sparklesIcon} style={styles.sparklesIcon} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.composer}>
        {(chat.error || chat.tooLong) && (
          <Text accessibilityRole="alert" style={styles.messageError}>
            {t(chat.tooLong ? 'roomMessageTooLong' : 'roomMessageFailed')}
          </Text>
        )}
        {!snapshot.media.audioPlaybackAllowed ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => void session.enableAudioPlayback()}
            style={styles.soundNotice}
          >
            <Text style={styles.soundNoticeText}>{t('voiceEnableSound')}</Text>
          </TouchableOpacity>
        ) : null}
        <View style={styles.controls}>
          <View style={styles.messageEntry}>
            <TextInput
              accessibilityLabel={t('voiceComposerLater')}
              placeholder={t('voiceComposerLater')}
              placeholderTextColor="#D5CFE3"
              value={chat.text}
              onChangeText={chat.setText}
              maxLength={2000}
              style={[styles.composerInput, styles.composerText]}
              onSubmitEditing={() => void chat.send()}
              returnKeyType="send"
            />
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('roomSendMessage')}
            disabled={chat.sending || chat.tooLong || !chat.text.trim()}
            onPress={() => void chat.send()}
            style={styles.sendButton}
          >
            <Image source={sendIcon} style={styles.sendImage} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              snapshot.media.microphoneEnabled ? t('voiceMute') : t('voiceUnmute')
            }
            onPress={() => void session.setMicrophoneEnabled(!snapshot.media.microphoneEnabled)}
            style={[styles.micButton, snapshot.media.microphoneEnabled && styles.micOn]}
          >
            <Image
              source={snapshot.media.microphoneEnabled ? micIcon : roomMicIcon}
              style={styles.micImage}
            />
          </TouchableOpacity>
        </View>
      </View>
      {(endConfirm || leaveConfirm) && (
        <View style={styles.overlay}>
          <View style={[styles.confirmSheet, leaveConfirm && styles.handoffSheet]}>
            <View style={leaveConfirm && styles.handoffHeader}>
              <Text style={[styles.confirmTitle, leaveConfirm && styles.handoffTitle]}>
                {endConfirm ? t('voiceEndConfirmTitle') : t('voiceLeaveConfirmTitle')}
              </Text>
              {leaveConfirm && (
                <>
                  <View pointerEvents="none" style={styles.handoffDots}>
                    <View style={[styles.handoffDot, { backgroundColor: '#FF6F70' }]} />
                    <View
                      style={[styles.handoffDot, { backgroundColor: '#FFD65A', marginTop: 3 }]}
                    />
                    <View style={[styles.handoffDot, { backgroundColor: '#23C8BE' }]} />
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('roomCloseSheet')}
                    style={styles.handoffClose}
                    onPress={() => {
                      setLeaveConfirm(false);
                      setSuccessorMembershipId(null);
                    }}
                  >
                    <Text style={styles.handoffCloseText}>×</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            <Text style={[styles.confirmBody, leaveConfirm && styles.handoffBody]}>
              {endConfirm ? t('voiceEndConfirmBody') : t('roomLeaveHostBody')}
            </Text>
            {leaveConfirm && snapshot.role === 'HOST' && (
              <View style={[styles.successors, styles.handoffCandidates]}>
                {members.filter(
                  (member) => member.role !== 'HOST' && member.presence === 'CONNECTED',
                ).length === 0 ? (
                  <Text style={styles.successorHint}>{t('roomLeaveNoSuccessor')}</Text>
                ) : (
                  <>
                    <Text style={styles.handoffHint}>{t('roomLeaveSuccessor')}</Text>
                    {members
                      .filter((member) => member.role !== 'HOST' && member.presence === 'CONNECTED')
                      .map((member) => (
                        <TouchableOpacity
                          key={member.membershipId}
                          accessibilityRole="button"
                          accessibilityLabel={member.displayName}
                          onPress={() => setSuccessorMembershipId(member.membershipId)}
                          style={[
                            styles.handoffOption,
                            successorMembershipId === member.membershipId &&
                              styles.successorSelected,
                          ]}
                        >
                          <Text style={styles.handoffName}>{member.displayName}</Text>
                          <Text style={styles.handoffPresence}>
                            {t(
                              snapshot.media.participants.some(
                                (p) => p.identity === member.participantIdentity && p.speaking,
                              )
                                ? 'roomHandoffSpeaking'
                                : snapshot.media.participants.some(
                                      (p) =>
                                        p.identity === member.participantIdentity &&
                                        p.microphoneEnabled,
                                    )
                                  ? 'roomHandoffOnline'
                                  : 'roomHandoffMuted',
                            )}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </>
                )}
              </View>
            )}
            <VoiceButton
              style={leaveConfirm ? styles.handoffAction : {}}
              textStyle={leaveConfirm ? styles.handoffActionText : {}}
              disabled={
                !endConfirm &&
                leaveConfirm &&
                !successorMembershipId &&
                members.some((member) => member.role !== 'HOST' && member.presence === 'CONNECTED')
              }
              label={
                endConfirm
                  ? t('voiceEndRoom')
                  : leaveConfirm && snapshot.role === 'HOST'
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
            {endConfirm && (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => {
                  setEndConfirm(false);
                  setLeaveConfirm(false);
                }}
              >
                <Text style={styles.cancel}>{t('cancelAction')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      {shareOpen && (
        <View style={styles.overlay}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>{t('roomShareAction')}</Text>
            <View style={styles.shareContent}>
              <RoomShareAction url={room.shareUrl} />
              {snapshot.role === 'HOST' && (
                <>
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => {
                      setShareOpen(false);
                      setExtendOpen(true);
                    }}
                  >
                    <Text style={styles.cancel}>{t('roomExtendAction')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => {
                      setShareOpen(false);
                      setEndConfirm(true);
                    }}
                  >
                    <Text style={styles.cancel}>{t('voiceEndRoom')}</Text>
                  </TouchableOpacity>
                </>
              )}
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
          {...(removeTarget ? { initialRemoveTarget: removeTarget } : {})}
          onClose={() => {
            setControlsOpen(false);
            setRemoveTarget(null);
          }}
        />
      )}
      {assistanceOpen && (
        <ExpressionAssistSheet
          roomId={room.id}
          api={assistanceApi}
          muteRoomMicrophone={muteRoomMicrophone}
          restoreRoomMicrophone={restoreRoomMicrophone}
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

export function VoiceRoomScreen({
  roomId,
  invitationId,
}: {
  roomId: string;
  invitationId?: string;
}) {
  const router = useRouter();
  const { authorized } = useAuth();
  const { draft, clear } = useJoinDraft();
  const [entryDraft, setEntryDraft] = useState(() =>
    beginDirectJoin(
      draft,
      roomId,
      invitationId ?? (draft?.roomId === roomId ? draft.invitationId : undefined),
    ),
  );
  const initialDraft = useRef(entryDraft);
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
  return (
    <SessionState
      snapshot={snapshot}
      session={session}
      roomId={roomId}
      draft={entryDraft}
      onPassword={(password) => {
        const nextDraft = { ...entryDraft, password };
        setEntryDraft(nextDraft);
        void session.start(nextDraft);
      }}
    />
  );
}

const styles = StyleSheet.create({
  assistanceButton: {
    width: 38,
    height: 38,
    borderRadius: 20,
    backgroundColor: '#443263',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHost: { borderColor: '#6546EC' },
  seatPress: { width: 76, height: 74, alignItems: 'center' },
  participantStrip: {
    minHeight: 191,
    marginTop: 8,
    marginLeft: -3,
    marginRight: 2,
    backgroundColor: '#38295B',
    paddingBottom: 9,
  },
  memberScroll: { flexGrow: 0, flexShrink: 1 },
  removeMark: { width: 10, height: 2.5, borderRadius: 1.25, backgroundColor: '#FFFFFF' },
  removeBadge: {
    position: 'absolute',
    right: 0,
    top: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#9B355B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleShoulders: {
    position: 'absolute',
    bottom: 4,
    width: 9,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  roleHead: {
    position: 'absolute',
    top: 3,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  hostBadge: { backgroundColor: '#7353E9' },
  roleBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#59A9F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatMuted: {
    position: 'absolute',
    left: 10,
    top: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#22222BD6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagBadge: {
    position: 'absolute',
    left: -9,
    top: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatAmbientCoral: {
    position: 'absolute',
    right: -48,
    bottom: 46,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FF6F70',
    opacity: 0.13,
  },
  chatAmbientGold: {
    position: 'absolute',
    left: -130,
    bottom: -157,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#5C3FA0',
  },
  chatRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: 16,
    paddingRight: 11,
    paddingBottom: 6,
    gap: 5,
  },
  chatArea: { flex: 1, minHeight: 44, overflow: 'hidden' },
  messagesContent: { flexGrow: 1, justifyContent: 'flex-end', gap: 6 },
  entryScroll: { flexGrow: 1 },
  consentHeading: { color: '#fff' },
  consentStateCard: { marginTop: 24 },
  messages: { flex: 1 },
  avatarPhoto: { width: 48, height: 48, borderRadius: 24 },
  message: {
    backgroundColor: '#503589',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  messageName: { color: '#C8BBFF', fontSize: 11, lineHeight: 18, maxWidth: 76, minWidth: 34 },
  messageText: { flex: 1, color: '#C8BBFF', fontSize: 13, lineHeight: 18 },
  messageError: { color: '#FF9C9F', fontSize: 12, marginBottom: 6 },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: 6,
    backgroundColor: tokens.color.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendImage: { width: 24, height: 24 },
  countryFlag: { width: 14, height: 10 },
  seatMic: { width: 16, height: 16 },
  seatIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
    paddingLeft: 5,
  },
  hostIcon: { width: 12, height: 12 },
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
    height: 88,
    flexShrink: 0,
    marginHorizontal: 16,
    backgroundColor: '#30204E',
    borderRadius: 12,
  },
  backHit: { position: 'absolute', left: -6, top: -2, width: 36, height: 38 },
  backIcon: { position: 'absolute', left: 9, top: 5, width: 24, height: 24 },
  headerMiddle: { position: 'absolute', left: 36, top: 3, width: 232 },
  headerTopic: { color: '#fff', fontSize: 18, lineHeight: 25, fontWeight: '700', height: 31 },
  headerMeta: { color: '#C8BBFF', fontSize: 12, lineHeight: 17, marginTop: 5, height: 24 },
  headerLevel: { color: '#C8BBFF', fontSize: 11, lineHeight: 15, fontWeight: '500', marginTop: 2 },
  exitHit: { position: 'absolute', left: 270, top: 0, width: 34, height: 34 },
  exitIcon: { position: 'absolute', left: 13, top: 3, width: 18, height: 18 },
  moreHit: { position: 'absolute', right: 0, top: -2, width: 46, height: 42 },
  moreIcon: { position: 'absolute', left: 8, top: 2, width: 24, height: 24, tintColor: '#FFFFFF' },
  live: {
    position: 'absolute',
    left: 283,
    width: 68,
    textAlign: 'right',
    top: 40,
    color: '#71E8CD',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  bodyContent: { paddingBottom: 0 },
  rulesBanner: {
    marginHorizontal: 16,
    marginTop: 4,
    minHeight: 76,
    borderRadius: 18,
    backgroundColor: '#150F29',
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 10,
  },
  rulesIcon: {
    alignSelf: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#7353E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rulesImage: { width: 20, height: 20 },
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
  rulesTitle: { color: '#FFFFFF', fontSize: 11, lineHeight: 16, fontWeight: '500' },
  rulesPreview: { color: '#FFFFFF', fontSize: 11, lineHeight: 17 },
  membersHeading: {
    color: '#D7CFF0',
    fontSize: 12,
    lineHeight: 22,
    fontWeight: '500',
    marginHorizontal: 16,
    marginTop: 9,
  },
  membersGrid: {
    marginHorizontal: 16,
    marginTop: 3,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 18,
    justifyContent: 'center',
  },
  seat: { width: 76, height: 74, alignItems: 'center' },
  inviteSeat: { height: 56, justifyContent: 'flex-start', paddingTop: 2 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#B4A7D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSpeaking: { borderColor: '#23C8BE' },
  seatName: { color: '#FFFFFF', fontSize: 12, lineHeight: 20, fontWeight: '500', maxWidth: 58 },
  emptySeat: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#B8A9D4',
    backgroundColor: '#463864',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPlus: { color: '#FFFFFF', fontSize: 29, lineHeight: 40, fontWeight: '500' },
  composer: {
    backgroundColor: '#271D3E',
    paddingBottom: Platform.OS === 'web' ? 17 : 8,
    paddingLeft: 16,
    paddingRight: 24,
    paddingTop: 8,
    flexShrink: 0,
  },
  sparklesIcon: { width: 20, height: 20, marginTop: 6, marginLeft: 7 },
  soundNotice: {
    height: 46,
    borderRadius: 14,
    marginTop: 4,
    backgroundColor: '#5A3D95',
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  soundNoticeText: { color: '#E4DDF4', fontSize: 11, fontWeight: '700' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  messageEntry: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2C2545',
    justifyContent: 'center',
  },
  composerInput: {
    flex: 1,
    height: 56,
    borderRadius: 25,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  composerText: { fontFamily: 'NotoSansSC', color: '#FFFFFF', fontSize: 14 },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4F407A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micOn: { backgroundColor: '#6943DF' },
  micImage: { width: 24, height: 24, tintColor: '#fff' },
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
  handoffSheet: {
    minHeight: 420,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 42,
    backgroundColor: '#34274F',
  },
  handoffHeader: { height: 30 },
  handoffTitle: { color: '#FFFFFF', fontSize: 20, lineHeight: 28, fontWeight: '500' },
  handoffClose: {
    position: 'absolute',
    right: 0,
    top: -4,
    width: 28,
    height: 28,
    alignItems: 'center',
  },
  handoffCloseText: { color: '#D6CBE9', fontSize: 22, fontWeight: '500', lineHeight: 28 },
  handoffDots: { position: 'absolute', left: 254, top: 0, flexDirection: 'row', gap: 5 },
  handoffDot: { width: 7, height: 7, borderRadius: 4 },
  handoffBody: {
    color: '#C8BCE0',
    fontSize: 13,
    lineHeight: 18,
    height: 52,
    marginTop: 14,
    marginBottom: 9,
  },
  handoffCandidates: { gap: 8, marginBottom: 22 },
  handoffHint: { color: '#C8BCE0', fontSize: 12, lineHeight: 17, height: 22, fontWeight: '500' },
  handoffOption: {
    height: 44,
    borderRadius: 24,
    backgroundColor: '#45365E',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  handoffName: { color: '#FFFFFF', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  handoffPresence: { color: '#C8BCE0', fontSize: 11, lineHeight: 16, width: 86 },
  handoffAction: { height: 48, minHeight: 48, borderRadius: 24, backgroundColor: '#6D4DE3' },
  handoffActionText: { fontWeight: '500' },
  confirmBody: { color: tokens.color.muted, fontSize: 13, marginTop: 17, marginBottom: 32 },
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
