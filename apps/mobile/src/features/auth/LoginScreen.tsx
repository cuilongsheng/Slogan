import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Redirect, router } from 'expo-router';

import { AuthPage, PrimaryButton } from '../../components/ui/AuthPage';
import { t } from '../../services/locale';
import {
  googleServerCode,
  googleSignInConfigured,
  googleSignInNeedsDevelopmentBuild,
  prepareGoogleSignIn,
} from '../../services/googleSignIn';
import { tokens } from '../../styles/tokens';
import { useAuth } from './context';
import { SessionError } from './session';
import { emailAuthMessage } from './emailApi';
import sloganLogo from '../../../../../assets/brand/slogan-logo.png';
import googleIcon from '../../../assets/icons/google.png';
import wechatIcon from '../../../assets/icons/wechat.png';

export function LoginScreen() {
  const { state, loginGoogle, loginPassword, retry } = useAuth();
  const configured = googleSignInConfigured();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    void prepareGoogleSignIn().catch(() => null);
  }, []);

  const signIn = async () => {
    if (busy) return;
    setMessage(null);
    if (!configured) {
      setMessage(
        t(googleSignInNeedsDevelopmentBuild() ? 'developmentBuildRequired' : 'configUnavailable'),
      );
      return;
    }
    setBusy(true);
    try {
      const code = await googleServerCode();
      if (!code) {
        setMessage(t('cancelled'));
        return;
      }
      await loginGoogle(code);
    } catch (error) {
      setMessage(
        error instanceof SessionError && error.code === 'CONFIG'
          ? t('configUnavailable')
          : t('loginFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const signInPassword = async () => {
    if (busy) return;
    setMessage(null);
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username.trim()) || [...password].length < 8) {
      setMessage(t('loginInputInvalid'));
      return;
    }
    setBusy(true);
    try {
      await loginPassword(username, password);
      setPassword('');
    } catch (error) {
      setMessage(
        error instanceof SessionError ? emailAuthMessage(error.message) : emailAuthMessage(error),
      );
    } finally {
      setBusy(false);
    }
  };

  if (state.kind === 'signedIn') return <Redirect href="/" />;
  if (state.kind === 'loading')
    return (
      <AuthPage>
        <Text style={styles.status}>{t('signingIn')}</Text>
      </AuthPage>
    );
  if (state.kind === 'error')
    return (
      <AuthPage>
        <Text style={styles.status}>{t('sessionRestoreFailed')}</Text>
        <PrimaryButton
          label={t('retry')}
          onPress={() => {
            void retry();
          }}
        />
      </AuthPage>
    );

  return (
    <AuthPage scroll>
      <View style={styles.logoArea}>
        <Image source={sloganLogo} style={styles.logo} resizeMode="contain" />
        <Text style={styles.wordmark}>{t('appName')}</Text>
      </View>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{t('eyebrow')}</Text>
        <View style={styles.heroSparkle}>
          <Text style={styles.heroSparkleText}>✦</Text>
        </View>
        <Text style={styles.heroTitle}>{t('heroTitle')}</Text>
        <Text style={styles.heroDescription}>{t('heroDescription')}</Text>
      </View>
      <View style={styles.credentials}>
        <Text style={styles.label}>{t('username')}</Text>
        <TextInput
          accessibilityLabel={t('username')}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          value={username}
          onChangeText={setUsername}
          placeholder={t('usernamePlaceholder')}
          placeholderTextColor={tokens.color.muted}
          style={styles.input}
          testID="login-username"
        />
        <Text style={[styles.label, styles.passwordLabel]}>{t('password')}</Text>
        <TextInput
          accessibilityLabel={t('password')}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder={t('passwordPlaceholder')}
          placeholderTextColor={tokens.color.muted}
          style={styles.input}
          testID="login-password"
        />
        <View style={styles.actions}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.push('/email/register')}
          >
            <Text style={styles.actionText}>{t('createAccountAction')}</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/email/forgot')}>
            <Text style={styles.actionText}>{t('forgotPasswordAction')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <PrimaryButton
        label={busy ? t('signingIn') : t('passwordLogin')}
        disabled={busy}
        onPress={() => {
          void signInPassword();
        }}
        testID="password-sign-in"
      />
      {message ? (
        <Text accessibilityRole="alert" style={styles.message}>
          {message}
        </Text>
      ) : (
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('otherSignInMethods')}</Text>
          <View style={styles.dividerLine} />
        </View>
      )}
      {state.message && (
        <Text accessibilityRole="alert" style={styles.message}>
          {t('logoutUnconfirmed')}
        </Text>
      )}
      <View style={styles.socialRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          accessibilityHint={t('wechatUnavailable')}
          disabled
          style={[styles.socialOption, styles.wechat]}
        >
          <Image source={wechatIcon} style={styles.socialIcon} />
          <Text style={styles.socialText}>{t('wechat')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={busy}
          onPress={() => {
            void signIn();
          }}
          testID="google-sign-in"
          style={[styles.socialOption, busy && styles.busyOption]}
        >
          <Image source={googleIcon} style={[styles.socialIcon, styles.googleGlyph]} />
          <Text style={[styles.socialText, styles.googleGlyph]}>Google</Text>
        </TouchableOpacity>
      </View>
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  logoArea: { alignItems: 'center', marginTop: 25 },
  logo: { width: 112, height: 112 },
  wordmark: { marginTop: 2, fontSize: 24, fontWeight: '700', color: tokens.color.foreground },
  hero: {
    marginTop: 30,
    marginHorizontal: -8,
    minHeight: 132,
    borderRadius: 24,
    backgroundColor: tokens.color.peach,
    borderWidth: 1,
    borderColor: tokens.color.peachBorder,
    padding: 16,
    paddingTop: 22,
    justifyContent: 'flex-start',
  },
  eyebrow: { color: tokens.color.purple, fontSize: 11, fontWeight: '700' },
  heroSparkle: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.color.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSparkleText: { color: tokens.color.coral, fontSize: 22, lineHeight: 26 },
  heroTitle: {
    marginTop: 4,
    color: tokens.color.foreground,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroDescription: { marginTop: 16, color: tokens.color.muted, fontSize: 12, textAlign: 'center' },
  credentials: { marginTop: 26, marginBottom: 31 },
  label: {
    color: tokens.color.foreground,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 8,
  },
  passwordLabel: { marginTop: 10 },
  input: {
    height: 54,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 16,
    backgroundColor: tokens.color.panel,
    paddingHorizontal: 16,
    color: tokens.color.foreground,
    fontSize: 16,
  },
  actions: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  actionText: { color: tokens.color.purple, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  socialRow: { flexDirection: 'row', gap: 12, marginTop: 18, marginBottom: 20 },
  socialOption: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 16,
    backgroundColor: tokens.color.panel,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wechat: {},
  googleGlyph: { transform: [{ translateX: -3 }] },
  busyOption: { opacity: 0.48 },
  socialIcon: { width: 24, height: 24 },
  socialText: { color: tokens.color.foreground, fontSize: 14, fontWeight: '600' },
  message: { color: tokens.color.error, marginTop: 12, textAlign: 'center', fontSize: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', marginTop: 22, gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: tokens.color.border },
  dividerText: { color: tokens.color.muted, fontSize: 12 },
  status: { color: tokens.color.foreground, marginTop: 100, textAlign: 'center', fontSize: 16 },
});
