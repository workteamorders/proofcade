'use client';
import Link from 'next/link';
import { useApp } from '@/lib/app';
import { OFFICIAL_CA } from '@/lib/data';
import { BigCoin, CoinCard, GateNote } from '../ui';

const STATS = [
  ['Coins launched', '1,284', 'since opening day'],
  ['24h volume', '412 ETH', 'across all Pons coins'],
  ['Formal ✓ proofs', '37', 'checked by the Lean kernel'],
  ['Players online', '218', 'in Live right now'],
];
const STEPS = [
  ['01', 'Write the theorem', 'State a claim in math notation when you launch.', 'xⁿ + yⁿ = zⁿ has no solutions for n > 2.'],
  ['02', 'Get a rigor score', 'An AI grades it from 0 to 100. It is an estimate, not a proof check.', 'Σ 94'],
  ['03', 'Freeze it on-chain', 'The statement and score go into the coin. The proof sketch lives on IPFS.', 'ipfs://bafy…q4'],
  ['04', 'Trade, then graduate', 'It trades on its Pons curve and moves to Uniswap V4 when the bar fills.', '████████░░ 80%'],
];

export function HomeView() {
  const app = useApp();
  const hot = [...app.coins].sort((a, b) => b.vol - a.vol).slice(0, 6);
  const fresh = [...app.coins].sort((a, b) => b.order - a.order).slice(0, 4);
  return (
    <>
      <section className="hero" aria-labelledby="h">
        <div>
          <div className="eyebrow"><b>Sigmafun</b> · Robinhood Chain · Routed through Pons</div>
          <h1 id="h">Every coin is a level. <span className="hl">Every level is a theorem.</span></h1>
          <p className="lead">Theorem-backed coins. Formally verified. Fully on-chain. Pick a statement, read its rigor score, then press start.</p>
          <div className="cta">
            <Link className="btn" href="/launch">▶ Press start · launch a coin</Link>
            <Link className="btn ghost" href="/explore">Explore coins</Link>
          </div>
          <GateNote />
        </div>
        <div className="cabinet crt" aria-hidden="true">
          <span className="hud tl">1UP<br /><b>Σ 100</b></span><span className="hud tr">HI-SCORE<br /><b>FORMAL ✓ 37</b></span>
          <span className="hud bl">LEVEL<br /><b>PRIME</b></span><span className="hud br">CREDIT<br /><b>{app.connected ? '01' : '00'}</b></span>
          <span className="sym" style={{ left: '12%', top: '28%' }}>∑</span>
          <span className="sym" style={{ right: '14%', top: '34%', animationDelay: '.9s' }}>π</span>
          <span className="sym" style={{ left: '20%', bottom: '26%', animationDelay: '1.7s' }}>∞</span>
          <span className="sym" style={{ right: '22%', bottom: '22%', animationDelay: '2.4s' }}>∫</span>
          <BigCoin />
        </div>
      </section>

      <section className="stats" aria-label="Network stats (sample data)">
        {STATS.map(([a, b, c]) => <div className="screen stat" key={a}><div className="label">{a}</div><div className="num">{b}</div><div className="sub">{c}</div></div>)}
      </section>

      <section className="section" aria-labelledby="hot">
        <div className="section-head">
          <div><div className="eyebrow">Leaderboard · 24h volume</div><h2 id="hot" style={{ marginTop: 12 }}>Hot right now</h2></div>
          <Link className="btn sm ghost" href="/explore">See all coins →</Link>
        </div>
        <div className="rail">{hot.map((c, i) => <CoinCard key={c.id} c={c} rank={i + 1} vol />)}</div>
      </section>

      <section className="section" aria-labelledby="how">
        <div className="section-head"><div><div className="eyebrow">Theorem board</div><h2 id="how" style={{ marginTop: 12 }}>How a level works</h2></div></div>
        <div className="steps">
          {STEPS.map(([n, t, p, e]) => <div className="screen step" key={n}><span className="n">{n}</span><h3>{t}</h3><p>{p}</p><div className="eg">{e}</div></div>)}
        </div>
      </section>

      <section className="section" aria-label="Official contract">
        <div className="screen contract">
          <div><div className="label">Official</div><div className="mono" style={{ fontWeight: 700, marginTop: 6 }}>$PROOF</div></div>
          <code>{OFFICIAL_CA}</code>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn sm ghost" onClick={() => { void navigator.clipboard?.writeText(OFFICIAL_CA).catch(() => {}); app.toast('COPIED', '$PROOF contract copied.'); }}>Copy</button>
            <Link className="btn sm ghost" href="/coin/fermat">Chart</Link>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="new">
        <div className="section-head"><div><div className="eyebrow">Just dropped</div><h2 id="new" style={{ marginTop: 12 }}>New cartridges</h2></div></div>
        <div className="grid">{fresh.map((c) => <CoinCard key={c.id} c={c} />)}</div>
      </section>
    </>
  );
}
