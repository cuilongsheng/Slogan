import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';

import type { CountryCode } from 'libphonenumber-js/max';

import type { NormalizedPhone } from '../entities/phone-auth.js';
import { AuthError } from '../errors/auth.error.js';

const require = createRequire(import.meta.url);
const { parsePhoneNumberFromString } =
  require('libphonenumber-js/max') as typeof import('libphonenumber-js/max');

export class PhonePolicy {
  constructor(
    private readonly lookupVersion: string,
    private readonly identityPepper: string,
    private readonly supportedRegions: ReadonlySet<string>,
  ) {}

  normalize(value: string, defaultRegion?: string): NormalizedPhone {
    const region = defaultRegion?.toUpperCase();
    const phone = parsePhoneNumberFromString(value, region as CountryCode | undefined);
    if (!phone?.isValid() || phone.country === undefined) {
      throw new AuthError('PHONE_INVALID', 'Phone number is invalid');
    }
    if (!this.supportedRegions.has(phone.country)) {
      throw new AuthError('PHONE_REGION_UNSUPPORTED', 'Phone region is unsupported');
    }
    const e164 = phone.number;
    return {
      e164,
      lookupVersion: this.lookupVersion,
      lookupHash: createHmac('sha256', this.identityPepper).update(e164).digest('hex'),
      countryCallingCode: phone.countryCallingCode,
      lastTwo: e164.slice(-2),
      region: phone.country,
    };
  }
}
