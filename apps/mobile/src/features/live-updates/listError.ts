import type { MessageKey } from '../../services/locale';
/** Keep access/dependency failures distinct from a successful empty snapshot. */
export function mainListError(error: unknown, fallback: MessageKey): MessageKey {
  if (typeof error !== 'object' || error === null || !('status' in error)) return fallback;
  if (error.status === 403) return 'mainListDenied';
  if (error.status === 0 || (typeof error.status === 'number' && error.status >= 500))
    return 'mainListUnavailable';
  return fallback;
}
