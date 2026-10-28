'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { PHASE, type Coin, type ChatMsg } from '@/lib/data';
import { sol, usd } from '@/lib/util';
import { coinCanvas } from '@/lib/sprites';
import { useApp } from '@/lib/app';
import { Px } from './Px';

export const rigorTier = (r: number | null) => (r == null ? 'lo' : r >= 85 ? 'hi' : r >= 60 ? 'mid' : 'lo');

export function RigorBadge({ r }: { r: number | null }) {
  return <span className={`badge ${rigorTier(r)}`} title="Rigor score. An AI estimate, not a proof check.">Σ {r == null ? '—' : r}</span>;
}
export function FormalBadge() {
  return <span className="badge formal" title="Formally verified with a Lean 4 proof">FORMAL ✓</span>;
}

/** 20-segment pixel health bar used for bonding-curve progress. */
export function HpBar({ p }: { p: number }) {
  const n = Math.round(p * 20);
  return (
    <div className="hp" role="progressbar" aria-valuenow={Math.round(p * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Graduation progress">
      {Array.from({ length: 20 }, (_, i) => <i key={i} className={i < n ? (p > 0.8 ? 'on warn' : 'on') : ''} />)}
    </div>
  );
}

export const changeColor = (v: number) => (v >= 0 ? 'var(--mint-ink)' : 'var(--loss-ink)');

export function CoinCard({ c, rank, vol }: { c: Coin; rank?: number; vol?: boolean }) {
  return (
    <Link href={`/coin/${c.id}`} className="cart" aria-label={`$${c.ticker} ${c.name}`}>
      {rank ? <span className="rank">#{rank}</span> : null}
      <span className="start">PRESS START</span>
      <span className="cart-head">
        <Px seed={c.id} />
        <span className="cart-names"><b>${c.ticker}</b><span>{c.name}</span></span>
      </span>
      <span className="cart-badges">
        {c.native ? <RigorBadge r={c.rigor} /> : <span className="badge">PUMP</span>}
      </span>
      <span className="cart-stmt">{c.native ? c.statement : c.blurb}</span>
      <span className="cart-row">
        <span>{vol ? 'Raised' : 'MC'} <b>{vol ? sol(c.raised) : usd(c.mcap)}</b></span>
        <span style={{ color: changeColor(c.change) }}>{c.change >= 0 ? '▲' : '▼'} {Math.abs(c.change).toFixed(1)}%</span>
      </span>
      <HpBar p={c.progress} />
      <span className="cart-row">
        <span>{c.phase === 0 ? `${Math.floor(c.progress * 100)}% to graduate` : PHASE[c.phase]}</span>
        <span>{c.age} ago</span>
      </span>
    </Link>
  );
}

export function GateNote() {
  const app = useApp();
  return (
    <div className="gate">
      <span className={`led ${app.connected ? '' : 'off'}`} />
      <span>A wallet is needed to launch or trade. Browsing is open.</span>
    </div>
  );
}

export function BigCoin() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { ref.current?.getContext('2d')!.drawImage(coinCanvas(32), 0, 0); }, []);
  return <canvas ref={ref} className="bigcoin" width={32} height={32} />;
}

export function CabArt({ draw }: { draw: (ctx: CanvasRenderingContext2D) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current; if (c) draw(c.getContext('2d')!); }, [draw]);
  return <canvas ref={ref} width={45} height={27} aria-hidden="true" />;
}

export function Msg({ m }: { m: ChatMsg }) {
  const app = useApp();
  const c = app.getCoin(m.coinId);
  return (
    <div className={`screen msg ${m.kind === 'sys' ? 'sys' : ''}`}>
      <Px seed={m.who} />
      <div>
        <div className="msg-top">
          <b>{m.who}</b>
          {c && <Link href={`/coin/${c.id}`} style={{ color: 'var(--ink)' }}>${c.ticker}</Link>}
          <span>{m.ago}</span>
        </div>
        <p>{m.text}</p>
        {m.kind === 'user' && (
          <div className="reacts">
            {([['r', '🚀'], ['e', '👀'], ['s', '💀']] as const).map(([k, ic]) => (
              <button key={k} className={`react ${m.me[k] ? 'me' : ''}`} aria-label={`React ${ic}`}
                onClick={() => app.needWallet('A wallet is needed to react.', () => app.react(m.id, k))}>{ic} {m.re[k]}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
