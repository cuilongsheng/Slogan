import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { Environment } from '../../src/config/environment.js';
import { AuthService, SessionService } from '../../src/modules/auth/index.js';
import { ProfilePolicy, ProfilesService } from '../../src/modules/profiles/index.js';
import {
  FakeOAuthProviderRegistry,
  MemoryAuthRepository,
  MemoryProfileRepository,
} from '../fixtures/fakes.js';
import { testEnvironment } from '../fixtures/environment.js';

describe('AuthService', () => {
  it('creates one account per verified identity and keeps provider profile fields as suggestions', async () => {
    const authRepository = new MemoryAuthRepository();
    const profileRepository = new MemoryProfileRepository();
    const profiles = new ProfilesService(profileRepository, new ProfilePolicy());
    const sessions = new SessionService(
      authRepository,
      new JwtService(),
      new ConfigService<Environment, true>(testEnvironment()),
    );
    const service = new AuthService(
      new FakeOAuthProviderRegistry(),
      authRepository,
      sessions,
      profiles,
    );
    const input = { authorizationCode: 'stable-subject', redirectUri: 'slogan://oauth/google' };

    const first = await service.exchange('GOOGLE', input);
    const second = await service.exchange('GOOGLE', input);

    expect(first).toMatchObject({
      created: true,
      onboardingState: 'PROFILE_REQUIRED',
      suggestedProfile: { displayName: 'Suggested only' },
    });
    expect(second).toMatchObject({
      userId: first.userId,
      created: false,
      onboardingState: 'PROFILE_REQUIRED',
    });
    await expect(profileRepository.findByUserId(first.userId)).resolves.toBeNull();
  });
});
