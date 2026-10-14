import { MultilineField } from '../../components/ui/MultilineField';
import { largeAction } from '../../components/ui/largeAction';
import backIcon from '../../../assets/icons/back.png';
import phoneIcon from '../../../assets/icons/direct-phone.png';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect, useRouter } from 'expo-router';
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
import { t, tf, useLanguage, type MessageKey } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { LatestRequestQueue } from '../../services/latestRequestQueue';
import { isAppForeground } from '../../services/foregroundPolling';
import { useMessageUnread } from './MessageUnreadProvider';
import { useAuth } from '../auth';
import { SocialApi } from '../social';
import { ReportReceiptSheet, type ReportSubmissionReceipt } from '../reporting';
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
  const refreshQueue = useRef(new LatestRequestQueue());
  const { refresh: refreshUnread } = useMessageUnread();
  const { authorized, state } = useAuth();
  const userId = state.kind === 'signedIn' ? state.me.userId : '';
  const api = useMemo(() => new DirectApi(authorized), [authorized]),
    social = useMemo(() => new SocialApi(authorized), [authorized]);
  const [conversation, setConversation] = useState<Conversation | null>(null),
    [messages, setMessages] = useState<DirectMessage[]>([]),
    [calls, setCalls] = useState<DirectCall[]>([]),
    [pending, setPending] = useState<Pending[]>([]),
    [draft, setDraft] = useState(''),
    [inputHeight, setInputHeight] = useState<number>(tokens.control.height),
    [menuOpen, setMenuOpen] = useState(false),
    [error, setError] = useState<MessageKey | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<'block' | 'hide' | 'report' | null>(null),
    [reportMessage, setReportMessage] = useState<DirectMessage | null>(null),
    [reason, setReason] = useState(''),
    [notice, setNotice] = useState<MessageKey | null>(null),
    [selectingReport, setSelectingReport] = useState(false);
  const [reportReceipt, setReportReceipt] = useState<ReportSubmissionReceipt | null>(null);
  const cursor = useRef<string | undefined>(undefined),
    callCursor = useRef<string | undefined>(undefined),
    lastRead = useRef(0),
    lastDetail = useRef(0),
    sending = useRef(new Set<string>()),
    commandIds = useRef(new Map<string, string>()),
    list = useRef<FlatList<Timeline>>(null);
  const conversationRef = useRef<Conversation | null>(null);
  const nearBottom = useRef(true);
  const focused = useRef(false);
  const readCandidate = useRef(0);
  const readPending = useRef<Promise<void> | null>(null);
  const acknowledge = useCallback(() => {
    if (readPending.current || !focused.current || !nearBottom.current || !isAppForeground())
      return;
    const sequence = readCandidate.current;
    if (sequence <= lastRead.current) return;
    const request = api
      .read(conversationId, sequence)
      .then(() => {
        lastRead.current = Math.max(lastRead.current, sequence);
        void refreshUnread();
      })
      .catch(() => {
        // Keep the badge unread; a subsequent visible refresh retries the acknowledgement.
      })
      .finally(() => {
        if (readPending.current === request) readPending.current = null;
      });
    readPending.current = request;
  }, [api, conversationId, refreshUnread]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
      };
    }, []),
  );
  const load = useCallback(
    (current: () => boolean = () => true) =>
      refreshQueue.current.enqueue(async () => {
        if (!current()) return;
        try {
          const needsDetail = !conversationRef.current || Date.now() - lastDetail.current > 15000;
          const [detail, page, history] = await Promise.all([
            needsDetail ? api.detail(conversationId) : Promise.resolve(null),
            api.messages(conversationId, cursor.current),
            api.callHistory(conversationId, callCursor.current),
          ]);
          if (!current()) return;
          if (detail) {
            conversationRef.current = detail;
            setConversation(detail);
            lastDetail.current = Date.now();
          }
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
            old.filter(
              (item) => !page.items.some((message) => message.clientRequestId === item.id),
            ),
          );
          // Call history has a separate cursor: it cannot acknowledge text we have not loaded.
          readCandidate.current = Math.max(
            readCandidate.current,
            ...page.items.map((item) => item.sequence),
            0,
          );
          setError(null);
        } catch (e) {
          if (current()) setError(directError(e));
        } finally {
          if (current()) setLoading(false);
        }
      }),
    [api, conversationId],
  );
  useFocusedPolling(load, 3000);
  useEffect(() => {
    if (!loading) acknowledge();
  }, [messages, loading, acknowledge]);
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
    if (
      !dialog ||
      busy ||
      !conversation ||
      (dialog === 'report' && (!reportMessage || !reason.trim()))
    )
      return;
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
        readCandidate.current = 0;
        void refreshUnread();
        setPending([]);
      } else if (dialog === 'block') {
        await social.block(conversation.peer.userId, id);
        conversationRef.current = { ...conversation, canInteract: false };
        setConversation(conversationRef.current);
      } else if (reportMessage) {
        const receipt = await api.report(conversationId, reportMessage.id, reason.trim(), id);
        setReportReceipt(receipt);
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
    <RoomPage direct>
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
          accessibilityLabel={t('directChatActions')}
          style={styles.more}
          onPress={() => setMenuOpen(true)}
        >
          <Text style={styles.moreText}>⋯</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('directVoiceAction')}
          disabled={busy || !conversation?.canInteract}
          style={styles.voice}
          onPress={() => void requestCall()}
        >
          <Image source={phoneIcon} style={styles.icon} />
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
            if (nearBottom.current) acknowledge();
          }}
          scrollEventThrottle={100}
          onContentSizeChange={() => {
            if (nearBottom.current) {
              list.current?.scrollToEnd({ animated: false });
              acknowledge();
            }
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
                accessibilityRole={!own ? 'button' : undefined}
                accessibilityLabel={
                  !own && selectingReport
                    ? tf('directSelectMessage', { text: item.value.text })
                    : undefined
                }
                onPress={() => {
                  if (!own && selectingReport) {
                    setReportMessage(item.value);
                    setDialog('report');
                    setReason('');
                    setSelectingReport(false);
                  }
                }}
                onLongPress={() => {
                  if (!own) {
                    setReportMessage(item.value);
                    setDialog('report');
                    setReason('');
                    setSelectingReport(false);
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
      {selectingReport && (
        <View style={styles.selection}>
          <Text accessibilityRole="alert" style={styles.selectionText}>
            {t('directReportSelect')}
          </Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => setSelectingReport(false)}>
            <Text style={styles.toolText}>{t('cancelAction')}</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.composer}>
        <TextInput
          testID="direct-message-input"
          editable={!!conversation?.canInteract}
          value={draft}
          onChangeText={setDraft}
          placeholder={t('directPlaceholder')}
          maxLength={2000}
          multiline
          onContentSizeChange={(event) =>
            setInputHeight(
              Math.min(120, Math.max(tokens.control.height, event.nativeEvent.contentSize.height)),
            )
          }
          scrollEnabled={inputHeight >= 120}
          style={[styles.input, { height: inputHeight }]}
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
      <Modal visible={menuOpen} transparent onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{t('directChatActions')}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!messages.some((message) => message.senderUserId !== userId)}
              onPress={() => {
                setMenuOpen(false);
                setSelectingReport(true);
              }}
            >
              <Text style={styles.menuAction}>{t('directReport')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={!conversation}
              onPress={() => {
                setMenuOpen(false);
                setDialog('block');
              }}
            >
              <Text style={styles.menuAction}>{t('socialBlock')}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" onPress={() => setMenuOpen(false)}>
              <Text style={styles.cancel}>{t('cancelAction')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
              <MultilineField
                autoFocus
                value={reason}
                onChangeText={setReason}
                maxLength={2000}
                multiline
                style={styles.reportInput}
              />
            )}
            <TouchableOpacity
              disabled={busy || (dialog === 'report' && (!reportMessage || !reason.trim()))}
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
      {reportReceipt && (
        <ReportReceiptSheet receipt={reportReceipt} onClose={() => setReportReceipt(null)} />
      )}
    </RoomPage>
  );
}
const styles = StyleSheet.create({
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  back: {
    width: 43,
    height: 44,
    paddingLeft: 4,
    marginTop: 0,
    justifyContent: 'center',
  },
  icon: { width: 24, height: 24 },
  title: {
    height: 40,
    marginTop: 0,
    textAlignVertical: 'center',
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    lineHeight: 40,
    fontWeight: '700',
    color: directColors.ink,
  },
  voice: {
    width: 48,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
    transform: [{ translateX: -1 }],
  },
  more: {
    width: 32,
    height: 44,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: { fontSize: 24, lineHeight: 32, color: directColors.muted },
  menuAction: { fontSize: 14, lineHeight: 24, paddingVertical: 8, color: directColors.violet },
  selection: { paddingHorizontal: 16, paddingVertical: 6, flexDirection: 'row', gap: 12 },
  selectionText: { flex: 1, fontSize: 12, lineHeight: 20, color: directColors.violet },
  toolText: { height: 22, fontSize: 12, lineHeight: 18, color: directColors.muted },
  timeline: { paddingHorizontal: 10, paddingBottom: 16, gap: 14 },
  bubble: {
    maxWidth: '94%',
    minHeight: 34,
    paddingHorizontal: 16,
    paddingVertical: 6,
    justifyContent: 'center',
    borderRadius: 20,
  },
  incoming: {
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    backgroundColor: tokens.color.mint,
  },
  outgoing: { alignSelf: 'flex-end', backgroundColor: tokens.color.purpleSoft },
  pending: { opacity: 0.65 },
  message: { fontSize: 14, lineHeight: 20, color: directColors.ink },
  pendingText: { fontSize: 11, lineHeight: 20, color: directColors.violet },
  callEvent: {
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
    color: directColors.muted,
    paddingVertical: 4,
  },
  composer: {
    minHeight: 79,
    paddingTop: 12,
    paddingBottom: 17,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingRight: 24,
    backgroundColor: tokens.color.surface,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: tokens.control.height,
    maxHeight: 120,
    backgroundColor: tokens.color.panel,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    includeFontPadding: false,
    textAlignVertical: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'NotoSansSC',
    color: directColors.ink,
  },
  send: {
    width: tokens.control.height,
    height: tokens.control.height,
    borderRadius: tokens.control.radius,
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
  dialogTitle: { lineHeight: 26, fontSize: 18, fontWeight: '700', color: directColors.ink },
  description: { fontSize: 14, lineHeight: 24, color: directColors.muted },
  reportInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    fontFamily: 'NotoSansSC',
    fontSize: 14,
    fontWeight: '400',
  },
  confirm: {
    justifyContent: 'center',
    backgroundColor: directColors.violet,
    ...largeAction,
  },
  confirmText: { color: '#FFFFFF', textAlign: 'center', fontSize: 14 },
  cancel: {
    height: tokens.control.height,
    lineHeight: tokens.control.height,
    fontSize: 14,
    color: directColors.violet,
    textAlign: 'center',
  },
});
