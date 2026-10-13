import { largeAction } from '../../components/ui/largeAction';
import { useRouter } from 'expo-router';
import { Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../../components/ui/AppText';
import { phonePreview } from '../../components/ui/phonePreview';
import { t, useLanguage } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import type { ReportSubmissionReceipt } from './api';

export function ReportReceiptSheet({
  receipt,
  onClose,
}: {
  receipt: ReportSubmissionReceipt;
  onClose: () => void;
}) {
  useLanguage();
  const router = useRouter();
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.canvas}>
        <View style={[styles.overlay, Platform.OS === 'web' && phonePreview.frame]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('roomCloseSheet')}
            style={StyleSheet.absoluteFill}
            onPress={onClose}
          />
          <View testID="report-receipt" style={styles.sheet}>
            <Text accessibilityRole="alert" style={styles.title}>
              {t('roomReportReceived')}
            </Text>
            <Text style={styles.body}>{t('reportReceiptHint')}</Text>
            <Text selectable style={styles.identifier}>
              {t('roomReportCaseId')} · {receipt.caseId}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.primary}
              onPress={() => {
                onClose();
                router.push('/me/reports');
              }}
            >
              <Text style={styles.primaryText}>{t('viewMyReports')}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.close} onPress={onClose}>
              <Text style={styles.body}>{t('roomCloseSheet')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  canvas: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.64)',
    justifyContent: 'flex-end',
  },
  sheet: {
    padding: 24,
    paddingBottom: 32,
    backgroundColor: tokens.connection.color.panel,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    gap: 16,
  },
  title: { color: '#fff', fontSize: 16, lineHeight: 24, fontWeight: '700' },
  body: { color: tokens.connection.color.muted, fontSize: 13, lineHeight: 20 },
  identifier: { color: '#fff', fontSize: 12, lineHeight: 18 },
  primary: {
    backgroundColor: tokens.color.purple,
    alignItems: 'center',
    justifyContent: 'center',
    ...largeAction,
  },
  primaryText: { color: '#fff', fontSize: 14, lineHeight: 20, fontWeight: '500' },
  close: { alignItems: 'center', padding: 8 },
});
