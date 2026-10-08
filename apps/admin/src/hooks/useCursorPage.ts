import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

export function useCursorPage<T>(
  key: readonly unknown[],
  load: (cursor?: string) => Promise<{ items: T[]; nextCursor: string | null }>,
  options: { refetchInterval?: number } = {},
) {
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const cursor = cursors.at(-1);
  const query = useQuery({ queryKey: [...key, cursor], queryFn: () => load(cursor), ...options });
  return {
    ...query,
    rows: query.data?.items ?? [],
    page: cursors.length,
    canNext: Boolean(query.data?.nextCursor),
    next: () => {
      if (query.data?.nextCursor) setCursors((current) => [...current, query.data!.nextCursor!]);
    },
    previous: () => setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current)),
    reset: () => setCursors([undefined]),
  };
}
