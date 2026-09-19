import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../src/config/environment.js';
import { RoomSpeechRiskPolicy } from '../../src/modules/speech-safety/index.js';
import { testEnvironment } from '../fixtures/environment.js';

describe('RoomSpeechRiskPolicy', () => {
  const policy = new RoomSpeechRiskPolicy(
    new ConfigService<Environment, true>(
      testEnvironment({ ROOM_SPEECH_RULE_SET_VERSION: 'rules-v1' }),
    ),
  );

  it('returns a versioned controlled category without exposing the matched text', () => {
    expect(policy.classify('I will attack you')).toEqual({
      category: 'THREAT_VIOLENCE',
      severity: 'HIGH',
      ruleSetVersion: 'rules-v1',
    });
    expect(policy.classify('normal language practice')).toBeNull();
  });
});
