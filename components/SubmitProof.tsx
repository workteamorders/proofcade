'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/app';

export function SubmitProofDialog({ preselect }: { preselect?: string }) {
  const app = useApp();
  const router = useRouter();
  const options = app.coins.filter((c) => c.native && !c.formal);
  const [coinId, setCoinId] = useState(preselect && options.some((c) => c.id === preselect) ? preselect : options[0]?.id ?? '');
  return (
    <>
      <div className="dlg-body">
        <div className="field">
          <label className="label" htmlFor="pcoin">Coin</label>
          <select id="pcoin" value={coinId} onChange={(e) => setCoinId(e.target.value)}>
            {options.map((c) => <option key={c.id} value={c.id}>${c.ticker}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="pfile">Lean 4 file (.lean)</label>
          <input id="pfile" type="file" accept=".lean,text/plain" />
          <small>The checker runs your file in a sandbox, then an admin reviews it.</small>
        </div>
        <p className="foot-note">Submitting costs a small fee, paid from your wallet.</p>
      </div>
      <div className="dlg-foot">
        <button className="btn ghost" onClick={app.closeDialog}>Cancel</button>
        <button className="btn" disabled={!coinId} onClick={() => { app.addProof(coinId); app.closeDialog(); app.toast('IN THE QUEUE', 'Your proof is being checked by the Lean kernel.'); router.push('/verify'); }}>Submit proof</button>
      </div>
    </>
  );
}

/** Wallet-gated entry point shared by the coin page and the verification queue. */
export function useSubmitProof() {
  const app = useApp();
  return (preselect?: string) => app.needWallet('A wallet is needed to submit a proof.', () => app.showDialog({ title: 'Submit a proof', node: <SubmitProofDialog preselect={preselect} /> }));
}
