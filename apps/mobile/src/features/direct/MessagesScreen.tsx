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
import { SocialApi, type FriendPage } from '../social';
import { DirectApi, directError, type Conversation } from './api';
import { DirectHeading, PeerRow, directColors } from './components';
import { useFocusedPolling } from './useFocusedPolling';
export function MessagesScreen() {
  useLanguage();
  const router = useRouter();
  const { authorized } = useAuth();
  const api = useMemo(() => new DirectApi(authorized), [authorized]),
    social = useMemo(() => new SocialApi(authorized), [authorized]);
  const [mode, setMode] = useState<'recent' | 'friends'>('recent'),
    [items, setItems] = useState<Conversation[]>([]),
    [friends, setFriends] = useState<FriendPage['items']>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<MessageKey | null>(null),
    [selected, setSelected] = useState<Conversation | null>(null),
    [busy, setBusy] = useState(false);
  const epoch = useRef(0),
    requestIds = useRef(new Map<string, string>()),
    paging = useRef(false),
    opening = useRef(false),
    refreshing = useRef(false),
    loadedPages = useRef(1);
  const load = useCallback(
    async (current: () => boolean = () => true) => {
      if (refreshing.current || paging.current) return;
      refreshing.current = true;
      const generation = ++epoch.current;
      try {
        const conversations: Conversation[] = [];
        const friendItems: FriendPage['items'] = [];
        let next: string | null = null;
        for (let pageIndex = 0; pageIndex < loadedPages.current; pageIndex++) {
          if (mode === 'recent') {
            const page = await api.conversations(next ?? undefined);
            if (!current() || generation !== epoch.current) return;
            conversations.push(
              ...page.items.filter(
                (item) => !conversations.some((existing) => existing.id === item.id),
              ),
            );
            next = page.nextCursor;
          } else {
            const page = await social.friends(next ?? undefined);
            if (!current() || generation !== epoch.current) return;
            friendItems.push(
              ...page.items.filter(
                (item) => !friendItems.some((existing) => existing.id === item.id),
              ),
            );
            next = page.nextCursor;
          }
          if (!next) break;
        }
        if (mode === 'recent') setItems(conversations);
        else setFriends(friendItems);
        setCursor(next);
        setError(null);
      } catch {
        if (current() && generation === epoch.current) setError('directLoadFailed');
      } finally {
        refreshing.current = false;
        if (current() && generation === epoch.current) setLoading(false);
      }
    },
    [api, social, mode],
  );
  useFocusedPolling(load, 15000);
  const more = async () => {
    if (!cursor || paging.current || refreshing.current) return;
    paging.current = true;
    const generation = epoch.current;
    try {
      if (mode === 'recent') {
        const page = await api.conversations(cursor);
        if (generation !== epoch.current) return;
        setItems((old) => [
          ...old,
          ...page.items.filter((item) => !old.some((x) => x.id === item.id)),
        ]);
        setCursor(page.nextCursor);
        loadedPages.current++;
      } else {
        const page = await social.friends(cursor);
        if (generation !== epoch.current) return;
        setFriends((old) => [
          ...old,
          ...page.items.filter((item) => !old.some((x) => x.id === item.id)),
        ]);
        setCursor(page.nextCursor);
        loadedPages.current++;
      }
    } catch {
      setError('socialMoreFailed');
    } finally {
      paging.current = false;
    }
  };
  const openFriend = async (userId: string) => {
    if (opening.current) return;
    opening.current = true;
    try {
      const item = await api.open(userId);
      router.push(`/messages/${item.id}`);
    } catch (e) {
      setError(directError(e));
    } finally {
      opening.current = false;
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
      <DirectHeading title={t('navMessages')} subtitle={t('messagesSubtitle')} />
      {!(error && items.length === 0 && mode === 'recent') && (
        <View style={styles.tabs}>
          {(['recent', 'friends'] as const).map((value) => (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: value === mode }}
              key={value}
              style={[
                styles.tab,
                { width: value === 'recent' ? 104 : 82 },
                value === mode && styles.active,
              ]}
              onPress={() => {
                if (value === mode) return;
                epoch.current++;
                loadedPages.current = 1;
                setCursor(null);
                setError(null);
                setLoading(true);
                setMode(value);
              }}
            >
              <Text style={[styles.tabText, value === mode && styles.activeText]}>
                {t(value === 'recent' ? 'directRecent' : 'directFriends')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {error && items.length === 0 && mode === 'recent' ? (
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
      ) : mode === 'recent' ? (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
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
              time={new Date(item.lastActivityAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
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
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={() => void load()}
          onEndReached={() => void more()}
          renderItem={({ item }) => (
            <PeerRow
              name={item.friend.displayName}
              avatar={item.friend.avatarUrl}
              detail={item.friend.cefrLevel.replaceAll('_', '–') + ' · ' + t('directFriend')}
              action={t('directChatAction')}
              onPress={() => void openFriend(item.friend.userId)}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>{t(error ?? 'socialEmpty')}</Text>}
          ListFooterComponent={
            <TouchableOpacity onPress={() => router.push('/me/social')}>
              <Text style={styles.manage}>{t('directManageFriends')}</Text>
            </TouchableOpacity>
          }
        />
      )}
      {error && !(items.length === 0 && mode === 'recent') && (
        <TouchableOpacity onPress={() => void load()}>
          <Text accessibilityRole="alert" style={styles.error}>
            {t(error)} · {t('retry')}
          </Text>
        </TouchableOpacity>
      )}
      <BottomNavigation active={2} />
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
  tabs: { height: 63, paddingTop: 6, paddingHorizontal: 16, flexDirection: 'row', gap: 9 },
  tab: {
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 0,
    backgroundColor: tokens.color.purpleSoft,
    justifyContent: 'center',
  },
  active: { backgroundColor: directColors.violet },
  tabText: {
    fontSize: 14,
    lineHeight: 20,
    height: 22,
    textAlign: 'center',
    color: directColors.violet,
    fontWeight: '500',
  },
  activeText: {
    fontSize: 14,
    lineHeight: 20,
    height: 22,
    color: '#FFFFFF',
    fontWeight: '500',
    textAlign: 'center',
  },
  list: { flexGrow: 1, paddingBottom: 16 },
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
  dialogTitle: { fontSize: 20, lineHeight: 30, fontWeight: '700', color: directColors.ink },
  note: { fontSize: 14, lineHeight: 24, color: directColors.muted },
  confirm: {
    height: 48,
    backgroundColor: directColors.violet,
    borderRadius: 24,
    justifyContent: 'center',
  },
});
