import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { RoomHeader, RoomPage } from '../../components/ui/RoomPage';
import { t } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../auth';
import { RoomApiError } from '../room-discovery/api';
import { PostRoomLearningApi, type VocabularyFilter, type VocabularyItem } from './api';

type KindFilter = 'ALL' | 'KEYWORD' | 'EXPRESSION';

function VocabularyCard({ item, api, onUpdated, onRemoved, onReload }: {
  item: VocabularyItem;
  api: PostRoomLearningApi;
  onUpdated: (item: VocabularyItem) => void;
  onRemoved: (id: string) => void;
  onReload: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  const [note, setNote] = useState(item.note ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState('');

  function commandError(cause: unknown) {
    if (cause instanceof RoomApiError && cause.status === 409) {
      setConflict(true);
      setError(t('vocabularyConflict'));
    } else setError(t('vocabularyCommandFailed'));
  }

  async function update(changes: { text?: string; note?: string | null; favorite?: boolean }) {
    if (busy || conflict) return;
    setBusy(true);
    setError('');
    try {
      const next = await api.update(item.id, item.version, changes);
      onUpdated(next);
      setEditing(false);
      setText(next.text);
      setNote(next.note ?? '');
    } catch (cause) { commandError(cause); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (busy || conflict) return;
    setBusy(true);
    setError('');
    try { await api.remove(item.id, item.version); onRemoved(item.id); }
    catch (cause) { commandError(cause); setConfirmDelete(false); }
    finally { setBusy(false); }
  }

  return <View style={styles.card}>
    <View style={styles.cardTop}><Text style={styles.kind}>{item.kind === 'KEYWORD' ? t('vocabularyKeyword') : t('vocabularyExpression')}</Text><Text style={styles.version}>v{item.version}</Text></View>
    {editing ? <>
      <TextInput accessibilityLabel={t('vocabularyTextLabel')} style={styles.input} value={text} maxLength={120} onChangeText={setText} />
      <TextInput accessibilityLabel={t('vocabularyNoteLabel')} style={[styles.input, styles.noteInput]} value={note} maxLength={500} multiline placeholder={t('vocabularyNotePlaceholder')} onChangeText={setNote} />
    </> : <>
      <Text style={styles.word}>{item.text}</Text>
      {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
    </>}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {conflict ? <><Text style={styles.muted}>{t('vocabularyReloadHint')}</Text><TouchableOpacity accessibilityRole="button" onPress={onReload}><Text style={styles.link}>{t('vocabularyReload')}</Text></TouchableOpacity></> : null}
    {confirmDelete ? <View style={styles.actions}>
      <TouchableOpacity accessibilityRole="button" disabled={busy || conflict} onPress={() => void remove()}><Text style={styles.danger}>{t('vocabularyConfirmDelete')}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={() => setConfirmDelete(false)}><Text style={styles.link}>{t('cancelAction')}</Text></TouchableOpacity>
    </View> : <View style={styles.actions}>
      {editing ? <>
        <TouchableOpacity accessibilityRole="button" disabled={busy || conflict || !text.trim()} onPress={() => void update({ text, note: note.trim() || null })}><Text style={styles.link}>{busy ? t('submitting') : t('vocabularySave')}</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => { setEditing(false); setText(item.text); setNote(item.note ?? ''); setConflict(false); setError(''); }}><Text style={styles.muted}>{t('cancelAction')}</Text></TouchableOpacity>
      </> : <>
        <TouchableOpacity accessibilityRole="button" disabled={busy || conflict} onPress={() => void update({ favorite: !item.favorite })}><Text style={styles.link}>{item.favorite ? t('vocabularyUnfavorite') : t('vocabularyFavorite')}</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => { setEditing(true); setError(''); }}><Text style={styles.link}>{t('vocabularyEdit')}</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => setConfirmDelete(true)}><Text style={styles.danger}>{t('vocabularyDelete')}</Text></TouchableOpacity>
      </>}
    </View>}
  </View>;
}

export function VocabularyScreen() {
  const router = useRouter();
  const { authorized } = useAuth();
  const api = useMemo(() => new PostRoomLearningApi(authorized), [authorized]);
  const [kind, setKind] = useState<KindFilter>('ALL');
  const [favorites, setFavorites] = useState(false);
  const filter = useMemo<VocabularyFilter>(() => ({ ...(kind !== 'ALL' ? { kind } : {}), ...(favorites ? { favorite: true } : {}) }), [kind, favorites]);
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const requestEpoch = useRef(0);

  const refresh = useCallback(async () => {
    const epoch = ++requestEpoch.current;
    setLoading(true);
    setError(false);
    try {
      const page = await api.list(filter);
      if (epoch !== requestEpoch.current) return;
      setItems(page.items);
      setCursor(page.nextCursor ?? null);
      setMoreError(false);
    } catch { if (epoch === requestEpoch.current) setError(true); }
    finally { if (epoch === requestEpoch.current) setLoading(false); }
  }, [api, filter]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  async function loadMore() {
    if (!cursor || loading || loadingMore) return;
    const epoch = requestEpoch.current;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const page = await api.list(filter, cursor);
      if (epoch !== requestEpoch.current) return;
      setItems((current) => [...current, ...page.items.filter((item) => !current.some((old) => old.id === item.id))]);
      setCursor(page.nextCursor ?? null);
    } catch { if (epoch === requestEpoch.current) setMoreError(true); }
    finally { if (epoch === requestEpoch.current) setLoadingMore(false); }
  }

  function changeFilter(nextKind: KindFilter, nextFavorites: boolean) {
    if (nextKind === kind && nextFavorites === favorites) return;
    ++requestEpoch.current;
    setItems([]);
    setCursor(null);
    setLoadingMore(false);
    setKind(nextKind);
    setFavorites(nextFavorites);
  }

  return <RoomPage ambient>
    <RoomHeader title={t('vocabularyTitle')} subtitle={t('vocabularySubtitle')} onBack={() => router.back()} />
    <View style={styles.filters}>
      {(['ALL', 'KEYWORD', 'EXPRESSION'] as const).map((option) => <TouchableOpacity key={option} accessibilityRole="button" accessibilityState={{ selected: kind === option }} style={[styles.chip, kind === option && styles.chipActive]} onPress={() => changeFilter(option, favorites)}><Text style={kind === option ? styles.chipTextActive : styles.chipText}>{option === 'ALL' ? t('vocabularyAll') : option === 'KEYWORD' ? t('vocabularyKeyword') : t('vocabularyExpression')}</Text></TouchableOpacity>)}
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: favorites }} style={[styles.chip, favorites && styles.chipActive]} onPress={() => changeFilter(kind, !favorites)}><Text style={favorites ? styles.chipTextActive : styles.chipText}>{t('vocabularyFavoritesOnly')}</Text></TouchableOpacity>
    </View>
    {error ? <View style={styles.message}><Text accessibilityRole="alert" style={styles.error}>{t('vocabularyLoadFailed')}</Text><TouchableOpacity accessibilityRole="button" onPress={() => void refresh()}><Text style={styles.link}>{t('retry')}</Text></TouchableOpacity></View> : null}
    {loading && items.length === 0 ? <ActivityIndicator style={styles.center} color={tokens.color.purple} /> : <FlatList
      data={items}
      keyExtractor={(item) => `${item.id}:${item.version}`}
      contentContainerStyle={styles.list}
      onRefresh={() => void refresh()}
      refreshing={loading}
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.3}
      ListEmptyComponent={!error ? <Text style={styles.empty}>{t('vocabularyEmpty')}</Text> : null}
      ListFooterComponent={loadingMore ? <ActivityIndicator color={tokens.color.purple} /> : moreError ? <TouchableOpacity accessibilityRole="button" onPress={() => void loadMore()}><Text style={styles.link}>{t('vocabularyMoreFailed')} · {t('retry')}</Text></TouchableOpacity> : null}
      renderItem={({ item }) => <VocabularyCard item={item} api={api} onUpdated={(next) => setItems((current) => current.map((entry) => entry.id === next.id ? next : entry).filter((entry) => (!favorites || entry.favorite) && (kind === 'ALL' || entry.kind === kind)))} onRemoved={(id) => setItems((current) => current.filter((entry) => entry.id !== id))} onReload={() => void refresh()} />}
    />}
  </RoomPage>;
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 20, marginBottom: 12 },
  chip: { borderColor: tokens.color.border, borderWidth: 1, borderRadius: 17, paddingVertical: 7, paddingHorizontal: 11, backgroundColor: tokens.color.panel },
  chipActive: { backgroundColor: tokens.color.purple, borderColor: tokens.color.purple },
  chipText: { color: tokens.color.muted, fontSize: 11, fontWeight: '600' },
  chipTextActive: { color: '#fff', fontSize: 11, fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingBottom: 90, gap: 12, flexGrow: 1 },
  center: { flex: 1 },
  message: { paddingHorizontal: 20, marginBottom: 8 },
  empty: { textAlign: 'center', color: tokens.color.muted, marginTop: 80, fontSize: 14 },
  card: { borderWidth: 1, borderColor: tokens.color.border, borderRadius: tokens.radius.lg, padding: 18, backgroundColor: tokens.color.panel },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  kind: { color: tokens.color.purple, fontSize: 12, fontWeight: '700' },
  version: { color: tokens.color.muted, fontSize: 11 },
  word: { color: tokens.color.foreground, fontSize: 20, fontWeight: '700', marginTop: 9 },
  note: { color: tokens.color.muted, fontSize: 13, marginTop: 7 },
  input: { color: tokens.color.foreground, borderWidth: 1, borderColor: tokens.color.border, borderRadius: tokens.radius.md, backgroundColor: tokens.color.surface, padding: 10, fontSize: 14, marginTop: 9 },
  noteInput: { minHeight: 72, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 17, marginTop: 16 },
  link: { color: tokens.color.purple, fontSize: 12, fontWeight: '700' },
  danger: { color: tokens.color.error, fontSize: 12, fontWeight: '700' },
  muted: { color: tokens.color.muted, fontSize: 12 },
  error: { color: tokens.color.error, fontSize: 12, marginTop: 9 },
});
