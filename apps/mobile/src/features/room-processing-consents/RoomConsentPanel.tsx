import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

import { t } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../auth';
import { RoomProcessingConsentApi, bundledNoticeVersion, currentConsent, type ConsentItem, type RoomConsentPurpose } from './api';

export function RoomConsentPanel({ safety, keywords, onReadyChange, allowRevoke = false, headingStyle }: {
  safety: boolean;
  keywords: boolean;
  onReadyChange?: (ready: boolean) => void;
  allowRevoke?: boolean;
  headingStyle?: StyleProp<TextStyle>;
}) {
  const { authorized } = useAuth();
  const api = useMemo(() => new RoomProcessingConsentApi(authorized), [authorized]);
  const required = useMemo<RoomConsentPurpose[]>(() => [
    ...(safety ? ['ROOM_SAFETY_DETECTION' as const] : []),
    ...(keywords ? ['POST_ROOM_KEYWORDS' as const] : []),
  ], [safety, keywords]);
  const [items, setItems] = useState<ConsentItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<RoomConsentPurpose | null>(null);
  const [error, setError] = useState('');
  const requestIds = useRef(new Map<string, string>());
  const pending = useRef(false);

  const refresh = useCallback(async () => {
    if (required.length === 0) { setItems([]); setLoading(false); return; }
    setLoading(true);
    setItems(null);
    setError('');
    try { setItems(await api.list()); }
    catch { setError(t('consentLoadFailed')); }
    finally { setLoading(false); }
  }, [api, required]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const ready = required.length === 0 || (items !== null && required.every((purpose) => {
    const item = items.find((entry) => entry.purpose === purpose);
    return item?.currentNoticeVersion === bundledNoticeVersion && currentConsent(item);
  }));
  useEffect(() => { onReadyChange?.(ready); }, [onReadyChange, ready]);

  async function command(purpose: RoomConsentPurpose, action: 'ACCEPT' | 'REVOKE', version: string) {
    if (pending.current) return;
    const key = `${purpose}:${action}:${version}`;
    const id = requestIds.current.get(key) ?? randomUUID();
    requestIds.current.set(key, id);
    pending.current = true;
    setBusy(purpose);
    setError('');
    try {
      const result = await api.command(purpose, action, version, id);
      setItems((current) => [...(current ?? []).filter((item) => item.purpose !== purpose), result]);
      requestIds.current.delete(key);
    } catch { setError(t('consentCommandFailed')); }
    finally { pending.current = false; setBusy(null); }
  }

  if (required.length === 0) return null;
  return <View style={styles.panel}>
    <Text style={[styles.heading, headingStyle]}>{t('consentHeading')}</Text>
    {loading && !items ? <ActivityIndicator color={tokens.color.purple} /> : null}
    {error ? <View style={styles.errorRow}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => void refresh()}><Text style={styles.link}>{t('retry')}</Text></TouchableOpacity></View> : null}
    {items === null ? <TouchableOpacity accessibilityRole="button" onPress={() => void refresh()}><Text style={styles.link}>{t('retry')}</Text></TouchableOpacity> : required.map((purpose) => {
      const item = items.find((entry) => entry.purpose === purpose);
      const accepted = currentConsent(item);
      const version = item?.currentNoticeVersion;
      const versionKnown = version === bundledNoticeVersion;
      return <View key={purpose} style={styles.card}>
        <Text style={styles.title}>{purpose === 'ROOM_SAFETY_DETECTION' ? t('consentSafetyTitle') : t('consentKeywordsTitle')}</Text>
        <Text style={styles.body}>{purpose === 'ROOM_SAFETY_DETECTION' ? t('consentSafetyBody') : t('consentKeywordsBody')}</Text>
        <Text style={styles.status}>{accepted ? t('consentAccepted') : item?.status === 'REVOKED' ? t('consentRevoked') : t('consentRequired')}</Text>
        {version && !versionKnown ? <Text style={styles.error}>{t('consentUpdateRequired')}</Text> : null}
        {!accepted && versionKnown && version ? <TouchableOpacity accessibilityRole="button" disabled={busy !== null} onPress={() => void command(purpose, 'ACCEPT', version)}><Text style={styles.link}>{busy === purpose ? t('submitting') : t('consentAccept')}</Text></TouchableOpacity> : null}
        {accepted && allowRevoke && version ? <TouchableOpacity accessibilityRole="button" disabled={busy !== null} onPress={() => void command(purpose, 'REVOKE', version)}><Text style={styles.danger}>{busy === purpose ? t('submitting') : t('consentRevoke')}</Text></TouchableOpacity> : null}
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  panel: { marginHorizontal: 20, marginTop: 12, gap: 10 },
  heading: { color: tokens.color.foreground, fontSize: 16, fontWeight: '700' },
  card: { padding: 16, borderRadius: tokens.radius.lg, backgroundColor: tokens.color.panel, borderWidth: 1, borderColor: tokens.color.border },
  title: { color: tokens.color.foreground, fontSize: 15, fontWeight: '700' },
  body: { color: tokens.color.muted, fontSize: 12, lineHeight: 19, marginTop: 7 },
  status: { color: tokens.color.purple, fontSize: 12, marginTop: 10 },
  link: { color: tokens.color.purple, fontSize: 13, fontWeight: '700', marginTop: 12 },
  danger: { color: tokens.color.error, fontSize: 13, fontWeight: '700', marginTop: 12 },
  error: { color: tokens.color.error, fontSize: 12 },
  errorRow: { gap: 4 },
});
