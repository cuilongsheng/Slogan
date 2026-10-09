import { Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText } from '../../components/ui/AppText';
import { t } from '../../services/locale';
import type { MediaSnapshot } from './mediaCore';

export function RoomDeviceNotice({
  media,
  errorCode,
  onRetry,
  onEnableAudio,
}: {
  media: MediaSnapshot;
  errorCode: string | null;
  onRetry(): Promise<void>;
  onEnableAudio(): Promise<void>;
}) {
  const microphone = media.deviceCheck?.microphone;
  const checking = microphone === 'checking' || media.deviceCheck?.playback === 'checking';
  const inputProblem = microphone && !['checking', 'ready'].includes(microphone);
  const playbackProblem = media.deviceCheck?.playback === 'unavailable';
  const blockedPlayback = !media.audioPlaybackAllowed || errorCode === 'AUDIO_PLAYBACK_BLOCKED';
  if (checking) return <AppText style={styles.text}>{t('voiceDevicesChecking')}</AppText>;
  if (
    !inputProblem &&
    !playbackProblem &&
    !blockedPlayback &&
    errorCode !== 'MICROPHONE_UNAVAILABLE'
  )
    return null;
  return (
    <View accessibilityRole="alert" style={styles.notice}>
      {(inputProblem || errorCode === 'MICROPHONE_UNAVAILABLE') && (
        <AppText style={styles.text}>
          {t(
            microphone === 'blocked'
              ? 'voiceMicBlocked'
              : microphone === 'denied'
                ? 'voiceMicDenied'
                : 'voiceMicUnavailable',
          )}
        </AppText>
      )}
      {playbackProblem && <AppText style={styles.text}>{t('voiceAudioUnavailable')}</AppText>}
      {blockedPlayback && <AppText style={styles.text}>{t('voiceAudioBlocked')}</AppText>}
      <View style={styles.actions}>
        {microphone === 'blocked' && (
          <TouchableOpacity accessibilityRole="button" onPress={() => void Linking.openSettings()}>
            <AppText style={styles.action}>{t('voiceOpenDeviceSettings')}</AppText>
          </TouchableOpacity>
        )}
        <TouchableOpacity accessibilityRole="button" onPress={() => void onRetry()}>
          <AppText style={styles.action}>{t('voiceRetryDeviceCheck')}</AppText>
        </TouchableOpacity>
        {blockedPlayback && (
          <TouchableOpacity accessibilityRole="button" onPress={() => void onEnableAudio()}>
            <AppText style={styles.action}>{t('voiceEnableSound')}</AppText>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { paddingVertical: 5, gap: 4 },
  text: { color: '#E4DDF4', fontSize: 12, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  action: { color: '#71E8CD', fontSize: 12, lineHeight: 24, fontWeight: '700' },
});
