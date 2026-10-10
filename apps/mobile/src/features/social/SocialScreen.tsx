import { randomUUID } from 'expo-crypto';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { RoomHeader, RoomPage } from '../../components/ui/RoomPage';
import { t, type MessageKey } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../auth';
import {
  SocialApi,
  type AvailablePage,
  type BlockPage,
  type FriendPage,
  type InvitationPage,
  type RequestPage,
} from './api';

type Mode = 'friends' | 'available' | 'incoming' | 'outgoing' | 'blocks' | 'invitations';
type Entry =
  | { mode: 'friends'; value: FriendPage['items'][number] }
  | { mode: 'available'; value: AvailablePage['items'][number] }
  | { mode: 'incoming'; value: RequestPage['items'][number] }
  | { mode: 'outgoing'; value: RequestPage['items'][number] }
  | { mode: 'blocks'; value: BlockPage['items'][number] }
  | { mode: 'invitations'; value: InvitationPage['items'][number] };
const modes: Mode[] = ['friends', 'available', 'incoming', 'outgoing', 'blocks', 'invitations'];
const modeLabels: Record<Mode, MessageKey> = {
  friends: 'socialTabFriends',
  available: 'socialTabAvailable',
  incoming: 'socialTabIncoming',
  outgoing: 'socialTabOutgoing',
  blocks: 'socialTabBlocks',
  invitations: 'socialTabInvitations',
};

function shortId(id: string) {
  return `${id.slice(0, 8)}…`;
}
function entryId(entry: Entry) {
  return entry.mode === 'available' ? entry.value.userId : entry.value.id;
}

