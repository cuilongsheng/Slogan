import type { DirectApi, TimelineEntry, TimelinePage } from './api';
import { LatestRequestQueue } from '../../services/latestRequestQueue';
export type ChatTimelineSnapshot = {
  items: TimelineEntry[];
  visibleAfterSequence: number;
  older: string | null;
  sync: string | null;
  hasOlder: boolean;
  loading: boolean;
  loadingOlder: boolean;
  error: boolean;
};
const empty = (): ChatTimelineSnapshot => ({
  items: [],
  visibleAfterSequence: 0,
  older: null,
  sync: null,
  hasOlder: false,
  loading: true,
  loadingOlder: false,
  error: false,
});
export class ChatTimeline {
  private snapshot = empty();
  private listeners = new Set<() => void>();
  private beforeListeners = new Set<() => void>();
  private queue = new LatestRequestQueue();
  private generation = 0;
  private olderPending: Promise<void> | undefined;
  constructor(
    private readonly api: Pick<DirectApi, 'timeline'>,
    private readonly conversationId: string,
    readonly owner = '',
  ) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  beforeChange = (listener: () => void) => {
    this.beforeListeners.add(listener);
    return () => {
      this.beforeListeners.delete(listener);
    };
  };
  private update(patch: Partial<ChatTimelineSnapshot>) {
    for (const fn of this.beforeListeners) fn();
    this.snapshot = { ...this.snapshot, ...patch };
    for (const fn of this.listeners) fn();
  }
  private merge(page: Pick<TimelinePage, 'items' | 'visibleAfterSequence'>) {
    const boundary = Math.max(this.snapshot.visibleAfterSequence, page.visibleAfterSequence);
    const rows = new Map(this.snapshot.items.map((e) => [`${e.kind}:${e.value.id}`, e]));
    for (const next of page.items) {
      const key = `${next.kind}:${next.value.id}`,
        prior = rows.get(key);
      if (!prior || next.revision >= prior.revision) rows.set(key, next);
    }
    return {
      visibleAfterSequence: boundary,
      items: [...rows.values()]
        .filter((e) => e.value.sequence > boundary)
        .sort((a, b) => a.value.sequence - b.value.sequence),
    };
  }
  refresh = (current: () => boolean) => {
    const generation = this.generation;
    return this.queue.enqueue(async () => {
      const live = () => generation === this.generation && current();
      if (!live()) return;
      try {
        let after = this.snapshot.sync;
        for (;;) {
          const page = await this.api.timeline(this.conversationId, after ? { after } : {});
          if (!live()) return;
          const initial = !this.snapshot.sync;
          this.update({
            ...this.merge(page),
            sync: page.syncCursor,
            loading: false,
            error: false,
            ...(initial ? { older: page.nextBeforeCursor, hasOlder: page.hasOlder } : {}),
          });
          if (!page.hasMoreChanges) break;
          if (!page.nextAfterCursor || page.nextAfterCursor === after)
            throw new Error('Non-advancing timeline');
          after = page.nextAfterCursor;
        }
      } catch {
        if (live()) this.update({ loading: false, error: true });
      }
    });
  };
  older = (current: () => boolean) => {
    if (this.olderPending || !this.snapshot.older || !this.snapshot.hasOlder)
      return this.olderPending ?? Promise.resolve();
    const generation = this.generation,
      before = this.snapshot.older;
    this.update({ loadingOlder: true });
    const request = (async () => {
      const live = () => generation === this.generation && current();
      try {
        const page = await this.api.timeline(this.conversationId, { before });
        if (live())
          this.update({
            ...this.merge(page),
            older: page.nextBeforeCursor,
            hasOlder: page.hasOlder,
            error: false,
          });
      } catch {
        if (live()) this.update({ error: true });
      } finally {
        if (generation === this.generation) this.update({ loadingOlder: false });
      }
    })().finally(() => {
      if (this.olderPending === request) this.olderPending = undefined;
    });
    this.olderPending = request;
    return request;
  };
  mergeOwn = (entry: TimelineEntry) =>
    this.update(
      this.merge({ items: [entry], visibleAfterSequence: this.snapshot.visibleAfterSequence }),
    );
  reset = () => {
    this.generation++;
    this.olderPending = undefined;
    this.update(empty());
  };
  dispose = () => {
    this.generation++;
    this.listeners.clear();
    this.beforeListeners.clear();
  };
}
