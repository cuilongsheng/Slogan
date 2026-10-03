import { useEffect, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { t, tf } from '../../services/locale';
import { usePrivateRecorder } from '../../services/usePrivateRecorder';
import { tokens } from '../../styles/tokens';
import { RoomApiError } from '../room-discovery/api';
import type { ExpressionAssistanceApi, AudioConsent, ExpressionResult } from './assistanceApi';
import micIcon from '../../../assets/icons/mic.png';

type Phase = 'loading-consent' | 'consent' | 'start' | 'recording' | 'confirm' | 'text' | 'loading' | 'result';

function failureMessage(error: unknown, audio: boolean) {
  if (error instanceof RoomApiError) {
    if (error.status === 429) return t('assistanceQuota');
    if (error.code === 'ASSISTANCE_CONSENT_REQUIRED') return t('assistanceConsentFailed');
    if (error.status === 503) return t('assistanceUnavailable');
  }
  return audio ? t('assistanceAudioFailed') : t('assistanceInputFailed');
}

export function ExpressionAssistSheet({
  roomId,
  api,
  initialMode,
  muteRoomMicrophone,
  onClose,
}: {
  roomId: string;
  api: ExpressionAssistanceApi;
  initialMode: 'audio' | 'text';
  muteRoomMicrophone: () => Promise<boolean>;
  onClose: () => void;
}) {
  const recorder = usePrivateRecorder();
  const [pendingPhase, setPhase] = useState<Phase>(initialMode === 'text' ? 'text' : 'loading-consent');
  const [consent, setConsent] = useState<AudioConsent | null>(null);
  const [text, setText] = useState('');
  const [requestId, setRequestId] = useState(() => randomUUID());
  const [consentRequestId] = useState(() => randomUUID());
  const [result, setResult] = useState<ExpressionResult | null>(null);
  const [resultMode, setResultMode] = useState<'audio' | 'text'>(initialMode);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.consent().then((value) => {
      if (!active) return;
      setConsent(value);
      if (initialMode === 'audio') setPhase(value.status === 'ACCEPTED' ? 'start' : 'consent');
    }).catch((cause) => {
      if (!active) return;
      setError(failureMessage(cause, true));
      if (initialMode === 'audio') setPhase('consent');
    });
    return () => { active = false; };
  }, [api, initialMode]);

  const phase = pendingPhase === 'recording' && recorder.clip ? 'confirm' : pendingPhase;
  const visibleError = error ?? (recorder.error ? t('assistanceAudioFailed') : null);

  async function accept() {
    if (!consent?.currentNoticeVersion) return;
    setError(null);
    setPhase('loading');
    try {
      const updated = await api.acceptConsent(consent.currentNoticeVersion, consentRequestId);
      setConsent(updated);
      setPhase('start');
    } catch (cause) {
      setError(failureMessage(cause, true));
      setPhase('consent');
    }
  }

  async function revoke() {
    if (!consent?.currentNoticeVersion) return;
    setError(null);
    setPhase('loading');
    try {
      const updated = await api.revokeConsent(consent.currentNoticeVersion, randomUUID());
      setConsent(updated);
      setPhase('consent');
    } catch (cause) {
      setError(failureMessage(cause, true));
      setPhase('start');
    }
  }

  async function startRecording() {
    setError(null);
    try {
      if (!(await muteRoomMicrophone())) throw new Error('PRIVATE_MIC_NOT_MUTED');
      await recorder.start();
      setRequestId(randomUUID());
      setPhase('recording');
    } catch (cause) {
      setError(cause instanceof Error && cause.message === 'PRIVATE_MIC_NOT_MUTED'
        ? t('assistanceMicPrivacy') : t('assistanceAudioFailed'));
    }
  }

  async function stopRecording() {
    try {
      await recorder.stop();
      setPhase('confirm');
    } catch {
      setError(t('assistanceAudioFailed'));
      setPhase('start');
    }
  }

  async function generateAudio() {
    if (!recorder.clip || !consent?.currentNoticeVersion) return;
    setError(null);
    setPhase('loading');
    try {
      setResult(await api.audio(roomId, recorder.clip, consent.currentNoticeVersion, requestId));
      setResultMode('audio');
      setPhase('result');
    } catch (cause) {
      setError(failureMessage(cause, true));
      setPhase('confirm');
    }
  }

  async function generateText() {
    const input = text.trim();
    if (!input || [...input].length > 1000) {
      setError(t('assistanceInputFailed'));
      return;
    }
    setError(null);
    setPhase('loading');
    try {
      setResult(await api.text(roomId, input, requestId));
      setResultMode('text');
      setPhase('result');
    } catch (cause) {
      setError(failureMessage(cause, false));
      setPhase('text');
    }
  }

  function resetResult() {
    recorder.discard();
    setResult(null);
    setError(null);
    setRequestId(randomUUID());
    setText('');
    setPhase(resultMode === 'text' ? 'text' : consent?.status === 'ACCEPTED' ? 'start' : 'consent');
  }

  function resetAudio() {
    recorder.discard();
    setError(null);
    setRequestId(randomUUID());
    setPhase(consent?.status === 'ACCEPTED' ? 'start' : 'consent');
  }

  const audioMode = phase !== 'text';
  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.headingRow}>
          <Text style={styles.title}>{phase === 'result' ? t('assistanceResultTitle') : t('assistanceTitle')}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('roomCloseSheet')} onPress={onClose}>
            <Text style={styles.close}>×</Text>
          </TouchableOpacity>
        </View>
        {phase !== 'result' && <Text style={styles.private}>{t('assistancePrivate')}</Text>}
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {phase === 'loading-consent' || phase === 'loading' ? (
            <Text style={styles.status}>{t('assistanceLoading')}</Text>
          ) : phase === 'consent' ? (
            <>
              <Text style={styles.sectionTitle}>{t('assistanceConsentTitle')}</Text>
              <Text style={styles.explanation}>{t('assistanceConsentBody')}</Text>
              {consent?.currentNoticeVersion && <Primary label={t('assistanceAccept')} onPress={() => void accept()} />}
              <Link label={t('assistanceTextAction')} onPress={() => { setError(null); setPhase('text'); }} />
            </>
          ) : phase === 'start' ? (
            <>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('assistanceStart')} style={styles.micCircle} onPress={() => void startRecording()}>
                <Image source={micIcon} style={styles.micIcon} />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>{t('assistanceStart')}</Text>
              <Text style={styles.hint}>{t('assistanceStartHint')}</Text>
              <Text style={styles.notice}>{t('assistanceFirstUse')}</Text>
              <Link label={t('assistanceTextAction')} onPress={() => { setError(null); setPhase('text'); }} />
              <Link label={t('assistanceRevoke')} onPress={() => void revoke()} />
            </>
          ) : phase === 'recording' ? (
            <>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('assistanceStop')} style={[styles.micCircle, styles.listeningCircle]} onPress={() => void stopRecording()}>
                <Text style={styles.wave}>▏▍▏▌▏</Text>
              </TouchableOpacity>
              <Text style={styles.recordingLabel}>{t('assistanceRecording')}</Text>
              <Text style={styles.timer}>{tf('assistanceDuration', { seconds: `00:${String(recorder.elapsedSeconds).padStart(2, '0')}` })}</Text>
              <Text style={styles.hint}>{t('assistancePrivate')}</Text>
            </>
          ) : phase === 'confirm' ? (
            <>
              <Text style={styles.sectionTitle}>{t('assistanceAudioConfirm')}</Text>
              <Text style={styles.explanation}>{t('assistanceConsentBody')}</Text>
              <Primary label={t('assistanceAudioConfirm')} onPress={() => void generateAudio()} />
              <Link label={t('assistanceAgain')} onPress={resetAudio} />
            </>
          ) : phase === 'text' ? (
            <>
              <TextInput multiline maxLength={1000} accessibilityLabel={t('assistanceTextHint')} placeholder={t('assistanceTextHint')} value={text} onChangeText={(value) => { setText(value); setRequestId(randomUUID()); setError(null); }} style={styles.textInput} />
              <Primary label={t('assistanceGenerate')} onPress={() => void generateText()} />
              <Link label={t('assistanceAudioAction')} onPress={() => setPhase(consent?.status === 'ACCEPTED' ? 'start' : 'consent')} />
            </>
          ) : result ? (
            <>
              <View style={styles.resultCard}>
                <Text style={styles.resultLabel}>{t('assistanceResultLabel')}</Text>
                <Text style={styles.resultText} selectable>{result.primary.text}</Text>
              </View>
              {result.alternatives.length > 0 && (
                <View><Text style={styles.alternativesLabel}>{t('assistanceAlternatives')}</Text>{result.alternatives.map((item, index) => <Text selectable key={`${index}-${item.text}`} style={styles.alternative}>{item.text}</Text>)}</View>
              )}
              <Text style={styles.hint}>{t('assistanceResultHint')}</Text>
              <Primary label={t('assistanceAgain')} onPress={resetResult} />
            </>
          ) : null}
          {visibleError && <Text accessibilityRole="alert" style={styles.error}>{visibleError}</Text>}
          {audioMode && phase === 'recording' && recorder.recording === false && !recorder.clip && <Text style={styles.error}>{t('assistanceAudioFailed')}</Text>}
        </ScrollView>
      </View>
    </View>
  );
}

