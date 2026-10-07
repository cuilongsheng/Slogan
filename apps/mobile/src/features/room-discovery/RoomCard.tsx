import { roomLevelLabel } from './presentation';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { t, tf } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import speechBurstIcon from '../../../assets/icons/speech-burst.png';
import type { RoomSummary } from './api';
import { remainingMinutes, roomAvailability } from './presentation';

const cardColors = ['#F1EDFF', '#E9F7FF', '#E8FAF5', '#FFF0E8'] as const;

export function RoomCard({
  room,
  index,
  onPress,
}: {
  room: RoomSummary;
  index: number;
  onPress: () => void;
}) {
  const availability = roomAvailability(room);
  const minutes = remainingMinutes(room.endsAt);
  const state =
    availability === 'ended'
      ? t('roomEnded')
      : availability === 'full'
        ? t('roomFull')
        : availability === 'reconnecting'
          ? t('roomHostReconnecting')
          : room.passwordProtected
            ? t('roomPasswordProtected')
            : t('roomAvailable');
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.card, { backgroundColor: cardColors[index % cardColors.length] }]}
    >
      <View style={styles.top}>
        <View style={styles.level}>
          <Text style={styles.levelText}>{roomLevelLabel(room)}</Text>
        </View>
        <Text style={styles.state}>{state}</Text>
      </View>
      <Text numberOfLines={1} style={styles.topic}>
        {room.topic}
      </Text>
      <View style={styles.bottom}>
        <View style={styles.hostCircle}>
          <Text style={styles.hostInitial}>{room.hostDisplayName.slice(0, 1)}</Text>
        </View>
        <Text numberOfLines={1} style={styles.host}>
          {room.hostDisplayName}
        </Text>
        <Text style={styles.meta}>
          {minutes > 0 ? tf('roomRemainingMinutes', { minutes }) : t('roomEndingSoon')}
        </Text>
        <View style={styles.capacity}>
          <Text style={styles.capacityText}>
            {room.memberCount}/{room.capacity}
          </Text>
        </View>
      </View>
      <View style={styles.safetyRow}>
        <Image source={speechBurstIcon} style={styles.safetyIcon} />
        <Text style={styles.safety}>
          {t(room.sensitiveSpeechDetectionEnabled ? 'roomSpeechSafetyOn' : 'roomSpeechSafetyOff')}
        </Text>
      </View>
      <Text style={styles.keyword}>
        {t(room.postRoomKeywordsEnabled ? 'roomKeywordsOn' : 'roomKeywordsOff')}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 149,
    marginHorizontal: 16,
    marginBottom: 5,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  level: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  levelText: { color: tokens.color.purple, fontSize: 12, fontWeight: '700' },
  state: { color: tokens.color.purple, fontSize: 12, fontWeight: '600' },
  topic: { color: tokens.color.foreground, fontWeight: '700', fontSize: 18, marginTop: 6 },
  bottom: { flexDirection: 'row', alignItems: 'center', marginTop: 11, gap: 6 },
  hostCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: tokens.color.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostInitial: { color: tokens.color.purple, fontSize: 10, fontWeight: '700' },
  host: { color: tokens.color.muted, fontSize: 11, flex: 1 },
  meta: { color: tokens.color.muted, fontSize: 10 },
  capacity: {
    minWidth: 40,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF3D1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capacityText: { color: tokens.color.foreground, fontSize: 11, fontWeight: '700' },
  safetyRow: { flexDirection: 'row', alignItems: 'center', marginTop: -3, gap: 4 },
  safetyIcon: { width: 12, height: 12 },
  safety: { color: tokens.color.muted, fontSize: 10 },
  keyword: { color: tokens.color.muted, fontSize: 10, marginLeft: 16 },
});
