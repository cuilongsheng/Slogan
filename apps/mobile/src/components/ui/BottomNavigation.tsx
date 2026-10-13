import discoverIcon from '../../../assets/icons/room-discovery/discover.png';
import partnersIcon from '../../../assets/icons/room-discovery/partners.png';
import messagesIcon from '../../../assets/icons/room-discovery/messages.png';
import profileIcon from '../../../assets/icons/room-discovery/profile.png';
import { useRouter } from 'expo-router';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from './AppText';
import { t, tf, useLanguage } from '../../services/locale';
import { tokens } from '../../styles/tokens';
const icons = [discoverIcon, partnersIcon, messagesIcon, profileIcon];
const tabs = [
  { path: '/rooms', label: 'navDiscover' },
  { path: '/partners', label: 'navPartners' },
  { path: '/messages', label: 'navMessages' },
  { path: '/me', label: 'navProfile' },
] as const;
export function BottomNavigation({
  active,
  unreadMessages = 0,
}: {
  active: 0 | 1 | 2 | 3;
  unreadMessages?: number;
}) {
  useLanguage();
  const router = useRouter();
  return (
    <View style={styles.nav}>
      {tabs.map((tab, index) => (
        <TouchableOpacity
          key={tab.path}
          accessibilityRole="button"
          accessibilityLabel={
            index === 2 && unreadMessages > 0
              ? tf('navMessagesUnread', { count: unreadMessages })
              : t(tab.label)
          }
          accessibilityState={{ selected: active === index }}
          onPress={() => {
            if (active !== index) router.navigate(tab.path);
          }}
          style={styles.item}
        >
          <Image
            source={icons[index]}
            style={styles.icon}
            tintColor={
              active === index ? tokens.discovery.color.tabAccent : tokens.discovery.color.tabMuted
            }
          />
          {index === 2 && unreadMessages > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadMessages > 99 ? '99+' : unreadMessages}</Text>
            </View>
          )}
          <Text style={[styles.label, active === index && styles.selected]}>{t(tab.label)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  nav: {
    height: 80,
    flexShrink: 0,
    borderTopWidth: 1,
    borderColor: tokens.discovery.color.navBorder,
    flexDirection: 'row',
    paddingHorizontal: 16,
    backgroundColor: tokens.color.panel,
  },
  item: { flex: 1, minWidth: 0, height: 62, marginTop: 5, alignItems: 'center' },
  icon: { width: 24, height: 24, marginTop: 5 },
  label: {
    marginTop: 9,
    textAlign: 'center',
    color: tokens.discovery.color.tabMuted,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
  },
  badge: {
    position: 'absolute',
    top: 1,
    left: '53%',
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: tokens.color.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, lineHeight: 14, color: tokens.color.foreground, fontWeight: '700' },
  selected: { color: tokens.discovery.color.tabAccent },
});
