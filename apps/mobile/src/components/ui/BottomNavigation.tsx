import discoverIcon from '../../../assets/icons/room-discovery/discover.png';
import partnersIcon from '../../../assets/icons/room-discovery/partners.png';
import messagesIcon from '../../../assets/icons/room-discovery/messages.png';
import profileIcon from '../../../assets/icons/room-discovery/profile.png';
import { useRouter } from 'expo-router';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from './AppText';
import { t, useLanguage } from '../../services/locale';
import { tokens } from '../../styles/tokens';
const icons = [discoverIcon, partnersIcon, messagesIcon, profileIcon];
const tabs = [
  { path: '/rooms', label: 'navDiscover' },
  { path: '/partners', label: 'navPartners' },
  { path: '/messages', label: 'navMessages' },
  { path: '/me', label: 'navProfile' },
] as const;
export function BottomNavigation({ active }: { active: 0 | 1 | 2 | 3 }) {
  useLanguage();
  const router = useRouter();
  return (
    <View style={styles.nav}>
      {tabs.map((tab, index) => (
        <TouchableOpacity
          key={tab.path}
          accessibilityRole="button"
          accessibilityLabel={t(tab.label)}
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
  selected: { color: tokens.discovery.color.tabAccent },
});
