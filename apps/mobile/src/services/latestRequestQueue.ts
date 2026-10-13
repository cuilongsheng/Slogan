/** Serialize refreshes and keep only the newest request waiting behind an active one. */
export class LatestRequestQueue {
  private pending: Promise<void> | null = null;
  private next: (() => Promise<void>) | null = null;

  enqueue(work: () => Promise<void>): Promise<void> {
    this.next = work;
    if (this.pending) return this.pending;
    const drain = async () => {
      while (this.next) {
        const next = this.next;
        this.next = null;
        await next();
      }
    };
    // Start in a microtask so pending is set even when work completes synchronously.
    const request = Promise.resolve()
      .then(drain)
      .finally(() => {
        if (this.pending === request) this.pending = null;
      });
    this.pending = request;
    return request;
  }
}
