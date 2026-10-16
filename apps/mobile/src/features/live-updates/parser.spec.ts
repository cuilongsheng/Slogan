import { EventStreamParser, liveEnvelope } from './parser';
test('decodes fragmented CRLF frames and never emits incomplete messages or comments', () => {
  const events: unknown[] = [];
  const parser = new EventStreamParser((data, id) => events.push({ data, id }));
  for (const part of [
    ': heartbeat\r',
    '\n\r\nid: account-bound\r\nda',
    'ta: {"scope":"messages"}\r',
    '\n',
    '\r\n',
  ])
    parser.push(part);
  expect(events).toEqual([{ data: { scope: 'messages' }, id: 'account-bound' }]);
  parser.push('data: {"scope":"rooms"}\n');
  expect(events).toHaveLength(1);
  parser.push('\n');
  expect(events).toHaveLength(2);
});
test('caps accumulated incomplete frames and rejects malformed event JSON', () => {
  const parser = new EventStreamParser(() => {});
  expect(() => parser.push('x'.repeat(16385))).toThrow('limit');
  expect(() => new EventStreamParser(() => {}).push('data: broken\n\n')).toThrow();
});
test('a large network chunk containing many individually bounded frames is valid', () => {
  const events: unknown[] = [];
  const parser = new EventStreamParser((data) => events.push(data));
  parser.push('data: {"scope":"messages"}\n\n'.repeat(1000));
  expect(events).toHaveLength(1000);
});

test('accepts future event scopes so their recovery IDs can advance, and rejects invalid envelopes', () => {
  expect(
    liveEnvelope({
      scope: 'future-event',
      resourceId: '915261f9-28de-4e64-bb21-f1795b1b77f8',
      kind: 'future-kind',
    }),
  ).toEqual({
    scope: 'future-event',
    resourceId: '915261f9-28de-4e64-bb21-f1795b1b77f8',
    kind: 'future-kind',
  });
  for (const value of [
    null,
    [],
    {},
    { scope: '' },
    { scope: 1 },
    { scope: 'x'.repeat(65) },
    { scope: 'calls', resourceId: '-'.repeat(36) },
    { scope: 'calls', resourceId: 'bad' },
    { scope: 'calls', kind: '' },
    { scope: 'calls', kind: 1 },
  ])
    expect(() => liveEnvelope(value)).toThrow('unavailable');
});
