import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { RoomPage } from '../../components/ui/RoomPage';
import { BottomNavigation } from '../../components/ui/BottomNavigation';
import { AppText as Text } from '../../components/ui/AppText';
import { t, useLanguage, type MessageKey } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../auth';
import { SocialApi, type AvailablePage } from '../social';
import { DirectApi, directError } from './api';
import { DirectHeading, PeerRow, directColors } from './components';
import { useFocusedPolling } from './useFocusedPolling';
export function PartnersScreen() {
  useLanguage();
  const router = useRouter();
  const { authorized } = useAuth();
  const social = useMemo(() => new SocialApi(authorized), [authorized]),
    direct = useMemo(() => new DirectApi(authorized), [authorized]);
  const [items, setItems] = useState<AvailablePage['items']>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [more, setMore] = useState(false),
    [error, setError] = useState<MessageKey | null>(null);
  const opening = useRef(false),
    generation = useRef(0),
    paging = useRef(false),
    refreshing = useRef(false),
    loadedPages = useRef(1);
  const refresh = useCallback(
    async (current: () => boolean = () => true) => {
      if (refreshing.current || paging.current) return;
      refreshing.current = true;
      const epoch = ++generation.current;
      try {
        const collected: AvailablePage['items'] = [];
        let next: string | null = null;
        for (let pageIndex = 0; pageIndex < loadedPages.current; pageIndex++) {
          const page = await social.available(next ?? undefined);
          if (!current() || epoch !== generation.current) return;
          collected.push(
            ...page.items.filter(
              (item) => !collected.some((existing) => existing.userId === item.userId),
            ),
          );
          next = page.nextCursor;
          if (!next) break;
        }
        setItems(collected);
        setCursor(next);
        setError(null);
      } catch {
        if (current() && epoch === generation.current) setError('socialLoadFailed');
      } finally {
        refreshing.current = false;
        if (current() && epoch === generation.current) setLoading(false);
      }
    },
    [social],
  );
  useFocusedPolling(refresh, 30000);
  const moreItems = async () => {
    if (!cursor || paging.current || refreshing.current) return;
    paging.current = true;
    setMore(true);
    const epoch = generation.current;
    try {
      const page = await social.available(cursor);
      if (epoch === generation.current) {
        setItems((old) => [
          ...old,
          ...page.items.filter((item) => !old.some((x) => x.userId === item.userId)),
        ]);
        setCursor(page.nextCursor);
        loadedPages.current++;
      }
    } catch {
      setError('socialMoreFailed');
    } finally {
      paging.current = false;
      setMore(false);
    }
  };
  const open = async (id: string) => {
    if (opening.current) return;
    opening.current = true;
    try {
      const conversation = await direct.open(id);
      router.push(`/messages/${conversation.id}`);
    } catch (e) {
      setError(directError(e));
    } finally {
      opening.current = false;
    }
  };
  return (
    <RoomPage direct hidePreviewIndicator>
      <DirectHeading title={t('navPartners')} subtitle={t('partnersSubtitle')} />
      {(loading || items.length > 0) && (
        <View style={styles.summary}>
          <Text style={styles.heading}>{t('partnersAvailable')}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.refresh}
            onPress={() => void refresh()}
          >
            <Text style={styles.refreshText}>{t('refreshAction')}</Text>
          </TouchableOpacity>
        </View>
      )}
      {loading ? (
        <ActivityIndicator style={styles.center} color={directColors.violet} />
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyText}>{t(error ?? 'partnersEmpty')}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => void refresh()}
              style={styles.emptyRefresh}
            >
              <Text style={styles.emptyRefreshText}>{t('refreshAction')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => (
            <PeerRow
              name={item.displayName}
              avatar={item.avatarUrl}
              detail={item.cefrLevel.replaceAll('_', '–') + ' · ' + t('directAvailable')}
              action={t('directChatAction')}
              onPress={() => void open(item.userId)}
            />
          )}
          refreshing={loading}
          onRefresh={() => void refresh()}
          onEndReached={() => void moreItems()}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>{t(error ?? 'partnersEmpty')}</Text>}
          ListFooterComponent={
            more ? (
              <ActivityIndicator />
            ) : cursor ? (
              <TouchableOpacity onPress={() => void moreItems()}>
                <Text style={styles.empty}>{t('socialLoadMore')}</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
      {error && items.length > 0 && (
        <Text accessibilityRole="alert" style={styles.error}>
          {t(error)}
        </Text>
      )}
      <BottomNavigation active={1} />
    </RoomPage>
  );
}
const styles = StyleSheet.create({
  summary: {
    height: 55,
    paddingHorizontal: 20,
    paddingTop: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heading: { fontSize: 14, lineHeight: 24, fontWeight: '500', color: directColors.ink },
  refresh: {
    width: 90,
    height: 32,
    paddingHorizontal: 15,
    borderRadius: 16,
    backgroundColor: tokens.color.purpleSoft,
  },
  refreshText: { textAlign: 'center', fontSize: 14, lineHeight: 32, color: directColors.violet },
  list: { flexGrow: 1, paddingBottom: 16 },
  center: { flex: 1 },
  emptyPanel: { position: 'absolute', top: 192, left: 30, right: 30, alignItems: 'center' },
  emptyText: {
    alignSelf: 'stretch',
    height: 24,
    fontSize: 14,
    lineHeight: 20,
    color: directColors.muted,
  },
  emptyRefresh: {
    width: 150,
    height: 44,
    marginTop: 25,
    borderRadius: 22,
    backgroundColor: directColors.violet,
    justifyContent: 'center',
  },
  emptyRefreshText: {
    fontSize: 14,
    lineHeight: 20,
    height: 22,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  empty: {
    fontSize: 14,
    lineHeight: 24,
    color: directColors.muted,
    textAlign: 'center',
    padding: 30,
  },
  error: { fontSize: 12, color: tokens.color.error, textAlign: 'center', padding: 12 },
});
