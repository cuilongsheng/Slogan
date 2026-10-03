import { useCallback, useEffect, useMemo, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { RoomHeader, RoomPage } from '../../components/ui/RoomPage';
import { t } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../auth';
import { RoomApiError } from '../room-discovery/api';
import { canAppeal, MySafetyApi, type Restriction } from './api';

type Draft = { restrictionId: string; reason: string; requestId: string };

function time(value: string) {
  return new Date(value).toLocaleString();
}

function statusText(item: Restriction) {
  if (item.appealStatus === 'PENDING') return t('safetyAppealPending');
  if (item.appealStatus === 'UPHELD') return t('safetyAppealUpheld');
  if (item.appealStatus === 'LIFTED') return t('safetyAppealLifted');
  if (item.status === 'ACTIVE') return t('safetyActive');
  if (item.status === 'LIFTED') return t('safetyLifted');
  return t('safetyExpired');
}

function submittedStatusText(status: 'PENDING' | 'UPHELD' | 'LIFTED') {
  return status === 'PENDING' ? t('safetySubmitted')
    : status === 'UPHELD' ? t('safetyAppealUpheld') : t('safetyAppealLifted');
}

function severityText(value: Restriction['severity']) {
  return value === 'HIGH_RISK' ? t('safetyHighRisk') : value === 'SERIOUS' ? t('safetySerious') : t('safetyGeneral');
}

function appealError(error: unknown) {
  if (error instanceof RoomApiError) {
    if (error.code === 'SAFETY_APPEAL_CLOSED') return t('safetyWindowClosed');
    if (error.code === 'SAFETY_STATE_CONFLICT') return t('safetyAlreadyAppealed');
    if (error.code === 'SAFETY_REQUEST_CONFLICT') return t('safetyRetryConflict');
  }
  return t('safetySubmitFailed');
}

export function RestrictionsScreen() {
  const router = useRouter();
  const { authorized } = useAuth();
  const api = useMemo(() => new MySafetyApi(authorized), [authorized]);
  const [items, setItems] = useState<Restriction[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [now, setNow] = useState(0);

  useEffect(() => {
    const initial = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 10_000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, []);

  const refresh = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const page = await api.list();
      setItems(page.items);
      setCursor(page.nextCursor);
      setMoreError(false);
      return page;
    } catch {
      setError(true);
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  async function loadMore() {
    if (!cursor || loadingMore || loading) return;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const page = await api.list(cursor);
      setItems((current) => [...current, ...page.items.filter((item) => !current.some((old) => old.id === item.id))]);
      setCursor(page.nextCursor);
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  async function submit() {
    if (!draft || submitting) return;
    const reason = draft.reason.trim();
    if (!reason || reason.length > 2000) {
      setSubmitMessage(t('safetyReasonRequired'));
      return;
    }
    setSubmitting(true);
    setSubmitMessage('');
    try {
      const result = await api.appeal(draft.restrictionId, reason, draft.requestId);
      setDraft(null);
      setSubmitMessage(submittedStatusText(result.status));
      await refresh(true);
    } catch (cause) {
      const latest = await refresh(true);
      const persisted = latest?.items.find((item) => item.id === draft.restrictionId);
      if (persisted?.appealStatus) {
        setDraft(null);
        setSubmitMessage(submittedStatusText(persisted.appealStatus));
      } else {
        setSubmitMessage(appealError(cause));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RoomPage ambient>
      <RoomHeader title={t('safetyTitle')} subtitle={t('safetySubtitle')} onBack={() => router.back()} />
      {submitMessage ? <Text accessibilityRole="alert" style={styles.message}>{submitMessage}</Text> : null}
      {error && items.length > 0 ? <Text accessibilityRole="alert" style={styles.message}>{t('safetyLoadFailed')}</Text> : null}
      {loading && items.length === 0 ? <ActivityIndicator style={styles.center} color={tokens.color.purple} />
        : error && items.length === 0 ? <View style={styles.center}><Text style={styles.empty}>{t('safetyLoadFailed')}</Text><TouchableOpacity accessibilityRole="button" onPress={() => void refresh()}><Text style={styles.link}>{t('retry')}</Text></TouchableOpacity></View>
          : <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              refreshing={refreshing}
              onRefresh={() => void refresh(true)}
              onEndReached={() => void loadMore()}
              onEndReachedThreshold={0.3}
              ListEmptyComponent={<View style={styles.emptyCard}><Text style={styles.empty}>{t('safetyEmpty')}</Text><TouchableOpacity accessibilityRole="button" onPress={() => void refresh(true)}><Text style={styles.link}>{t('safetyRefresh')}</Text></TouchableOpacity></View>}
              ListFooterComponent={loadingMore ? <ActivityIndicator color={tokens.color.purple} /> : moreError ? <TouchableOpacity accessibilityRole="button" onPress={() => void loadMore()}><Text style={styles.link}>{t('safetyMoreFailed')} · {t('retry')}</Text></TouchableOpacity> : null}
              renderItem={({ item }) => {
                const eligible = canAppeal(item, now);
                const editing = draft?.restrictionId === item.id;
                return <View style={styles.card}>
                  <View style={styles.row}><Text style={styles.severity}>{severityText(item.severity)}</Text><Text style={[styles.badge, item.status === 'ACTIVE' && styles.activeBadge]}>{statusText(item)}</Text></View>
                  <Text style={styles.reason}>{item.reason}</Text>
                  <Text style={styles.date}>{t('safetyStarts')} {time(item.startsAt)}</Text>
                  <Text style={styles.date}>{t('safetyEnds')} {time(item.endsAt)}</Text>
                  <Text style={styles.date}>{t('safetyAppealDeadline')} {time(item.appealDeadlineAt)}</Text>
                  {eligible && !editing ? <TouchableOpacity accessibilityRole="button" style={styles.action} onPress={() => { setDraft((current) => current?.restrictionId === item.id ? current : { restrictionId: item.id, reason: '', requestId: randomUUID() }); setSubmitMessage(''); }}><Text style={styles.actionText}>{t('safetyAppealAction')}</Text></TouchableOpacity> : null}
                  {eligible && editing ? <View style={styles.form}>
                    <TextInput accessibilityLabel={t('safetyReasonLabel')} multiline maxLength={2000} placeholder={t('safetyReasonPlaceholder')} style={styles.input} value={draft.reason} onChangeText={(value) => { setDraft({ ...draft, reason: value, requestId: randomUUID() }); setSubmitMessage(''); }} />
                    <TouchableOpacity accessibilityRole="button" style={[styles.action, submitting && styles.disabled]} disabled={submitting} onPress={() => void submit()}><Text style={styles.actionText}>{submitting ? t('submitting') : t('safetySubmit')}</Text></TouchableOpacity>
                    <TouchableOpacity accessibilityRole="button" onPress={() => setDraft(null)}><Text style={styles.link}>{t('cancelAction')}</Text></TouchableOpacity>
                  </View> : null}
                </View>;
              }}
            />}
    </RoomPage>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 90, gap: 14, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderColor: tokens.color.border, borderRadius: tokens.radius.lg, backgroundColor: tokens.color.panel, padding: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  severity: { color: tokens.color.purple, fontWeight: '700', fontSize: 14 },
  badge: { color: tokens.color.muted, backgroundColor: tokens.color.purpleSoft, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11 },
  activeBadge: { color: tokens.color.error, backgroundColor: tokens.color.peach },
  reason: { color: tokens.color.foreground, fontSize: 16, lineHeight: 24, marginTop: 18, marginBottom: 16 },
  date: { color: tokens.color.muted, fontSize: 12, marginTop: 6 },
  action: { backgroundColor: tokens.color.purple, borderRadius: 24, minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  disabled: { opacity: 0.5 },
  form: { marginTop: 12 },
  input: { minHeight: 105, borderRadius: tokens.radius.md, borderWidth: 1, borderColor: tokens.color.border, backgroundColor: tokens.color.surface, padding: 12, color: tokens.color.foreground, textAlignVertical: 'top' },
  link: { color: tokens.color.purple, textAlign: 'center', padding: 12, fontWeight: '700' },
  message: { color: tokens.color.error, marginHorizontal: 20, marginBottom: 8, fontSize: 13 },
  emptyCard: { borderWidth: 1, borderColor: tokens.color.border, backgroundColor: tokens.color.panel, borderRadius: tokens.radius.lg, padding: 28, marginTop: 20 },
  empty: { color: tokens.color.muted, fontSize: 14, textAlign: 'center' },
});
