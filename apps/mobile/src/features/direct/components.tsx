import chatActionIcon from '../../../assets/icons/direct-chat-action.png';
import { useState } from 'react';
import { Image, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/ui/AppText';
import { tf } from '../../services/locale';
import { tokens } from '../../styles/tokens';
export const directColors = {
  ink: '#26233B',
  violet: '#6247E8',
  canvas: tokens.color.surface,
  muted: tokens.color.muted,
};
export function DirectHeading({ title }: { title: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}
export function PeerRow({
  name,
  avatar,
  detail,
  action,
  onPress,
  onLongPress,
  unread = 0,
}: {
  name: string;
  avatar: string;
  detail: string;
  action?: string;
  onPress: () => void;
  onLongPress?: () => void;
  unread?: number;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={unread ? tf('directUnreadConversation', { name, count: unread }) : name}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.row}
    >
      <PeerAvatar key={avatar || name} avatar={avatar} name={name} />
      <View style={styles.copy}>
        <Text style={[styles.name, unread > 0 && styles.unreadName]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.detail, unread > 0 && styles.unreadDetail]} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {action && (
        <View style={styles.action}>
          <Image source={chatActionIcon} style={styles.actionIcon} accessibilityLabel={action} />
        </View>
      )}
      {unread > 0 && (
        <View style={styles.unread}>
          <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
function PeerAvatar({ avatar, name }: { avatar: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return avatar && !failed ? (
    <Image source={{ uri: avatar }} style={styles.avatar} onError={() => setFailed(true)} />
  ) : (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Text style={styles.initial}>{Array.from(name.trim())[0]?.toUpperCase() ?? '?'}</Text>
    </View>
  );
}
export const directListStyles = StyleSheet.create({
  heading: { height: 32, marginTop: Platform.OS === 'web' ? -13 : 0 },
  headingText: { lineHeight: 32, color: tokens.color.foreground },
  list: { flexGrow: 1, paddingTop: 16, paddingBottom: 16 },
});
const styles = StyleSheet.create({
  heading: { height: 58, paddingHorizontal: 20 },
  title: { fontSize: 18, height: 42, lineHeight: 26, fontWeight: '700', color: directColors.ink },
  row: {
    height: 61,
    borderBottomWidth: 1,
    borderColor: tokens.color.divider,
    marginLeft: 16,
    marginRight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 6,
  },
  unreadName: { fontWeight: '700' },
  unreadDetail: { color: directColors.ink, fontWeight: '500' },
  unreadText: { fontSize: 10, lineHeight: 14, color: directColors.ink, fontWeight: '700' },
  avatar: { width: 42, height: 42, borderRadius: 21, flexShrink: 0 },
  avatarFallback: {
    backgroundColor: tokens.color.avatarSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: tokens.discovery.color.tabAccent,
  },
  copy: { marginLeft: 10, flex: 1, minWidth: 0, gap: 4, transform: [{ translateY: -2.5 }] },
  name: { fontSize: 12, lineHeight: 21, fontWeight: '700', color: tokens.color.foreground },
  detail: { fontSize: 12, height: 18, lineHeight: 18, color: directColors.muted },
  action: {
    height: tokens.control.height,
    width: tokens.control.height,
    flexShrink: 0,
    borderRadius: tokens.control.radius,
    backgroundColor: directColors.violet,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  actionIcon: { width: 20, height: 20 },
  unread: {
    position: 'absolute',
    top: 3,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.coral,
  },
});
