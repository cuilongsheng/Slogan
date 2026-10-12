import backIcon from '../../../assets/icons/back.png';
import micIcon from '../../../assets/icons/mic.png';
import { useCallback, useMemo, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { RoomPage } from '../../components/ui/RoomPage';
import { AppText as Text } from '../../components/ui/AppText';
import { t, useLanguage, type MessageKey } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../auth';
import { SocialApi } from '../social';
import {
  DirectApi,
  directError,
  type Conversation,
  type DirectMessage,
  type DirectCall,
} from './api';
import { directColors } from './components';
import { useFocusedPolling } from './useFocusedPolling';
type Pending = { id: string; text: string; busy: boolean };
type Timeline =
  | { kind: 'text'; value: DirectMessage }
  | { kind: 'call'; value: DirectCall }
  | { kind: 'pending'; value: Pending };
export function ChatScreen({ conversationId }: { conversationId: string }) {
  useLanguage();
  const router = useRouter();
  const { authorized, state } = useAuth();
  const userId = state.kind === 'signedIn' ? state.me.userId : '';
  const api = useMemo(() => new DirectApi(authorized), [authorized]),
    social = useMemo(() => new SocialApi(authorized), [authorized]);
  const [conversation, setConversation] = useState<Conversation | null>(null),
    [messages, setMessages] = useState<DirectMessage[]>([]),
    [calls, setCalls] = useState<DirectCall[]>([]),
    [pending, setPending] = useState<Pending[]>([]),
    [draft, setDraft] = useState(''),
    [error, setError] = useState<MessageKey | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<'block' | 'hide' | 'report' | null>(null),
    [reportMessage, setReportMessage] = useState<DirectMessage | null>(null),
    [reason, setReason] = useState(''),
    [notice, setNotice] = useState<MessageKey | null>(null);
  const cursor = useRef<string | undefined>(undefined),
    callCursor = useRef<string | undefined>(undefined),
    lastRead = useRef(0),
    lastDetail = useRef(0),
    sending = useRef(new Set<string>()),
    commandIds = useRef(new Map<string, string>()),
    list = useRef<FlatList<Timeline>>(null);
  const hasConversation = conversation !== null;
  const nearBottom = useRef(true);
  const load = useCallback(
    async (current: () => boolean = () => true) => {
      try {
        if (!hasConversation || Date.now() - lastDetail.current > 15000) {
          const detail = await api.detail(conversationId);
          if (!current()) return;
          setConversation(detail);
          lastDetail.current = Date.now();
        }
        const [page, history] = await Promise.all([
          api.messages(conversationId, cursor.current),
          api.callHistory(conversationId, callCursor.current),
        ]);
        if (!current()) return;
        cursor.current = page.nextCursor ?? undefined;
        callCursor.current = history.nextCursor ?? undefined;
        setMessages((old) =>
          [
            ...old.filter(
              (item) =>
                item.sequence > page.visibleAfterSequence &&
                !page.items.some((next) => next.id === item.id),
            ),
            ...page.items,
          ].sort((a, b) => a.sequence - b.sequence),
        );
        setCalls((old) =>
          [
            ...old.filter(
              (item) =>
                item.sequence > history.visibleAfterSequence &&
                !history.items.some((next) => next.id === item.id),
            ),
            ...history.items,
          ].sort((a, b) => a.sequence - b.sequence),
        );
        setPending((old) =>
          old.filter((item) => !page.items.some((message) => message.clientRequestId === item.id)),
        );
        const sequence = Math.max(
          ...page.items.map((item) => item.sequence),
          ...history.items.map((item) => item.sequence),
          0,
        );
        if (sequence > lastRead.current) {
          await api.read(conversationId, sequence);
          if (current()) lastRead.current = sequence;
        }
        setError(null);
      } catch (e) {
        if (current()) setError(directError(e));
      } finally {
        if (current()) setLoading(false);
      }
    },
    [api, conversationId, hasConversation],
  );
  useFocusedPolling(load, 3000);
  const send = async (item: Pending) => {
    if (sending.current.has(item.id)) return;
    sending.current.add(item.id);
    setPending((old) => old.map((row) => (row.id === item.id ? { ...row, busy: true } : row)));
    try {
      nearBottom.current = true;
      const message = await api.send(conversationId, item.text, item.id);
      setMessages((old) =>
        [...old.filter((row) => row.id !== message.id), message].sort(
          (a, b) => a.sequence - b.sequence,
        ),
      );
      setPending((old) => old.filter((row) => row.id !== item.id));
      setDraft((old) => (old.trim() === item.text ? '' : old));
      setError(null);
    } catch (e) {
      setPending((old) => old.map((row) => (row.id === item.id ? { ...row, busy: false } : row)));
      setError(directError(e));
    } finally {
      sending.current.delete(item.id);
    }
  };
  const submit = () => {
    const text = draft.trim();
    if (!text || !conversation?.canInteract) return;
    const previous = pending.find((item) => item.text === text);
    if (previous) {
      void send(previous);
      return;
    }
    const item = { id: randomUUID(), text, busy: false };
    setPending((old) => [...old, item]);
    void send(item);
  };
  const requestCall = async () => {
    if (busy) return;
    setBusy(true);
    const requestId = commandIds.current.get('call') ?? randomUUID();
    commandIds.current.set('call', requestId);
    try {
      const call = await api.requestCall(conversationId, requestId);
      commandIds.current.delete('call');
      router.push(`/calls/${call.id}`);
    } catch (e) {
      setError(directError(e));
    } finally {
      setBusy(false);
    }
  };
  const command = async () => {
    if (!dialog || busy || !conversation || (dialog === 'report' && !reason.trim())) return;
    setBusy(true);
    const action =
      dialog + ':' + (reportMessage?.id ?? '') + ':' + (dialog === 'report' ? reason.trim() : '');
    const id = commandIds.current.get(action) ?? randomUUID();
    commandIds.current.set(action, id);
    try {
      if (dialog === 'hide') {
        await api.hide(conversationId, id);
        cursor.current = undefined;
        callCursor.current = undefined;
        setMessages([]);
        setCalls([]);
        setPending([]);
      } else if (dialog === 'block') {
        await social.block(conversation.peer.userId, id);
        setConversation((old) => (old ? { ...old, canInteract: false } : old));
      } else if (reportMessage) {
        await api.report(conversationId, reportMessage.id, reason.trim(), id);
        setNotice('directReported');
      }
      commandIds.current.delete(action);
      setDialog(null);
      setReason('');
      setReportMessage(null);
      setError(null);
    } catch (e) {
      setError(directError(e));
    } finally {
      setBusy(false);
    }
  };
  const timeline: Timeline[] = [
    ...messages.map((value) => ({ kind: 'text' as const, value })),
    ...calls.map((value) => ({ kind: 'call' as const, value })),
  ].sort((a, b) => a.value.sequence - b.value.sequence);
  timeline.push(...pending.map((value) => ({ kind: 'pending' as const, value })));
  return (
    <RoomPage direct hidePreviewIndicator>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          style={styles.back}
          onPress={() => router.back()}
        >
          <Image source={backIcon} style={styles.icon} />
        </TouchableOpacity>
        <Text numberOfLines={1} style={styles.title}>
          {conversation?.peer.displayName ?? t('navMessages')}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('directVoiceAction')}
          disabled={busy || !conversation?.canInteract}
          style={styles.voice}
          onPress={() => void requestCall()}
        >
          <Image source={micIcon} style={styles.icon} />
        </TouchableOpacity>
      </View>
      <View style={styles.privacy}>
        <Text style={styles.privacyText}>{t('directPrivate')}</Text>
      </View>
      <View style={styles.tools}>
        <TouchableOpacity disabled={!conversation} onPress={() => setDialog('block')}>
          <Text style={styles.toolText}>{t('socialBlock')}</Text>
        </TouchableOpacity>
        <Text style={styles.toolText}> · </Text>
        <TouchableOpacity disabled={!conversation} onPress={() => setDialog('hide')}>
          <Text style={styles.toolText}>{t('directDeleteShort')}</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={directColors.violet} />
      ) : (
        <FlatList
          ref={list}
          data={timeline}
          keyExtractor={(item) => item.kind + item.value.id}
          contentContainerStyle={styles.timeline}
          onScroll={(event) => {
            const value = event.nativeEvent;
            nearBottom.current =
              value.contentSize.height - value.layoutMeasurement.height - value.contentOffset.y <
              64;
          }}
          scrollEventThrottle={100}
          onContentSizeChange={() => {
            if (nearBottom.current) list.current?.scrollToEnd({ animated: false });
          }}
          renderItem={({ item }) => {
            if (item.kind === 'call')
              return (
                <TouchableOpacity
                  onPress={() => {
                    if (item.value.status === 'ACTIVE' || item.value.status === 'RINGING')
                      router.push(`/calls/${item.value.id}`);
                  }}
                >
                  <Text style={styles.callEvent}>
                    {t('directVoiceAction')} ·{' '}
                    {t(
                      item.value.status === 'ACTIVE'
                        ? 'directCallActive'
                        : item.value.status === 'RINGING'
                          ? 'directCallOutgoing'
                          : item.value.status === 'EXPIRED'
                            ? 'directCallExpired'
                            : item.value.status === 'REJECTED'
                              ? 'directCallRejected'
                              : 'directCallEnded',
                    )}
                  </Text>
                </TouchableOpacity>
              );
            if (item.kind === 'pending')
              return (
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={item.value.busy}
                  onPress={() => void send(item.value)}
                  style={[styles.bubble, styles.outgoing, styles.pending]}
                >
                  <Text style={styles.message}>{item.value.text}</Text>
                  <Text style={styles.pendingText}>
                    {t(item.value.busy ? 'submitting' : 'directRetrySend')}
                  </Text>
                </TouchableOpacity>
              );
            const own = item.value.senderUserId === userId;
            return (
              <TouchableOpacity
                activeOpacity={own ? 1 : 0.7}
                onLongPress={() => {
                  if (!own) {
                    setReportMessage(item.value);
                    setDialog('report');
                    setReason('');
                  }
                }}
                style={[styles.bubble, own ? styles.outgoing : styles.incoming]}
              >
                <Text style={styles.message}>{item.value.text}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
      {!conversation?.canInteract && conversation && (
        <Text style={styles.error}>{t('directBlocked')}</Text>
      )}
      {error && (
        <TouchableOpacity onPress={() => void load()}>
          <Text accessibilityRole="alert" style={styles.error}>
            {t(error)} · {t('retry')}
          </Text>
        </TouchableOpacity>
      )}
      {notice && <Text style={styles.notice}>{t(notice)}</Text>}
      <View style={styles.composer}>
        <TextInput
          testID="direct-message-input"
          editable={!!conversation?.canInteract}
          value={draft}
          onChangeText={setDraft}
          placeholder={t('directPlaceholder')}
          maxLength={2000}
          multiline
          style={styles.input}
          placeholderTextColor={directColors.muted}
        />
        <TouchableOpacity
          testID="direct-message-send"
          accessibilityRole="button"
          accessibilityLabel={t('directSend')}
          disabled={!draft.trim() || !conversation?.canInteract}
          onPress={submit}
          style={styles.send}
        >
          <Text style={styles.sendText}>↑</Text>
        </TouchableOpacity>
      </View>
      <Modal visible={dialog !== null} transparent onRequestClose={() => setDialog(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.overlay}
        >
          <View style={[styles.dialog, { minHeight: dialog === 'report' ? 368 : 264 }]}>
            <Text style={styles.dialogTitle}>
              {t(
                dialog === 'report'
                  ? 'directReport'
                  : dialog === 'hide'
                    ? 'directDeleteShort'
                    : 'socialBlock',
              )}
            </Text>
            <Text style={styles.description}>
              {t(
                dialog === 'hide'
                  ? 'directDeleteNote'
                  : dialog === 'report'
                    ? 'directReportReason'
                    : 'directBlockNote',
              )}
            </Text>
            {dialog === 'report' && (
              <TextInput
                autoFocus
                value={reason}
                onChangeText={setReason}
                maxLength={2000}
                multiline
                style={styles.reportInput}
              />
            )}
            <TouchableOpacity
              disabled={busy || (dialog === 'report' && !reason.trim())}
              onPress={() => void command()}
              style={styles.confirm}
            >
              <Text style={styles.confirmText}>{t(busy ? 'submitting' : 'directConfirm')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setDialog(null)}>
              <Text style={styles.cancel}>{t('cancelAction')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </RoomPage>
  );
}
const styles = StyleSheet.create({
  header: { height: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  back: { width: 48, height: 44, justifyContent: 'center', transform: [{ translateY: -7 }] },
  icon: { width: 24, height: 24 },
  title: {
    alignSelf: 'flex-start',
    height: 42,
    flex: 1,
    minWidth: 0,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: directColors.ink,
  },
  voice: {
    width: 48,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -7 }],
  },
  privacy: {
    height: 44,
    marginHorizontal: 16,
    backgroundColor: tokens.color.purpleSoft,
    borderRadius: 18,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  privacyText: { height: 24, fontSize: 12, lineHeight: 18, color: directColors.muted },
  tools: { height: 42, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  toolText: { height: 22, fontSize: 12, lineHeight: 18, color: directColors.muted },
  timeline: { paddingHorizontal: 16, paddingBottom: 16, gap: 18, paddingTop: 0 },
  bubble: {
    width: 264,
    maxWidth: '74%',
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 5,
    justifyContent: 'center',
    borderRadius: 20,
  },
  incoming: { width: 262, alignSelf: 'flex-start', backgroundColor: tokens.color.mint },
  outgoing: { alignSelf: 'flex-end', backgroundColor: tokens.color.purpleSoft },
  pending: { opacity: 0.65 },
  message: { fontSize: 14, lineHeight: 20, color: directColors.ink },
  pendingText: { fontSize: 11, lineHeight: 20, color: directColors.violet },
  callEvent: {
    fontSize: 12,
    lineHeight: 24,
    textAlign: 'center',
    color: directColors.muted,
    padding: 10,
  },
  composer: {
    minHeight: 108,
    paddingTop: 12,
    paddingBottom: 30,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: tokens.color.surface,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 54,
    maxHeight: 120,
    backgroundColor: tokens.color.panel,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    lineHeight: 24,
    fontFamily: 'NotoSansSC',
    color: directColors.ink,
  },
  send: {
    width: 50,
    height: 54,
    borderRadius: 27,
    backgroundColor: directColors.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { fontSize: 14, fontWeight: '500', lineHeight: 20, color: '#FFFFFF' },
  error: {
    fontSize: 12,
    lineHeight: 20,
    color: tokens.color.error,
    textAlign: 'center',
    padding: 8,
  },
  notice: { fontSize: 12, color: directColors.violet, textAlign: 'center' },
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
    gap: 16,
  },
  dialogTitle: { lineHeight: 30, fontSize: 20, fontWeight: '700', color: directColors.ink },
  description: { fontSize: 14, lineHeight: 24, color: directColors.muted },
  reportInput: {
    minHeight: 88,
    maxHeight: 160,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    fontFamily: 'NotoSansSC',
    fontSize: 14,
    fontWeight: '400',
  },
  confirm: {
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    backgroundColor: directColors.violet,
  },
  confirmText: { color: '#FFFFFF', textAlign: 'center', fontSize: 14 },
  cancel: {
    height: 38,
    lineHeight: 24,
    fontSize: 14,
    color: directColors.violet,
    textAlign: 'center',
  },
});
