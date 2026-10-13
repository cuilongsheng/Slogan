import type { MicrophoneCheck } from './voiceDeviceCheck';

// Holds a capability result only; never retains an audio stream or track.
export class MicrophoneProbeCache {
  private verifiedAt = -Infinity;
  private generation = 0;
  constructor(private readonly now = () => Date.now()) {}

  invalidate(): void {
    this.generation++;
    this.verifiedAt = -Infinity;
  }

  async check(
    granted: boolean,
    force: boolean,
    signal: AbortSignal,
    probe: () => Promise<MicrophoneCheck>,
  ): Promise<MicrophoneCheck> {
    if (signal.aborted) return 'unavailable';
    if (!granted || force) this.invalidate();
    if (granted && this.now() - this.verifiedAt < 300_000) return 'ready';
    const generation = this.generation;
    const result = await probe();
    if (signal.aborted) return 'unavailable';
    if (generation === this.generation) {
      this.verifiedAt = result === 'ready' ? this.now() : -Infinity;
    }
    return result;
  }
}
