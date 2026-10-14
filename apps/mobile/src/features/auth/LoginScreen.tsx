import { AppText as Text } from '../../components/ui/AppText';
import { BrandLoading } from '../../components/ui/BrandLoading';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Redirect, router } from 'expo-router';

import { AuthPage, PrimaryButton } from '../../components/ui/AuthPage';
import { t, useLanguage } from '../../services/locale';
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
import sloganLogo from '../../../assets/icons/slogan-mark-v3.png';
import googleIcon from '../../../assets/icons/google.png';
import wechatIcon from '../../../assets/icons/wechat.png';

export function LoginScreen() {
  useLanguage();
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
  if (state.kind === 'loading') return <BrandLoading />;
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
      <View pointerEvents="none" style={styles.heroSparkle}>
        <Text style={styles.heroSparkleText}>✦</Text>
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
        <View style={styles.passwordRow}>
          <Text style={styles.label}>{t('password')}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/email/forgot')}>
            <Text style={styles.recoveryText}>{t('forgotPasswordAction')}</Text>
          </TouchableOpacity>
        </View>
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
        </View>
      </View>
      <PrimaryButton
        label={busy ? t('signingIn') : t('passwordLogin')}
        disabled={busy}
        onPress={() => {
          void signInPassword();
        }}
        testID="password-sign-in"
        labelStyle={{ fontSize: 15, lineHeight: 25 }}
      />
      {message ? (
        <Text accessibilityRole="alert" style={styles.message}>
          {message}
        </Text>
      ) : (
        <View style={styles.divider}>
          <View style={[styles.dividerLine, styles.dividerLeft]} />
          <Text style={styles.dividerText}>{t('otherSignInMethods')}</Text>
          <View style={[styles.dividerLine, styles.dividerRight]} />
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
          testID="wechat-sign-in"
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
  wordmark: {
    marginTop: 2,
    fontSize: 24,
    lineHeight: 28,
    height: 36,
    fontWeight: '700',
    color: tokens.color.brandInk,
  },
  heroSparkle: {
    position: 'absolute',
    top: 213,
    right: 36,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.color.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSparkleText: { color: tokens.color.coral, fontSize: 18, lineHeight: 30 },
  credentials: { marginTop: 78, marginBottom: 28 },
  label: {
    color: tokens.color.authInk,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    height: 24,
    marginBottom: 3,
  },
  passwordRow: {
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recoveryText: {
    fontSize: 12,
    lineHeight: 18,
    height: 24,
    marginBottom: 3,
    color: tokens.color.purple,
  },
  input: {
    height: tokens.control.height,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 16,
    backgroundColor: tokens.color.panel,
    paddingHorizontal: 16,
    color: tokens.color.foreground,
    fontSize: 14,
    paddingVertical: 0,
    lineHeight: 26,
  },
  actions: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  actionText: {
    color: tokens.color.purple,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 17,
    height: 20,
  },
  socialRow: { flexDirection: 'row', gap: 12, marginTop: 13, marginBottom: 20 },
  socialOption: {
    flex: 1,
    height: tokens.control.height,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 16,
    backgroundColor: tokens.color.panel,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wechat: { opacity: 0.4 },
  googleGlyph: { transform: [{ translateX: -3 }] },
  busyOption: { opacity: 0.48 },
  socialIcon: { width: 24, height: 24 },
  socialText: { color: tokens.color.authInk, fontSize: 14, fontWeight: '500' },
  message: { color: tokens.color.error, marginTop: 12, textAlign: 'center', fontSize: 14 },
  divider: { flexDirection: 'row', height: 22, alignItems: 'center', marginTop: 24 },
  dividerLine: { height: 1, backgroundColor: tokens.color.border },
  dividerLeft: { flex: 1, marginRight: 13 },
  dividerRight: { flex: 114 / 127, marginLeft: 16 },
  dividerText: { color: tokens.color.authHintInk, fontSize: 12, lineHeight: 16, height: 22 },
  status: { color: tokens.color.foreground, marginTop: 100, textAlign: 'center', fontSize: 16 },
});
