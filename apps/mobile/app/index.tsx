import { Redirect } from 'expo-router';

import { BrandLoading } from '../src/components/ui/BrandLoading';
import { useAuth } from '../src/features/auth/context';
import { onboardingRoute } from '../src/features/auth/routes';

export default function IndexRoute() {
  const { state } = useAuth();
  if (state.kind === 'loading') return <BrandLoading />;
  if (state.kind === 'signedIn')
    return <Redirect href={onboardingRoute(state.me.onboardingState)} />;
  return <Redirect href="/sign-in" />;
}
