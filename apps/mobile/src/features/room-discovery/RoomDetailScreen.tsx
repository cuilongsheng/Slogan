import { roomLevelLabel } from './presentation';
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
import { useJoinDraft } from './join';
import { remainingMinutes, roomAvailability } from './presentation';
import { useRoomDetail } from './useRoomDetail';

export function RoomDetailScreen({
  roomId,
  invitationId,
}: {
  roomId: string;
  invitationId?: string;
}) {
  const router = useRouter();
  const { room, loading, error, reload } = useRoomDetail(roomId);
  const { begin } = useJoinDraft();
  const availability = room ? roomAvailability(room) : null;
  const available = availability === 'available';
  const state =
    availability === 'scheduled'
      ? t('roomScheduled')
      : availability === 'ended'
        ? t('roomEnded')
        : availability === 'full'
          ? t('roomFull')
          : availability === 'reconnecting'
            ? t('roomHostReconnecting')
            : null;
  return (
    <RoomPage ambient>
      <RoomHeader
        title={t('roomDetailTitle')}
        subtitle={t('roomDetailSubtitle')}
        onBack={() => router.back()}
      />
      {loading && !room ? (
        <ActivityIndicator style={styles.center} color={tokens.color.purple} />
      ) : error || !room ? (
        <View style={styles.center}>
          <Text style={styles.helper}>{t('roomsLoadFailed')}</Text>
          <TouchableOpacity onPress={() => void reload()}>
            <Text style={styles.retry}>{t('roomRetry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            style={roomPageStyles.scroll}
            contentContainerStyle={roomPageStyles.scrollContent}
          >
            <View style={styles.roomCard}>
              <View style={styles.row}>
                <Text style={styles.badge}>{roomLevelLabel(room)}</Text>
                <Text style={styles.state}>
                  {state ??
                    (room.passwordProtected ? t('roomPasswordProtected') : t('roomAvailable'))}
                </Text>
              </View>
              <Text style={styles.topic}>{room.topic}</Text>
              <Text style={styles.muted}>
                {t('roomHost')} · {room.hostDisplayName}
              </Text>
              <View style={styles.row}>
                <Text style={styles.muted}>
                  {room.memberCount}/{room.capacity}
                </Text>
                <Text style={styles.muted}>
                  {tf('roomRemainingMinutes', { minutes: remainingMinutes(room.endsAt) })}
                </Text>
              </View>
            </View>
            <Text style={styles.sectionTitle}>
              {tf(room.memberCount === 1 ? 'roomPeopleOne' : 'roomPeople', {
                count: room.memberCount,
              })}
            </Text>
            <View style={styles.members}>
              <Text style={styles.helper}>{t('roomPeopleUnavailable')}</Text>
            </View>
            <Text style={[styles.sectionTitle, styles.accessSectionTitle]}>
              {t('roomAccessTitle')}
            </Text>
            <View style={styles.access}>
              <Text style={styles.accessTitle}>
                {t(room.passwordProtected ? 'roomPasswordAccess' : 'roomOpenAccess')}
              </Text>
              <Text style={styles.helper}>
                {t(
                  room.passwordProtected
                    ? 'roomPasswordAccessDescription'
                    : 'roomOpenAccessDescription',
                )}
              </Text>
            </View>
            <Text style={styles.safety}>
              {t(
                room.sensitiveSpeechDetectionEnabled ? 'roomSpeechSafetyOn' : 'roomSpeechSafetyOff',
              )}
            </Text>
            <Text style={styles.safety}>
              {t(room.postRoomKeywordsEnabled ? 'roomKeywordsOn' : 'roomKeywordsOff')}
            </Text>
            {room.shareUrl && availability !== 'ended' && (
              <View style={styles.access}>
                <RoomShareAction url={room.shareUrl} />
              </View>
            )}
            {state && <Text style={styles.unavailable}>{t('roomUnavailable')}</Text>}
          </ScrollView>
          <View style={roomPageStyles.footer}>
            <RoomAction
              label={
                available
                  ? t('roomViewPreparation')
                  : availability === 'scheduled'
                    ? t('roomScheduled')
                    : t('roomRetry')
              }
              disabled={availability === 'scheduled'}
              onPress={() => {
                if (!available) {
                  void reload();
                  return;
                }
                if (invitationId) begin(roomId, invitationId);
                else begin(roomId);
                router.push(
                  room.passwordProtected ? `/rooms/${roomId}/password` : `/rooms/${roomId}/rules`,
                );
              }}
            />
          </View>
        </>
      )}
    </RoomPage>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  retry: { color: tokens.color.purple, fontWeight: '700', padding: 12 },
  roomCard: {
    marginHorizontal: 16,
    marginTop: 53,
    height: 124,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.color.border,
    padding: 16,
    backgroundColor: '#F1EDFF',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: {
    color: tokens.color.purple,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '700',
  },
  state: { color: tokens.color.purple, fontSize: 12, fontWeight: '700' },
  topic: { color: tokens.color.foreground, fontSize: 18, fontWeight: '700', marginTop: 8 },
  muted: { color: tokens.color.muted, fontSize: 12, marginTop: 4 },
  sectionTitle: {
    color: tokens.color.foreground,
    fontSize: 17,
    fontWeight: '700',
    marginHorizontal: 20,
    marginTop: 32,
    marginBottom: 12,
  },
  accessSectionTitle: { marginTop: 63 },
  members: {
    height: 102,
    marginHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: '#E4F8F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  access: {
    minHeight: 86,
    marginHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: '#FFF0E8',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  accessTitle: { color: tokens.color.foreground, fontSize: 16, fontWeight: '700', marginBottom: 7 },
  helper: { color: tokens.color.muted, fontSize: 13, textAlign: 'center' },
  safety: { color: tokens.color.muted, fontSize: 12, marginTop: 14, marginHorizontal: 20 },
  unavailable: { color: tokens.color.error, fontSize: 13, marginHorizontal: 20, marginTop: 14 },
});
