import { type ReactNode } from 'react';
import { Redirect } from 'expo-router';
import { Text } from 'react-native';

import { AuthPage } from '../../components/ui/AuthPage';
import { t, useLanguage } from '../../services/locale';
import { useAuth } from './context';
import { onboardingRoute } from './routes';

export function Gate({
  allow,
  children,
}: {
  allow:
    | 'PROFILE_REQUIRED'
    | 'AGE_RESTRICTED'
    | 'ELIGIBLE'
    | Array<'PROFILE_REQUIRED' | 'AGE_RESTRICTED' | 'ELIGIBLE'>;
  children: ReactNode;
}) {
  useLanguage();
  const { state } = useAuth();
  if (state.kind === 'loading')
    return (
      <AuthPage>
        <Text>{t('signingIn')}</Text>
      </AuthPage>
    );
  if (state.kind === 'error') return <Redirect href="/sign-in" />;
  if (state.kind === 'signedOut') return <Redirect href="/sign-in" />;
  if (
    !(Array.isArray(allow)
      ? allow.includes(state.me.onboardingState)
      : state.me.onboardingState === allow)
  )
    return <Redirect href={onboardingRoute(state.me.onboardingState)} />;
  return <>{children}</>;
}
