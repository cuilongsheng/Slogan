import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

export function useCursorPage<Page extends { items: unknown[]; nextCursor: string | null }>(
  key: readonly unknown[],
  load: (cursor?: string) => Promise<Page>,
  options: { refetchInterval?: number } = {},
) {
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const cursor = cursors.at(-1);
  const query = useQuery({ queryKey: [...key, cursor], queryFn: () => load(cursor), ...options });
  return {
    ...query,
    rows: (query.data?.items ?? []) as Page['items'],
    page: cursors.length,
    canNext: Boolean(query.data?.nextCursor),
    next: () => {
      if (query.data?.nextCursor) setCursors((current) => [...current, query.data!.nextCursor!]);
    },
    previous: () => setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current)),
    reset: () => setCursors([undefined]),
  };
}
