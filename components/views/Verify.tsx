'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApp } from '@/lib/app';
import type { ProofStatus } from '@/lib/data';
import { Px } from '../Px';
import { useSubmitProof } from '../SubmitProof';

const ST: Record<ProofStatus, [string, string]> = {
  checking: ['CHECKING', 'badge'], passed: ['PASSED · IN REVIEW', 'badge mid'], failed: ['FAILED', 'badge lo'], verified: ['FORMAL ✓', 'badge formal'],
};

export function VerifyView() {
  const app = useApp();
  const router = useRouter();
  const submit = useSubmitProof();
  const [tab, setTab] = useState<'mine' | 'public' | 'verified'>('public');
  const rows = app.proofs.filter((r) => (tab === 'verified' ? r.status === 'verified' : tab === 'mine' ? r.mine : true));
  const queued = app.proofs.filter((r) => r.status === 'checking' || r.status === 'passed').length;
  return (
    <>
      <div className="eyebrow">Boss queue · Lean 4</div>
      <h1 style={{ margin: '14px 0 14px' }}>Verification queue</h1>
      <p className="lead" style={{ marginBottom: 26 }}>A Lean proof that passes the kernel and review earns Σ 100, the FORMAL ✓ trophy and a reward from the pool.</p>
      <div className="pool">
        {([['Pool balance', '12.40 ETH'], ['Paid out', '3.10 ETH'], ['In queue', String(queued)]] as const).map(([a, b]) => <div className="screen stat" key={a}><div className="label">{a}</div><div className="num">{b}</div></div>)}
      </div>
      <div className="toolbar on-dark">
        <div className="seg" role="group" aria-label="Queue">
          {([['mine', 'My submissions'], ['public', 'Public queue'], ['verified', 'Verified']] as const).map(([v, l]) => <button key={v} aria-pressed={tab === v} onClick={() => setTab(v)}>{l}</button>)}
        </div>
        <div className="grow" />
        <button className="btn" onClick={() => submit()}>⚡ Submit new proof</button>
      </div>
      <div className="screen">
        {rows.length ? rows.map((r, i) => {
          const c = app.getCoin(r.coinId); const t = c ? c.ticker : r.coinId.toUpperCase();
          return (
            <div className="q-row" key={i}>
              <Px seed={r.coinId} />
              <div><div className="t">${t}</div><div className="s">{r.who} · {r.ago} ago</div></div>
              <span className={ST[r.status][1]}>{ST[r.status][0]}</span>
              <button className="btn sm ghost" onClick={() => router.push(`/coin/${r.coinId}`)}>View</button>
            </div>
          );
        }) : <div className="gate-card"><p>Nothing here yet. Submit a proof to join the queue.</p></div>}
      </div>
    </>
  );
}
