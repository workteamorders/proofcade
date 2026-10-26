'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApp } from '@/lib/app';
import { eth, fmt, short, usd } from '@/lib/util';
import { changeColor, RigorBadge } from '../ui';
import { Px } from '../Px';

export function PortfolioView() {
  const app = useApp();
  const router = useRouter();
  const [tab, setTab] = useState<'holdings' | 'launches'>('holdings');

  if (!app.connected) {
    return (
      <>
        <div className="eyebrow">Inventory</div>
        <h1 style={{ margin: '14px 0 26px' }}>Portfolio</h1>
        <div className="screen gate-card">
          <div className="insert">INSERT COIN</div>
          <p>Connect a wallet to see your launches and holdings.</p>
          <button className="btn" onClick={app.openWallet}>Connect wallet</button>
        </div>
      </>
    );
  }
  const rows = Object.keys(app.holdings).filter((id) => app.holdings[id] > 0).flatMap((id) => {
    const c = app.getCoin(id); if (!c) return [];
    const bal = app.holdings[id], val = bal * c.price, cost = bal * (app.costBasis[id] ?? c.price * 0.9);
    return [{ c, bal, val, cost, pnl: val - cost, pct: ((val - cost) / cost) * 100 }];
  });
  const tv = rows.reduce((a, r) => a + r.val, 0), tc = rows.reduce((a, r) => a + r.cost, 0);
  const mine = app.coins.filter((c) => c.mine);
  return (
    <>
      <div className="eyebrow">Inventory · {short(app.address)}</div>
      <h1 style={{ margin: '14px 0 26px' }}>Portfolio</h1>
      <div className="stats" style={{ marginTop: 0, marginBottom: 26, gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
        <div className="screen stat"><div className="label">Value</div><div className="num">{eth(tv)}</div></div>
        <div className="screen stat"><div className="label">P&amp;L</div><div className="num" style={{ color: changeColor(tv - tc) }}>{tv - tc >= 0 ? '+' : ''}{fmt(tv - tc)} ETH</div><div className="sub">{tc ? (((tv - tc) / tc) * 100).toFixed(1) : '0.0'}% on cost</div></div>
        <div className="screen stat"><div className="label">Coins held</div><div className="num">{rows.length}</div></div>
      </div>
      <div className="screen">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'holdings'} onClick={() => setTab('holdings')}>Holdings ({rows.length})</button>
          <button role="tab" aria-selected={tab === 'launches'} onClick={() => setTab('launches')}>My launches ({mine.length})</button>
        </div>
        {tab === 'holdings' ? (
          <div className="scroll-x">
            <table className="list">
              <thead><tr><th>Coin</th><th className="r">Balance</th><th className="r">Value</th><th className="r">P&amp;L</th><th></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.c.id} tabIndex={0} onClick={() => router.push(`/coin/${r.c.id}`)} onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/coin/${r.c.id}`); }}>
                    <td><span className="cell-coin"><Px seed={r.c.id} /><b>${r.c.ticker}</b>{r.c.native && <RigorBadge r={r.c.rigor} />}</span></td>
                    <td className="r">{fmt(r.bal)}</td><td className="r">{eth(r.val)}</td>
                    <td className="r" style={{ color: changeColor(r.pnl) }}>{r.pnl >= 0 ? '+' : ''}{fmt(r.pnl)} <small>{r.pct.toFixed(1)}%</small></td>
                    <td className="r"><span className="btn sm ghost">Open</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="tabpanel">
            {mine.length ? (
              <div className="scroll-x"><table className="list"><thead><tr><th>Coin</th><th className="r">MCap</th><th className="r">Age</th></tr></thead>
                <tbody>{mine.map((c) => <tr key={c.id} tabIndex={0} onClick={() => router.push(`/coin/${c.id}`)}><td><span className="cell-coin"><Px seed={c.id} /><b>${c.ticker}</b></span></td><td className="r">{usd(c.mcap)}</td><td className="r">{c.age}</td></tr>)}</tbody></table></div>
            ) : (<p className="muted">You haven&apos;t launched a coin yet. <Link href="/launch" style={{ color: 'var(--ink)' }}>Start a launch →</Link></p>)}
          </div>
        )}
      </div>
      <div style={{ marginTop: 18 }}><button className="btn sm ghost" onClick={() => app.toast('EXPORT', 'The full app downloads your holdings as CSV.')}>Export CSV</button></div>
    </>
  );
}
