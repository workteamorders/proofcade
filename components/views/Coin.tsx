'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/lib/app';
import { PHASE, type Coin } from '@/lib/data';
import { addrOf, eth, fmt, hex, rng, short } from '@/lib/util';
import { FormalBadge, HpBar, Msg, RigorBadge } from '../ui';
import { Px } from '../Px';
import { useSubmitProof } from '../SubmitProof';

type Interval = '1m' | '5m' | '15m' | '1h' | '1d';
const INTERVALS: Interval[] = ['1m', '5m', '15m', '1h', '1d'];
const MONO = 'JetBrains Mono, monospace';

/* ---------------- chart ---------------- */
function Chart({ c, iv }: { c: Coin; iv: Interval }) {
  const g = useMemo(() => {
    const r = rng(c.id + iv), N = 56, W = 800, H = 280, L = 8, R = 70, T = 18, B = 26;
    const vol = { '1m': 0.02, '5m': 0.035, '15m': 0.05, '1h': 0.07, '1d': 0.12 }[iv];
    const drift = c.change >= 0 ? 0.004 : -0.003;
    let p = 1;
    const ds: [number, number, number, number][] = [];
    for (let i = 0; i < N; i++) {
      const o = p, cl = Math.max(0.15, o * (1 + (r() - 0.47) * vol + drift));
      ds.push([o, Math.max(o, cl) * (1 + r() * vol * 0.5), Math.min(o, cl) * (1 - r() * vol * 0.5), cl]); p = cl;
    }
    const min = Math.min(...ds.map((d) => d[2])), max = Math.max(...ds.map((d) => d[1]));
    const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
    const k = (W - L - R) / N, last = ds[N - 1][3], base = c.price / last;
    return { ds, y, k, W, H, L, R, min, max, base, last };
  }, [c.id, c.change, c.price, iv]);
  const { ds, y, k, W, H, L, R, min, max, base, last } = g;
  const ly = y(last);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Candle chart of ${c.ticker} price, ${iv}`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const v = min + ((max - min) * i) / 4, yy = y(v);
        return (<g key={i}><line x1={L} x2={W - R} y1={yy} y2={yy} stroke="#1b3f94" strokeDasharray="2 5" /><text x={W - R + 8} y={yy + 4} fill="#7fd6ff" fontSize="11" fontFamily={MONO}>{fmt(v * base)}</text></g>);
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
type Quote = { a: number; out: number; min: number; impact: number; fee: number; recv: string; minS: string };

function quoteFor(c: Coin, side: Side, amt: string, slipStr: string): Quote | null {
  const a = parseFloat(amt.replace(',', '.'));
  if (!(a > 0)) return null;
  const slip = Math.max(0, 1 - (parseFloat(slipStr) || 5) / 100);
  if (side === 'buy') {
    const fee = a * 0.01, out = (a - fee) / c.price;
    return { a, out, min: out * slip, impact: (a / (c.mcap + a)) * 200, fee, recv: `${fmt(out)} $${c.ticker}`, minS: `${fmt(out * slip)} $${c.ticker}` };
  }
  const out = a * c.price * 0.99;
  return { a, out, min: out * slip, impact: ((a * c.price) / (c.mcap + a * c.price)) * 200, fee: a * c.price * 0.01, recv: `${fmt(out)} ETH`, minS: `${fmt(out * slip)} ETH` };
}

type TradeState = { busy?: boolean; label?: string; ok?: boolean; err?: boolean; msg?: string };

function TradePanel({ c }: { c: Coin }) {
  const app = useApp();
  const [side, setSide] = useState<Side>('buy');
  const [amt, setAmt] = useState('');
  const [slip, setSlip] = useState('5');
  const [tr, setTr] = useState<TradeState | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  if (c.phase > 0) {
    return (
      <div className="trade-body">
        <div className="status">${c.ticker} has finished its curve. Its Uniswap V4 pool is being seeded, so curve trading is closed.</div>
        <p className="foot-note">Powered by Pons · Pons V2 is unaudited</p>
      </div>
    );
  }
  const buy = side === 'buy', held = app.holdings[c.id] || 0, unit = buy ? 'ETH' : '$' + c.ticker;
  const q = quoteFor(c, side, amt, slip);
  const label = tr?.busy ? tr.label : !app.connected ? 'Insert coin · connect wallet' : `${buy ? 'Buy' : 'Sell'} $${c.ticker}`;

  const run = (qq: Quote) => {
    const check = app.validateTrade(c, side, qq.a);
    if (!check.ok) { setTr({ err: true, msg: check.msg }); return; }
    const seq: [string, number][] = [['Approve in your wallet…', 700], ['Confirming approval…', 900], ['Confirm in your wallet…', 700], ['Confirming on Robinhood Chain…', 1100]];
    let i = 0;
    const step = () => {
      if (i < seq.length) { setTr({ busy: true, label: seq[i][0] }); timers.current.push(setTimeout(step, seq[i][1])); i++; return; }
      app.applyTrade(c, side, qq.a, qq.out);
      const tx = `0x${hex(rng('tx' + Date.now()), 6)}…`;
      setTr({ ok: true, msg: buy ? `Bought ${fmt(qq.out)} $${c.ticker}. Tx ${tx}` : `Sold for ${fmt(qq.out)} ETH. Tx ${tx}` });
      setAmt('');
      app.toast('LEVEL UP', buy ? `+${fmt(qq.out)} $${c.ticker}` : `+${fmt(qq.out)} ETH`);
    };
    step();
  };
  const onTrade = () => app.needWallet('A wallet is needed to trade.', () => {
    const qq = quoteFor(c, side, amt, slip);
    if (!qq) { setTr({ err: true, msg: 'Enter an amount first.' }); return; }
    app.needRisk(() => run(qq));
  });

  return (
    <>
      <div className="sides" role="tablist">
        <button className="b" role="tab" aria-selected={buy} onClick={() => { setSide('buy'); setAmt(''); setTr(null); }}>BUY</button>
        <button className="s" role="tab" aria-selected={!buy} onClick={() => { setSide('sell'); setAmt(''); setTr(null); }}>SELL</button>
      </div>
      <div className="trade-body">
        <div className="field">
          <div style={{ display: 'flex', justifyContent: 'space-between' }} className="label">
            <label htmlFor="amt">Amount</label>
            <span>{app.connected ? 'Balance ' + (buy ? app.balance.toFixed(3) + ' ETH' : fmt(held)) : 'Wallet not connected'}</span>
          </div>
          <div className="amt"><input id="amt" type="text" inputMode="decimal" autoComplete="off" placeholder="0" value={amt} onChange={(e) => setAmt(e.target.value)} /><span className="unit">{unit}</span></div>
        </div>
        <div className="presets">
          {buy
            ? ['0.01', '0.05', '0.1', '0.5'].map((v) => <button key={v} onClick={() => setAmt(v)}>{v}</button>)
            : [25, 50, 75, 100].map((v) => <button key={v} onClick={() => setAmt(String(Math.floor((held * v) / 100)))}>{v === 100 ? 'Max' : v + '%'}</button>)}
        </div>
        {q && (
          <dl className="quote">
            <div><dt>You receive</dt><dd>≈ {q.recv}</dd></div>
            <div><dt>Minimum</dt><dd>{q.minS}</dd></div>
            <div><dt>Price impact</dt><dd className={q.impact > 5 ? 'warn' : ''}>{q.impact.toFixed(2)}%</dd></div>
            <div><dt>Trade fee (1%)</dt><dd>{fmt(q.fee)} ETH</dd></div>
          </dl>
        )}
        <label className="slip">Slippage <input type="number" min={0.5} max={20} step={0.5} value={slip} onChange={(e) => setSlip(e.target.value)} aria-label="Slippage percent" /> %</label>
        <button className={`btn ${buy ? 'buy' : 'sell'} wide`} onClick={onTrade} disabled={!!tr?.busy}>{label}</button>
        {tr?.msg && <div className={`status ${tr.ok ? 'ok' : tr.err ? 'bad' : ''}`}>{tr.msg}</div>}
        <p className="foot-note">Powered by Pons · Pons V2 is unaudited</p>
      </div>
    </>
  );
}

/* ---------------- tabs ---------------- */
function Trades({ c }: { c: Coin }) {
  const rows = useMemo(() => {
    const r = rng(c.id + 'tr');
    return Array.from({ length: 12 }, (_, i) => {
      const b = r() > 0.45;
      return { b, who: short(addrOf(c.id + i)), eth: (r() * 1.4 + 0.01).toFixed(3), price: fmt(c.price * (1 + (r() - 0.5) * 0.05)), age: Math.floor(r() * 50) + i * 4 + 1 };
    });
  }, [c.id, c.price]);
  return (
    <div className="scroll-x">
      <table className="list">
        <thead><tr><th>Side</th><th>Trader</th><th className="r">ETH</th><th className="r">Price</th><th className="r">Age</th></tr></thead>
        <tbody>{rows.map((t, i) => <tr key={i}><td className={t.b ? 'buy-t' : 'sell-t'}>{t.b ? 'BUY' : 'SELL'}</td><td>{t.who}</td><td className="r">{t.eth}</td><td className="r">{t.price}</td><td className="r">{t.age} min ago</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function TabPanel({ c, tab }: { c: Coin; tab: string }) {
  const app = useApp();
  const submit = useSubmitProof();
  if (tab === 'trades') return <Trades c={c} />;
  if (tab === 'callouts') {
    const m = app.msgs.filter((x) => x.coinId === c.id);
    return m.length ? <div className="feed">{m.map((x) => <Msg key={x.id} m={x} />)}</div> : <p className="muted">No callouts for this coin yet.</p>;
  }
  if (tab === 'theorem') {
    if (!c.native) return (<><p className="muted">This coin wasn&apos;t launched on Proofcade, so it carries no theorem. Its description:</p><p>{c.blurb}</p></>);
    return (
      <>
        <div className="theorem screen" style={{ boxShadow: 'none', borderWidth: '0 0 0 10px', borderColor: 'var(--coin)' }}><small>Theorem</small>{c.statement}</div>
        <p className="muted">Rigor <RigorBadge r={c.rigor} /> {c.formal ? <><FormalBadge /> formally verified: a Lean 4 proof was checked by the kernel and reviewed.</> : '. An AI estimate, not a proof check.'}</p>
        {!c.formal && <p><button className="btn sm" onClick={() => submit(c.id)}>⚡ Submit for formal verification</button> <span className="muted">A Lean proof that passes earns Σ 100, FORMAL ✓ and a reward.</span></p>}
      </>
    );
  }
  return (
    <pre className="mono" style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 }}>{`theorem ${c.id}_holds : ∀ n : ℕ, Statement n := by
  intro n
  induction n with
  | zero => simp
  | succ k ih => omega

-- Checked by the Lean 4 kernel. Reviewed by an admin.`}</pre>
  );
}

/* ---------------- page ---------------- */
export function CoinView({ id }: { id: string }) {
  const app = useApp();
  const c = app.getCoin(id);
  const [iv, setIv] = useState<Interval>('5m');
  const [tab, setTab] = useState('trades');

  if (!c) {
    return (
      <div className="screen gate-card">
        <div className="insert">GAME OVER</div>
        <p>No coin with that address on this board.</p>
        <Link className="btn" href="/explore">Back to index</Link>
      </div>
    );
  }
  const tabs: [string, string][] = [['trades', 'Trades'], ['callouts', 'Callouts'], ['theorem', 'Theorem'], ...(c.formal ? [['formal', 'Formal ✓'] as [string, string]] : [])];
  return (
    <>
      <Link className="crumb" href="/explore">← Back to index</Link>
      <div className="detail">
        <div className="detail-main">
          <div className="coin-head">
            <Px seed={c.id} large />
            <div>
              <h1>${c.ticker} <span className="muted" style={{ color: 'var(--hero-dim)', fontSize: '.6em' }}>{c.name}</span></h1>
              <div className="sub">{c.native ? c.statement : c.blurb}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                {c.native && <RigorBadge r={c.rigor} />}{c.formal && <FormalBadge />}
                <div className="share">
                  <button className="btn sm ghost" onClick={() => { void navigator.clipboard?.writeText(location.href).catch(() => {}); app.toast('COPIED', 'Link copied.'); }}>Copy link</button>
                  <a className="btn sm ghost" href={`https://x.com/intent/post?text=${encodeURIComponent('$' + c.ticker + ' on Proofcade')}`} target="_blank" rel="noopener noreferrer">Post on X</a>
                </div>
              </div>
            </div>
          </div>
          <div className="kv on-dark">
            <div><span className="label" style={{ color: 'var(--hero-faint)' }}>Price</span><span className="v">{eth(c.price)}</span></div>
            <div><span className="label" style={{ color: 'var(--hero-faint)' }}>MCap</span><span className="v">{eth(c.mcap)}</span></div>
            <div><span className="label" style={{ color: 'var(--hero-faint)' }}>24h vol</span><span className="v">{eth(c.vol)}</span></div>
            <div><span className="label" style={{ color: 'var(--hero-faint)' }}>24h</span><span className={`v ${c.change >= 0 ? 'up' : 'down'}`}>{c.change >= 0 ? '+' : ''}{c.change.toFixed(1)}%</span></div>
          </div>
          <div className="chart crt">
            <div className="chart-bar">
              <span>Price (ETH)</span>
              <div className="seg" role="group" aria-label="Chart interval">{INTERVALS.map((i) => <button key={i} aria-pressed={iv === i} onClick={() => setIv(i)}>{i}</button>)}</div>
            </div>
            <div><Chart c={c} iv={iv} /></div>
            <div className="chart-foot">
              <div className="row"><span>{c.phase === 0 ? `Curve ${Math.floor(c.progress * 100)}% → Uniswap V4` : PHASE[c.phase]}</span><span>launched {c.age} ago by {short(c.creator)}</span></div>
              <HpBar p={c.progress} />
            </div>
          </div>
          <div className="screen">
            <div className="tabs" role="tablist">{tabs.map(([i, l]) => <button key={i} role="tab" aria-selected={tab === i} onClick={() => setTab(i)}>{l}</button>)}</div>
            <div className="tabpanel"><TabPanel c={c} tab={tab} /></div>
          </div>
        </div>
        <aside className="screen trade" aria-label="Trade"><TradePanel key={c.id} c={c} /></aside>
      </div>
    </>
  );
}
