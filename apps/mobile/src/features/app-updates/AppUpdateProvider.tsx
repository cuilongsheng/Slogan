import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { usePathname } from 'expo-router';
import { AppState, Image, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import sloganLogo from '../../../assets/icons/slogan-mark-v3.png';
import { AppText as Text } from '../../components/ui/AppText';
import { useForegroundPolling } from '../../hooks/useForegroundPolling';
import { appUpdates } from '../../services/appUpdates';
import type { AndroidRelease } from '../../services/appUpdates/types';
import { isAppForeground } from '../../services/foregroundPolling';
import { t, tf, useLanguage } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import { useAuth } from '../auth';

type Stage =
  'available' | 'downloading' | 'permission' | 'ready' | 'error' | 'current' | 'checkError';
interface UpdateUi {
  stage: Stage;
  release?: AndroidRelease;
  installedVersion?: string;
  progress?: number;
}
const SIX_HOURS = 6 * 60 * 60 * 1000;
const mainPages = new Set(['/rooms', '/partners', '/messages', '/me']);
const Context = createContext<{ supported: boolean; checking: boolean; check(): void }>({
  supported: false,
  checking: false,
  check: () => undefined,
});
export const useAppUpdates = () => useContext(Context);

export function AppUpdateProvider({ children }: { children: React.ReactNode }) {
  useLanguage();
  const path = usePathname().replace(/\/$/, '');
  const { state: auth } = useAuth();
  const safe =
    appUpdates.supported &&
    ((auth.kind === 'signedIn' && mainPages.has(path)) ||
      (auth.kind === 'signedOut' && path === '/sign-in'));
  const safeRef = useRef(safe);
  useLayoutEffect(() => {
    safeRef.current = safe;
  }, [safe]);
  const [ui, setUi] = useState<UpdateUi | null>(null);
  const uiRef = useRef<UpdateUi | null>(null);
  const [checking, setChecking] = useState(false);
  const [foreground, setForeground] = useState(isAppForeground);
  const alive = useRef(true);
  const checkingRef = useRef(false);
  const downloading = useRef(false);
  const nextCheck = useRef(0);
  const dismissed = useRef(new Set<number>());
  const operation = useRef(0);
  const invalidate = useCallback(() => {
    operation.current++;
    appUpdates.cancel();
  }, []);
  const awaitingPermission = useRef(false);
  const installing = useRef(false);
  const show = useCallback((value: UpdateUi | null) => {
    uiRef.current = value;
    if (alive.current) setUi(value);
  }, []);

  const check = useCallback(
    async (manual = false) => {
      if (
        !safeRef.current ||
        checkingRef.current ||
        downloading.current ||
        (!manual && (Date.now() < nextCheck.current || uiRef.current))
      )
        return;
      checkingRef.current = true;
      setChecking(true);
      try {
        const result = await appUpdates.check();
        if (!alive.current) return;
        nextCheck.current = Date.now() + SIX_HOURS;
        if (result.release) {
          if (manual || !dismissed.current.has(result.release.versionCode)) {
            show({ stage: 'available', release: result.release });
          }
        } else if (manual) show({ stage: 'current', installedVersion: result.installedVersion });
      } catch {
        nextCheck.current = Date.now() + 5 * 60 * 1000;
        if (manual && alive.current) show({ stage: 'checkError' });
      } finally {
        checkingRef.current = false;
        if (alive.current) setChecking(false);
      }
    },
    [show],
  );
  const autoCheck = useCallback(async () => {
    await check();
  }, [check]);
  const checkInterval = useCallback(
    () => Math.max(5 * 60 * 1000, nextCheck.current - Date.now()),
    [],
  );
  useForegroundPolling(autoCheck, checkInterval, safe);

  const install = useCallback(async () => {
    if (!alive.current || !safeRef.current || !isAppForeground() || installing.current) return;
    const selected = uiRef.current?.release;
    if (!selected) return;
    installing.current = true;
    try {
      if (!appUpdates.canInstall()) {
        show({ stage: 'permission', release: selected });
        return;
      }
      show({ stage: 'ready', release: selected });
      await appUpdates.install();
      // Launching or returning from the installer does not mean installation succeeded.
    } catch {
      show({ stage: 'error', release: selected });
    } finally {
      installing.current = false;
    }
  }, [show]);

  useEffect(() => {
    alive.current = true;
    if (!appUpdates.supported) return;
    const removeProgress = appUpdates.onProgress(({ bytes, total }) => {
      const current = uiRef.current;
      if (current?.stage !== 'downloading' || total <= 0) return;
      show({ ...current, progress: Math.min(100, Math.floor((bytes * 100) / total)) });
    });
    const listener = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
      if (state !== 'active' || !awaitingPermission.current) return;
      awaitingPermission.current = false;
      if (safeRef.current && uiRef.current?.stage === 'permission' && appUpdates.canInstall()) {
        void install();
      }
    });
    return () => {
      alive.current = false;
      invalidate();
      removeProgress();
      listener.remove();
    };
  }, [install, show, invalidate]);

  // Calls/rooms take precedence, including incoming calls detected by the root observer.
  useEffect(() => {
    if (safe || !appUpdates.supported) return;
    awaitingPermission.current = false;
    if (downloading.current) {
      operation.current++;
      appUpdates.cancel();
      const release = uiRef.current?.release;
      if (release) show({ stage: 'available', release });
    }
  }, [safe, show]);

  const later = () => {
    const selected = uiRef.current?.release;
    if (selected) dismissed.current.add(selected.versionCode);
    awaitingPermission.current = false;
    operation.current++;
    appUpdates.cancel();
    show(null);
  };
  const download = async () => {
    const selected = uiRef.current?.release;
    if (!selected || downloading.current || !safeRef.current) return;
    downloading.current = true;
    const epoch = ++operation.current;
    show({ stage: 'downloading', release: selected, progress: 0 });
    try {
      await appUpdates.download(selected);
      if (!alive.current || epoch !== operation.current) return;
      show({ stage: 'ready', release: selected });
      await install();
    } catch {
      if (alive.current && epoch === operation.current) show({ stage: 'error', release: selected });
    } finally {
      downloading.current = false;
    }
  };
  const openSettings = async () => {
    if (awaitingPermission.current) return;
    awaitingPermission.current = true;
    try {
      await appUpdates.openSettings();
    } catch {
      awaitingPermission.current = false;
      const selected = uiRef.current?.release;
      if (selected) show({ stage: 'error', release: selected });
    }
  };
  const stage = ui?.stage;
  const title =
    stage === 'downloading'
      ? 'updateDownloading'
      : stage === 'permission'
        ? 'updatePermissionTitle'
        : stage === 'ready'
          ? 'updateReady'
          : stage === 'current'
            ? 'updateCurrent'
            : stage === 'error' || stage === 'checkError'
              ? 'updateFailed'
              : 'updateAvailable';
  const primaryLabel =
    stage === 'permission'
      ? 'updateSettings'
      : stage === 'ready'
        ? 'updateInstall'
        : stage === 'error' || stage === 'checkError'
          ? 'retry'
          : 'updateDownload';
  const act = () => {
    if (stage === 'permission') void openSettings();
    else if (stage === 'ready') void install();
    else if (stage === 'checkError') {
      show(null);
      void check(true);
    } else void download();
  };
  return (
    <Context.Provider
      value={{ supported: appUpdates.supported, checking, check: () => void check(true) }}
    >
      {children}
      <Modal
        transparent
        visible={safe && !!ui && foreground}
        animationType="fade"
        onRequestClose={later}
      >
        <View style={styles.overlay}>
          <View
            accessibilityRole="alert"
            style={[styles.card, stage === 'downloading' && styles.downloadCard]}
          >
            <View style={styles.heading}>
              <Image
                source={sloganLogo}
                resizeMode="contain"
                style={styles.logo}
                accessible={false}
              />
              <Text
                accessibilityRole="header"
                style={[styles.title, stage !== 'downloading' && styles.titleInset]}
              >
                {t(title)}
              </Text>
            </View>
            {ui?.release && (
              <Text
                style={[
                  styles.body,
                  styles.version,
                  stage === 'downloading' ? styles.downloadBodyInset : styles.bodyInset,
                ]}
              >
                {tf('updateVersionSize', {
                  version: ui.release.version,
                  size: Math.ceil(ui.release.bytes / (1024 * 1024)),
                })}
              </Text>
            )}
            <Text
              style={[
                styles.body,
                styles.description,
                stage !== 'downloading' && styles.bodyInset,
                stage === 'downloading' && styles.downloadDescription,
                stage === 'downloading' && styles.downloadBodyInset,
              ]}
            >
              {stage === 'current'
                ? tf('updateInstalledVersion', { version: ui?.installedVersion ?? '' })
                : t(
                    stage === 'permission'
                      ? 'updatePermissionBody'
                      : stage === 'downloading'
                        ? 'updateDownloadBody'
                        : stage === 'ready'
                          ? 'updateReadyBody'
                          : stage === 'error' || stage === 'checkError'
                            ? 'updateErrorBody'
                            : 'updateInstallBody',
                  )}
            </Text>
            {stage === 'downloading' ? (
              <>
                <View style={styles.progressRow}>
                  <View
                    accessible
                    accessibilityRole="progressbar"
                    accessibilityLabel={t('updateDownloading')}
                    accessibilityValue={{ min: 0, max: 100, now: ui?.progress ?? 0 }}
                    style={styles.bar}
                  >
                    <View style={[styles.progress, { width: `${ui?.progress ?? 0}%` }]} />
                  </View>
                  <Text style={[styles.body, styles.percentage]}>{ui?.progress ?? 0}%</Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  hitSlop={{ top: 4, bottom: 4 }}
                  style={[styles.action, styles.secondary, styles.cancel]}
                  onPress={() => {
                    operation.current++;
                    appUpdates.cancel();
                    const release = uiRef.current?.release;
                    show(release ? { stage: 'available', release } : null);
                  }}
                >
                  <Text style={styles.secondaryText}>{t('updateCancel')}</Text>
                </TouchableOpacity>
              </>
            ) : stage === 'current' ? (
              <TouchableOpacity
                accessibilityRole="button"
                hitSlop={{ top: 4, bottom: 4 }}
                style={[styles.action, styles.primary, styles.singleAction]}
                onPress={later}
              >
                <Text style={styles.primaryText}>{t('directConfirm')}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.actions}>
                <TouchableOpacity
                  accessibilityRole="button"
                  hitSlop={{ top: 4, bottom: 4 }}
                  style={[styles.action, styles.secondary, styles.paired]}
                  onPress={later}
                >
                  <Text style={styles.secondaryText}>{t('updateLater')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  hitSlop={{ top: 4, bottom: 4 }}
                  style={[styles.action, styles.primary, styles.paired]}
                  onPress={act}
                >
                  <Text style={styles.primaryText}>{t(primaryLabel)}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </Context.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(21,17,37,0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 342,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    borderRadius: 24,
    backgroundColor: tokens.color.panel,
  },
  downloadCard: { paddingBottom: 34 },
  heading: { minHeight: 80, flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  logo: { width: 80, height: 80, flexShrink: 0, marginLeft: -1 },
  title: {
    flex: 1,
    minWidth: 0,
    marginTop: 16,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: tokens.color.headingInk,
  },
  titleInset: { marginLeft: 11 },
  body: { fontSize: 14, lineHeight: 22, color: tokens.color.headingInk },
  version: { marginTop: 9 },
  description: { marginTop: 9 },
  bodyInset: { marginLeft: 11 },
  downloadBodyInset: { marginLeft: 1 },
  downloadDescription: { marginTop: 16 },
  actions: { marginTop: 23, flexDirection: 'row', gap: 12 },
  action: {
    height: tokens.control.height,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  paired: { flex: 1 },
  singleAction: { marginTop: 23 },
  cancel: { marginTop: 17, marginLeft: -9, width: '100%' },
  primary: { backgroundColor: tokens.color.purple },
  secondary: { backgroundColor: tokens.color.purpleSoft },
  primaryText: { fontSize: 14, lineHeight: 20, color: tokens.color.panel, fontWeight: '500' },
  secondaryText: { fontSize: 14, lineHeight: 20, color: tokens.color.purple, fontWeight: '500' },
  progressRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    paddingLeft: 1,
    paddingRight: 9,
  },
  percentage: { minWidth: 29, flexShrink: 0 },
  bar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: tokens.color.purpleSoft,
    transform: [{ translateY: 3 }],
  },
  progress: { height: 6, borderRadius: 3, backgroundColor: tokens.color.purple },
});
