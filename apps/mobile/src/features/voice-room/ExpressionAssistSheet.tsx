import { largeAction } from '../../components/ui/largeAction';
import { AppText as Text } from '../../components/ui/AppText';
import { useEffect, useMemo, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { AppState, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { t, tf } from '../../services/locale';
import { usePrivateRecorder } from '../../services/usePrivateRecorder';
import { tokens } from '../../styles/tokens';
import { RoomApiError } from '../room-discovery/api';
import type { ExpressionAssistanceApi, AudioConsent } from './assistanceApi';
import { HoldToTalk } from './holdToTalk';
import micIcon from '../../../assets/icons/mic.png';
import burstIcon from '../../../assets/icons/speech-burst.png';

function failureMessage(error: unknown) {
  if (error instanceof Error && error.message === 'PRIVATE_MIC_NOT_MUTED')
    return t('assistanceMicPrivacy');
  if (error instanceof RoomApiError) {
    if (error.status === 429) return t('assistanceQuota');
    if (error.code === 'ASSISTANCE_CONSENT_REQUIRED') return t('assistanceConsentFailed');
    if (error.status === 503) return t('assistanceUnavailable');
  }
  return t('assistanceAudioFailed');
}
interface ExpressionAssistSheetProps {
  roomId: string;
  api: ExpressionAssistanceApi;
  muteRoomMicrophone: () => Promise<boolean>;
  restoreRoomMicrophone: () => Promise<void>;
  onClose: () => void;
  available?: boolean;
}

// Keep the unavailable release state outside the recorder-owning component.
// Opening or closing this notice must not touch the room's audio session.
export function ExpressionAssistSheet(props: ExpressionAssistSheetProps) {
  if (props.available) return <AvailableExpressionAssistSheet {...props} />;
  return (
    <View style={styles.overlay}>
      <View testID="expression-assistance-sheet" style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.headingRow}>
          <Text style={styles.title}>{t('assistanceTitle')}</Text>
          <Image source={burstIcon} style={styles.burst} />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('roomCloseSheet')}
            style={styles.closeButton}
            onPress={props.onClose}
          >
            <Text style={styles.close}>×</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.private}>{t('assistancePrivate')}</Text>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.explanation}>{t('assistanceConsentBody')}</Text>
          <Primary label={t('assistanceAccept')} disabled onPress={() => undefined} />
          <Text accessibilityRole="text" style={styles.hint}>
            {t('assistanceInDevelopment')}
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

