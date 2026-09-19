import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../../config/environment.js';
import type { RiskClassification } from '../entities/room-speech-safety.js';

const RULES: Array<{
  pattern: RegExp;
  category: RiskClassification['category'];
  severity: RiskClassification['severity'];
}> = [
  { pattern: /\b(kill|hurt|attack|weapon|bomb)\b/i, category: 'THREAT_VIOLENCE', severity: 'HIGH' },
  { pattern: /\b(hate|racist|inferior)\b/i, category: 'HATE_DISCRIMINATION', severity: 'HIGH' },
  { pattern: /\b(nude|sexual|porn)\b/i, category: 'SEXUAL_CONTENT', severity: 'HIGH' },
  { pattern: /\b(idiot|stupid|harass|abuse)\b/i, category: 'HARASSMENT_ABUSE', severity: 'MEDIUM' },
  { pattern: /\b(buy now|promo|advertis|spam)\b/i, category: 'SPAM_ADVERTISING', severity: 'LOW' },
];

@Injectable()
export class RoomSpeechRiskPolicy {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  classify(transcript: string): RiskClassification | null {
    const normalized = transcript.normalize('NFKC').trim();
    const match = RULES.find((rule) => rule.pattern.test(normalized));
    return match
      ? {
          category: match.category,
          severity: match.severity,
          ruleSetVersion: this.config.get('ROOM_SPEECH_RULE_SET_VERSION', { infer: true }),
        }
      : null;
  }
}
