'use client';
import Link from 'next/link';
import { useApp } from '@/lib/app';
import { PUMP_PROGRAM_ID } from '@pump-fun/pump-sdk';
import { addressUrl, NETWORK_NAME } from '@/lib/sol/config';
import { sol } from '@/lib/util';
import { BigCoin, CoinCard, GateNote } from '../ui';

const STEPS = [
  ['01', 'Write the theorem', 'State a claim in math notation when you launch.', 'xⁿ + yⁿ = zⁿ has no solutions for n > 2.'],
  ['02', 'Get a rigor score', 'An AI grades it from 0 to 100. It is an estimate, not a proof check.', 'Σ 94'],
  ['03', 'Freeze it on-chain', 'The statement and score go into the coin. The proof sketch lives on IPFS.', 'ipfs://bafy…q4'],
  ['04', 'Trade, then graduate', 'It trades on its pump.fun curve and graduates to PumpSwap when the bar fills.', '████████░░ 80%'],
];

export function HomeView() {
  const app = useApp();
  const hot = [...app.coins].sort((a, b) => b.raised - a.raised).slice(0, 6);
  const fresh = [...app.coins].sort((a, b) => b.order - a.order).slice(0, 4);
  const creators = new Set(app.coins.map((c) => c.creator)).size;
  const raised = app.coins.reduce((a, c) => a + c.raised, 0);
  const wait = app.market.loading ? '…' : app.market.error ? '—' : null;
  const STATS = [
    ['Coins launched', wait ?? String(app.coins.length), 'with a theorem attached'],
    ['SOL raised', wait ?? sol(raised), 'on the curves right now'],
    ['Graduated', wait ?? String(app.coins.filter((c) => c.phase > 0).length), 'moved past the curve'],
    ['Creators', wait ?? String(creators), 'wallets that launched'],
  ];
  const empty = (msg: string) => <div className="screen gate-card"><p>{app.market.error ?? msg}</p><Link className="btn" href="/launch">▶ Launch a coin</Link></div>;
  return (
    <>
      <section className="hero" aria-labelledby="h">
        <div>
          <div className="eyebrow"><b>Theorem</b> · Solana · Routed through pump.fun</div>
          <h1 id="h">Every coin is a level. <span className="hl">Every level is a theorem.</span></h1>
          <p className="lead">Theorem-backed coins. Formally verified. Fully on-chain. Pick a statement, read its rigor score, then press start.</p>
          <div className="cta">
            <Link className="btn" href="/launch">▶ Press start · launch a coin</Link>
            <Link className="btn ghost" href="/explore">Explore coins</Link>
          </div>
          <GateNote />
        </div>
        <div className="cabinet crt" aria-hidden="true">
          <span className="hud tl">1UP<br /><b>Σ 100</b></span><span className="hud tr">HI-SCORE<br /><b>COINS {app.coins.length}</b></span>
          <span className="hud bl">LEVEL<br /><b>{NETWORK_NAME.toUpperCase()}</b></span><span className="hud br">CREDIT<br /><b>{app.connected ? '01' : '00'}</b></span>
          <span className="sym" style={{ left: '12%', top: '28%' }}>∑</span>
          <span className="sym" style={{ right: '14%', top: '34%', animationDelay: '.9s' }}>π</span>
          <span className="sym" style={{ left: '20%', bottom: '26%', animationDelay: '1.7s' }}>∞</span>
          <span className="sym" style={{ right: '22%', bottom: '22%', animationDelay: '2.4s' }}>∫</span>
          <BigCoin />
        </div>
      </section>

      <section className="stats" aria-label="Network stats">
        {STATS.map(([a, b, c]) => <div className="screen stat" key={a}><div className="label">{a}</div><div className="num">{b}</div><div className="sub">{c}</div></div>)}
      </section>

      <section className="section" aria-labelledby="hot">
        <div className="section-head">
          <div><div className="eyebrow">Leaderboard · SOL raised</div><h2 id="hot" style={{ marginTop: 12 }}>Hot right now</h2></div>
          <Link className="btn sm ghost" href="/explore">See all coins →</Link>
        </div>
        {hot.length ? <div className="rail">{hot.map((c, i) => <CoinCard key={c.id} c={c} rank={i + 1} vol />)}</div> : empty('No coins have launched yet.')}
      </section>

      <section className="section" aria-labelledby="how">
        <div className="section-head"><div><div className="eyebrow">Theorem board</div><h2 id="how" style={{ marginTop: 12 }}>How a level works</h2></div></div>
        <div className="steps">
          {STEPS.map(([n, t, p, e]) => <div className="screen step" key={n}><span className="n">{n}</span><h3>{t}</h3><p>{p}</p><div className="eg">{e}</div></div>)}
        </div>
      </section>

      <section className="section" aria-label="Contracts">
        <div className="screen contract">
          <div><div className="label">pump.fun program</div><div className="mono" style={{ fontWeight: 700, marginTop: 6 }}>{NETWORK_NAME}</div></div>
          <code>{PUMP_PROGRAM_ID.toBase58()}</code>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn sm ghost" onClick={() => { void navigator.clipboard?.writeText(PUMP_PROGRAM_ID.toBase58()).catch(() => {}); app.toast('COPIED', 'Program address copied.'); }}>Copy</button>
            <a className="btn sm ghost" href={addressUrl(PUMP_PROGRAM_ID.toBase58())} target="_blank" rel="noopener noreferrer">Explorer</a>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="new">
        <div className="section-head"><div><div className="eyebrow">Just dropped</div><h2 id="new" style={{ marginTop: 12 }}>New cartridges</h2></div></div>
        {fresh.length ? <div className="grid">{fresh.map((c) => <CoinCard key={c.id} c={c} />)}</div> : empty('Nothing has dropped yet.')}
      </section>
    </>
  );
}
