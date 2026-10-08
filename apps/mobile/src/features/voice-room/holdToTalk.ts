import type { PrivateClip } from '../../services/privateClip.types';
export type HoldPhase =
  'idle' | 'starting' | 'recording' | 'stopping' | 'translating' | 'result' | 'error';
export interface HoldState {
  phase: HoldPhase;
  error: unknown;
  text: string | null;
}
export interface HoldPorts {
  mute(): Promise<boolean>;
  restore(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<PrivateClip | null>;
  discard(): void;
  translate(clip: PrivateClip, requestId: string, signal: AbortSignal): Promise<string>;
  requestId(): string;
}
// One gesture owns startup, recording, stop and upload. Release can arrive before start resolves.
export class HoldToTalk {
  state: HoldState = { phase: 'idle', error: null, text: null };
  private listeners = new Set<(state: HoldState) => void>();
  private intent: 'hold' | 'send' | 'cancel' = 'hold';
  private operation: Promise<void> | null = null;
  private finish: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private clip: PrivateClip | null = null;
  private id = '';
  private generation = 0;
  private muted = false;
  private uploadAbort: AbortController | null = null;
  constructor(private readonly ports: HoldPorts) {}
  subscribe(listener: (state: HoldState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private update(patch: Partial<HoldState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }
  press() {
    if (
      !['idle', 'result', 'error'].includes(this.state.phase) ||
      this.operation ||
      this.finish ||
      this.muted
    )
      return;
    this.ports.discard();
    this.clip = null;
    this.id = this.ports.requestId();
    this.intent = 'hold';
    this.generation++;
    this.update({ phase: 'starting', error: null, text: null });
    const op = this.begin().finally(() => {
      if (this.operation === op) this.operation = null;
    });
    this.operation = op;
  }
  private async begin() {
    try {
      if (!(await this.ports.mute())) throw new Error('PRIVATE_MIC_NOT_MUTED');
      this.muted = true;
      if (this.intent === 'cancel') {
        await this.restore();
        return;
      }
      await this.ports.start();
      this.update({ phase: 'recording' });
      if (this.intent !== 'hold') await this.stopAndSend();
      else
        this.timer = setTimeout(() => {
          void this.release();
        }, 10000);
    } catch (error) {
      // stop before restoring even when recorder startup only partially succeeded
      try {
        await this.ports.stop();
        await this.restore();
      } catch {
        /* retain safe mute */
      }
      this.update({ phase: this.intent === 'cancel' ? 'idle' : 'error', error });
    }
  }
  async release() {
    if (
      this.intent === 'cancel' ||
      !['starting', 'recording', 'stopping'].includes(this.state.phase)
    )
      return;
    this.intent = 'send';
    if (this.operation) await this.operation;
    if (this.state.phase === 'recording') await this.stopAndSend();
    if (this.finish) await this.finish;
  }
  private stopAndSend() {
    if (this.finish) return this.finish;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const generation = this.generation;
    const op = (async () => {
      this.update({ phase: 'stopping' });
      try {
        this.clip = await this.ports.stop();
        await this.restore();
        if (this.intent === 'cancel' || generation !== this.generation) {
          this.ports.discard();
          this.clip = null;
          this.update({ phase: 'idle' });
          return;
        }
        if (!this.clip) throw new Error('PRIVATE_AUDIO_UNAVAILABLE');
        await this.upload(generation);
      } catch (error) {
        if (generation === this.generation) this.update({ phase: 'error', error });
      }
    })().finally(() => {
      if (this.finish === op) this.finish = null;
    });
    this.finish = op;
    return op;
  }
  private async restore() {
    if (this.muted) {
      await this.ports.restore();
      this.muted = false;
    }
  }
  private async upload(generation: number) {
    if (!this.clip) return;
    this.update({ phase: 'translating', error: null });
    const abort = new AbortController();
    this.uploadAbort = abort;
    let text: string;
    try {
      text = await this.ports.translate(this.clip, this.id, abort.signal);
    } finally {
      if (this.uploadAbort === abort) this.uploadAbort = null;
    }
    if (generation !== this.generation) return;
    this.ports.discard();
    this.clip = null;
    this.update({ phase: 'result', text });
  }
  async retry() {
    if (this.state.phase !== 'error' || !this.clip || this.finish) return;
    const generation = this.generation;
    const op = (async () => {
      try {
        await this.restore();
        if (generation !== this.generation) return;
        await this.upload(generation);
      } catch (error) {
        if (generation === this.generation) this.update({ phase: 'error', error });
      }
    })().finally(() => {
      if (this.finish === op) this.finish = null;
    });
    this.finish = op;
    await op;
  }
  async cancel() {
    this.intent = 'cancel';
    this.generation++;
    this.uploadAbort?.abort();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.operation) await this.operation;
    if (this.state.phase === 'recording') await this.stopAndSend();
    if (this.finish) await this.finish;
    if (this.muted) {
      try {
        await this.ports.stop();
        await this.restore();
      } catch (error) {
        this.update({ phase: 'error', error });
        return;
      }
    }
    this.ports.discard();
    this.clip = null;
    this.update({ phase: 'idle', error: null, text: null });
  }
}
