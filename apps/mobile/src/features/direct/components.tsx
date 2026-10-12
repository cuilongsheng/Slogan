import defaultAvatar from '../../../assets/profile/default-avatar.png';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/ui/AppText';
import { tf } from '../../services/locale';
import { tokens } from '../../styles/tokens';
export const directColors = {
  ink: '#26233B',
  violet: '#6247E8',
  canvas: tokens.color.surface,
  muted: tokens.color.muted,
};
export function DirectHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string | undefined;
}) {
  return (
    <View style={[styles.heading, !subtitle && styles.compactHeading]}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
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
      <Image source={avatar ? { uri: avatar } : defaultAvatar} style={styles.avatar} />
      <View style={styles.copy}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {action && (
        <View style={styles.action}>
          <Text style={styles.actionText}>{action}</Text>
        </View>
      )}
      {unread > 0 && <View style={styles.unread} />}
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  heading: { height: 86, paddingHorizontal: 20 },
  compactHeading: { height: 58 },
  title: { fontSize: 28, height: 42, lineHeight: 38, fontWeight: '700', color: directColors.ink },
  subtitle: { fontSize: 14, height: 24, lineHeight: 20, color: directColors.muted, marginTop: 10 },
  row: {
    height: 88,
    borderRadius: 24,
    backgroundColor: tokens.color.purpleSoft,
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 16,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  copy: { marginLeft: 12, flex: 1, minWidth: 0, gap: 4, transform: [{ translateY: -4 }] },
  name: { fontSize: 16, lineHeight: 25, fontWeight: '500', color: directColors.ink },
  detail: { fontSize: 12, height: 22, lineHeight: 18, color: directColors.muted },
  action: {
    height: 34,
    width: 74,
    borderRadius: 17,
    backgroundColor: directColors.violet,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  actionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500', lineHeight: 22 },
  unread: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.color.coral,
  },
});
