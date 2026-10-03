import { useState } from 'react';
import { router } from 'expo-router';
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { AuthPage, PrimaryButton } from '../../components/ui/AuthPage';
import { t } from '../../services/locale';
import { tokens } from '../../styles/tokens';
import {
  confirmEmail,
  emailAuthMessage,
  registerEmail,
  requestPasswordReset,
  resendEmail,
  resetPassword,
} from './emailApi';
import { useEmailFlow } from './emailFlow';
import { useEmailLinkToken } from './emailLink';
import mailIcon from '../../../assets/icons/email-verification.png';
import backIcon from '../../../assets/icons/auth-back.png';

const usernameValid = (value: string) => /^[A-Za-z0-9_]{3,20}$/.test(value.trim());
const emailValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const passwordValid = (value: string) => [...value].length >= 8 && [...value].length <= 128;

function FlowHeader({
  title,
  description,
  step,
}: {
  title: string;
  description: string;
  step?: 1 | 2;
}) {
  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          onPress={() => router.replace('/sign-in')}
        >
          <Image source={backIcon} style={styles.back} />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      </View>
      <Text style={styles.description}>{description}</Text>
      {step && (
        <View style={styles.progressBlock}>
          <Text style={styles.step}>{step === 1 ? t('accountStepOne') : t('accountStepTwo')}</Text>
          <View style={styles.track}>
            <View style={[styles.progress, { width: step === 1 ? '50%' : '100%' }]} />
          </View>
        </View>
      )}
    </>
  );
}

function Input({
  label,
  placeholder,
  value,
  onChangeText,
  secure = false,
  email = false,
  testID,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText(value: string): void;
  secure?: boolean;
  email?: boolean;
  testID: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={email ? 'email-address' : 'default'}
        secureTextEntry={secure}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.color.muted}
        style={styles.input}
        testID={testID}
      />
    </View>
  );
}

function Feedback({ message }: { message: string | null }) {
  return message ? (
    <Text accessibilityRole="alert" style={styles.feedback}>
      {message}
    </Text>
  ) : null;
}

function BackToLogin({ label }: { label: string }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => router.replace('/sign-in')}
      style={styles.returnAction}
    >
      <Text style={styles.action}>{label}</Text>
    </TouchableOpacity>
  );
}

