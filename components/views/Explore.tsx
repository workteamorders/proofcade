'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/app';
import { PHASE, type Coin } from '@/lib/data';
import { sol, fmt, usd } from '@/lib/util';
import { changeColor, CoinCard, HpBar, RigorBadge } from '../ui';
import { Px } from '../Px';
import Link from 'next/link';

type Sort = 'latest' | 'volume' | 'mcap';
const SORTS: Record<Sort, (a: Coin, b: Coin) => number> = {
  latest: (x, y) => y.order - x.order,
  volume: (x, y) => y.raised - x.raised,
  mcap: (x, y) => y.mcap - x.mcap,
};

export function ExploreView() {
  const app = useApp();
  const router = useRouter();
  const [tab, setTab] = useState<'native' | 'all'>('all');
  const [sort, setSort] = useState<Sort>('latest');
  const [q, setQ] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [shown, setShown] = useState(12);

  const all = useMemo(() => {
    let a = app.coins.filter((c) => (tab === 'native' ? c.native : true));
    const s = q.trim().toLowerCase();
    if (s.length >= 2) a = a.filter((c) => c.ticker.toLowerCase().includes(s) || c.name.toLowerCase().includes(s) || c.address.toLowerCase().includes(s));
    return a.sort(SORTS[sort]);
  }, [app.coins, tab, sort, q]);
  const items = all.slice(0, shown);
  const nativeCount = app.coins.filter((c) => c.native).length;

  return (
    <>
      <div className="eyebrow">Index · {app.coins.length} coins · Solana</div>
      <h1 style={{ margin: '14px 0 26px' }}>Explore coins</h1>
      <div className="toolbar on-dark">
        <div className="seg" role="group" aria-label="Collection">
          <button aria-pressed={tab === 'native'} onClick={() => { setTab('native'); setShown(12); }}>Theorem launches ({nativeCount})</button>
          <button aria-pressed={tab === 'all'} onClick={() => { setTab('all'); setShown(12); }}>All coins</button>
        </div>
        <div className="grow">
          <label className="sr" htmlFor="q">Search coins</label>
          <input id="q" type="search" value={q} onChange={(e) => { setQ(e.target.value); setShown(12); }} placeholder="Search ticker, name or mint…" maxLength={64} spellCheck={false} autoComplete="off" />
        </div>
        <label>Sort{' '}
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="latest">Latest</option><option value="volume">Raised</option><option value="mcap">MCap</option>
          </select>
        </label>
        <div className="seg" role="group" aria-label="View">
          <button aria-pressed={view === 'grid'} onClick={() => setView('grid')}>Grid</button>
          <button aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
        </div>
      </div>

      {!items.length ? (
        <div className="screen pad gate-card">
          <p>{q ? `No coins match “${q}”.` : app.market.error ?? (app.market.loading ? 'Reading coins from Solana…' : 'No coins here yet.')}</p>
          <Link className="btn" href="/launch">▶ Launch a coin</Link>
        </div>
      ) : view === 'grid' ? (
        <div className="grid">{items.map((c) => <CoinCard key={c.id} c={c} vol={sort === 'volume'} />)}</div>
      ) : (
        <div className="screen scroll-x">
          <table className="list">
            <thead><tr><th>Coin</th><th>Rigor</th><th className="r">Price</th><th className="r">Since launch</th><th className="r">MCap</th><th className="r">Raised</th><th>Graduation</th><th className="r">Age</th></tr></thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} tabIndex={0} onClick={() => router.push(`/coin/${c.id}`)} onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/coin/${c.id}`); }}>
                  <td><span className="cell-coin"><Px seed={c.id} /><b>${c.ticker}</b></span></td>
                  <td>{c.native ? <RigorBadge r={c.rigor} /> : '—'}</td>
                  <td className="r">{fmt(c.price)}</td>
                  <td className="r" style={{ color: changeColor(c.change) }}>{c.change >= 0 ? '+' : ''}{c.change.toFixed(1)}%</td>
                  <td className="r">{usd(c.mcap)}</td>
                  <td className="r">{sol(c.raised)}</td>
                  <td style={{ minWidth: 150 }}>{c.phase === 0 ? <HpBar p={c.progress} /> : PHASE[c.phase]}</td>
                  <td className="r">{c.age}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {all.length > shown && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 26 }}><button className="btn ghost" onClick={() => setShown((n) => n + 12)}>Show more</button></div>}
      {items.length > 0 && <div className="statusbar"><span>{all.length} object{all.length === 1 ? '' : 's'}</span><span>Read live from Solana. Raised is the SOL on the curve.</span></div>}
    </>
  );
}
