export { SocialModule } from './social.module.js';
export { SocialService } from './application/services/social.service.js';
export { SocialError } from './domain/errors/social.error.js';
export { SOCIAL_PRESENCE } from './domain/ports/presence.port.js';
export type { SocialPresence } from './domain/ports/presence.port.js';
export {
  isSocialPairBlocked,
  lockSocialPair,
  readSocialUserEligible,
  runSocialCommand,
} from './persistence.js';
