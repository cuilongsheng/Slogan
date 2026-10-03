import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { createMobileApiClient } from '../../src/api/client';
import { RoomHeader, RoomPage } from '../../src/components/ui/RoomPage';
import { t } from '../../src/services/locale';
import { tokens } from '../../src/styles/tokens';

export default function RoomShareRoute() {
  const { shareCode, attributionId } = useLocalSearchParams<{
    shareCode: string;
    attributionId?: string;
  }>();
  const router = useRouter();
  const [failed, setFailed] = useState(!shareCode);
  useEffect(() => {
    let active = true;
    if (!shareCode) {
      return;
    }
    void createMobileApiClient()
      .GET('/v1/room-links/{shareCode}', {
        params: {
          path: { shareCode },
          query: attributionId ? { attributionId } : {},
        },
      })
      .then(({ data }) => {
        if (!active) return;
        if (!data) {
          setFailed(true);
          return;
        }
        router.replace(
          data.kind === 'APPOINTMENT' ? `/rooms/appointments/${data.id}` : `/rooms/${data.id}`,
        );
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [shareCode, attributionId, router]);
  return (
    <RoomPage ambient>
      <RoomHeader
        title={t('roomDetailTitle')}
        subtitle={t('roomDetailSubtitle')}
        onBack={() => router.replace('/rooms')}
      />
      <View style={styles.center}>
        {failed ? (
          <>
            <Text style={styles.error}>{t('roomShareUnavailable')}</Text>
            <TouchableOpacity onPress={() => router.replace('/rooms')}>
              <Text style={styles.link}>{t('voiceBackToDiscover')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator color={tokens.color.purple} />
        )}
      </View>
    </RoomPage>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  error: { color: tokens.color.foreground, textAlign: 'center' },
  link: { color: tokens.color.purple, fontWeight: '700', marginTop: 20 },
});
