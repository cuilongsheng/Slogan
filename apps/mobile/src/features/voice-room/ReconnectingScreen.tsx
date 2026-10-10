import { useEffect, useState } from 'react';
import { AppState, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppText as Text } from '../../components/ui/AppText';
import { VoicePage } from '../../components/ui/VoicePage';
import { t } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import backIcon from '../../../assets/icons/connection/back.png';
import refreshIcon from '../../../assets/icons/connection/refresh.png';
import type { VoiceSessionSnapshot } from './session';

const colors = tokens.connection.color;

export function ReconnectingScreen({
  snapshot,
  onLeave,
}: {
  snapshot: VoiceSessionSnapshot;
  onLeave: () => void;
}) {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    let clock: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      if (clock !== undefined) clearInterval(clock);
      clock = undefined;
    };
    const resume = () => {
      stop();
      clock = setInterval(() => setNow(Date.now()), 1000);
    };
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') resume();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNow(Date.now());
        resume();
      } else stop();
    });
    return () => {
      stop();
      subscription.remove();
    };
  }, []);

  // Only a host's server-provided deadline is a recovery countdown. Otherwise this is
  // elapsed reconnect time, never a made-up 60-second membership or ownership deadline.
  const deadline =
    snapshot.role === 'HOST' && snapshot.room?.hostReconnectDeadline
      ? Date.parse(snapshot.room.hostReconnectDeadline)
      : NaN;
  const countdown = Number.isFinite(deadline);
  const seconds = Math.max(
    0,
    countdown ? Math.ceil((deadline - now) / 1000) : Math.floor((now - startedAt) / 1000),
  );
  const timer = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <VoicePage connection>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            testID="reconnecting-back"
            accessibilityRole="button"
            accessibilityLabel={t('voiceLeave')}
            onPress={onLeave}
            style={styles.back}
          >
            <Image source={backIcon} style={styles.backIcon} />
          </TouchableOpacity>
          <Text accessibilityRole="header" style={styles.title}>
            {t('voiceReconnectingTitle')}
          </Text>
          <Text style={styles.subtitle}>{t('voiceReconnectSubtitle')}</Text>
        </View>
        <View testID="reconnecting-panel" style={styles.panel}>
          <View pointerEvents="none" style={styles.ring} />
          <View style={styles.iconCircle}>
            <Image source={refreshIcon} style={styles.refreshIcon} />
          </View>
          <Text style={styles.headline}>{t('voiceReconnecting')}</Text>
          <Text
            accessibilityLabel={`${t(countdown ? 'voiceReconnectRemaining' : 'voiceReconnectElapsed')}: ${timer}`}
            style={styles.timer}
          >
            {timer}
          </Text>
          <Text style={styles.helper}>{t('voiceReconnectHelper')}</Text>
        </View>
        <TouchableOpacity
          testID="reconnecting-leave"
          accessibilityRole="button"
          accessibilityLabel={t('voiceLeave')}
          onPress={onLeave}
          style={styles.leave}
        >
          <Text style={styles.leaveText}>{t('voiceLeave')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </VoicePage>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 36 },
  // The submitted reference places the panel at y173 and the CTA at y564.
  // Web shell status is 49px; native uses the actual OS safe-area above this content.
  header: { height: 124, position: 'relative' },
  back: {
    position: 'absolute',
    left: 16,
    top: 0,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { width: 24, height: 24 },
  title: {
    position: 'absolute',
    left: 64,
    right: 26,
    top: 1,
    color: tokens.color.panel,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 39,
  },
  subtitle: {
    position: 'absolute',
    left: 64,
    right: 26,
    top: 43,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  panel: { marginHorizontal: 16, height: 345, borderRadius: 24, backgroundColor: colors.panel },
  ring: {
    position: 'absolute',
    top: 18,
    left: '50%',
    marginLeft: -58,
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 3,
    borderColor: colors.ring,
  },
  iconCircle: {
    position: 'absolute',
    top: 31,
    left: '50%',
    marginLeft: -45,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.iconSurface,
  },
  refreshIcon: { position: 'absolute', top: 31, left: 31, width: 28, height: 28 },
  headline: {
    position: 'absolute',
    top: 151,
    alignSelf: 'center',
    color: tokens.color.panel,
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 29,
    transform: [{ translateX: 1.5 }],
  },
  timer: {
    position: 'absolute',
    top: 203,
    left: '50%',
    marginLeft: -38,
    width: 90,
    color: colors.muted,
    fontSize: 18,
    lineHeight: 25,
  },
  helper: {
    position: 'absolute',
    top: 253,
    left: 33,
    right: 25,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  leave: {
    marginLeft: 18,
    marginRight: 22,
    marginTop: 46,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.actionSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveText: { color: colors.actionInk, fontSize: 14, fontWeight: '500', lineHeight: 20 },
});
