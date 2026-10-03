import { Redirect } from 'expo-router';
import { Text } from 'react-native';

import { AuthPage } from '../src/components/ui/AuthPage';
import { useAuth } from '../src/features/auth/context';
import { onboardingRoute } from '../src/features/auth/routes';
import { t } from '../src/services/locale';

export default function IndexRoute() {
  const { state } = useAuth();
  if (state.kind === 'loading')
    return (
      <AuthPage>
        <Text>{t('signingIn')}</Text>
      </AuthPage>
    );
  if (state.kind === 'signedIn')
    return <Redirect href={onboardingRoute(state.me.onboardingState)} />;
  return <Redirect href="/sign-in" />;
}
