'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { useApp } from '@/lib/app';
import { PHASE, type Coin } from '@/lib/data';
import { sol, fmt, short, usd } from '@/lib/util';
import { useSolUsd } from '@/lib/price';
import { addressUrl, tokenUrl, txUrl } from '@/lib/sol/config';
import { ago, readTrades, type Trade } from '@/lib/sol/market';
import { BN, PUMP_SDK, bondingCurvePda, lamportsOf, quoteBuy, quoteSell, rawOf, toSol, toTokens } from '@/lib/sol/pump';
import * as trade from '@/lib/sol/trade';
import { SubmittedTransactionError, txError } from '@/lib/sol/errors';
import { confirm, type Wallet } from '@/lib/sol/tx';
import { HpBar, Msg, RigorBadge } from '../ui';
import { Px } from '../Px';

type Interval = '1m' | '5m' | '15m' | '1h' | '1d';
const INTERVALS: Interval[] = ['1m', '5m', '15m', '1h', '1d'];
const SECONDS: Record<Interval, number> = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '1d': 86400 };
const MONO = 'JetBrains Mono, monospace';
/** This coin's latest trades, newest first. */
function useCoinTrades(c: Coin) {
  const app = useApp();
  const q = useQuery({
    queryKey: ['trades', c.id],
    refetchInterval: 15_000,
    queryFn: () => readTrades(app.conn, c),
  });
  return { trades: q.data ?? [], loading: q.isLoading, error: q.isError };
}

