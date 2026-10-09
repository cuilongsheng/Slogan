import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { RoomPage } from '../../components/ui/RoomPage';
import { useAuth } from '../auth';
import { t, tf } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import addIcon from '../../../assets/icons/add.png';
import discoverIcon from '../../../assets/icons/discover.png';
import partnersIcon from '../../../assets/icons/partners.png';
import messagesIcon from '../../../assets/icons/messages.png';
import profileIcon from '../../../assets/icons/profile.png';
import { RoomDiscoveryApi, RoomListPager, type RoomSummary } from './api';
import { RoomCard } from './RoomCard';
import { useJoinDraft } from './join';

export function RoomListScreen() {
  const router = useRouter();
  const { authorized } = useAuth();
  const { beginDirect } = useJoinDraft();
  const entering = useRef(false);
  const pager = useMemo(() => new RoomListPager(new RoomDiscoveryApi(authorized)), [authorized]);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);

  const refresh = useCallback(
    async (isPull = false) => {
      if (isPull) setRefreshing(true);
      else setLoading(true);
      setError(false);
      try {
        const page = await pager.refresh();
        setRooms(page.items);
        setCursor(page.nextCursor);
        setMoreError(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [pager],
  );

  useFocusEffect(
    useCallback(() => {
      entering.current = false;
      void refresh();
    }, [refresh]),
  );

  const loadMore = async () => {
    if (!cursor || moreLoading || loading) return;
    setMoreLoading(true);
    setMoreError(false);
    try {
      const page = await pager.loadMore();
      setRooms(page.items);
      setCursor(page.nextCursor);
    } catch {
      setMoreError(true);
    } finally {
      setMoreLoading(false);
    }
  };

  return (
    <RoomPage ambient>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('roomsTitle')}</Text>
          <Text style={styles.subtitle}>{t('roomsSubtitle')}</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('createRoomTitle')}
          onPress={() => router.push('/rooms/create')}
          style={styles.add}
        >
          <Image source={addIcon} style={styles.addIcon} />
        </TouchableOpacity>
      </View>
      <View style={styles.filter}>
        <Text style={styles.filterText}>{t('roomsAll')}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('roomsOngoing')}</Text>
        <Text style={styles.count}>
          {tf(rooms.length === 1 ? 'roomsLoadedCountOne' : 'roomsLoadedCount', {
            count: rooms.length,
          })}
        </Text>
      </View>
      {error && rooms.length > 0 && (
        <TouchableOpacity accessibilityRole="button" onPress={() => void refresh(true)}>
          <Text style={styles.errorBanner}>
            {t('roomsLoadFailed')} {t('retry')}
          </Text>
        </TouchableOpacity>
      )}
      {loading && rooms.length === 0 ? (
        <ActivityIndicator style={styles.center} color={tokens.color.purple} />
      ) : error && rooms.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.message}>{t('roomsLoadFailed')}</Text>
          <TouchableOpacity onPress={() => void refresh()}>
            <Text style={styles.retry}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(room) => room.id}
          renderItem={({ item, index }) => (
            <RoomCard
              room={item}
              index={index}
              onPress={() => {
                if (entering.current) return;
                entering.current = true;
                beginDirect(item.id);
                router.push(
                  item.passwordProtected
                    ? `/rooms/${item.id}/password`
                    : `/rooms/${item.id}/session`,
                );
              }}
            />
          )}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={() => void refresh(true)}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<Text style={styles.message}>{t('roomsEmpty')}</Text>}
          ListFooterComponent={
            moreLoading ? (
              <ActivityIndicator color={tokens.color.purple} />
            ) : moreError ? (
              <TouchableOpacity onPress={() => void loadMore()}>
                <Text style={styles.retry}>{t('roomsMoreFailed')}</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
      <View style={styles.nav}>
        <View style={styles.navItem}>
          <Image source={discoverIcon} style={styles.navIcon} />
          <Text style={styles.navText}>{t('navDiscover')}</Text>
        </View>
        <View style={styles.navItem}>
          <Image source={partnersIcon} style={styles.navIcon} />
          <Text style={styles.navInactive}>{t('navPartners')}</Text>
        </View>
        <View style={styles.navItem}>
          <Image source={messagesIcon} style={styles.navIcon} />
          <Text style={styles.navInactive}>{t('navMessages')}</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('navProfile')}
          style={styles.navItem}
          onPress={() => router.push('/me')}
        >
          <Image source={profileIcon} style={styles.navIcon} />
          <Text style={styles.navInactive}>{t('navProfile')}</Text>
        </TouchableOpacity>
      </View>
    </RoomPage>
  );
}

const styles = StyleSheet.create({
  header: {
    marginHorizontal: 20,
    height: 75,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: { fontSize: 24, fontWeight: '700', color: tokens.color.foreground },
  subtitle: { fontSize: 12, color: tokens.color.muted, marginTop: 3 },
  add: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: tokens.color.coral,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  addIcon: { width: 24, height: 24 },
  filter: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20 },
  filterText: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: tokens.color.purple,
    paddingHorizontal: 13,
    paddingVertical: 7,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  ongoing: {
    color: tokens.color.purple,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 7,
    fontSize: 12,
  },
  section: {
    height: 36,
    marginHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { color: tokens.color.foreground, fontSize: 17, fontWeight: '700' },
  count: { color: tokens.color.muted, fontSize: 11 },
  list: { paddingTop: 1, paddingBottom: 92, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  message: { color: tokens.color.muted, fontSize: 14, textAlign: 'center', padding: 24 },
  retry: { color: tokens.color.purple, fontWeight: '700', textAlign: 'center', padding: 12 },
  errorBanner: { color: tokens.color.error, fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  nav: {
    height: 80,
    borderTopWidth: 1,
    borderColor: tokens.color.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: tokens.color.surface,
  },
  navItem: { minWidth: 58, alignItems: 'center', justifyContent: 'center', gap: 4 },
  navIcon: { width: 24, height: 24 },
  navText: { color: tokens.color.purple, fontSize: 10 },
  navInactive: { color: tokens.color.muted, fontSize: 10 },
});