export function SocialScreen() {
  const router = useRouter();
  const { authorized } = useAuth();
  const api = useMemo(() => new SocialApi(authorized), [authorized]);
  const [mode, setMode] = useState<Mode>('friends');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const requestIds = useRef(new Map<string, string>());
  const epoch = useRef(0);
  const modeRef = useRef(mode);

  const load = useCallback(
    async (nextCursor?: string) => {
      const generation = nextCursor ? epoch.current : ++epoch.current;
      if (nextCursor) setMoreLoading(true);
      else setLoading(true);
      setError('');
      try {
        const page =
          mode === 'friends'
            ? await api.friends(nextCursor)
            : mode === 'available'
              ? await api.available(nextCursor)
              : mode === 'incoming' || mode === 'outgoing'
                ? await api.requests(mode, nextCursor)
                : mode === 'blocks'
                  ? await api.blocks(nextCursor)
                  : await api.invitations(nextCursor);
        if (generation !== epoch.current) return;
        const next = page.items.map((value) => ({ mode, value }) as Entry);
        setEntries((current) =>
          nextCursor
            ? [
                ...current,
                ...next.filter((entry) => !current.some((old) => entryId(old) === entryId(entry))),
              ]
            : next,
        );
        setCursor(page.nextCursor);
      } catch {
        if (generation === epoch.current)
          setError(nextCursor ? t('socialMoreFailed') : t('socialLoadFailed'));
      } finally {
        if (generation === epoch.current) {
          setLoading(false);
          setMoreLoading(false);
        }
      }
    },
    [api, mode],
  );
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function selectMode(next: Mode) {
    if (next === mode) return;
    ++epoch.current;
    modeRef.current = next;
    setMode(next);
    setEntries([]);
    setCursor(null);
    setError('');
    setMessage('');
    setConfirmKey(null);
  }

  async function command(
    action:
      | 'request'
      | 'accept'
      | 'reject'
      | 'withdraw'
      | 'removeFriend'
      | 'block'
      | 'unblock'
      | 'decline',
    target: string,
  ) {
    const key = `${action}:${target}`;
    if (busy) return;
    const id = requestIds.current.get(key) ?? randomUUID();
    requestIds.current.set(key, id);
    setBusy(key);
    setError('');
    setMessage('');
    try {
      if (action === 'request') await api.requestFriend(target, id);
      else if (action === 'accept' || action === 'reject' || action === 'withdraw')
        await api.resolveRequest(target, action, id);
      else if (action === 'removeFriend') await api.deleteFriend(target, id);
      else if (action === 'block') await api.block(target, id);
      else if (action === 'unblock') await api.unblock(target, id);
      else await api.declineInvitation(target, id);
      requestIds.current.delete(key);
      setConfirmKey(null);
      setMessage(t('socialCommandDone'));
      if (modeRef.current === mode) await load();
    } catch {
      setError(t('socialCommandFailed'));
    } finally {
      setBusy(null);
    }
  }

  function action(label: string, key: string, onPress: () => void, destructive = false) {
    return (
      <TouchableOpacity
        key={key}
        accessibilityRole="button"
        disabled={busy !== null}
        onPress={onPress}
      >
        <Text style={destructive ? styles.danger : styles.link}>{label}</Text>
      </TouchableOpacity>
    );
  }

  function confirm(
    actionName: 'removeFriend' | 'block' | 'unblock' | 'decline',
    target: string,
    label: string,
  ) {
    const key = `${actionName}:${target}`;
    return confirmKey === key ? (
      <View style={styles.actions}>
        {action(t('socialConfirm'), `${key}:yes`, () => void command(actionName, target), true)}
        {action(t('cancelAction'), `${key}:no`, () => setConfirmKey(null))}
      </View>
    ) : (
      action(label, key, () => setConfirmKey(key), true)
    );
  }

  function card(entry: Entry) {
    if (entry.mode === 'friends') {
      const person = entry.value.friend;
      return (
        <View key={entry.value.id} style={styles.card}>
          <Text style={styles.name}>{person.displayName}</Text>
          <Text style={styles.meta}>
            {person.cefrLevel} ·{' '}
            {entry.value.isAvailable ? t('socialAvailable') : t('socialUnavailable')}
          </Text>
          <View style={styles.actions}>
            {confirm('removeFriend', person.userId, t('socialRemoveFriend'))}
            {confirm('block', person.userId, t('socialBlock'))}
          </View>
        </View>
      );
    }
    if (entry.mode === 'available') {
      const person = entry.value;
      return (
        <View key={person.userId} style={styles.card}>
          <Text style={styles.name}>{person.displayName}</Text>
          <Text style={styles.meta}>
            {person.cefrLevel} · {t('socialAvailable')}
          </Text>
          <View style={styles.actions}>
            {action(
              t('socialAddFriend'),
              `request:${person.userId}`,
              () => void command('request', person.userId),
            )}
            {confirm('block', person.userId, t('socialBlock'))}
          </View>
        </View>
      );
    }
    if (entry.mode === 'incoming' || entry.mode === 'outgoing') {
      const request = entry.value;
      const peerId = entry.mode === 'incoming' ? request.requesterUserId : request.recipientUserId;
      return (
        <View key={request.id} style={styles.card}>
          <Text style={styles.name}>
            {request.peerDisplayName ?? `${t('socialUser')} ${shortId(peerId)}`}
          </Text>
          <Text style={styles.meta}>
            {request.status === 'PENDING' ? t('socialPending') : request.status}
          </Text>
          {request.status === 'PENDING' ? (
            <View style={styles.actions}>
              {entry.mode === 'incoming' ? (
                <>
                  {action(
                    t('socialAccept'),
                    `accept:${request.id}`,
                    () => void command('accept', request.id),
                  )}
                  {action(
                    t('socialReject'),
                    `reject:${request.id}`,
                    () => void command('reject', request.id),
                    true,
                  )}
                </>
              ) : (
                action(
                  t('socialWithdraw'),
                  `withdraw:${request.id}`,
                  () => void command('withdraw', request.id),
                  true,
                )
              )}
            </View>
          ) : null}
        </View>
      );
    }
    if (entry.mode === 'blocks') {
      const blocked = entry.value;
      return (
        <View key={blocked.id} style={styles.card}>
          <Text style={styles.name}>
            {t('socialUser')} {shortId(blocked.blockedUserId)}
          </Text>
          <View style={styles.actions}>
            {confirm('unblock', blocked.blockedUserId, t('socialUnblock'))}
          </View>
        </View>
      );
    }
    const invitation = entry.value;
    return (
      <View key={invitation.id} style={styles.card}>
        <Text style={styles.name}>{invitation.room.topic}</Text>
        <Text style={styles.meta}>
          {invitation.inviterDisplayName} · {invitation.room.cefrLevel}
        </Text>
        <View style={styles.actions}>
          {action(t('socialViewRoom'), `open:${invitation.id}`, () =>
            router.push({
              pathname: '/rooms/[roomId]',
              params: { roomId: invitation.roomId, invitationId: invitation.id },
            }),
          )}
          {confirm('decline', invitation.id, t('socialDecline'))}
        </View>
      </View>
    );
  }

  return (
    <RoomPage ambient>
      <RoomHeader
        title={t('socialTitle')}
        subtitle={t('socialSubtitle')}
        onBack={() => router.back()}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
        contentContainerStyle={styles.tabContent}
      >
        {modes.map((option) => (
          <TouchableOpacity
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === option }}
            style={[styles.tab, mode === option && styles.tabActive]}
            onPress={() => selectMode(option)}
          >
            <Text style={mode === option ? styles.tabTextActive : styles.tabText}>
              {t(modeLabels[option])}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {error ? (
        <View style={styles.feedback}>
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => void load()}>
            <Text style={styles.link}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
        {loading && entries.length === 0 ? <ActivityIndicator color={tokens.color.purple} /> : null}
        {/* Event handlers created by card access request refs only when the user presses an action. */}
        {!loading && !error && entries.length === 0 ? (
          <Text style={styles.empty}>{t('socialEmpty')}</Text>
        ) : (
          // eslint-disable-next-line react-hooks/refs -- card only reads refs in user action handlers.
          entries.map(card)
        )}
        {cursor ? (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={moreLoading}
            onPress={() => void load(cursor)}
          >
            <Text style={styles.more}>{moreLoading ? t('submitting') : t('socialLoadMore')}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </RoomPage>
  );
}

const styles = StyleSheet.create({
  tabs: { flexGrow: 0, marginBottom: 12 },
  tabContent: { paddingHorizontal: 20, gap: 7 },
  tab: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 18,
    backgroundColor: tokens.color.panel,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabActive: { backgroundColor: tokens.color.purple, borderColor: tokens.color.purple },
  tabText: { color: tokens.color.muted, fontSize: 12 },
  tabTextActive: { color: '#fff', fontSize: 12 },
  scroll: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 90, gap: 12, flexGrow: 1 },
  card: {
    borderColor: tokens.color.border,
    borderWidth: 1,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.color.panel,
    padding: 18,
  },
  name: { color: tokens.color.foreground, fontSize: 17, fontWeight: '700' },
  meta: { color: tokens.color.muted, fontSize: 12, marginTop: 7 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 16 },
  link: { color: tokens.color.purple, fontSize: 13, fontWeight: '700' },
  danger: { color: tokens.color.error, fontSize: 13, fontWeight: '700' },
  feedback: { paddingHorizontal: 20, marginBottom: 10, gap: 6 },
  error: { color: tokens.color.error, fontSize: 13 },
  success: { color: tokens.color.mintInk, fontSize: 13, marginHorizontal: 20, marginBottom: 8 },
  empty: { color: tokens.color.muted, fontSize: 14, marginTop: 80, textAlign: 'center' },
  more: {
    color: tokens.color.purple,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
  },
});
