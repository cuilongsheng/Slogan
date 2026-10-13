import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/ui/AppText';
import { RoomHeader, RoomPage } from '../../components/ui/RoomPage';
import { useFocusedPolling } from '../../hooks/useFocusedPolling';
import { LatestRequestQueue } from '../../services/latestRequestQueue';
import { t, useLanguage, type MessageKey } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../auth';
import { ReportingApi, type PersonalReport } from './api';

const progress: Record<PersonalReport['status'], MessageKey> = {
  OPEN: 'reportStatusOpen',
  UNDER_REVIEW: 'reportStatusReview',
  RESOLVED: 'reportStatusResolved',
  DISMISSED: 'reportStatusDismissed',
};
const kind: Record<PersonalReport['kind'], MessageKey> = {
  ROOM: 'roomReportRoom',
  ROOM_MEMBER: 'roomReportMember',
  DIRECT_MESSAGE: 'directReport',
};
const categories: Record<PersonalReport['category'], MessageKey> = {
  HARASSMENT_ABUSE: 'roomReportHarassment',
  HATE_DISCRIMINATION: 'roomReportHate',
  SEXUAL_CONTENT: 'roomReportSexual',
  SPAM_ADVERTISING: 'roomReportSpam',
  OTHER: 'roomReportOther',
};

export function MyReportsScreen() {
  const language = useLanguage(),
    router = useRouter();
  const { authorized } = useAuth();
  const api = useMemo(() => new ReportingApi(authorized), [authorized]);
  const queue = useRef(new LatestRequestQueue()),
    pages = useRef(1);
  const [items, setItems] = useState<PersonalReport[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(true),
    [fetching, setFetching] = useState(false);
  const fence = useRef<() => boolean>(() => false);
  const load = useCallback(
    (current: () => boolean, moreCursor?: string) =>
      queue.current.enqueue(async () => {
        if (!current()) return;
        setFetching(true);
        try {
          const collected: PersonalReport[] = [];
          let next = moreCursor ?? undefined,
            count = 0;
          do {
            const page = await api.list(next);
            if (!current()) return;
            collected.push(
              ...page.items.filter((item) => !collected.some((x) => x.id === item.id)),
            );
            next = page.nextCursor ?? undefined;
            count++;
          } while (!moreCursor && next && count < pages.current);
          setItems((old) =>
            moreCursor
              ? [...old, ...collected.filter((item) => !old.some((x) => x.id === item.id))]
              : collected,
          );
          pages.current = moreCursor ? pages.current + 1 : count;
          setCursor(next ?? null);
          setError(false);
        } catch {
          if (current()) setError(true);
        } finally {
          if (current()) {
            setFetching(false);
            setLoading(false);
          }
        }
      }),
    [api],
  );
  const poll = useCallback(
    (current: () => boolean) => {
      fence.current = current;
      return load(current);
    },
    [load],
  );
  useFocusedPolling(poll, 5000);
  const time = (value: string) =>
    new Date(value).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US');
  return (
    <RoomPage direct>
      <RoomHeader title={t('myReports')} onBack={() => router.back()} />
      <View style={styles.toolbar}>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={fetching}
          onPress={() => void load(fence.current)}
        >
          <Text style={styles.link}>{t('refreshAction')}</Text>
        </TouchableOpacity>
      </View>
      {error && (
        <View style={styles.feedback}>
          <Text accessibilityRole="alert" style={styles.error}>
            {t('myReportsFailed')}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={fetching}
            onPress={() => void load(fence.current)}
          >
            <Text style={styles.link}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      )}
      {loading ? <ActivityIndicator color={tokens.color.purple} /> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          !loading && !error ? <Text style={styles.empty}>{t('myReportsEmpty')}</Text> : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.title}>{t(kind[item.kind])}</Text>
              <Text style={[styles.status, item.status === 'RESOLVED' && styles.resolved]}>
                {t(progress[item.status])}
              </Text>
            </View>
            {item.roomTopic ? <Text style={styles.topic}>{item.roomTopic}</Text> : null}
            <Text style={styles.meta}>
              {t(categories[item.category])} · {time(item.submittedAt)}
            </Text>
            <Text selectable style={styles.meta}>
              {t('roomReportCaseId')} · {item.caseId ?? item.id}
            </Text>
            {item.decidedAt ? (
              <Text style={styles.meta}>
                {t('reportProcessedAt')} · {time(item.decidedAt)}
              </Text>
            ) : null}
          </View>
        )}
        ListFooterComponent={
          cursor ? (
            <TouchableOpacity
              accessibilityRole="button"
              disabled={fetching}
              style={styles.more}
              onPress={() => void load(fence.current, cursor)}
            >
              <Text style={styles.link}>{t(fetching ? 'submitting' : 'socialLoadMore')}</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </RoomPage>
  );
}
const styles = StyleSheet.create({
  toolbar: { paddingHorizontal: 20, alignItems: 'flex-end', marginBottom: 12 },
  list: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 12, flexGrow: 1 },
  card: {
    padding: 16,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.color.panel,
    gap: 8,
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  title: {
    fontSize: 14,
    lineHeight: 20,
    color: tokens.color.headingInk,
    fontWeight: '700',
    flex: 1,
  },
  topic: { fontSize: 14, lineHeight: 20, color: tokens.color.foreground },
  status: {
    fontSize: 12,
    lineHeight: 18,
    color: tokens.color.purple,
    backgroundColor: tokens.color.purpleSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  resolved: { color: tokens.color.mintInk, backgroundColor: tokens.color.mint },
  meta: { fontSize: 12, lineHeight: 18, color: tokens.color.muted },
  feedback: { paddingHorizontal: 20, gap: 8, marginBottom: 12 },
  error: { color: tokens.color.error, fontSize: 12 },
  empty: { textAlign: 'center', color: tokens.color.muted, fontSize: 14, marginTop: 64 },
  link: { color: tokens.color.purple, fontSize: 12, lineHeight: 18 },
  more: { alignItems: 'center', padding: 16 },
});
