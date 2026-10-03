import { onboardingRoute } from './routes';

describe('onboarding navigation', () => {
  it('keeps incomplete and underage accounts away from eligible routes', () => {
    expect(onboardingRoute('PROFILE_REQUIRED')).toBe('/profile/basic');
    expect(onboardingRoute('AGE_RESTRICTED')).toBe('/age-restricted');
    expect(onboardingRoute('ELIGIBLE')).toBe('/rooms');
  });
});
