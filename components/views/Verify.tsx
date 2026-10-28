'use client';
import { useApp } from '@/lib/app';

export function VerifyView() {
  const app = useApp();
  return (
    <>
      <div className="eyebrow">Boss queue · Lean 4</div>
      <h1 style={{ margin: '14px 0 14px' }}>Verification queue</h1>
      <p className="lead" style={{ marginBottom: 26 }}>A Lean proof that passes the kernel and review earns Σ 100, the FORMAL ✓ trophy and a reward from the pool.</p>
      <div className="screen gate-card">
        <div className="insert">OFFLINE</div>
        <p>The verification service is not connected to this build. It needs the Theorem backend: a Lean 4 checker, a review queue and a reward pool.</p>
        <p className="muted">Coins launched here are read straight from Solana and carry no rigor score or FORMAL ✓ badge yet.</p>
        <button className="btn ghost" onClick={() => app.toast('OFFLINE', 'Proof submission needs the Theorem backend.')}>⚡ Submit a proof</button>
      </div>
    </>
  );
}