function AvailableExpressionAssistSheet({
  roomId,
  api,
  muteRoomMicrophone,
  restoreRoomMicrophone,
  onClose,
}: ExpressionAssistSheetProps) {
  const { start, stop, discard, elapsedSeconds } = usePrivateRecorder();
  const [consent, setConsent] = useState<AudioConsent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [settings, setSettings] = useState(false);
  const hold = useMemo(
    () =>
      new HoldToTalk({
        mute: muteRoomMicrophone,
        restore: restoreRoomMicrophone,
        start,
        stop,
        discard,
        requestId: randomUUID,
        translate: async (clip, requestId, signal) => {
          const current = await api.consent(signal);
          if (signal.aborted) throw new Error('ASSISTANCE_CANCELLED');
          if (current.status !== 'ACCEPTED')
            throw new RoomApiError(403, 'ASSISTANCE_CONSENT_REQUIRED');
          return (await api.audio(roomId, clip, current.currentNoticeVersion, requestId, signal))
            .primary.text;
        },
      }),
    [api, roomId, muteRoomMicrophone, restoreRoomMicrophone, start, stop, discard],
  );
  const [state, setState] = useState(hold.state);
  useEffect(() => hold.subscribe(setState), [hold]);
  useEffect(() => {
    let active = true;
    api
      .consent()
      .then((value) => {
        if (active) setConsent(value);
      })
      .catch((cause) => {
        if (active) setError(cause);
      });
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') void hold.cancel();
    });
    return () => {
      active = false;
      subscription.remove();
      void hold.cancel();
    };
  }, [api, hold]);
  async function updateConsent(revoke: boolean) {
    if (!consent || busy) return;
    setBusy(true);
    setError(null);
    try {
      setConsent(
        await (revoke
          ? api.revokeConsent(consent.currentNoticeVersion, randomUUID())
          : api.acceptConsent(consent.currentNoticeVersion, randomUUID())),
      );
      setSettings(false);
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }
  const recording = ['starting', 'recording', 'stopping'].includes(state.phase);
  const processing = state.phase === 'translating';
  const microphone = (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t('assistanceStart')}
      disabled={busy || state.phase === 'stopping'}
      style={[styles.micCircle, recording && styles.listeningCircle]}
      onPressIn={() => {
        setError(null);
        hold.press();
      }}
      onPressOut={() => void hold.release()}
    >
      <Image source={micIcon} style={styles.micIcon} />
    </TouchableOpacity>
  );
  return (
    <View style={styles.overlay}>
      <View testID="expression-assistance-sheet" style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.headingRow}>
          <Text style={styles.title}>
            {t(state.phase === 'result' ? 'assistanceResultTitle' : 'assistanceTitle')}
          </Text>
          <Image source={burstIcon} style={styles.burst} />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('roomCloseSheet')}
            style={styles.closeButton}
            onPress={() => {
              void hold.cancel();
              onClose();
            }}
          >
            <Text style={styles.close}>×</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.private}>{t('assistancePrivate')}</Text>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!consent ? (
            <Text style={styles.status}>
              {error ? failureMessage(error) : t('assistanceLoading')}
            </Text>
          ) : consent.status !== 'ACCEPTED' ? (
            <>
              <Text style={styles.explanation}>{t('assistanceConsentBody')}</Text>
              <Primary
                label={t('assistanceAccept')}
                disabled={busy}
                onPress={() => void updateConsent(false)}
              />
            </>
          ) : settings ? (
            <>
              <Text style={styles.explanation}>{t('assistanceConsentBody')}</Text>
              <Primary
                label={t('assistanceRevoke')}
                disabled={busy}
                onPress={() => void updateConsent(true)}
              />
            </>
          ) : state.phase === 'result' ? (
            <>
              <View style={styles.resultCard}>
                <Text selectable style={styles.resultText}>
                  {state.text}
                </Text>
              </View>
              <View style={styles.resultMicrophone}>{microphone}</View>
            </>
          ) : processing ? (
            <Text style={styles.status}>{t('assistanceLoading')}</Text>
          ) : (
            <>
              {microphone}
              <Text style={styles.actionLabel}>
                {recording
                  ? tf('assistanceDuration', {
                      seconds: `00:${String(elapsedSeconds).padStart(2, '0')}`,
                    })
                  : t('assistanceStart')}
              </Text>
              <Text style={styles.hint}>{t('assistanceHoldHint')}</Text>
              {state.phase === 'error' && (
                <Primary label={t('retry')} onPress={() => void hold.retry()} />
              )}
            </>
          )}
          {!!(error ?? state.error) && (
            <Text accessibilityRole="alert" style={styles.error}>
              {failureMessage(error ?? state.error)}
            </Text>
          )}
        </ScrollView>
        {consent?.status === 'ACCEPTED' && !recording && !processing && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('assistanceConsentTitle')}
            onPress={() => setSettings((value) => !value)}
          >
            <Text style={styles.settings}>{t('assistanceConsentTitle')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
function Primary({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={[styles.primary, disabled && styles.disabled]}
      onPress={onPress}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(20, 12, 44, 0.72)',
    justifyContent: 'flex-end',
    zIndex: 30,
  },
  sheet: {
    height: 394,
    maxHeight: '82%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#34274F',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  grabber: {
    width: 52,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    backgroundColor: '#66557F',
    marginBottom: 13,
  },
  headingRow: {
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    paddingRight: 48,
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
  },
  burst: { position: 'absolute', right: 52, top: 4, width: 27, height: 27 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  close: { width: 26, color: '#C8BCE0', fontSize: 26, lineHeight: 30 },
  private: { color: '#C8BCE0', fontSize: 13, lineHeight: 18, marginTop: 5 },
  content: { minHeight: 245, paddingBottom: 12 },
  micCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: tokens.color.coral,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 33,
  },
  listeningCircle: { backgroundColor: tokens.color.mint },
  micIcon: { width: 29, height: 29, tintColor: '#fff' },
  actionLabel: {
    color: tokens.color.purple,
    textAlign: 'center',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
    marginTop: 10,
  },
  hint: {
    color: '#C8BCE0',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 14,
  },
  explanation: {
    color: '#C8BCE0',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 25,
    marginBottom: 20,
  },
  primary: {
    backgroundColor: tokens.color.purple,

    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    ...largeAction,
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disabled: { backgroundColor: '#514267' },
  resultCard: {
    backgroundColor: tokens.color.mint,
    borderRadius: 20,
    padding: 16,
    marginTop: 7,
    minHeight: 142,
    justifyContent: 'center',
  },
  resultMicrophone: { marginTop: 8 },
  resultText: { color: '#FFFFFF', fontSize: 19, lineHeight: 27, fontWeight: '700' },
  status: { color: '#C8BCE0', textAlign: 'center', marginTop: 80 },
  error: { color: tokens.color.error, fontSize: 12, textAlign: 'center', marginTop: 14 },
  settings: { color: '#C8BCE0', fontSize: 11, textAlign: 'right' },
});
