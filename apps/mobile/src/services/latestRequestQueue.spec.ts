import { LatestRequestQueue } from './latestRequestQueue';

test('a returning focus refresh runs after an older fetch, coalescing multiple waiting refreshes', async () => {
  const queue = new LatestRequestQueue();
  let complete!: () => void;
  const first = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  const superseded = jest.fn(async () => {});
  const newest = jest.fn(async () => {});
  const pending = queue.enqueue(first);
  await Promise.resolve();
  queue.enqueue(superseded);
  queue.enqueue(newest);
  expect(newest).not.toHaveBeenCalled();
  complete();
  await pending;
  expect(first).toHaveBeenCalledTimes(1);
  expect(superseded).not.toHaveBeenCalled();
  expect(newest).toHaveBeenCalledTimes(1);
});