export function RegisterScreen() {
  const { setEnrollment } = useEmailFlow();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    if (!usernameValid(username) || !emailValid(email) || !passwordValid(password)) {
      setMessage(t('registrationInputInvalid'));
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await registerEmail({
        username: username.trim(),
        email: email.trim(),
        password,
      });
      setPassword('');
      setEnrollment({
        email: email.trim(),
        managementToken: result.managementToken,
        resendAt: result.resendAt,
      });
      router.replace('/email/verify');
    } catch (error) {
      setMessage(emailAuthMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthPage scroll>
      <FlowHeader title={t('createAccount')} description={t('createAccountDescription')} step={1} />
      <View style={styles.registrationFields}>
        <Input
          label={t('username')}
          placeholder={t('registrationUsernamePlaceholder')}
          value={username}
          onChangeText={setUsername}
          testID="registration-username"
        />
        <Input
          label={t('email')}
          placeholder="name@example.com"
          value={email}
          onChangeText={setEmail}
          email
          testID="registration-email"
        />
        <Input
          label={t('password')}
          placeholder={t('registrationPasswordPlaceholder')}
          value={password}
          onChangeText={setPassword}
          secure
          testID="registration-password"
        />
      </View>
      <Text style={styles.note}>{t('registrationNote')}</Text>
      <View style={styles.registrationButton}>
        <PrimaryButton
          label={busy ? t('submitting') : t('registerAndVerify')}
          onPress={() => void submit()}
          disabled={busy}
          testID="registration-submit"
        />
      </View>
      <Feedback message={message} />
      <BackToLogin label={t('haveAccountReturn')} />
    </AuthPage>
  );
}

function maskedEmail(value: string): string {
  const [name, domain] = value.split('@');
  if (!name || !domain) return '';
  return `${name.slice(0, 1)}•••@${domain}`;
}

export function VerifyEmailScreen() {
  const { enrollment, setEnrollment } = useEmailFlow();
  const linkToken = useEmailLinkToken('REGISTER');
  const [processedToken, setProcessedToken] = useState<string | null>(null);
  const token = linkToken === processedToken ? null : linkToken;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const confirm = async () => {
    if (busy) return;
    if (!token) {
      setMessage(t('openVerificationLink'));
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await confirmEmail(token);
      setProcessedToken(token);
      setVerified(true);
      setEnrollment(null);
    } catch (error) {
      setMessage(emailAuthMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!enrollment || busy) return;
    if (Date.now() < Date.parse(enrollment.resendAt)) {
      setMessage(t('verificationCooldown'));
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const resendAt = await resendEmail(enrollment.managementToken);
      setEnrollment({ ...enrollment, resendAt });
      setMessage(t('verificationResent'));
    } catch (error) {
      setMessage(emailAuthMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthPage scroll>
      <FlowHeader
        title={t('verifyEmailTitle')}
        description={t('verifyEmailDescription')}
        step={2}
      />
      <View style={styles.mailIllustration}>
        <Image source={mailIcon} style={styles.mailIcon} />
      </View>
      <Text style={styles.mailHeading}>
        {verified ? t('verificationComplete') : t('verificationSent')}
      </Text>
      <View style={styles.emailCard}>
        <Text style={styles.emailCardText}>
          {enrollment
            ? `${t('sentTo')}  ${maskedEmail(enrollment.email)}`
            : t('verificationLinkCard')}
        </Text>
      </View>
      <View style={styles.verifyButton}>
        <PrimaryButton
          label={
            verified ? t('returnToLogin') : busy ? t('submitting') : t('completedVerification')
          }
          onPress={() => (verified ? router.replace('/sign-in') : void confirm())}
          disabled={busy}
          testID="verification-confirm"
        />
      </View>
      <Feedback message={message} />
      {!verified && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => void resend()}
          style={[styles.returnAction, styles.resendAction]}
        >
          <Text style={styles.action}>{t('resendVerification')}</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.help}>{t('verificationHelp')}</Text>
      {!enrollment && !verified && <BackToLogin label={t('returnToLogin')} />}
    </AuthPage>
  );
}

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submit = async () => {
    if (busy) return;
    if (!emailValid(email)) {
      setMessage(t('invalidEmail'));
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await requestPasswordReset(email.trim());
      setAccepted(true);
    } catch (error) {
      setMessage(emailAuthMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthPage scroll>
      <FlowHeader title={t('forgotPasswordTitle')} description={t('forgotPasswordDescription')} />
      <View style={styles.guide}>
        <Text style={styles.guideTitle}>{t('protectAccount')}</Text>
        <Text style={styles.guideCopy}>{t('resetLinkWarning')}</Text>
      </View>
      {!accepted && (
        <View style={styles.forgotField}>
          <Input
            label={t('registeredEmail')}
            placeholder="name@example.com"
            value={email}
            onChangeText={setEmail}
            email
            testID="forgot-email"
          />
        </View>
      )}
      <View style={styles.forgotButton}>
        <PrimaryButton
          label={accepted ? t('returnToLogin') : busy ? t('submitting') : t('sendResetEmail')}
          onPress={() => (accepted ? router.replace('/sign-in') : void submit())}
          disabled={busy}
          testID="forgot-submit"
        />
      </View>
      {accepted && <Text style={styles.accepted}>{t('resetRequestAccepted')}</Text>}
      <Feedback message={message} />
      {!accepted && <BackToLogin label={t('rememberedPassword')} />}
    </AuthPage>
  );
}

export function ResetPasswordScreen() {
  const linkToken = useEmailLinkToken('RESET_PASSWORD');
  const [processedToken, setProcessedToken] = useState<string | null>(null);
  const token = linkToken === processedToken ? null : linkToken;
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submit = async () => {
    if (busy) return;
    if (!token) {
      setMessage(t('resetLinkMissing'));
      return;
    }
    if (!passwordValid(password) || password !== repeat) {
      setMessage(t('resetPasswordInvalid'));
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await resetPassword(token, password);
      setProcessedToken(token);
      setPassword('');
      setRepeat('');
      setDone(true);
    } catch (error) {
      setMessage(emailAuthMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthPage scroll>
      <FlowHeader title={t('resetPasswordTitle')} description={t('resetPasswordDescription')} />
      {done ? (
        <Text style={styles.accepted}>{t('passwordUpdated')}</Text>
      ) : (
        <View style={styles.resetFields}>
          <Input
            label={t('newPassword')}
            placeholder={t('registrationPasswordPlaceholder')}
            value={password}
            onChangeText={setPassword}
            secure
            testID="reset-password"
          />
          <Input
            label={t('confirmPassword')}
            placeholder={t('confirmPassword')}
            value={repeat}
            onChangeText={setRepeat}
            secure
            testID="reset-repeat"
          />
        </View>
      )}
      <View style={styles.forgotButton}>
        <PrimaryButton
          label={done ? t('returnToLogin') : busy ? t('submitting') : t('updatePassword')}
          onPress={() => (done ? router.replace('/sign-in') : void submit())}
          disabled={busy}
          testID="reset-submit"
        />
      </View>
      <Feedback message={message} />
      {!done && <BackToLogin label={t('returnToLogin')} />}
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', height: 40 },
  back: { width: 24, height: 24, marginRight: 14 },
  title: { fontSize: 24, fontWeight: '700', color: tokens.color.foreground },
  description: {
    marginTop: 8,
    minHeight: 42,
    color: tokens.color.muted,
    fontSize: 12,
    lineHeight: 22,
  },
  progressBlock: { marginTop: 8 },
  step: { color: tokens.color.purple, fontSize: 12, lineHeight: 24 },
  track: { marginTop: 7, height: 4, borderRadius: 2, backgroundColor: tokens.color.border },
  progress: { height: 4, borderRadius: 2, backgroundColor: tokens.color.coral },
  registrationFields: { marginTop: 15 },
  fieldGroup: { marginBottom: 14 },
  label: {
    color: tokens.color.foreground,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 3,
  },
  input: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.panel,
    paddingHorizontal: 16,
    color: tokens.color.foreground,
    fontSize: 16,
  },
  note: { marginTop: 1, color: tokens.color.muted, fontSize: 12, lineHeight: 22 },
  registrationButton: { marginTop: 50 },
  feedback: { marginTop: 12, color: tokens.color.error, fontSize: 13, textAlign: 'center' },
  returnAction: { marginTop: 30, alignItems: 'center' },
  resendAction: { marginTop: 24 },
  action: { color: tokens.color.purple, fontSize: 13, fontWeight: '600' },
  mailIllustration: {
    alignSelf: 'center',
    marginTop: 31,
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: tokens.color.purpleSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mailIcon: { width: 54, height: 54 },
  mailHeading: {
    marginTop: 21,
    textAlign: 'center',
    color: tokens.color.foreground,
    fontSize: 20,
    fontWeight: '700',
  },
  emailCard: {
    marginTop: 28,
    height: 58,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: 16,
    backgroundColor: tokens.color.panel,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  emailCardText: { color: tokens.color.foreground, fontSize: 14 },
  verifyButton: { marginTop: 44 },
  help: {
    marginTop: 30,
    color: tokens.color.muted,
    fontSize: 12,
    lineHeight: 22,
    textAlign: 'center',
  },
  guide: {
    marginTop: 7,
    height: 86,
    borderRadius: 18,
    backgroundColor: tokens.color.purpleSoft,
    padding: 16,
  },
  guideTitle: { color: tokens.color.foreground, fontSize: 13, fontWeight: '600' },
  guideCopy: { marginTop: 5, color: tokens.color.muted, fontSize: 12, lineHeight: 22 },
  forgotField: { marginTop: 46 },
  forgotButton: { marginTop: 27 },
  accepted: {
    marginTop: 32,
    color: tokens.color.foreground,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 24,
  },
  resetFields: { marginTop: 30 },
});
