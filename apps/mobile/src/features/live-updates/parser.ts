import type { SloganApiPaths } from '@slogan/api-client';
export type LiveEvent =
  SloganApiPaths['/v1/me/live-updates']['get']['responses'][200]['content']['text/event-stream'];
/** Incremental SSE parser: a partial UTF-8/codepoint or CRLF boundary is never a message. */
export class EventStreamParser {
  private buffer = '';
  private id = '';
  private data: string[] = [];
  constructor(private readonly onEvent: (data: unknown, id: string) => void) {}
  push(text: string) {
    this.buffer += text;
    let end: number;
    while ((end = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, end).replace(/\r$/, '');
      this.buffer = this.buffer.slice(end + 1);
      if (!line) {
        if (this.data.length) this.onEvent(JSON.parse(this.data.join('\n')), this.id);
        this.data = [];
        this.id = '';
        continue;
      }
      if (line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'id' && !value.includes('\0')) this.id = value;
      if (field === 'data') this.data.push(value);
      if (this.data.join('\n').length > 8192) throw new Error('Live frame exceeds limit');
    }
    if (this.buffer.length > 16384) throw new Error('Live frame exceeds limit');
  }
}

export function liveEnvelope(value: unknown): LiveEvent {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('scope' in value) ||
    typeof value.scope !== 'string' ||
    !value.scope ||
    value.scope.length > 64 ||
    ('resourceId' in value &&
      (typeof value.resourceId !== 'string' ||
        !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value.resourceId))) ||
    ('kind' in value && (typeof value.kind !== 'string' || !value.kind || value.kind.length > 24))
  )
    throw new Error('Live event unavailable');
  return value as LiveEvent;
}
