'use client';
import { useSyncExternalStore } from 'react';
import { setSolUsd } from './util';

/** Live SOL/USD, fetched from /api/price (server-cached). Falls back to the fixed sample rate until it loads. */
type State = { usd: number; live: boolean; source: string };
const FALLBACK = Number(process.env.NEXT_PUBLIC_SOL_USD || 150);
let state: State = { usd: FALLBACK, live: false, source: 'fixed' };
const subs = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let inflight = false;

const emit = () => subs.forEach((f) => f());

async function refresh() {
  if (inflight) return;
  inflight = true;
  try {
    const res = await fetch('/api/price', { cache: 'no-store' });
    if (!res.ok) return;
    const j = (await res.json()) as { usd?: unknown; live?: unknown; source?: unknown };
    if (typeof j.usd !== 'number' || !Number.isFinite(j.usd) || j.usd <= 0) return;
    const next: State = { usd: j.usd, live: j.live === true, source: String(j.source ?? 'fixed') };
    if (next.usd === state.usd && next.live === state.live) return;
    state = next;
    setSolUsd(next.usd);
    emit();
  } catch {
    /* keep the previous value */
  } finally {
    inflight = false;
  }
}

function subscribe(cb: () => void) {
  subs.add(cb);
  if (subs.size === 1) {
    void refresh();
    timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 60_000);
  }
  return () => {
    subs.delete(cb);
    if (!subs.size && timer) { clearInterval(timer); timer = undefined; }
  };
}

/** Subscribe a component to the live rate so `usd()` output re-renders when it changes. */
export function useSolUsd(): State {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
