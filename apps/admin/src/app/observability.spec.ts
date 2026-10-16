import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Sentry from '@sentry/react';
import { Component, createElement, act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

describe('Admin actual SDK and final transport boundary', () => {
  const envelopes: string[] = [];
  beforeEach(() => {
    vi.resetModules();
    envelopes.length = 0;
    vi.stubEnv('VITE_OBSERVABILITY_ENABLED', 'true');
    vi.stubEnv('VITE_OBSERVABILITY_ENVIRONMENT', 'test');
    vi.stubEnv('VITE_OBSERVABILITY_RELEASE', 'slogan-admin@abcdef123456');
    vi.stubEnv('VITE_OBSERVABILITY_BUILD', 'abcdef123456');
    vi.stubEnv('VITE_SENTRY_DSN', 'https://0123456789abcdef@o123.ingest.us.sentry.io/123');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: unknown, init?: RequestInit) => {
        envelopes.push(String(init?.body));
        return new Response('', { status: 200 });
      }),
    );
  });
  afterEach(async () => {
    await Sentry.close();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it('sends real SDK HTTP spans without private request or identity contents', async () => {
    vi.stubEnv('VITE_SENTRY_TRACES_SAMPLE_RATE', '1');
    await import('./observability');
    const { traceAdminFetch, rememberAdminRequest } = await import('./tracing');
    const request = new Request(
      'https://api.example.test/v1/rooms/PRIVATE_CANARY?secret=PRIVATE_CANARY',
    );
    rememberAdminRequest(request, '/v1/rooms/{roomId}');
    await traceAdminFetch(
      request,
      undefined,
      async (_input, init) => {
        expect(new Headers(init?.headers).get('sentry-trace')).toMatch(
          /^[a-f0-9]{32}-[a-f0-9]{16}-1$/,
        );
        return new Response('PRIVATE_CANARY', { status: 200 });
      },
      'https://api.example.test',
    );
    await Sentry.flush(1000);
    expect(envelopes.join()).toContain('GET /v1/rooms/{roomId}');
    expect(envelopes.join()).not.toContain('PRIVATE_CANARY');
    expect(envelopes.join()).toContain('sentry.environment');
  });
  it('captures a React boundary error while preserving its existing fallback', async () => {
    const { adminReactErrorHandlers } = await import('./observability');
    class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
      override state = { failed: false };
      static getDerivedStateFromError() {
        return { failed: true };
      }
      override render() {
        return this.state.failed
          ? createElement('div', null, 'Existing fallback')
          : this.props.children;
      }
    }
    function Crash(): ReactNode {
      throw new Error('PRIVATE_CANARY');
    }
    const container = document.createElement('div');
    const root = createRoot(container, adminReactErrorHandlers);
    await act(async () => {
      root.render(createElement(Boundary, null, createElement(Crash)));
    });
    expect(container.textContent).toBe('Existing fallback');
    await Sentry.flush(1000);
    expect(envelopes).toHaveLength(1);
    expect(envelopes.join()).not.toContain('PRIVATE_CANARY');
    await act(async () => {
      root.unmount();
    });
  });

  it('keeps response/result and legal correlation, suppresses denial and cancellation, scrubs content', async () => {
    const { observeAdminFetch, reportAdminError, clearAdminObservability } =
      await import('./observability');
    await observeAdminFetch(async () => new Response('PRIVATE_BODY', { status: 401 }));
    const cancellation = new DOMException('PRIVATE_CANCEL', 'AbortError');
    await expect(
      observeAdminFetch(async () => {
        throw cancellation;
      }),
    ).rejects.toBe(cancellation);
    const response = new Response('PRIVATE_BODY', {
      status: 503,
      headers: { 'x-request-id': 'a1b2c3d4-e5f6-4abc-8def-123456789abc' },
    });
    expect(await observeAdminFetch(async () => response, true)).toBe(response);
    const error = new Error('PRIVATE_CANARY');
    reportAdminError(error, { stage: 'render' });
    reportAdminError(error);
    clearAdminObservability();
    reportAdminError(new Error('PRIVATE_CANARY'));
    await Sentry.flush(1000);
    expect(envelopes).toHaveLength(3);
    expect(envelopes.join()).not.toMatch(/PRIVATE_/);
    expect(envelopes.join()).toContain('a1b2c3d4-e5f6-4abc-8def-123456789abc');
    expect(envelopes[0]).not.toContain('stacktrace');
  });

  it('keeps the business rejection when ingest fails and makes disabled handlers inert', async () => {
    const { observeAdminFetch } = await import('./observability');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ingest unavailable');
      }),
    );
    const failure = new TypeError('PRIVATE_NETWORK');
    await expect(
      observeAdminFetch(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    await Sentry.flush(1000);
    await Sentry.close();
    vi.resetModules();
    vi.stubEnv('VITE_OBSERVABILITY_ENABLED', 'false');
    const disabled = await import('./observability');
    expect(disabled.adminReactErrorHandlers).toEqual({});
    expect(
      await disabled.observeAdminFetch(async () => new Response('', { status: 503 })),
    ).toHaveProperty('status', 503);
  });
});
