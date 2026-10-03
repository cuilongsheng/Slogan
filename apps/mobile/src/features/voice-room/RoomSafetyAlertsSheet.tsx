import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { t, tf, type MessageKey } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import type { RoomMember } from './api';
import type { VoiceRoomSession, VoiceSessionSnapshot } from './session';

const categoryLabels: Record<VoiceSessionSnapshot['safetyAlerts'][number]['category'], MessageKey> =
  {
    HARASSMENT_ABUSE: 'safetyAlertHarassment',
    HATE_DISCRIMINATION: 'safetyAlertHate',
    SEXUAL_CONTENT: 'safetyAlertSexual',
    THREAT_VIOLENCE: 'safetyAlertThreat',
    SPAM_ADVERTISING: 'safetyAlertSpam',
    OTHER_SAFETY_RISK: 'safetyAlertOther',
  };

const severityLabels: Record<VoiceSessionSnapshot['safetyAlerts'][number]['severity'], MessageKey> =
  {
    LOW: 'safetyAlertLow',
    MEDIUM: 'safetyAlertMedium',
    HIGH: 'safetyAlertHigh',
  };

export function RoomSafetyAlertsSheet({
  snapshot,
  session,
  members,
  onClose,
}: {
  snapshot: VoiceSessionSnapshot;
  session: VoiceRoomSession;
  members: RoomMember[];
  onClose: () => void;
}) {
  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.heading}>
          <Text style={styles.title}>{t('safetyAlertsTitle')}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('roomCloseSheet')}
            onPress={onClose}
          >
            <Text style={styles.close}>×</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.explanation}>{t('safetyAlertsExplanation')}</Text>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {snapshot.safetyAlerts.map((alert) => {
            const member = members.find((item) => item.userId === alert.subjectUserId);
            return (
              <View key={alert.id} style={styles.alert}>
                <View style={styles.alertHeading}>
                  <Text style={styles.category}>{t(categoryLabels[alert.category])}</Text>
                  <Text style={styles.severity}>{t(severityLabels[alert.severity])}</Text>
                </View>
                <Text style={styles.meta}>
                  {tf('safetyAlertMember', {
                    name: member?.displayName ?? alert.subjectUserId.slice(0, 8),
                  })}
                </Text>
                <Text style={styles.meta}>
                  {new Date(alert.lastOccurredAt).toLocaleString()} ·{' '}
                  {tf('safetyAlertOccurrences', { count: alert.occurrenceCount })}
                </Text>
                <Text style={styles.review}>{t('safetyAlertReview')}</Text>
              </View>
            );
          })}
          {!snapshot.safetyAlerts.length &&
            !snapshot.safetyAlertsLoading &&
            !snapshot.safetyAlertsError && (
              <Text style={styles.empty}>{t('safetyAlertsEmpty')}</Text>
            )}
          {snapshot.safetyAlertsError && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => void session.refreshSafetyAlerts()}
            >
              <Text style={styles.retry}>{t('safetyAlertsRetry')}</Text>
            </TouchableOpacity>
          )}
          {snapshot.safetyAlertsLoading && <ActivityIndicator color={tokens.color.purple} />}
          {snapshot.safetyAlertsCursor && !snapshot.safetyAlertsLoading && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() =>
                void session.refreshSafetyAlerts(snapshot.safetyAlertsCursor ?? undefined)
              }
            >
              <Text style={styles.retry}>{t('safetyAlertsMore')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#0008',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: tokens.color.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 38,
    maxHeight: '78%',
  },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: tokens.color.foreground, fontSize: 21, fontWeight: '700' },
  close: { color: tokens.color.muted, fontSize: 30, paddingHorizontal: 8 },
  explanation: { color: tokens.color.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  list: { marginTop: 20 },
  listContent: { paddingBottom: 12, gap: 12 },
  alert: { borderRadius: 16, backgroundColor: tokens.color.purpleSoft, padding: 14 },
  alertHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  category: { color: tokens.color.foreground, fontSize: 14, fontWeight: '700', flex: 1 },
  severity: { color: tokens.color.purple, fontSize: 11, fontWeight: '700' },
  meta: { color: tokens.color.muted, fontSize: 11, marginTop: 8 },
  review: { color: tokens.color.foreground, fontSize: 12, marginTop: 11 },
  empty: { color: tokens.color.muted, fontSize: 13, textAlign: 'center', paddingVertical: 35 },
  retry: {
    color: tokens.color.purple,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
