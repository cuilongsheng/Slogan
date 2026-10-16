import { useFocusedLive } from '../live-updates';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { RoomHeader, RoomPage } from '../../components/ui/RoomPage';
import { t, useLanguage } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../auth';
import { RoomHistoryApi, type HistoryItem } from './api';

function roomStatus(item: HistoryItem) {
  if (item.status === 'ENDED') return t('historyEnded');
  if (item.status === 'CANCELLED') return t('historyCancelled');
  if (item.status === 'SCHEDULED') return t('historyScheduled');
  return t('historyOngoing');
}

export function HistoryScreen() {
  useLanguage();
  const router = useRouter();
  const { authorized } = useAuth();
  const api = useMemo(() => new RoomHistoryApi(authorized), [authorized]);
  const pages = useRef(1);
  const requestEpoch = useRef(0);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [moreError, setMoreError] = useState(false);

  const refresh = useCallback(
    async (pull = false, current: () => boolean = () => true) => {
      const epoch = ++requestEpoch.current;
      setLoadingMore(false);
      if (pull) setRefreshing(true);
      else setLoading(true);
      setError(false);
      try {
        const collected: HistoryItem[] = [];
        let next: string | undefined;
        let count = 0;
        do {
          const page = await api.list(next);
          if (epoch !== requestEpoch.current || !current()) return;
          collected.push(
            ...page.items.filter((item) => !collected.some((old) => old.roomId === item.roomId)),
          );
          next = page.nextCursor ?? undefined;
          count++;
        } while (next && count < pages.current);
        const page = { items: collected, nextCursor: next ?? null };
        pages.current = count;
        if (epoch !== requestEpoch.current || !current()) return;
        setItems(page.items);
        setCursor(page.nextCursor);
        setMoreError(false);
      } catch {
        if (epoch === requestEpoch.current && current()) setError(true);
      } finally {
        if (epoch === requestEpoch.current && current()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [api],
  );
  const liveRefresh = useCallback(
    async (current: () => boolean) => {
      await refresh(false, current);
    },
    [refresh],
  );
  const fence = useFocusedLive(liveRefresh, 'learning');

  async function loadMore() {
    if (!cursor || loading || loadingMore) return;
    const epoch = requestEpoch.current;
    const active = fence();
    setLoadingMore(true);
    setMoreError(false);
    try {
      const page = await api.list(cursor);
      if (epoch !== requestEpoch.current || !active()) return;
      pages.current++;
      setItems((current) => [
        ...current,
        ...page.items.filter((item) => !current.some((old) => old.roomId === item.roomId)),
      ]);
      setCursor(page.nextCursor);
    } catch {
      if (epoch === requestEpoch.current && active()) setMoreError(true);
    } finally {
      if (epoch === requestEpoch.current && active()) setLoadingMore(false);
    }
  }

  return (
    <RoomPage ambient>
      <RoomHeader title={t('historyTitle')} onBack={() => router.back()} />
      {error && items.length > 0 ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t('historyLoadFailed')}
        </Text>
      ) : null}
      {loading && items.length === 0 ? (
        <ActivityIndicator style={styles.center} color={tokens.color.purple} />
      ) : error && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>{t('historyLoadFailed')}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => void refresh(false, fence())}>
            <Text style={styles.link}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.roomId}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={() => void refresh(true, fence())}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.card}>
              <Text style={styles.empty}>{t('historyEmpty')}</Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => void refresh(true, fence())}
              >
                <Text style={styles.link}>{t('safetyRefresh')}</Text>
              </TouchableOpacity>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={tokens.color.purple} />
            ) : moreError ? (
              <TouchableOpacity accessibilityRole="button" onPress={() => void loadMore()}>
                <Text style={styles.link}>
                  {t('historyMoreFailed')} · {t('retry')}
                </Text>
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.topic}>{item.topic}</Text>
                <Text style={styles.badge}>{roomStatus(item)}</Text>
              </View>
              <Text style={styles.meta}>
                {item.relationship === 'PARTICIPATED'
                  ? t('historyParticipated')
                  : t('historyReservedOnly')}{' '}
                · {item.kind === 'INSTANT' ? t('historyInstant') : t('historyAppointment')} ·{' '}
                {item.cefrLevel}
              </Text>
              <Text style={styles.date}>{new Date(item.occurredAt).toLocaleString()}</Text>
              {item.relationship === 'PARTICIPATED' && item.status === 'ENDED' ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/me/history/[roomId]',
                      params: { roomId: item.roomId },
                    })
                  }
                >
                  <Text style={styles.link}>
                    {item.noteExists ? t('historyEditNote') : t('historyWriteNote')} ›
                  </Text>
                </TouchableOpacity>
              ) : null}
              {item.relationship === 'PARTICIPATED' && item.status === 'ENDED' ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/me/history/[roomId]/keywords',
                      params: { roomId: item.roomId },
                    })
                  }
                >
                  <Text style={styles.link}>{t('historyKeywords')} ›</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        />
      )}
    </RoomPage>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 90, gap: 14, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius.lg,
    padding: 18,
    backgroundColor: tokens.color.panel,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  topic: {
    flex: 1,
    color: tokens.color.foreground,
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
  },
  badge: {
    color: tokens.color.purple,
    backgroundColor: tokens.color.purpleSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    fontSize: 11,
  },
  meta: { color: tokens.color.muted, fontSize: 13, marginTop: 15 },
  date: { color: tokens.color.muted, fontSize: 12, marginTop: 8 },
  link: { color: tokens.color.purple, fontWeight: '700', fontSize: 13, marginTop: 14 },
  error: { color: tokens.color.error, marginHorizontal: 20, marginBottom: 8, fontSize: 13 },
  empty: { color: tokens.color.muted, fontSize: 14, textAlign: 'center' },
});
