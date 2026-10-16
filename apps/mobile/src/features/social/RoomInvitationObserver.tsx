import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/ui/AppText';
import { phonePreview } from '../../components/ui/phonePreview';
import { useForegroundLive } from '../live-updates';
import { t, tf, useLanguage } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../auth';
import { useJoinDraft } from '../room-discovery';
import { SocialApi, type InvitationPage } from './api';

type Invitation = InvitationPage['items'][number];
const mainPages = new Set(['/rooms', '/partners', '/messages', '/me']);
export function RoomInvitationObserver() {
  const { state } = useAuth();
  return state.kind === 'signedIn' && state.me.onboardingState === 'ELIGIBLE' ? (
    <InvitationMonitor key={state.me.userId} />
  ) : null;
}
function InvitationMonitor() {
  useLanguage();
  const path = usePathname(),
    router = useRouter();
  const onMainPage = mainPages.has(path.replace(/\/$/, ''));
  const { authorized } = useAuth();
  const { beginDirect } = useJoinDraft();
  const api = useMemo(() => new SocialApi(authorized), [authorized]);
  const [items, setItems] = useState<Invitation[]>([]),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const dismissed = useRef(new Set<string>()),
    finalized = useRef(new Set<string>()),
    ids = useRef(new Map<string, string>()),
    commanding = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const poll = useCallback(
    async (current: () => boolean) => {
      try {
        const page = await api.invitations();
        if (!current()) return;
        const next = page.items.filter((item) => !finalized.current.has(item.id));
        setItems(next);
        setSelectedId((old) =>
          old && next.some((item) => item.id === old)
            ? old
            : (next.find((item) => !dismissed.current.has(item.id))?.id ?? null),
        );
      } catch {
        /* Keep the current page and already received invitations during transient failure. */
      }
    },
    [api],
  );
  useForegroundLive(poll, 'invitations', onMainPage);
  const selected = items.find((item) => item.id === selectedId);
  const dismiss = () => {
    if (commanding.current) return;
    if (selectedId) dismissed.current.add(selectedId);
    setSelectedId(null);
    setError(false);
  };
  const join = () => {
    if (!selected || commanding.current) return;
    dismissed.current.add(selected.id);
    setSelectedId(null);
    setError(false);
    if (selected.room.status === 'SCHEDULED')
      router.push({
        pathname: '/rooms/[roomId]',
        params: { roomId: selected.roomId, invitationId: selected.id },
      });
    else {
      beginDirect(selected.roomId, selected.id);
      router.push({
        pathname: '/rooms/[roomId]/session',
        params: { roomId: selected.roomId, invitationId: selected.id },
      });
    }
  };
  const decline = async () => {
    if (!selected || commanding.current) return;
    const target = selected.id;
    commanding.current = true;
    setBusy(true);
    setError(false);
    const id = ids.current.get(target) ?? randomUUID();
    ids.current.set(target, id);
    try {
      await api.declineInvitation(target, id);
      if (!alive.current) return;
      finalized.current.add(target);
      ids.current.delete(target);
      setItems((old) => old.filter((item) => item.id !== target));
      setSelectedId(null);
    } catch {
      if (alive.current) setError(true);
    } finally {
      commanding.current = false;
      if (alive.current) setBusy(false);
    }
  };
  if (!onMainPage || items.length === 0) return null;
  return (
    <>
      {!selected && (
        <View pointerEvents="box-none" style={styles.entryArea}>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.entry}
            onPress={() => {
              setSelectedId(items[0]?.id ?? null);
              setError(false);
            }}
          >
            <Text style={styles.entryText}>
              {tf('roomInvitationPending', { count: items.length })}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <Modal transparent visible={!!selected} animationType="fade" onRequestClose={dismiss}>
        <View style={styles.canvas}>
          <View style={[styles.overlay, Platform.OS === 'web' && phonePreview.frame]}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              accessibilityRole="button"
              accessibilityLabel={t('roomInvitationLater')}
              onPress={dismiss}
              disabled={busy}
            />
            <View testID="incoming-room-invitation" accessibilityRole="alert" style={styles.card}>
              <View style={styles.heading}>
                <Text style={styles.title}>{t('roomInvitationTitle')}</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={t('roomInvitationLater')}
                  onPress={dismiss}
                  disabled={busy}
                >
                  <Text style={styles.close}>×</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.body}>
                {tf('roomInvitationFrom', { name: selected?.inviterDisplayName ?? '' })}
              </Text>
              <Text style={styles.topic}>{String(selected?.room.topic ?? '')}</Text>
              {selected?.room.passwordProtected && (
                <Text style={styles.body}>{t('roomPasswordProtected')}</Text>
              )}
              {error && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {t('roomInvitationFailed')}
                </Text>
              )}
              <View style={styles.actions}>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={busy}
                  style={[styles.action, styles.secondary]}
                  onPress={() => void decline()}
                >
                  <Text style={styles.secondaryText}>
                    {t(busy ? 'submitting' : 'roomInvitationDecline')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={busy}
                  style={[styles.action, styles.primary]}
                  onPress={join}
                >
                  <Text style={styles.actionText}>
                    {t(
                      selected?.room.status === 'SCHEDULED'
                        ? 'socialViewRoom'
                        : 'roomInvitationJoin',
                    )}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  canvas: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.64)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: { padding: 24, borderRadius: 24, backgroundColor: tokens.connection.color.panel, gap: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: '#fff' },
  close: { fontSize: 22, lineHeight: 28, color: tokens.connection.color.muted },
  body: { fontSize: 13, lineHeight: 20, color: tokens.connection.color.muted },
  topic: { fontSize: 16, lineHeight: 24, fontWeight: '500', color: '#fff' },
  actions: { flexDirection: 'row', gap: 12 },
  action: {
    height: tokens.control.height,
    flex: 1,
    minHeight: tokens.control.height,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  primary: { backgroundColor: tokens.color.purple },
  secondary: { backgroundColor: tokens.connection.color.actionSurface },
  actionText: { color: '#fff', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  secondaryText: { color: tokens.connection.color.actionInk, fontSize: 14, lineHeight: 20 },
  entryArea: { position: 'absolute', left: 0, right: 0, bottom: 110, alignItems: 'center' },
  entry: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: tokens.color.goldSoft,
  },
  entryText: { color: tokens.color.purple, fontSize: 12, lineHeight: 18 },
  error: { color: tokens.color.coral, fontSize: 12, lineHeight: 18 },
});