function Primary({ label, onPress }: { label: string; onPress: () => void }) {
  return <TouchableOpacity accessibilityRole="button" style={styles.primary} onPress={onPress}><Text style={styles.primaryText}>{label}</Text></TouchableOpacity>;
}
function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return <TouchableOpacity accessibilityRole="button" onPress={onPress}><Text style={styles.link}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(20, 12, 44, 0.72)', justifyContent: 'flex-end', zIndex: 30 },
  sheet: { minHeight: 394, maxHeight: '82%', borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: tokens.color.surface, paddingHorizontal: 20, paddingTop: 11, paddingBottom: 38 },
  grabber: { width: 52, height: 5, borderRadius: 3, alignSelf: 'center', backgroundColor: '#D7D1E5', marginBottom: 14 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: tokens.color.foreground, fontSize: 20, fontWeight: '700' },
  close: { color: tokens.color.muted, fontSize: 29, lineHeight: 31 },
  private: { color: tokens.color.muted, fontSize: 13, marginTop: 2 },
  content: { minHeight: 265, alignItems: 'stretch', paddingBottom: 12 },
  micCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: tokens.color.coral, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 26 },
  listeningCircle: { backgroundColor: '#1FC8BD' },
  micIcon: { width: 29, height: 29, tintColor: '#fff' },
  wave: { color: '#fff', fontSize: 25, fontWeight: '700' },
  actionLabel: { color: tokens.color.purple, textAlign: 'center', fontSize: 18, fontWeight: '700', marginTop: 14 },
  recordingLabel: { color: tokens.color.foreground, textAlign: 'center', fontSize: 18, fontWeight: '700', marginTop: 14 },
  timer: { color: tokens.color.muted, fontSize: 14, textAlign: 'center', marginTop: 14 },
  hint: { color: tokens.color.muted, textAlign: 'center', fontSize: 12, lineHeight: 20, marginTop: 20 },
  notice: { backgroundColor: tokens.color.peach, color: '#7D6070', borderRadius: 16, padding: 12, fontSize: 11, marginTop: 28 },
  sectionTitle: { color: tokens.color.foreground, fontSize: 17, fontWeight: '700', marginTop: 25 },
  explanation: { color: tokens.color.muted, fontSize: 13, lineHeight: 21, marginTop: 14, marginBottom: 24 },
  primary: { minHeight: 50, backgroundColor: tokens.color.purple, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  link: { color: tokens.color.purple, fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 18 },
  resultCard: { backgroundColor: tokens.color.mint, borderRadius: 20, padding: 16, marginTop: 27, minHeight: 142 },
  resultLabel: { color: tokens.color.purple, fontSize: 12, marginBottom: 16 },
  resultText: { color: tokens.color.foreground, fontSize: 19, lineHeight: 26, fontWeight: '700' },
  alternativesLabel: { color: tokens.color.muted, fontSize: 12, marginTop: 13 },
  alternative: { color: tokens.color.foreground, fontSize: 13, marginTop: 5 },
  textInput: { minHeight: 110, borderRadius: 16, borderWidth: 1, borderColor: tokens.color.border, backgroundColor: '#fff', padding: 13, marginTop: 25, textAlignVertical: 'top', color: tokens.color.foreground },
  status: { color: tokens.color.muted, textAlign: 'center', marginTop: 80 },
  error: { color: tokens.color.error, fontSize: 12, textAlign: 'center', marginTop: 14 },
});
