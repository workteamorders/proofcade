'use client';
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { Rigor } from './rigor';

const MAX_COINS = 40;

/** Fetch the AI rigor estimate for each Theorem statement once. Missing scores stay null, so the badge shows a dash. */
export function useRigor(statements: string[]): Record<string, Rigor> {
  const unique = useMemo(() => Array.from(new Set(statements)).slice(0, MAX_COINS), [statements]);
  const results = useQueries({
    queries: unique.map((s) => ({
      queryKey: ['rigor', s],
      staleTime: Infinity,
      gcTime: Infinity,
      retry: false,
      queryFn: async (): Promise<Rigor | null> => {
        const r = await fetch(`/api/rigor?s=${encodeURIComponent(s)}`);
        if (r.status === 503) return null; /* switched off: do not keep asking */
        if (!r.ok) throw new Error('rigor unavailable');
        return (await r.json()) as Rigor;
      },
    })),
  });
  return useMemo(() => {
    const out: Record<string, Rigor> = {};
    unique.forEach((s, i) => { const d = results[i]?.data; if (d) out[s] = d; });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unique, results.map((r) => r.dataUpdatedAt).join(',')]);
}
