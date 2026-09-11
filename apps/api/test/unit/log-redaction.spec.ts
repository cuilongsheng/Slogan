import { Writable } from 'node:stream';

import pino from 'pino';

import { LOG_REDACTION } from '../../src/infrastructure/observability/log-redaction.js';

describe('structured log redaction', () => {
  it('removes authorization codes, tokens, room passwords, digests and client secrets', () => {
    let output = '';
    const destination = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        output += chunk.toString('utf8');
        callback();
      },
    });
    const logger = pino({ redact: LOG_REDACTION }, destination);

    logger.info({
      req: {
        headers: { authorization: 'Bearer private-access-token' },
        body: {
          authorizationCode: 'private-code',
          refreshToken: 'private-refresh-token',
          password: 'room-pin-1234',
        },
      },
      provider: {
        clientSecret: 'private-provider-secret',
        passwordDigest: 'private-room-digest',
        roomPasswordPepper: 'private-room-pepper',
      },
    });

    expect(output).not.toContain('private-access-token');
    expect(output).not.toContain('private-code');
    expect(output).not.toContain('private-refresh-token');
    expect(output).not.toContain('private-provider-secret');
    expect(output).not.toContain('room-pin-1234');
    expect(output).not.toContain('private-room-digest');
    expect(output).not.toContain('private-room-pepper');
    expect(output).toContain('[REDACTED]');
  });
});
