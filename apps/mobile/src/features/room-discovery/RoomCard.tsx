import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';

import { AppText as Text } from '../../components/ui/AppText';
import { tokens } from '../../styles/tokens';
import { t, tf } from '../../services/locale';
import lockIcon from '../../../assets/icons/room-discovery/lock.png';
import type { RoomSummary } from './api';
import { remainingMinutes, roomAvailability, roomLevelLabel } from './presentation';

const colors = tokens.discovery.color;

const cardColors = [
  colors.cardLavender,
  colors.cardBlue,
  colors.cardLavender,
  colors.cardMint,
] as const;

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
  const unavailable = availability !== 'available';
  const password = !unavailable && room.passwordProtected;
  const state =
    availability === 'ended'
      ? t('roomEnded')
      : availability === 'full'
        ? t('roomFull')
        : availability === 'reconnecting'
          ? t('roomHostReconnecting')
          : password
            ? t('roomPasswordProtected')
            : t('roomAvailable');
  const processing = [
    room.sensitiveSpeechDetectionEnabled ? t('roomSpeechSafetyOn') : null,
    room.postRoomKeywordsEnabled ? t('roomKeywordsOn') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <TouchableOpacity
      testID={`room-card-${room.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${room.topic}, ${roomLevelLabel(room)}, ${state}, ${room.memberCount}/${room.capacity}`}
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: cardColors[index % cardColors.length] },
        !!processing && styles.processingCard,
      ]}
    >
      <View style={styles.level}>
        <Text style={styles.levelText}>{roomLevelLabel(room)}</Text>
      </View>
      <View style={[styles.availability, password && styles.password]}>
        {password ? (
          <Image source={lockIcon} style={styles.lock} />
        ) : (
          <View style={[styles.dot, unavailable && styles.unavailableDot]} />
        )}
        <Text numberOfLines={1} style={[styles.state, unavailable && styles.unavailableText]}>
          {state}
        </Text>
      </View>
      {!password && (
        <View style={styles.confetti} pointerEvents="none">
          <View style={[styles.confettiDot, { backgroundColor: tokens.color.coral }]} />
          <View style={[styles.confettiDot, styles.confettiGold]} />
          <View style={[styles.confettiDot, { backgroundColor: colors.confettiMint }]} />
        </View>
      )}
      <Text numberOfLines={1} style={styles.topic}>
        {room.topic}
      </Text>
      {/* The current list contract has no photo or member-preview fields. Keep the existing
          initial fallback, never substitute Figma's sample people for real room members. */}
      <View style={styles.hostCircle}>
        <Text style={styles.hostInitial}>{room.hostDisplayName.slice(0, 1)}</Text>
      </View>
      <View style={styles.hostInfo}>
        <Text numberOfLines={1} style={styles.host}>
          {room.hostDisplayName} · {t('roomHost')}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {minutes > 0 ? tf('roomRemainingMinutes', { minutes }) : t('roomEndingSoon')}
        </Text>
      </View>
      <View
        style={[
          styles.capacity,
          {
            backgroundColor:
              availability === 'full'
                ? colors.capacityFull
                : password
                  ? colors.capacityPassword
                  : colors.capacityOpen,
          },
        ]}
      >
        <Text style={styles.capacityText}>
          {room.memberCount}/{room.capacity}
        </Text>
      </View>
      {!!processing && <Text style={styles.processing}>{processing}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 132,
    marginLeft: 15,
    marginRight: 17,
    marginBottom: 5,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  level: {
    position: 'absolute',
    left: 13,
    top: 11,
    minWidth: 38,
    height: 22,
    paddingHorizontal: 9,
    borderRadius: 7,
    backgroundColor: tokens.color.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelText: { color: colors.badgeAccent, fontSize: 12, fontWeight: '700', lineHeight: 16 },
  availability: {
    position: 'absolute',
    right: 58,
    top: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 130,
    height: 18,
  },
  password: { right: 54, top: 11 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.available },
  unavailableDot: { backgroundColor: colors.unavailable },
  lock: { width: 14, height: 14 },
  state: {
    color: colors.available,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
    flexShrink: 1,
  },
  unavailableText: { color: colors.unavailable },
  confetti: { position: 'absolute', right: 15, top: 14, flexDirection: 'row', gap: 4 },
  confettiDot: { width: 6, height: 6, borderRadius: 3 },
  confettiGold: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.color.ambientGold,
    marginTop: 4,
  },
  topic: {
    position: 'absolute',
    left: 13,
    right: 13,
    top: 42,
    color: colors.ink,
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
  },
  hostCircle: {
    position: 'absolute',
    left: 13,
    top: 84,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostInitial: { color: colors.badgeAccent, fontSize: 13, fontWeight: '500' },
  hostInfo: { position: 'absolute', left: 57, right: 62, top: 85 },
  host: { color: colors.ink, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  meta: { marginTop: 2, color: colors.muted, fontSize: 11, lineHeight: 15 },
  capacity: {
    position: 'absolute',
    right: 12,
    top: 85,
    width: 42,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capacityText: { color: colors.ink, fontSize: 12, fontWeight: '700', lineHeight: 16 },
  processingCard: { height: 155 },
  processing: {
    position: 'absolute',
    top: 129,
    left: 13,
    right: 13,
    fontSize: 10,
    lineHeight: 17,
    color: colors.muted,
  },
});
