'use client';
import { useApp } from '@/lib/app';

const bold = (t: string) => t.split(/(\$[A-Z0-9]+|[\d.]+ SOL)/g).map((x, i) => (i % 2 ? <b key={i}>{x}</b> : x));

export function Ticker() {
  const app = useApp();
  const items = app.msgs.filter((m) => m.kind === 'sys').slice(0, 8).map((m) => m.text);
  const row = items.length ? items : ['WAITING FOR THE FIRST LAUNCH ON SOLANA', 'LAUNCH A COIN TO START THE BOARD'];
  const rep = [...row, ...row];
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-in">{rep.map((t, i) => <span key={i}>{bold(t)}</span>)}</div>
    </div>
  );
}
