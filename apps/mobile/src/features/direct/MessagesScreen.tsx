import { largeAction } from '../../components/ui/largeAction';
import { MainListEmpty } from '../../components/ui/MainListEmpty';
import { MainPageTitle } from '../../components/ui/MainPageTitle';
import { LatestRequestQueue } from '../../services/latestRequestQueue';
import { useCallback, useMemo, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { RoomPage } from '../../components/ui/RoomPage';
import { BottomNavigation } from '../../components/ui/BottomNavigation';
import { AppText as Text } from '../../components/ui/AppText';
import { t, useLanguage, type MessageKey } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../auth';
import { DirectApi, directError, type Conversation } from './api';
import { PeerRow, directColors, directListStyles } from './components';
import { useMessageUnread } from './MessageUnreadProvider';
import { useFocusedLive, LiveConnectionNotice, mainListError } from '../live-updates';
export function MessagesScreen() {
  useLanguage();
  const router = useRouter();
  const refreshQueue = useRef(new LatestRequestQueue());
  const unread = useMessageUnread();
  const { authorized } = useAuth();
  const api = useMemo(() => new DirectApi(authorized), [authorized]);
  const [items, setItems] = useState<Conversation[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<MessageKey | null>(null),
    [selected, setSelected] = useState<Conversation | null>(null),
    [busy, setBusy] = useState(false);
  const deferredRefresh = useRef<(() => boolean) | null>(null);
  const epoch = useRef(0),
    requestIds = useRef(new Map<string, string>()),
    paging = useRef(false),
    refreshing = useRef(false),
    loadedPages = useRef(1);
  const load = useCallback(
    (current: () => boolean = () => true) =>
      refreshQueue.current.enqueue(async () => {
        if (!current()) return;
        if (paging.current) {
          deferredRefresh.current = current;
          return;
        }
        refreshing.current = true;
        const generation = ++epoch.current;
        try {
          const conversations: Conversation[] = [];
          let next: string | null = null;
          for (let pageIndex = 0; pageIndex < loadedPages.current; pageIndex++) {
            const page = await api.conversations(next ?? undefined);
            if (!current() || generation !== epoch.current) return;
            conversations.push(
              ...page.items.filter(
                (item) => !conversations.some((existing) => existing.id === item.id),
              ),
            );
            next = page.nextCursor;
            if (!next) break;
          }
          setItems(conversations);
          setCursor(next);
          setError(null);
        } catch (error) {
          if (current() && generation === epoch.current)
            setError(mainListError(error, 'directLoadFailed'));
        } finally {
          refreshing.current = false;
          if (current() && generation === epoch.current) setLoading(false);
        }
      }),
    [api],
  );
  const requestFence = useFocusedLive(load, 'inbox');
  const more = async () => {
    if (!cursor || paging.current || refreshing.current) return;
    paging.current = true;
    const generation = epoch.current;
    const current = requestFence();
    try {
      const page = await api.conversations(cursor);
      if (!current() || generation !== epoch.current) return;
      setItems((old) => [
        ...old,
        ...page.items.filter((item) => !old.some((x) => x.id === item.id)),
      ]);
      setCursor(page.nextCursor);
      loadedPages.current++;
    } catch (error) {
      if (current()) setError(mainListError(error, 'socialMoreFailed'));
    } finally {
      paging.current = false;
      const deferred = deferredRefresh.current;
      deferredRefresh.current = null;
      if (deferred) void load(deferred);
    }
  };
  const hide = async () => {
    if (!selected || busy) return;
    setBusy(true);
    const id = requestIds.current.get(selected.id) ?? randomUUID();
    requestIds.current.set(selected.id, id);
    try {
      await api.hide(selected.id, id);
      requestIds.current.delete(selected.id);
      setItems((old) => old.filter((item) => item.id !== selected.id));
      setSelected(null);
    } catch (e) {
      setError(directError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <RoomPage direct hidePreviewIndicator>
      <MainPageTitle
        title={t('navMessages')}
        style={directListStyles.heading}
        textStyle={directListStyles.headingText}
      />
      {error && items.length === 0 ? (
        <View style={{ flex: 1 }}>
          <View style={styles.failure}>
            <Text style={styles.failureText}>{t('directListFailed')}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => void load()}
              style={styles.retry}
            >
              <Text style={styles.activeText}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={directColors.violet} />
      ) : items.length === 0 ? (
        <MainListEmpty onRefresh={() => void load()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={directListStyles.list}
          refreshing={loading}
          onRefresh={() => void load()}
          onEndReached={() => void more()}
          renderItem={({ item }) => (
            <PeerRow
              name={item.peer.displayName}
              avatar={item.peer.avatarUrl}
              detail={
                item.lastCall &&
                (!item.lastMessage || item.lastCall.sequence > item.lastMessage.sequence)
                  ? t('directVoiceAction')
                  : (item.lastMessage?.text ?? t('directNew'))
              }
              action={t('directViewAction')}
              unread={item.unreadCount}
              onPress={() => router.push(`/messages/${item.id}`)}
              onLongPress={() => setSelected(item)}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>{t(error ?? 'directEmpty')}</Text>}
          ListFooterComponent={
            cursor ? (
              <TouchableOpacity onPress={() => void more()}>
                <Text style={styles.empty}>{t('socialLoadMore')}</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
      {error && !(items.length === 0) && (
        <TouchableOpacity onPress={() => void load()}>
          <Text accessibilityRole="alert" style={styles.error}>
            {t(error)} · {t('retry')}
          </Text>
        </TouchableOpacity>
      )}
      <LiveConnectionNotice />
      <BottomNavigation active={2} unreadMessages={unread.count} />
      <Modal transparent visible={!!selected} onRequestClose={() => setSelected(null)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{t('directDelete')}</Text>
            <Text style={styles.note}>{t('directDeleteNote')}</Text>
            <TouchableOpacity disabled={busy} onPress={() => void hide()} style={styles.confirm}>
              <Text style={styles.activeText}>{t(busy ? 'submitting' : 'socialConfirm')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Text style={styles.manage}>{t('cancelAction')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </RoomPage>
  );
}
const styles = StyleSheet.create({
  failure: { position: 'absolute', top: 192, left: 35, right: 35, alignItems: 'center' },
  failureText: {
    fontSize: 14,
    lineHeight: 20,
    height: 24,
    color: directColors.muted,
    alignSelf: 'stretch',
    textAlign: 'left',
  },
  retry: {
    width: 150,
    height: 44,
    marginTop: 25,
    borderRadius: 22,
    backgroundColor: directColors.violet,
    justifyContent: 'center',
  },
  activeText: {
    fontSize: 14,
    lineHeight: 20,
    height: 22,
    color: '#FFFFFF',
    fontWeight: '500',
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
  manage: {
    fontSize: 14,
    lineHeight: 24,
    color: directColors.violet,
    textAlign: 'center',
    padding: 12,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00000066',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 342,
    backgroundColor: tokens.color.surface,
    borderRadius: 24,
    padding: 24,
    gap: 18,
  },
  dialogTitle: { fontSize: 18, lineHeight: 26, fontWeight: '700', color: directColors.ink },
  note: { fontSize: 14, lineHeight: 24, color: directColors.muted },
  confirm: {
    backgroundColor: directColors.violet,

    justifyContent: 'center',
    ...largeAction,
  },
});
