import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { AppText as Text } from '../../components/ui/AppText';
import { RoomPage } from '../../components/ui/RoomPage';
import { useAuth } from '../auth';
import { t, tf } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import addIcon from '../../../assets/icons/room-discovery/add.png';
import speechBurstIcon from '../../../assets/icons/room-discovery/speech-burst.png';
import discoverIcon from '../../../assets/icons/room-discovery/discover.png';
import partnersIcon from '../../../assets/icons/room-discovery/partners.png';
import messagesIcon from '../../../assets/icons/room-discovery/messages.png';
import profileIcon from '../../../assets/icons/room-discovery/profile.png';
import { RoomDiscoveryApi, RoomListPager, type RoomSummary } from './api';
import { RoomCard } from './RoomCard';
import { useJoinDraft } from './join';

const colors = tokens.discovery.color;

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
    <RoomPage discovery>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('roomsTitle')}</Text>
        </View>
        <Image source={speechBurstIcon} style={styles.brand} />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('createRoomTitle')}
          onPress={() => router.push('/rooms/create')}
          style={styles.add}
        >
          <Image source={addIcon} style={styles.addIcon} />
        </TouchableOpacity>
      </View>
      <View style={styles.filterRow}>
        <View style={styles.filter}>
          <Text style={styles.filterText}>{t('roomsAll')}</Text>
        </View>
        <Text style={styles.count}>
          {tf(cursor ? 'roomsLoadedCount' : rooms.length === 1 ? 'roomsCountOne' : 'roomsCount', {
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
                router.push(`/rooms/${item.id}/session`);
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
          <View style={styles.navHalo} />
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
    marginLeft: 16,
    marginRight: 20,
    height: 46,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  title: {
    marginTop: 2,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    color: tokens.color.foreground,
  },
  brand: { position: 'absolute', right: 56, top: 4, width: 32, height: 32 },
  add: {
    marginTop: 4,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: tokens.color.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIcon: { width: 24, height: 24 },
  filterRow: {
    height: 47,
    marginLeft: 15,
    marginRight: 17,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  filter: {
    height: 32,
    width: 57,
    borderRadius: 16,
    backgroundColor: colors.filterSelected,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: { fontSize: 12, fontWeight: '500', lineHeight: 23, color: colors.tabAccent },
  count: {
    marginTop: 13,
    color: colors.countMuted,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  list: { paddingBottom: 16, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  message: { color: tokens.color.muted, fontSize: 14, textAlign: 'center', padding: 24 },
  retry: { color: tokens.color.purple, fontWeight: '700', textAlign: 'center', padding: 12 },
  errorBanner: { color: tokens.color.error, fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  nav: {
    height: 80,
    flexShrink: 0,
    borderTopWidth: 1,
    borderColor: colors.navBorder,
    flexDirection: 'row',
    paddingLeft: 23,
    paddingRight: 13,
    justifyContent: 'space-between',
    backgroundColor: tokens.color.panel,
  },
  navItem: { width: 72, flexShrink: 1, height: 62, marginTop: 5, alignItems: 'center' },
  navHalo: {
    position: 'absolute',
    top: -2,
    left: 11,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.cardLavender,
  },
  navIcon: { width: 24, height: 24, marginTop: 5 },
  navText: {
    position: 'absolute',
    left: 22,
    top: 38,
    color: colors.tabAccent,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
  },
  navInactive: {
    position: 'absolute',
    left: 22,
    top: 38,
    color: colors.tabMuted,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
  },
});