/* ---------------- chart ---------------- */
function Chart({ c, iv, trades }: { c: Coin; iv: Interval; trades: ReturnType<typeof useCoinTrades> }) {
  const g = useMemo(() => {
    const step = SECONDS[iv];
    const pts: [number, number][] = [[c.created, c.launchPrice], ...trades.trades.flatMap((t): [number, number][] => (t.time ? [[t.time, t.price]] : []))];
    pts.sort((a, b) => a[0] - b[0]);
    const buckets = new Map<number, [number, number, number, number]>();
    let prev = pts[0][1];
    for (const [t, p] of pts) {
      const k = Math.floor(t / step);
      const b = buckets.get(k);
      if (!b) buckets.set(k, [prev, Math.max(prev, p), Math.min(prev, p), p]);
      else { b[1] = Math.max(b[1], p); b[2] = Math.min(b[2], p); b[3] = p; }
      prev = p;
    }
    const ds = [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v).slice(-56);
    if (ds.length < 1 || trades.trades.length < 1) return null;
    const W = 800, H = 280, L = 8, R = 70, T = 18, B = 26;
    const min = Math.min(...ds.map((d) => d[2])), max = Math.max(...ds.map((d) => d[1]));
    const span = max - min || max * 0.1 || 1;
    const y = (v: number) => T + (1 - (v - (min - span * 0.05)) / (span * 1.1)) * (H - T - B);
    return { ds, y, k: (W - L - R) / Math.max(ds.length, 12), W, H, L, R, min, max };
  }, [c.created, c.launchPrice, trades.trades, iv]);

  if (!g) return <div className="chart-empty muted" style={{ padding: '60px 12px', textAlign: 'center' }}>{trades.loading ? 'Loading candles…' : trades.error ? 'Could not read trades from Solana.' : 'No trades yet. The first buy draws the first candle.'}</div>;
  const { ds, y, k, W, H, L, R, min, max } = g;
  const ly = y(c.price);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Candle chart of ${c.ticker} price, ${iv}`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const v = min + ((max - min) * i) / 4, yy = y(v);
        return (<g key={i}><line x1={L} x2={W - R} y1={yy} y2={yy} stroke="#1b3f94" strokeDasharray="2 5" /><text x={W - R + 8} y={yy + 4} fill="#7fd6ff" fontSize="11" fontFamily={MONO}>{fmt(v)}</text></g>);
      })}
      {ds.map(([o, h, l, cl], i) => {
        const x = L + i * k + k / 2, col = cl >= o ? '#3de8a0' : '#ff5577';
        return (<g key={i}><line x1={x} x2={x} y1={y(h)} y2={y(l)} stroke={col} strokeWidth="2" /><rect x={x - k * 0.3} y={Math.min(y(o), y(cl))} width={k * 0.6} height={Math.max(3, Math.abs(y(o) - y(cl)))} fill={col} /></g>);
      })}
      <line x1={L} x2={W - R} y1={ly} y2={ly} stroke="#ffd23f" strokeDasharray="4 3" />
      <rect x={W - R} y={ly - 10} width={R - 4} height={20} fill="#ffd23f" />
      <text x={W - R + 5} y={ly + 4} fill="#16233f" fontSize="11" fontWeight="700" fontFamily={MONO}>{fmt(c.price)}</text>
    </svg>
  );
}

/* ---------------- trade ---------------- */
type Side = 'buy' | 'sell';
type TradeState = { busy?: boolean; label?: string; ok?: boolean; err?: boolean; msg?: string; tx?: string };

/** The curve account, re-read every few seconds so quotes follow the price. */
function useCurve(c: Coin) {
  const app = useApp();
  return useQuery({
    queryKey: ['curve', c.id],
    enabled: c.phase === 0,
    refetchInterval: 8_000,
    queryFn: async () => {
      const info = await app.conn.getAccountInfo(bondingCurvePda(c.id), 'confirmed');
      const curve = info ? PUMP_SDK.decodeBondingCurveNullable(info) : null;
      if (!curve) throw new Error('curve not found');
      return curve;
    },
  });
}

function TradePanel({ c }: { c: Coin }) {
  const app = useApp();
  const [side, setSide] = useState<Side>('buy');
  const [amt, setAmt] = useState('');
  const [slip, setSlip] = useState('5');
  const [tr, setTr] = useState<TradeState | null>(null);
  const pending = useRef<SubmittedTransactionError | null>(null);
  const running = useRef(false);
  useEffect(() => {
    if (!tr?.busy && !pending.current) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [tr]);
  const curveQ = useCurve(c);
  const curve = curveQ.data;

  const graduated = c.phase > 0 || curve?.complete;
  const buy = side === 'buy', unit = buy ? 'SOL' : '$' + c.ticker;
  const held = app.holdings[c.id] || 0;
  const slipPct = Math.min(50, Math.max(0.1, parseFloat(slip) || 5));
  const input = buy ? lamportsOf(amt) : rawOf(amt);
  const q = curve && app.pump && input
    ? (buy ? quoteBuy(app.pump, curve, input) : quoteSell(app.pump, curve, input))
    : null;
  const recvText = q ? ('tokens' in q ? `${fmt(toTokens(q.tokens))} $${c.ticker}` : `${fmt(toSol(q.lamports))} SOL`) : '';
  const limitText = q && input ? ('tokens' in q ? `${fmt(toSol(input.add(input.mul(new BN(Math.floor(slipPct * 10))).div(new BN(1000)))))} SOL` : `${fmt(toSol(q.lamports) * (1 - slipPct / 100))} SOL`) : '';
  const label = tr?.busy ? tr.label : !app.connected ? 'Insert coin · connect wallet' : `${buy ? 'Buy' : 'Sell'} $${c.ticker}`;

  const run = async (w: Wallet) => {
    if (running.current || pending.current || graduated) return;
    const amount = buy ? lamportsOf(amt) : rawOf(amt);
    if (!amount) { setTr({ err: true, msg: 'Enter an amount first.' }); return; }
    running.current = true;
    try {
      if (!buy && amount.gt(new BN(Math.round(held * 1e6)))) throw new Error(`You only hold ${fmt(held)} $${c.ticker}.`);
      const step = (label: string, sig?: string) => setTr({ busy: true, label, tx: sig });
      const mint = new PublicKey(c.id);
      const r = buy ? await trade.buy(app.conn, w, mint, amount, slipPct, step) : await trade.sell(app.conn, w, mint, amount, slipPct, step);
      const out = 'tokens' in r ? `${fmt(toTokens(r.tokens))} $${c.ticker}` : `${fmt(toSol(r.lamports))} SOL`;
      setTr({ ok: true, tx: r.sig, msg: buy ? `Bought about ${out}.` : `Sold for about ${out}.` });
      setAmt('');
      app.toast('LEVEL UP', `+${out}`);
      void app.refresh();
    } catch (e) {
      if (e instanceof SubmittedTransactionError && e.status === 'unknown') pending.current = e;
      setTr({ err: true, tx: e instanceof SubmittedTransactionError ? e.sig : undefined, msg: txError(e) });
    } finally { running.current = false; }
  };
  const checkPending = async () => {
    const p = pending.current;
    if (!p || running.current) return;
    running.current = true;
    setTr({ busy: true, tx: p.sig, label: 'Checking submitted transaction...' });
    try {
      await confirm(app.conn, p.sig, p.lastValidBlockHeight);
      pending.current = null;
      setTr({ ok: true, tx: p.sig, msg: 'Your submitted transaction is confirmed.' });
      setAmt('');
      void app.refresh();
    } catch (e) {
      if (e instanceof SubmittedTransactionError && e.status !== 'unknown') pending.current = null;
      setTr({ err: true, tx: p.sig, msg: txError(e) });
    } finally { running.current = false; }
  };
  const onTrade = () => app.needWallet('A wallet is needed to trade.', (w) => {
    if (!(buy ? lamportsOf(amt) : rawOf(amt))) { setTr({ err: true, msg: 'Enter an amount first.' }); return; }
    app.needRisk(() => { void run(w); });
  });

  if (graduated) {
    return (
      <div className="trade-body">
        <div className="status">${c.ticker} has finished its curve and graduated. Curve trading is closed.</div>
        {tr?.msg && <div className={`status ${tr.err ? 'bad' : 'ok'}`}>{tr.msg}</div>}
        {tr?.tx && <p><a href={txUrl(tr.tx)} target="_blank" rel="noopener noreferrer">View submitted transaction</a></p>}
        {pending.current && <button className="btn wide" disabled={!!tr?.busy} onClick={() => { void checkPending(); }}>{tr?.busy ? tr.label : 'Check submitted transaction'}</button>}
        <p className="foot-note">Powered by pump.fun · third-party software</p>
      </div>
    );
  }

  return (
    <>
      <div className="sides" role="tablist">
        <button className="b" role="tab" aria-selected={buy} disabled={!!tr?.busy || !!pending.current} onClick={() => { setSide('buy'); setAmt(''); setTr(null); }}>BUY</button>
        <button className="s" role="tab" aria-selected={!buy} disabled={!!tr?.busy || !!pending.current} onClick={() => { setSide('sell'); setAmt(''); setTr(null); }}>SELL</button>
      </div>
      <div className="trade-body">
        <div className="field">
          <div style={{ display: 'flex', justifyContent: 'space-between' }} className="label">
            <label htmlFor="amt">Amount</label>
            <span>{app.connected ? 'Balance ' + (buy ? app.balance.toFixed(4) + ' SOL' : fmt(held)) : 'Wallet not connected'}</span>
          </div>
          <div className="amt"><input id="amt" type="text" inputMode="decimal" autoComplete="off" placeholder="0" value={amt} onChange={(e) => setAmt(e.target.value)} /><span className="unit">{unit}</span></div>
        </div>
        <div className="presets">
          {buy
            ? ['0.01', '0.05', '0.1', '0.5'].map((v) => <button key={v} onClick={() => setAmt(v)}>{v}</button>)
            : [25, 50, 75, 100].map((v) => <button key={v} onClick={() => setAmt(String(Math.floor((held * v) / 100 * 1e6) / 1e6))}>{v === 100 ? 'Max' : v + '%'}</button>)}
        </div>
        {q && (
          <dl className="quote">
            <div><dt>You receive</dt><dd>≈ {recvText}</dd></div>
            <div><dt>{buy ? 'Maximum SOL cost' : 'Minimum SOL received'}</dt><dd>{limitText}</dd></div>
            <div><dt>Price impact (with fees)</dt><dd className={q.impact > 5 ? 'warn' : ''}>{q.impact.toFixed(2)}%</dd></div>
          </dl>
        )}
        {input && curve && !q && <div className="status bad">That amount is too small or too large for this curve.</div>}
        {curveQ.isError && <div className="status bad">Could not read this curve from Solana. Try again in a moment.</div>}
        <label className="slip">Slippage <input type="number" min={0.5} max={50} step={0.5} value={slip} onChange={(e) => setSlip(e.target.value)} aria-label="Slippage percent" /> %</label>
        <button className={`btn ${buy ? 'buy' : 'sell'} wide`} onClick={pending.current ? () => { void checkPending(); } : onTrade} disabled={!!tr?.busy || (!pending.current && app.connected && !curve)}>{tr?.busy ? tr.label : pending.current ? 'Check submitted transaction' : label}</button>
        {tr?.msg && <div className={`status ${tr.ok ? 'ok' : tr.err ? 'bad' : ''}`}>{tr.msg}{tr.tx && <> <a href={txUrl(tr.tx)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>View tx {short(tr.tx)}</a></>}</div>}
        {tr?.busy && tr.tx && <div className="status"><a href={txUrl(tr.tx)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>Tx {short(tr.tx)}</a></div>}
        <p className="foot-note">Powered by pump.fun · third-party software</p>
        <p className="foot-note">SOL limits exclude transaction fees and account rent. Keep this page open while a transaction is pending.</p>
      </div>
    </>
  );
}

/* ---------------- tabs ---------------- */
function Trades({ c, trades }: { c: Coin; trades: ReturnType<typeof useCoinTrades> }) {
  const rows = trades.trades.slice(0, 20);
  if (!rows.length) return <p className="muted">{trades.loading ? 'Reading trades…' : `No trades yet for $${c.ticker}.`}</p>;
  return (
    <div className="scroll-x">
      <table className="list">
        <thead><tr><th>Side</th><th>Trader</th><th className="r">SOL</th><th className="r">Price</th><th className="r">When</th></tr></thead>
        <tbody>{rows.map((t: Trade) => (
          <tr key={t.sig}>
            <td className={t.side === 'buy' ? 'buy-t' : 'sell-t'}>{t.side.toUpperCase()}</td>
            <td><a href={addressUrl(t.trader)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{short(t.trader)}</a></td>
            <td className="r">{fmt(t.sol)}</td><td className="r">{fmt(t.price)}</td>
            <td className="r"><a href={txUrl(t.sig)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{t.time ? `${ago(t.time)} ago` : 'view'}</a></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function TabPanel({ c, tab, trades }: { c: Coin; tab: string; trades: ReturnType<typeof useCoinTrades> }) {
  const app = useApp();
  if (tab === 'trades') return <Trades c={c} trades={trades} />;
  if (tab === 'callouts') {
    const m = app.msgs.filter((x) => x.coinId === c.id);
    return m.length ? <div className="feed">{m.map((x) => <Msg key={x.id} m={x} />)}</div> : <p className="muted">No callouts for this coin yet.</p>;
  }
  if (tab === 'contract') {
    return (
      <dl className="review" style={{ margin: 0 }}>
        <div><dt>Mint</dt><dd className="mono"><a href={tokenUrl(c.address)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{c.address}</a></dd></div>
        <div><dt>Bonding curve</dt><dd className="mono"><a href={addressUrl(c.curve)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{c.curve}</a></dd></div>
        <div><dt>Creator</dt><dd className="mono"><a href={addressUrl(c.creator)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{c.creator}</a></dd></div>
      </dl>
    );
  }
  if (!c.native) return (<><p className="muted">This coin wasn&apos;t launched on Theorem, so it carries no theorem. Its description:</p><p>{c.blurb}</p></>);
  return (
    <>
      <div className="theorem screen" style={{ boxShadow: 'none', borderWidth: '0 0 0 10px', borderColor: 'var(--coin)' }}><small>Theorem</small>{c.statement}</div>
      <p className="muted">Rigor <RigorBadge r={c.rigor} /> {c.rigor == null ? 'Not scored yet. Scores are AI estimates of how precisely a statement is written.' : `${c.rigorNote ? c.rigorNote + ' ' : ''}An AI estimate of how precisely the statement is written. It is not a proof check.`} Lean verification is not available in this build.</p>
    </>
  );
}

/* ---------------- page ---------------- */
export function CoinView({ id }: { id: string }) {
  useSolUsd();
  const app = useApp();
  const c = app.getCoin(id);
  const [iv, setIv] = useState<Interval>('5m');
  const [tab, setTab] = useState('trades');

  if (!c) {
    if (!app.market.ready && !app.market.error) {
      return <div className="screen gate-card"><div className="insert">LOADING…</div><p>Reading coins from Solana.</p></div>;
    }
    return (
      <div className="screen gate-card">
        <div className="insert">GAME OVER</div>
        <p>{app.market.error ?? 'No coin with that address on this board.'}</p>
        <Link className="btn" href="/explore">Back to index</Link>
      </div>
    );
  }
  return <CoinPage c={c} iv={iv} setIv={setIv} tab={tab} setTab={setTab} />;
}

function CoinPage({ c, iv, setIv, tab, setTab }: { c: Coin; iv: Interval; setIv: (i: Interval) => void; tab: string; setTab: (t: string) => void }) {
  const app = useApp();
  const trades = useCoinTrades(c);
  const tabs: [string, string][] = [['trades', 'Trades'], ['callouts', 'Callouts'], ['theorem', 'Theorem'], ['contract', 'Contract']];
  return (
    <>
      <Link className="crumb" href="/explore">← Back to index</Link>
      <div className="detail">
        <div className="detail-main">
          <div className="coin-head">
            <Px seed={c.id} logo={c.logo} large />
            <div>
              <h1>${c.ticker} <span className="muted" style={{ color: 'var(--hero-dim)', fontSize: '.6em' }}>{c.name}</span></h1>
              <div className="sub">{c.native ? c.statement : c.blurb}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                {c.native && <RigorBadge r={c.rigor} />}
                <div className="share">
                  <button className="btn sm ghost" onClick={() => { void navigator.clipboard?.writeText(location.href).catch(() => {}); app.toast('COPIED', 'Link copied.'); }}>Copy link</button>
                  <a className="btn sm ghost" href={`https://x.com/intent/post?text=${encodeURIComponent('$' + c.ticker + ' on Theorem')}`} target="_blank" rel="noopener noreferrer">Post on X</a>
                </div>
              </div>
            </div>
          </div>
          <div className="kv on-dark">
            <div><span className="label" style={{ color: 'var(--hero-faint)' }}>Price</span><span className="v">{sol(c.price)}</span></div>
            <div><span className="label" style={{ color: 'var(--hero-faint)' }}>MCap</span><span className="v">{usd(c.mcap)}</span></div>
            <div><span className="label" style={{ color: 'var(--hero-faint)' }}>Raised</span><span className="v">{sol(c.raised)}</span></div>
            <div><span className="label" style={{ color: 'var(--hero-faint)' }}>Since launch</span><span className={`v ${c.change >= 0 ? 'up' : 'down'}`}>{c.change >= 0 ? '+' : ''}{c.change.toFixed(1)}%</span></div>
          </div>
          <div className="chart crt">
            <div className="chart-bar">
              <span>Price (SOL)</span>
              <div className="seg" role="group" aria-label="Chart interval">{INTERVALS.map((i) => <button key={i} aria-pressed={iv === i} onClick={() => setIv(i)}>{i}</button>)}</div>
            </div>
            <div><Chart c={c} iv={iv} trades={trades} /></div>
            <div className="chart-foot">
              <div className="row"><span>{c.phase === 0 ? `Curve ${Math.floor(c.progress * 100)}% → PumpSwap` : PHASE[c.phase]}</span><span>launched {c.age} ago by {short(c.creator)}</span></div>
              <HpBar p={c.progress} />
            </div>
          </div>
          <div className="screen">
            <div className="tabs" role="tablist">{tabs.map(([i, l]) => <button key={i} role="tab" aria-selected={tab === i} onClick={() => setTab(i)}>{l}</button>)}</div>
            <div className="tabpanel"><TabPanel c={c} tab={tab} trades={trades} /></div>
          </div>
        </div>
        <aside className="screen trade" aria-label="Trade"><TradePanel key={c.id} c={c} /></aside>
      </div>
    </>
  );
}
