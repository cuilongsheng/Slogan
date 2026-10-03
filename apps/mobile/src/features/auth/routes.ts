import type { Me } from './session';

export function onboardingRoute(
  state: Me['onboardingState'],
): '/profile/basic' | '/age-restricted' | '/rooms' {
  switch (state) {
    case 'PROFILE_REQUIRED':
      return '/profile/basic';
    case 'AGE_RESTRICTED':
      return '/age-restricted';
    case 'ELIGIBLE':
      return '/rooms';
  }
}
