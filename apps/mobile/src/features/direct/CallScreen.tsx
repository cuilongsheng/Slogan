import micIcon from '../../../assets/icons/direct-microphone.png';
import micOffIcon from '../../../assets/icons/voice-mic-off.png';
import defaultAvatar from '../../../assets/profile/default-avatar.png';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { RoomPage } from '../../components/ui/RoomPage';
import { AppText as Text } from '../../components/ui/AppText';
import { t, tf, useLanguage, type MessageKey } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../auth';
import { createVoiceMedia } from '../voice-room';
import { DirectApi, directError, type DirectCall } from './api';
import { DirectHeading, directColors } from './components';
import { useFocusedPolling } from './useFocusedPolling';
import { queueCallEnd, flushCallEnds, locallyEnded } from './callRecovery';
export function CallScreen({ callId }: { callId: string }) {
  useLanguage();
  const router = useRouter(),
    navigation = useNavigation();
  const { state, authorized } = useAuth();
  const owner = state.kind === 'signedIn' ? state.me.userId : '';
  const api = useMemo(() => new DirectApi(authorized), [authorized]),
    media = useMemo(() => createVoiceMedia(), []);
  const [call, setCall] = useState<DirectCall | null>(null),
    [snapshot, setSnapshot] = useState(media.snapshot),
    [error, setError] = useState<MessageKey | null>(null),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0),
    [now, setNow] = useState(() => Date.now());
  const mediaUnavailableSince = useRef<number | null>(null);
  const callRef = useRef(call),
    leaving = useRef(false),
    acceptId = useRef<string | null>(null);
  useEffect(() => {
    callRef.current = call;
  }, [call]);
  const incoming = call?.calleeUserId === owner,
    active = call?.status === 'ACTIVE',
    live = active || call?.status === 'RINGING';
  useEffect(() => media.subscribe(setSnapshot), [media]);
  const refresh = useCallback(
    async (current: () => boolean = () => true) => {
      try {
        const value =
          callRef.current?.status === 'ACTIVE'
            ? await api.heartbeat(callId)
            : await api.call(callId);
        if (!current() || leaving.current) return;
        setCall((previous) => {
          const peer = value.peer ?? previous?.peer;
          return { ...value, ...(peer ? { peer } : {}) };
        });
        if (!['RINGING', 'ACTIVE'].includes(value.status)) void media.disconnect();
      } catch (e) {
        if (current()) setError(directError(e));
      }
    },
    [api, callId, media],
  );
  useFocusedPolling(refresh, 5000);
  const leave = useCallback(
    (action: 'end' | 'reject' = 'end') => {
      if (leaving.current) return;
      leaving.current = true;
      // Local tracks stop immediately; business/media cleanup continues independently.
      void media.disconnect();
      if (callRef.current && ['RINGING', 'ACTIVE'].includes(callRef.current.status)) {
        queueCallEnd(owner, callId, action);
        void flushCallEnds(owner, api);
      }
      const conversationId = callRef.current?.conversationId;
      router.replace(conversationId ? `/messages/${conversationId}` : '/messages');
    },
    [media, owner, callId, api, router],
  );
  useFocusEffect(
    useCallback(() => {
      const back =
        Platform.OS === 'web'
          ? { remove() {} }
          : BackHandler.addEventListener('hardwareBackPress', () => {
              leave();
              return true;
            });
      const remove = navigation.addListener('beforeRemove', (event) => {
        if (leaving.current) return;
        event.preventDefault();
        leave();
      });
      return () => {
        back.remove();
        remove();
        void media.disconnect();
        if (
          callRef.current &&
          ['RINGING', 'ACTIVE'].includes(callRef.current.status) &&
          !locallyEnded(callId)
        ) {
          queueCallEnd(owner, callId);
          void flushCallEnds(owner, api);
        }
      };
    }, [navigation, leave, media, owner, callId, api]),
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!active) return;
    let current = true;
    void (async () => {
      try {
        const credential = await api.credentials(callId);
        if (!current || leaving.current) return;
        await media.connect({
          serverUrl: credential.url,
          participantToken: credential.token,
          roomId: `direct-${callId}`,
        });
        if (!current || leaving.current) {
          void media.disconnect();
          return;
        }
        await media.checkDevices();
        const checked = media.snapshot;
        if (checked.deviceCheck?.microphone === 'ready') await media.setMicrophoneEnabled(true);
        if (
          checked.deviceCheck?.microphone !== 'ready' ||
          checked.deviceCheck?.playback !== 'ready'
        )
          setError('directCallDevice');
        else setError(null);
      } catch {
        if (current && !leaving.current) setError('directCallDevice');
      }
    })();
    return () => {
      current = false;
      void media.disconnect();
    };
  }, [active, api, callId, media, retry]);
  useEffect(() => {
    if (!active || snapshot.connection === 'connected') {
      mediaUnavailableSince.current = null;
      return;
    }
    mediaUnavailableSince.current ??= now;
    if (now - mediaUnavailableSince.current >= 60_000) leave();
  }, [active, snapshot.connection, now, leave]);
  const accept = async () => {
    if (busy) return;
    setBusy(true);
    acceptId.current ??= randomUUID();
    try {
      const value = await api.callAction(callId, 'accept', acceptId.current);
      setCall((previous) => {
        const peer = value.peer ?? previous?.peer;
        return { ...value, ...(peer ? { peer } : {}) };
      });
      setError(null);
    } catch (e) {
      setError(directError(e));
    } finally {
      setBusy(false);
    }
  };
  const toggle = async () => {
    try {
      await media.setMicrophoneEnabled(!snapshot.microphoneEnabled);
      setError(null);
    } catch {
      setError('directCallDevice');
    }
  };
  const seconds = call?.acceptedAt
      ? Math.max(0, Math.floor((now - Date.parse(call.acceptedAt)) / 1000))
      : 0,
    duration = `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  const endedLabel: MessageKey =
    call?.status === 'EXPIRED'
      ? 'directCallExpired'
      : call?.status === 'REJECTED'
        ? 'directCallRejected'
        : 'directCallEnded';
  return (
    <RoomPage direct dark={!!active}>
      {!call ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={directColors.violet} />
          {error && (
            <TouchableOpacity onPress={() => void refresh()}>
              <Text style={styles.error}>
                {t(error === 'directCallDevice' ? 'directDeviceRetry' : error)}
                {error === 'directCallDevice' ? '' : ' · ' + t('retry')}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => leave()}>
            <Text style={styles.cancel}>{t('back')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.body}>
          {active ? (
            <>
              <Text numberOfLines={1} style={styles.activeTitle}>
                {tf('directCallWithPeer', { name: call.peer?.displayName ?? '' })}
              </Text>
              <Text style={styles.duration}>{duration}</Text>
            </>
          ) : (
            <DirectHeading
              title={t(live ? 'directVoiceAction' : endedLabel)}
              subtitle={
                incoming && live
                  ? undefined
                  : t(call.status === 'ENDED' ? 'directCallStopped' : 'directCallPrivate')
              }
            />
          )}
          <Image
            source={call.peer?.avatarUrl ? { uri: call.peer.avatarUrl } : defaultAvatar}
            style={[styles.photo, active && styles.activePhoto]}
          />
          {live && (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              style={[styles.name, active && styles.activeName]}
            >
              {active
                ? t(
                    snapshot.connection === 'connected'
                      ? 'directCallConnected'
                      : snapshot.connection === 'reconnecting'
                        ? 'directCallReconnecting'
                        : 'directCallConnecting',
                  )
                : incoming && call.status === 'RINGING'
                  ? tf('directCallerIncoming', { name: call.peer?.displayName ?? '' })
                  : (call.peer?.displayName ?? '')}
            </Text>
          )}
          {call.status === 'RINGING' && !incoming && (
            <Text style={styles.hint}>
              {t(incoming ? 'directCallIncoming' : 'directCallOutgoing')}
            </Text>
          )}
          {error && (
            <TouchableOpacity
              style={styles.errorPanel}
              onPress={() => {
                if (active) setRetry((value) => value + 1);
                else void refresh();
              }}
            >
              <Text accessibilityRole="alert" style={[styles.error, active && styles.lightError]}>
                {t(error === 'directCallDevice' ? 'directDeviceRetry' : error)}
                {error === 'directCallDevice' ? '' : ' · ' + t('retry')}
              </Text>
            </TouchableOpacity>
          )}
          {active && !snapshot.audioPlaybackAllowed && (
            <TouchableOpacity
              style={styles.playback}
              onPress={() => void media.startAudio().catch(() => setError('directCallDevice'))}
            >
              <Text style={styles.cancel}>{t('voiceEnableSound')}</Text>
            </TouchableOpacity>
          )}
          <View style={[styles.controls, active && styles.activeControls]}>
            {active ? (
              <>
                <View style={styles.controlGroup}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t(snapshot.microphoneEnabled ? 'voiceMute' : 'voiceUnmute')}
                    accessibilityState={{ selected: !snapshot.microphoneEnabled }}
                    style={styles.mic}
                    onPress={() => void toggle()}
                  >
                    <Image
                      source={snapshot.microphoneEnabled ? micIcon : micOffIcon}
                      style={styles.micIcon}
                    />
                  </TouchableOpacity>
                  <Text style={styles.controlLabel}>{t('directMicrophone')}</Text>
                </View>
                <View style={styles.controlGroup}>
                  <TouchableOpacity
                    style={styles.end}
                    accessibilityRole="button"
                    accessibilityLabel={t('directCallEnd')}
                    onPress={() => leave()}
                  >
                    <Text style={styles.endIcon}>×</Text>
                  </TouchableOpacity>
                  <Text style={styles.controlLabel}>{t('directCallEnd')}</Text>
                </View>
              </>
            ) : call.status === 'RINGING' && incoming ? (
              <>
                <TouchableOpacity
                  style={styles.decline}
                  accessibilityRole="button"
                  onPress={() => leave('reject')}
                >
                  <Text style={styles.declineText}>{t('directCallReject')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.accept}
                  disabled={busy}
                  accessibilityRole="button"
                  onPress={() => void accept()}
                >
                  <Text style={styles.actionText}>
                    {t(busy ? 'submitting' : 'directCallAccept')}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.fullAction}
                accessibilityRole="button"
                onPress={() => leave()}
              >
                <Text style={styles.actionText}>
                  {t(live ? 'cancelAction' : 'directCallReturn')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </RoomPage>
  );
}
const styles = StyleSheet.create({
  body: { flex: 1 },
  activeTitle: {
    position: 'absolute',
    top: 11,
    left: 25,
    right: 25,
    fontSize: 18,
    height: 38,
    lineHeight: 26,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  duration: {
    position: 'absolute',
    top: 73,
    left: 145,
    right: 145,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  photo: {
    position: 'absolute',
    top: 102,
    width: 140,
    height: 140,
    borderRadius: 70,
    alignSelf: 'center',
  },
  activePhoto: { top: 134, width: 160, height: 160, borderRadius: 80 },
  name: {
    position: 'absolute',
    top: 260,
    left: 45,
    right: 45,
    fontSize: 14,
    height: 32,
    lineHeight: 32,
    fontWeight: '700',
    textAlign: 'center',
    color: directColors.ink,
  },
  activeName: {
    top: 327,
    height: 30,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    color: '#FFFFFF',
  },
  hint: {
    position: 'absolute',
    top: 387,
    left: 40,
    right: 40,
    fontSize: 14,
    height: 28,
    lineHeight: 20,
    textAlign: 'center',
    color: directColors.muted,
  },
  controls: {
    position: 'absolute',
    bottom: 70,
    left: 24,
    right: 24,
    flexDirection: 'row',
    gap: 18,
  },
  activeControls: { bottom: 56, left: 68, right: 64, justifyContent: 'space-between' },
  controlGroup: { width: 108, alignItems: 'center', gap: 7 },
  controlLabel: {
    marginTop: 0,
    width: 108,
    height: 24,
    lineHeight: 18,
    fontSize: 12,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  micIcon: { width: 27, height: 27, tintColor: directColors.violet },
  endIcon: {
    width: 72,
    height: 42,
    lineHeight: 40,
    fontSize: 29,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  decline: {
    flex: 1,
    height: 55,
    borderRadius: 28,
    backgroundColor: tokens.color.purpleSoft,
    justifyContent: 'center',
  },
  declineText: {
    fontSize: 14,
    lineHeight: 20,
    height: 22,
    fontWeight: '500',
    textAlign: 'center',
    color: directColors.violet,
  },
  accept: {
    flex: 1,
    height: 55,
    borderRadius: 28,
    backgroundColor: directColors.violet,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 14,
    lineHeight: 20,
    height: 22,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  mic: {
    width: 72,
    height: 72,
    alignItems: 'center',
    borderRadius: 36,
    backgroundColor: tokens.color.purpleSoft,
    justifyContent: 'center',
  },
  end: {
    width: 72,
    height: 72,
    alignItems: 'center',
    borderRadius: 36,
    backgroundColor: tokens.color.coral,
    justifyContent: 'center',
  },
  fullAction: {
    width: '100%',
    height: 55,
    borderRadius: 28,
    backgroundColor: directColors.violet,
    justifyContent: 'center',
  },
  errorPanel: { position: 'absolute', top: 470, left: 24, right: 24 },
  error: {
    fontSize: 12,
    lineHeight: 20,
    color: tokens.color.error,
    textAlign: 'center',
    padding: 10,
  },
  lightError: { color: '#FFD65A' },
  playback: {
    position: 'absolute',
    top: 530,
    left: 24,
    right: 24,
    backgroundColor: tokens.color.purpleSoft,
    borderRadius: 18,
  },
  cancel: {
    fontSize: 14,
    lineHeight: 24,
    color: directColors.violet,
    textAlign: 'center',
    padding: 12,
  },
});
