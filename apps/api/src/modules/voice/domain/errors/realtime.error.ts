export class RealtimeError extends Error {
  constructor(public readonly code: 'REALTIME_PROVIDER_UNAVAILABLE' | 'REALTIME_WEBHOOK_INVALID') {
    super(
      code === 'REALTIME_WEBHOOK_INVALID'
        ? 'Invalid realtime webhook'
        : 'Realtime provider is unavailable',
    );
    this.name = 'RealtimeError';
  }
}
