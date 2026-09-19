import { ConfigService } from '@nestjs/config';
import { spyOn } from 'jest-mock';

import type { Environment } from '../../src/config/environment.js';
import { HttpSmsAdapter } from '../../src/modules/auth/testing.js';
import { testEnvironment } from '../fixtures/environment.js';

describe('HTTP SMS adapter', () => {
  it('sends only the delivery contract and normalizes provider failures', async () => {
    const fetchMock = spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 202 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }));
    const adapter = new HttpSmsAdapter(
      new ConfigService<Environment, true>(
        testEnvironment({
          SMS_PROVIDER_BASE_URL: 'http://localhost:4999/send',
          SMS_PROVIDER_API_KEY: 'provider-secret',
          SMS_PROVIDER_TIMEOUT_MS: 1000,
        }),
      ),
    );
    const input = {
      to: '+8613800138000',
      code: '123456',
      template: 'login',
      sender: 'Slogan',
      locale: 'zh-CN',
      correlationId: 'correlation',
    };
    await expect(adapter.send(input)).resolves.toBeUndefined();
    const request = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String((request[1] as RequestInit).body))).toEqual(input);
    expect(String((request[1] as RequestInit).body)).not.toContain('accessToken');
    await expect(adapter.send(input)).rejects.toMatchObject({ code: 'SMS_PROVIDER_UNCERTAIN' });
    fetchMock.mockRestore();
  });

  it('reports timeouts without retrying an uncertain send', async () => {
    const fetchMock = spyOn(globalThis, 'fetch').mockImplementation(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const adapter = new HttpSmsAdapter(
      new ConfigService<Environment, true>(
        testEnvironment({
          SMS_PROVIDER_BASE_URL: 'http://localhost:4999/send',
          SMS_PROVIDER_API_KEY: 'provider-secret',
          SMS_PROVIDER_TIMEOUT_MS: 500,
        }),
      ),
    );
    await expect(
      adapter.send({
        to: '+12025550123',
        code: '123456',
        template: 'login',
        sender: 'Slogan',
        correlationId: 'correlation',
      }),
    ).rejects.toMatchObject({ code: 'SMS_PROVIDER_TIMEOUT' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
  });
});
