import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RoomAction, RoomHeader, RoomPage, roomPageStyles } from '../../components/ui/RoomPage';
import { RoomShareAction } from '../../components/ui/RoomShareAction';
import { t, tf } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../auth';
import { RoomCreationApi } from './api';

type Appointment = Awaited<ReturnType<RoomCreationApi['scheduledDetail']>>;
export function AppointmentDetailScreen({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { authorized, state } = useAuth();
  const userId = state.kind === 'signedIn' ? state.me.userId : null;
  const api = useMemo(() => new RoomCreationApi(authorized), [authorized]);
  const [room, setRoom] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setRoom(await api.scheduledDetail(roomId));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [api, roomId]);
  useEffect(() => {
    let active = true;
    void api
      .scheduledDetail(roomId)
      .then((value) => {
        if (active) setRoom(value);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, roomId]);
  async function cancelRoom() {
    if (cancelBusy) return;
    setCancelBusy(true);
    setCancelError(false);
    try {
      await api.cancelScheduled(roomId);
      setCancelConfirm(false);
      setRoom(await api.scheduledDetail(roomId));
    } catch {
      setCancelError(true);
    } finally {
      setCancelBusy(false);
    }
  }
  return (
    <RoomPage ambient>
      <RoomHeader
        title={t('createRoomScheduled')}
        subtitle={t('roomDetailSubtitle')}
        onBack={() => router.replace('/rooms')}
      />
      {loading && !room ? (
        <ActivityIndicator style={styles.center} color={tokens.color.purple} />
      ) : error || !room ? (
        <View style={styles.center}>
          <Text style={styles.helper}>{t('roomsLoadFailed')}</Text>
          <TouchableOpacity onPress={() => void load()}>
            <Text style={styles.retry}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            style={roomPageStyles.scroll}
            contentContainerStyle={roomPageStyles.scrollContent}
          >
            <View style={styles.card}>
              <Text style={styles.badge}>{room.cefrLevel}</Text>
              <Text style={styles.topic}>{room.topic}</Text>
              <Text style={styles.helper}>
                {t('createRoomDate')} · {new Date(room.startsAt).toLocaleString()}
              </Text>
              <Text style={styles.helper}>
                {t('createRoomTime')} · {new Date(room.endsAt).toLocaleString()}
              </Text>
              <Text style={styles.helper}>
                {tf('createRoomPeopleCount', { count: room.memberCount, capacity: room.capacity })}{' '}
                · {room.visibility === 'PUBLIC' ? t('createRoomPublic') : t('createRoomLinkOnly')}
              </Text>
              <Text style={styles.helper}>
                {t('createRoomAccess')} ·{' '}
                {room.passwordProtected ? t('createRoomPassword') : t('createRoomOpen')}
              </Text>
            </View>
            <Text style={styles.section}>
              {room.status === 'CANCELLED' ? t('roomCancelled') : t('roomScheduled')}
            </Text>
            {room.status !== 'CANCELLED' && (
              <View style={styles.card}>
                <RoomShareAction url={room.shareUrl} />
              </View>
            )}
            {room.status === 'SCHEDULED' && room.hostUserId === userId && (
              <View style={styles.card}>
                {cancelConfirm ? (
                  <>
                    <Text style={styles.topic}>{t('appointmentCancelConfirm')}</Text>
                    {cancelError && (
                      <Text style={styles.error}>{t('appointmentCancelFailed')}</Text>
                    )}
                    <TouchableOpacity
                      accessibilityRole="button"
                      disabled={cancelBusy}
                      onPress={() => void cancelRoom()}
                    >
                      <Text style={styles.cancelAction}>{t('appointmentCancelAction')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      disabled={cancelBusy}
                      onPress={() => setCancelConfirm(false)}
                    >
                      <Text style={styles.retry}>{t('cancelAction')}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => setCancelConfirm(true)}
                  >
                    <Text style={styles.cancelAction}>{t('appointmentCancelAction')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
          <View style={roomPageStyles.footer}>
            <RoomAction label={t('voiceBackToDiscover')} onPress={() => router.replace('/rooms')} />
          </View>
        </>
      )}
    </RoomPage>
  );
}
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  helper: { fontSize: 13, lineHeight: 22, color: tokens.color.muted, marginTop: 8 },
  retry: { color: tokens.color.purple, marginTop: 15 },
  error: { color: '#C6384A', marginTop: 12 },
  cancelAction: { color: '#C6384A', fontWeight: '700', marginTop: 15 },
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: tokens.color.purpleSoft,
    padding: 20,
    borderRadius: 24,
  },
  badge: {
    alignSelf: 'flex-start',
    color: tokens.color.purple,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  topic: { color: tokens.color.foreground, fontSize: 21, fontWeight: '700', marginTop: 12 },
  section: {
    marginHorizontal: 20,
    marginTop: 20,
    fontWeight: '700',
    color: tokens.color.foreground,
  },
});
