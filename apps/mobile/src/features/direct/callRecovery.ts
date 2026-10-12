import { randomUUID } from 'expo-crypto';
import type { DirectApi } from './api';
type EndCommand = { owner: string; callId: string; action: 'end' | 'reject'; requestId: string };
const pending = new Map<string, EndCommand>();
const executing = new Map<string, Promise<void>>();
export function locallyEnded(callId: string) {
  return pending.has(callId);
}
export function queueCallEnd(owner: string, callId: string, action: 'end' | 'reject' = 'end') {
  if (!pending.has(callId)) pending.set(callId, { owner, callId, action, requestId: randomUUID() });
}
export async function flushCallEnds(owner: string, api: DirectApi): Promise<void> {
  if (executing.has(owner)) return executing.get(owner);
  const work = (async () => {
    for (const [id, command] of pending) {
      if (command.owner !== owner) continue;
      try {
        await api.callAction(id, command.action, command.requestId);
        pending.delete(id);
      } catch {
        try {
          const call = await api.call(id);
          if (!['ACTIVE', 'RINGING'].includes(call.status)) pending.delete(id);
        } catch {
          /* A foreground retry or server heartbeat expiry owns recovery. */
        }
      }
    }
  })();
  executing.set(owner, work);
  try {
    await work;
  } finally {
    executing.delete(owner);
  }
}
