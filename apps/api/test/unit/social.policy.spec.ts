import { SocialError } from '../../src/modules/social/domain/errors/social.error.js';
import { SocialPolicy } from '../../src/modules/social/domain/policies/social.policy.js';
import { socialPayloadHash } from '../../src/modules/social/persistence.js';
import {
  decodeSocialCursor,
  encodeSocialCursor,
} from '../../src/modules/social/application/social-cursor.js';

describe('social policy', () => {
  const policy = new SocialPolicy();
  const left = '00000000-0000-4000-8000-000000000001';
  const right = '00000000-0000-4000-8000-000000000002';

  it('normalizes pairs and rejects self relations', () => {
    expect(policy.pair(right, left)).toEqual([left, right]);
    expect(() => policy.pair(left, left)).toThrow(
      expect.objectContaining({ code: 'SOCIAL_TARGET_UNAVAILABLE' }),
    );
  });

  it('enforces request actors and terminal states', () => {
    const request = { requesterUserId: left, recipientUserId: right, status: 'PENDING' };
    expect(() => policy.assertRequestActor('accept', right, request)).not.toThrow();
    expect(() => policy.assertRequestActor('withdraw', left, request)).not.toThrow();
    expect(() => policy.assertRequestActor('reject', left, request)).toThrow(SocialError);
    expect(() =>
      policy.assertRequestActor('accept', right, { ...request, status: 'REJECTED' }),
    ).toThrow(expect.objectContaining({ code: 'SOCIAL_REQUEST_STATE_CONFLICT' }));
  });

  it('hashes normalized payloads independent of property order', () => {
    expect(socialPayloadHash({ target: right, action: 'accept' })).toBe(
      socialPayloadHash({ action: 'accept', target: right }),
    );
    expect(socialPayloadHash({ action: 'accept', target: right })).not.toBe(
      socialPayloadHash({ action: 'reject', target: right }),
    );
  });

  it('binds opaque cursors to their query kind', () => {
    const value = { createdAt: new Date('2026-09-15T00:00:00.000Z'), id: left };
    const cursor = encodeSocialCursor('friends', value);
    expect(decodeSocialCursor('friends', cursor)).toEqual(value);
    expect(() => decodeSocialCursor('blocks', cursor)).toThrow(
      expect.objectContaining({ code: 'SOCIAL_CURSOR_INVALID' }),
    );
    expect(() => decodeSocialCursor('friends', 'bad')).toThrow(
      expect.objectContaining({ code: 'SOCIAL_CURSOR_INVALID' }),
    );
  });
});
