import { ChatTimeline } from './chatTimeline';
import type { TimelineEntry, TimelinePage } from './api';
const text = (sequence: number): TimelineEntry => ({
  kind: 'text',
  revision: sequence,
  value: {
    id: `text-${sequence}`,
    conversationId: 'conversation',
    senderUserId: 'peer',
    clientRequestId: `request-${sequence}`,
    sequence,
    text: `Text ${sequence}`,
    createdAt: '2026-10-15T00:00:00Z',
  },
});
const page = (items: TimelineEntry[], patch: Partial<TimelinePage> = {}): TimelinePage => ({
  items,
  visibleAfterSequence: 0,
  nextBeforeCursor: null,
  hasOlder: false,
  syncCursor: 'sync-1',
  nextAfterCursor: null,
  hasMoreChanges: false,
  ...patch,
});
test('initial latest window and independent older cursor never auto-walk history', async () => {
  const api = {
    timeline: jest
      .fn()
      .mockResolvedValueOnce(
        page(
          Array.from({ length: 20 }, (_, i) => text(i + 46)),
          { nextBeforeCursor: 'before-46', hasOlder: true },
        ),
      )
      .mockResolvedValueOnce(
        page([text(44), text(45)], { syncCursor: 'newer-than-not-yet-read', hasOlder: false }),
      )
      .mockResolvedValueOnce(page([text(66)], { syncCursor: 'sync-66' })),
  };
  const model = new ChatTimeline(api, 'conversation');
  await model.refresh(() => true);
  expect(api.timeline).toHaveBeenCalledTimes(1);
  expect(api.timeline).toHaveBeenCalledWith('conversation', {});
  await model.older(() => true);
  expect(model.getSnapshot().sync).toBe('sync-1');
  await model.refresh(() => true);
  expect(api.timeline).toHaveBeenLastCalledWith('conversation', { after: 'sync-1' });
  expect(model.getSnapshot().items.map((e) => e.value.sequence)).toEqual(
    Array.from({ length: 23 }, (_, i) => i + 44),
  );
});
test('invalidation arriving during an active query queues bounded newer changes without duplicate rows', async () => {
  let finish!: (p: TimelinePage) => void;
  const api = {
    timeline: jest
      .fn()
      .mockImplementationOnce(() => new Promise<TimelinePage>((r) => (finish = r)))
      .mockResolvedValueOnce(
        page([text(2)], { syncCursor: 'sync-2', hasMoreChanges: true, nextAfterCursor: 'after-2' }),
      )
      .mockResolvedValueOnce(page([text(2), text(3)], { syncCursor: 'sync-3' })),
  };
  const model = new ChatTimeline(api, 'conversation');
  const first = model.refresh(() => true);
  await Promise.resolve();
  const second = model.refresh(() => true);
  finish(page([text(1)]));
  await Promise.all([first, second]);
  expect(api.timeline).toHaveBeenCalledTimes(3);
  expect(model.getSnapshot().items.map((e) => e.value.sequence)).toEqual([1, 2, 3]);
  expect(model.getSnapshot().sync).toBe('sync-3');
});
test('late older pages cannot resurrect personally hidden content or overwrite a newer revision', async () => {
  let finish!: (p: TimelinePage) => void;
  const api = {
    timeline: jest
      .fn()
      .mockResolvedValueOnce(page([text(21)], { nextBeforeCursor: 'older', hasOlder: true }))
      .mockImplementationOnce(() => new Promise<TimelinePage>((r) => (finish = r)))
      .mockResolvedValueOnce(page([text(31)], { visibleAfterSequence: 30, syncCursor: 'sync-31' })),
  };
  const model = new ChatTimeline(api, 'conversation');
  await model.refresh(() => true);
  const older = model.older(() => true);
  await model.refresh(() => true);
  finish(page([text(1), text(2)]));
  await older;
  expect(model.getSnapshot().items.map((e) => e.value.sequence)).toEqual([31]);
  let resolve!: (p: TimelinePage) => void;
  api.timeline.mockImplementationOnce(() => new Promise<TimelinePage>((r) => (resolve = r)));
  const pending = model.refresh(() => true);
  await Promise.resolve();
  model.reset();
  resolve(page([text(100)]));
  await pending;
  expect(model.getSnapshot().items).toEqual([]);
});
test('background/account fences reject responses and repeated older edge callbacks share one request', async () => {
  let finish!: (p: TimelinePage) => void,
    alive = true;
  const api = {
    timeline: jest
      .fn()
      .mockResolvedValueOnce(page([text(21)], { nextBeforeCursor: 'older', hasOlder: true }))
      .mockImplementationOnce(() => new Promise<TimelinePage>((r) => (finish = r))),
  };
  const model = new ChatTimeline(api, 'conversation');
  await model.refresh(() => alive);
  const a = model.older(() => alive),
    b = model.older(() => alive);
  expect(a).toBe(b);
  alive = false;
  finish(page([text(1)]));
  await a;
  expect(model.getSnapshot().items.map((e) => e.value.sequence)).toEqual([21]);
});
