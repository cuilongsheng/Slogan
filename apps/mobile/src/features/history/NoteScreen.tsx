import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { RoomHeader, RoomPage } from '../../components/ui/RoomPage';
import { t } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../auth';
import { RoomApiError } from '../room-discovery/api';
import { RoomHistoryApi, type RoomNote } from './api';

export function NoteScreen({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { authorized } = useAuth();
  const api = useMemo(() => new RoomHistoryApi(authorized), [authorized]);
  const [remote, setRemote] = useState<RoomNote | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const note = await api.note(roomId);
      setRemote(note);
      setDraft(note.content ?? '');
      setConflict(false);
      setSaved(false);
    } catch {
      setError(t('noteLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [api, roomId]);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  async function save(content = draft) {
    if (!remote || saving) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const next = await api.saveNote(roomId, content, remote.version);
      setRemote(next);
      setDraft(next.content ?? '');
      setConflict(false);
      setSaved(true);
    } catch (cause) {
      if (cause instanceof RoomApiError && cause.status === 409) {
        setConflict(true);
        setError(t('noteConflict'));
      } else {
        setError(t('noteSaveFailed'));
      }
    } finally {
      setSaving(false);
    }
  }

  return <RoomPage ambient>
    <RoomHeader title={t('noteTitle')} subtitle={t('noteSubtitle')} onBack={() => router.back()} />
    {loading ? <ActivityIndicator style={styles.center} color={tokens.color.purple} />
      : !remote ? <View style={styles.center}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => void reload()}><Text style={styles.link}>{t('retry')}</Text></TouchableOpacity></View>
        : <View style={styles.body}>
          <Text style={styles.private}>{t('notePrivate')}</Text>
          <TextInput accessibilityLabel={t('noteInputLabel')} multiline maxLength={2000} style={styles.input} placeholder={t('notePlaceholder')} value={draft} onChangeText={(value) => { setDraft(value); setSaved(false); }} />
          <Text style={styles.counter}>{draft.length} / 2000</Text>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {saved ? <Text style={styles.saved}>{t('noteSaved')}</Text> : null}
          {conflict ? <TouchableOpacity accessibilityRole="button" onPress={() => void reload()}><Text style={styles.link}>{t('noteLoadLatest')}</Text></TouchableOpacity> : null}
          <TouchableOpacity accessibilityRole="button" disabled={saving || conflict || draft.length > 2000} style={[styles.primary, (saving || conflict) && styles.disabled]} onPress={() => void save()}><Text style={styles.primaryText}>{saving ? t('submitting') : t('noteSave')}</Text></TouchableOpacity>
          {remote.content ? <TouchableOpacity accessibilityRole="button" disabled={saving || conflict} onPress={() => { setDraft(''); void save(''); }}><Text style={styles.clear}>{t('noteClear')}</Text></TouchableOpacity> : null}
        </View>}
  </RoomPage>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { marginHorizontal: 20, marginTop: 8, padding: 18, borderWidth: 1, borderColor: tokens.color.border, borderRadius: tokens.radius.lg, backgroundColor: tokens.color.panel },
  private: { color: tokens.color.muted, fontSize: 12, marginBottom: 16 },
  input: { minHeight: 210, borderRadius: tokens.radius.md, borderWidth: 1, borderColor: tokens.color.border, backgroundColor: tokens.color.surface, padding: 14, color: tokens.color.foreground, textAlignVertical: 'top', fontSize: 15, lineHeight: 23 },
  counter: { alignSelf: 'flex-end', color: tokens.color.muted, fontSize: 11, marginTop: 8 },
  error: { color: tokens.color.error, fontSize: 13, marginTop: 12 },
  saved: { color: tokens.color.mintInk, fontSize: 13, marginTop: 12 },
  link: { color: tokens.color.purple, fontWeight: '700', fontSize: 13, marginTop: 12 },
  primary: { minHeight: 50, borderRadius: 25, backgroundColor: tokens.color.purple, justifyContent: 'center', alignItems: 'center', marginTop: 22 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.5 },
  clear: { color: tokens.color.error, textAlign: 'center', marginTop: 20, fontSize: 13 },
});
