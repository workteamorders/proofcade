'use client';
import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import { useApp } from '@/lib/app';
import { short } from '@/lib/util';
import { CLUSTER, IS_TEST, NETWORK_NAME, addressUrl } from '@/lib/sol/config';

export function ConnectDialog({ reason }: { reason?: string }) {
  const { wallets, select, connecting } = useWallet();
  const [err, setErr] = useState<string | null>(null);
  const installed = wallets
    .filter((x) => x.readyState === WalletReadyState.Installed || x.readyState === WalletReadyState.Loadable)
    .sort((a, b) => Number(/metamask/i.test(b.adapter.name)) - Number(/metamask/i.test(a.adapter.name)));
  const others = wallets.filter((x) => !installed.includes(x) && x.readyState !== WalletReadyState.Unsupported);
  /* the wallet provider reports connection errors through this event (see Web3.tsx) */
  useEffect(() => {
    const on = (e: Event) => setErr((e as CustomEvent<string>).detail);
    window.addEventListener('wallet-error', on);
    return () => window.removeEventListener('wallet-error', on);
  }, []);
  /* with autoConnect on, selecting a wallet connects it */
  const go = (name: (typeof wallets)[number]['adapter']['name']) => { setErr(null); select(name); };
  if (connecting) {
    return (
      <div className="dlg-body">
        <p className="insert">CONNECTING…</p>
        <p className="foot-note">Approve the request in your wallet.</p>
      </div>
    );
  }
  const row = (x: (typeof wallets)[number], dim?: boolean) => (
    <button key={x.adapter.name} className="wopt" onClick={() => (dim ? window.open(x.adapter.url, '_blank', 'noopener') : go(x.adapter.name))}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={x.adapter.icon} alt="" width={22} height={22} style={{ borderRadius: 4 }} />
      <span><b>{x.adapter.name}</b><br /><small>{dim ? 'Not installed. Get it' : 'Detected'}</small></span>
      <span className="mono">▶</span>
    </button>
  );
  return (
    <div className="dlg-body">
      <p>{reason || 'Connect a wallet to play.'} Theorem is non-custodial. Your keys never leave your wallet.</p>
      <div className="wlist">
        {installed.map((x) => row(x))}
        {!installed.length && others.map((x) => row(x, true))}
      </div>
      {!installed.length && <div className="status">No Solana wallet found in this browser. Install MetaMask or Phantom, reload, and try again.</div>}
      {err && <div className="status bad">{err}</div>}
      <p className="foot-note">
        Network: {NETWORK_NAME}.{IS_TEST ? ' MetaMask: switch its Solana network to Devnet. Phantom: Testnet Mode in Developer Settings. Devnet SOL has no value.' : ''}
      </p>
    </div>
  );
}

export function AccountDialog() {
  const app = useApp();
  const { wallet } = useWallet();
  return (
    <div className="dlg-body">
      <div className="review">
        <div><dt>Address</dt><dd className="mono">{short(app.address)}</dd></div>
        <div><dt>Wallet</dt><dd>{wallet?.adapter.name ?? 'Solana wallet'}</dd></div>
        <div><dt>Balance</dt><dd>{app.balance.toFixed(4)} SOL</dd></div>
        <div><dt>Network</dt><dd>{NETWORK_NAME}</dd></div>
      </div>
      {IS_TEST && app.balance === 0 && <div className="status">No devnet SOL here yet. Get some from faucet.solana.com (choose Devnet) and it shows up in a few seconds.</div>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn sm ghost" onClick={() => { void navigator.clipboard?.writeText(app.address).catch(() => {}); app.toast('COPIED', 'Address copied.'); }}>Copy address</button>
        <a className="btn sm ghost" href={addressUrl(app.address)} target="_blank" rel="noopener noreferrer">Explorer</a>
        <button className="btn sm sell" onClick={app.disconnect}>Disconnect</button>
      </div>
      <p className="foot-note">Cluster: {CLUSTER}</p>
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
          <li>Coins are issued by their creators, not by Theorem.</li>
          <li>Rigor scores, when they exist, are an AI estimate, not a proof check.</li>
          <li>Trades run on the pump.fun program, which Theorem does not control.{IS_TEST ? ' This build runs on Solana devnet.' : ''}</li>
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
