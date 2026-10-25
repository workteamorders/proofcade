'use client';
import { useEffect, useState } from 'react';
import { WALLETS } from '@/lib/data';
import { useApp } from '@/lib/app';
import { short } from '@/lib/util';

export function ConnectDialog({ reason }: { reason?: string }) {
  const app = useApp();
  const [pick, setPick] = useState<number | null>(null);
  const { completeConnect } = app;
  useEffect(() => {
    if (pick == null) return;
    const id = setTimeout(() => completeConnect(WALLETS[pick].name), 700);
    return () => clearTimeout(id);
  }, [pick, completeConnect]);

  if (pick != null) {
    return (
      <div className="dlg-body">
        <p className="insert">CONNECTING…</p>
        <p className="foot-note">Approve the request in your wallet.</p>
      </div>
    );
  }
  return (
    <div className="dlg-body">
      <p>{reason || 'Connect a wallet to play.'} Proofcade is non-custodial. Your keys never leave your wallet.</p>
      <div className="wlist">
        {WALLETS.map((w, i) => (
          <button key={w.name} className="wopt" onClick={() => setPick(i)}>
            <i style={{ background: w.color }} />
            <span><b>{w.name}</b><br /><small>{w.note}</small></span>
            <span className="mono">▶</span>
          </button>
        ))}
      </div>
      <p className="foot-note">Demo wallet: picking one fakes a connection. Swap the wallet block in <span className="mono">Providers.tsx</span> for wagmi and RainbowKit on Robinhood Chain.</p>
    </div>
  );
}

export function AccountDialog() {
  const app = useApp();
  return (
    <div className="dlg-body">
      <div className="review">
        <div><dt>Address</dt><dd className="mono">{short(app.address)}</dd></div>
        <div><dt>Balance</dt><dd>{app.balance.toFixed(3)} ETH</dd></div>
        <div><dt>Network</dt><dd>Robinhood Chain</dd></div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn sm ghost" onClick={() => { void navigator.clipboard?.writeText(app.address).catch(() => {}); app.toast('COPIED', 'Address copied.'); }}>Copy address</button>
        <button className="btn sm sell" onClick={app.disconnect}>Disconnect</button>
      </div>
    </div>
  );
}

export function RiskDialog() {
  const app = useApp();
  const [ok, setOk] = useState(false);
  return (
    <>
      <div className="dlg-body">
        <p>Launching and trading memecoins is highly speculative. Read this once.</p>
        <ul className="risk-list">
          <li>You can lose everything you put in.</li>
          <li>Coins are issued by their creators, not by Proofcade.</li>
          <li>Rigor scores are an AI estimate, not a proof check.</li>
          <li>Pons V2 is unaudited software.</li>
        </ul>
        <label className="check"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /><span>I understand these risks and agree to the Terms of Use.</span></label>
      </div>
      <div className="dlg-foot">
        <button className="btn ghost" onClick={app.closeDialog}>Cancel</button>
        <button className="btn" disabled={!ok} onClick={app.acceptRisk}>I accept</button>
      </div>
    </>
  );
}
