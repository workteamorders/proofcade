'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Keypair } from '@solana/web3.js';
import { getBuyTokenAmountFromSolAmount } from '@pump-fun/pump-sdk';
import { useApp } from '@/lib/app';
import { fmt, short } from '@/lib/util';
import { NETWORK_NAME, IS_TEST, txUrl } from '@/lib/sol/config';
import { BN, NATIVE_MINT, curvePreview, lamportsOf, toTokens, toSol } from '@/lib/sol/pump';
import { launch as runLaunch, type LaunchState } from '@/lib/sol/launch';
import { txError } from '@/lib/sol/errors';
import { logosEnabled, prepareLogo, uploadLogo } from '@/lib/logoClient';

const STEPS: [string, string, string][] = [
  ['Identity', 'Name your coin', 'Pick a name, ticker and sprite. They can never be changed after launch.'],
  ['Theorem', 'State your theorem', 'Every Theorem coin carries a mathematical statement, written on-chain with the launch.'],
  ['Economics', 'Set the first buy', 'Coins trade against SOL on a pump.fun bonding curve. You can buy the first tokens yourself, optionally.'],
  ['Review', 'Review and launch', 'Check everything. A launch cannot be undone. Your wallet will ask you to confirm twice (the theorem, then the coin), and a third time if the first buy does not fit.'],
];

type Form = { name: string; ticker: string; stmt: string; buy: string };
const EMPTY: Form = { name: '', ticker: '', stmt: '', buy: '' };

const bytes = (s: string) => new TextEncoder().encode(s).length;
const STMT_MAX = 280;

function errorsFor(step: number, w: Form): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 0) {
    if (!w.name.trim() || bytes(w.name.trim()) > 32) e.name = 'Use 1–32 characters.';
    if (!/^[A-Za-z0-9]{2,10}$/.test(w.ticker)) e.ticker = 'Use 2–10 letters or digits.';
  }
  if (step === 1) {
    if (w.stmt.trim().length < 12) e.stmt = 'State the theorem in at least 12 characters.';
    else if (bytes(w.stmt.trim()) > STMT_MAX) e.stmt = `Keep the statement under ${STMT_MAX} bytes (about ${STMT_MAX} plain characters).`;
  }
  if (step === 2 && w.buy.trim() && !lamportsOf(w.buy)) e.buy = 'Enter an amount like 0.05.';
  return e;
}

type Phase = { i: number; err?: string };
const LSTEPS = ['Reading pump.fun launch terms', 'Waiting for your signature', 'Confirming on ' + NETWORK_NAME, 'Opening the new coin'];

/** The real launch: build, simulate, sign, confirm. */
function LaunchProgress({ form, mint, logo, onDone }: { form: Form; mint: Keypair; logo: Blob | null; onDone: (token: string, tx: string) => void }) {
  const app = useApp();
  const [p, setP] = useState<Phase>({ i: 0 });
  const [tx, setTx] = useState<string | null>(null);
  const [run, setRun] = useState(0);
  /* React strict mode runs effects twice in development; a wallet flow must start once per attempt. */
  const started = useRef(-1);
  const done = useRef<LaunchState>({}); /* what is already on-chain, so "try again" resumes */
  const logoStored = useRef(false);
  const { conn, signer, refresh } = app;
  const partial = !!(done.current.pending || done.current.created);
  useEffect(() => {
    app.setDialogLocked(!p.err || partial);
  }, [p.err, partial, app.setDialogLocked]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  useEffect(() => {
    if (started.current === run) return;
    started.current = run;
    const go = async () => {
      if (!signer) throw new Error('Connect a wallet first.');
      setP({ i: 0 });
      const devBuy = form.buy.trim() ? lamportsOf(form.buy) : null;
      /* the logo goes up first: the address is fresh and unused, and the launch memo then says the coin has one */
      if (logo && !logoStored.current && !done.current.marker) { await uploadLogo(mint.publicKey.toBase58(), logo); logoStored.current = true; }
      const r = await runLaunch(conn, signer, { name: form.name.trim(), symbol: form.ticker.trim().toUpperCase(), statement: form.stmt.trim(), devBuy, mint, slippagePct: 1, logo: !!logo }, (label, sig) => {
        if (sig) setTx(sig);
        setP({ i: sig ? 2 : /wallet/i.test(label) ? 1 : 0 });
      }, done.current);
      const last = done.current.created ?? r.sigs[r.sigs.length - 1];
      setP({ i: 3 });
      setTx(last);
      await refresh();
      onDone(r.mint, last);
    };
    go().catch((e) => setP((x) => ({ ...x, err: txError(e) })));
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps
  const filled = Math.min(20, Math.round(((p.i + 0.5) / LSTEPS.length) * 20));
  return (
    <>
      <div className="dlg-body">
        <ul className="progress">{LSTEPS.map((s, k) => <li key={s} className={k < p.i ? 'done' : k === p.i && !p.err ? 'cur' : ''}><span>{k < p.i ? '✓' : k === p.i ? (p.err ? '✕' : '▸') : ' '}</span>{s}</li>)}</ul>
        <div className="hp" style={{ marginTop: 6 }}>{Array.from({ length: 20 }, (_, n) => <i key={n} className={n < filled ? 'on' : ''} />)}</div>
        {tx && <p className="foot-note"><a href={txUrl(tx)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>Tx {short(tx)}</a></p>}
        {p.err && <div className="status bad">{p.err}</div>}
        <p className="foot-note">Keep this page open until the launch finishes. Recovery is kept only in this session; do not reload. A retry checks any submitted transaction first.</p>
      </div>
      {p.err && (
        <div className="dlg-foot">
          {!partial && <button className="btn ghost" onClick={app.closeDialog}>Close</button>}
          {done.current.created && !done.current.pending && <button className="btn ghost" onClick={() => onDone(mint.publicKey.toBase58(), done.current.created!)}>Finish without first buy</button>}
          <button className="btn" onClick={() => { setP({ i: 0 }); setRun((n) => n + 1); }}>{done.current.pending ? 'Check status and resume' : 'Try again'}</button>
        </div>
      )}
    </>
  );
}

function LaunchDone({ ticker, token, tx }: { ticker: string; token: string; tx: string }) {
  const app = useApp();
  const router = useRouter();
  return (
    <>
      <div className="dlg-body">
        <p><b>${ticker}</b> is live on {NETWORK_NAME}.</p>
        <p className="mono muted" style={{ fontSize: 13 }}><a href={txUrl(tx)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>Tx {short(tx)}</a></p>
      </div>
      <div className="dlg-foot">
        <button className="btn ghost" onClick={app.closeDialog}>OK</button>
        <button className="btn" onClick={() => { app.closeDialog(); router.push(`/coin/${token}`); }}>View coin</button>
      </div>
    </>
  );
}

export function LaunchView() {
  const app = useApp();
  const [step, setStep] = useState(0);
  const [w, setW] = useState<Form>(EMPTY);
  const [tried, setTried] = useState(false);
  /* The coin's address is chosen now, so the sprite you roll is the sprite the coin keeps. */
  const [mint, setMint] = useState<Keypair | null>(null);
  const [logo, setLogo] = useState<{ blob: Blob; url: string } | null>(null);
  const [logoOn, setLogoOn] = useState(false);
  const [logoErr, setLogoErr] = useState('');
  useEffect(() => { void logosEnabled().then(setLogoOn); }, []);
  useEffect(() => () => { if (logo) URL.revokeObjectURL(logo.url); }, [logo]);
  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    try { const blob = await prepareLogo(file); setLogo({ blob, url: URL.createObjectURL(blob) }); setLogoErr(''); } catch (e) { setLogoErr(e instanceof Error ? e.message : 'That image could not be used.'); }
  };
  useEffect(() => { setMint(Keypair.generate()); }, []); /* after mount: a random key during render would not match the server's HTML */
  const mintStr = mint?.publicKey.toBase58() ?? '';
  const g = app.pump?.global ?? null;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setW((f) => ({ ...f, [k]: v }));
  const errs = errorsFor(step, w);
  const err = (k: string) => (tried && errs[k] ? <small className="err">{errs[k]}</small> : null);
  const [, title, sub] = STEPS[step];

  const next = () => { setTried(true); if (Object.keys(errs).length) return; setTried(false); setStep((s) => s + 1); };
  const back = () => { setStep((s) => Math.max(0, s - 1)); setTried(false); };
  const launch = () => app.needWallet('A wallet is needed to launch.', () => app.needRisk(() => {
    if (!mint) return;
    const snapshot = w, key = mint;
    app.showDialog({
      title: 'Launching…',
      locked: true,
      node: <LaunchProgress form={snapshot} mint={key} logo={logo?.blob ?? null} onDone={(token, tx) => {
        setW(EMPTY); setLogo(null); setMint(Keypair.generate()); setStep(0); setTried(false);
        app.toast('LEVEL CLEAR', `$${snapshot.ticker.toUpperCase()} launched.`);
        app.showDialog({ title: 'LEVEL CLEAR', node: <LaunchDone ticker={snapshot.ticker.toUpperCase()} token={token} tx={tx} /> });
      }} />,
    });
  }));

  const buyLamports = useMemo(() => (w.buy.trim() ? lamportsOf(w.buy) : null), [w.buy]);
  const devBuy = useMemo(() => {
    if (!app.pump || !buyLamports) return null;
    try {
      const t = getBuyTokenAmountFromSolAmount({ global: app.pump.global, feeConfig: app.pump.feeConfig, mintSupply: null, bondingCurve: null, amount: buyLamports, quoteMint: NATIVE_MINT });
      return t.gtn(0) ? t : null;
    } catch { return null; }
  }, [app.pump, buyLamports]);
  const curve = useMemo(() => {
    if (!g) return null;
    const pts = curvePreview(g);
    const top = pts[pts.length - 1].price, bot = pts[0].price;
    return pts.map((p, i) => `${i ? 'L' : 'M'}${(p.progress * 400).toFixed(1)} ${(112 - ((p.price - bot) / (top - bot || 1)) * 108).toFixed(1)}`).join(' ');
  }, [g]);
  const target = g ? toSol(g.initialVirtualSolReserves) : 0;
  const paused = !!g && !g.createV2Enabled;
  return (
    <>
      <div className="eyebrow">Select player · step {step + 1} of 4</div>
      <h1 style={{ margin: '14px 0 26px' }}>Launch a coin</h1>
      <div className="wiz">
        <ol className="wiz-steps" aria-label="Steps">
          {STEPS.map(([l], i) => <li key={l} className={i === step ? 'cur' : i < step ? 'done' : ''}><b>{i < step ? '✓' : i + 1}</b><span>{l}</span></li>)}
        </ol>
        <div className="screen">
          <div className="form">
            <div><h2>{title}</h2><p className="muted" style={{ margin: '10px 0 0' }}>{sub}</p></div>
            <div style={{ display: 'grid', gap: 18 }}>
              {step === 0 && (
                <>
                  <div className="field"><label className="label" htmlFor="wn">Coin name</label><input id="wn" type="text" value={w.name} onChange={(e) => set('name', e.target.value)} maxLength={32} placeholder="Fermat Last Margin" autoComplete="off" />{err('name')}</div>
                  <div className="field"><label className="label" htmlFor="wt">Ticker</label><input id="wt" type="text" value={w.ticker} onChange={(e) => set('ticker', e.target.value)} maxLength={10} placeholder="FERMAT" autoComplete="off" style={{ textTransform: 'uppercase' }} />{err('ticker')}</div>
                  <div className="field">
                    <span className="label">Logo</span>
                    <div className="drop">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {logo ? <img className="px" src={logo.url} alt="Logo preview" width={88} height={88} /> : mint ? <img className="px" src={`/api/sprite/${mintStr}`} alt="Logo preview" width={88} height={88} /> : <span style={{ width: 88, height: 88, display: 'inline-block' }} />}
                      <div style={{ display: 'grid', gap: 10 }}>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {!logo && <button className="btn sm ghost" type="button" onClick={() => setMint(Keypair.generate())}>Roll a sprite</button>}
                          {logoOn && <label className="btn sm ghost" style={{ cursor: 'pointer' }}>{logo ? 'Choose another image' : 'Upload an image'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => { void pickLogo(e.target.files?.[0]); e.target.value = ''; }} /></label>}
                          {logo && <button className="btn sm ghost" type="button" onClick={() => setLogo(null)}>Use the sprite</button>}
                        </div>
                        {logoErr && <small className="err">{logoErr}</small>}
                        <small className="mono muted">{logo ? 'Your image is cropped to a square and stored when you launch. It cannot be changed afterwards.' : logoOn ? `Or keep the pixel sprite, drawn from the coin's address (${mint ? short(mintStr) : '…'}); rolling picks a new address.` : `The sprite is drawn from the coin's address (${mint ? short(mintStr) : '…'}), so rolling picks a new address.`}</small>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {step === 1 && (
                <>
                  <div className="field"><label className="label" htmlFor="ws">Theorem statement</label><textarea id="ws" value={w.stmt} onChange={(e) => set('stmt', e.target.value)} placeholder="For every n greater than 2, xⁿ + yⁿ = zⁿ has no positive integer solutions." />{err('stmt')}<small>{bytes(w.stmt.trim())}/{STMT_MAX} bytes. Written in the launch transaction memo.</small></div>
                  <div><span className="label">Live preview</span><div className="preview-stmt" style={{ marginTop: 8 }}>{w.stmt.trim() ? w.stmt : <span className="muted">Your statement appears here.</span>}</div></div>
                </>
              )}
              {step === 2 && (
                <>
                  <div className="two">
                    <div className="field"><span className="label">Trades against</span><div className="mono" style={{ padding: '12px 0' }}>SOL</div><small>On the pump.fun bonding curve.</small></div>
                    <div className="field"><span className="label">Creator</span><div className="mono" style={{ padding: '12px 0' }}>{app.connected ? short(app.address) : 'Your wallet'}</div><small>Creator fees follow pump.fun&apos;s own rules.</small></div>
                  </div>
                  <div className="field"><label className="label" htmlFor="wbuy">First buy (SOL, optional)</label><input id="wbuy" type="text" inputMode="decimal" value={w.buy} onChange={(e) => set('buy', e.target.value)} placeholder="0.05" />{err('buy')}{devBuy && <small>≈ {fmt(toTokens(devBuy))} ${w.ticker.toUpperCase() || 'TOKENS'} at the opening price.</small>}</div>
                  <div><span className="label">Bonding curve preview</span>
                    <div className="curve crt" style={{ marginTop: 8 }}>
                      <svg viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
                        {curve ? <><path d={curve} fill="none" stroke="#3de8a0" strokeWidth="3" /><path d={`${curve} V120 H0Z`} fill="rgba(61,232,160,.12)" /></> : null}
                      </svg>
                    </div>
                    <small className="muted">{g ? 'Price rises as tokens are bought, then the coin graduates to PumpSwap when the curve is full.' : 'Reading the launch terms…'}</small>
                  </div>
                </>
              )}
              {step === 3 && (
                <>
                  <div className="review">
                    <div><dt>Name</dt><dd>{w.name}</dd></div><div><dt>Ticker</dt><dd>${w.ticker.toUpperCase()}</dd></div><div><dt>Theorem</dt><dd>{w.stmt}</dd></div>
                    <div><dt>Logo</dt><dd>{logo ? 'Your image' : 'Pixel sprite'}</dd></div>
                    <div><dt>Address</dt><dd className="mono">{mint ? short(mintStr) : '…'}</dd></div>
                    <div><dt>Pair</dt><dd>SOL (pump.fun curve)</dd></div>
                    <div><dt>First buy</dt><dd>{buyLamports ? `${w.buy} SOL quote; up to ${fmt(toSol(buyLamports) * 1.01)} SOL with 1% slippage` : 'None'}</dd></div>
                    <div><dt>Network fees</dt><dd>Additional SOL is needed for transaction fees and account rent.</dd></div>
                    <div><dt>Rigor score</dt><dd>An AI estimate appears on the coin after launch. It is not a proof check.</dd></div>
                  </div>
                  {app.market.error && <div className="status bad">Could not read pump.fun from {NETWORK_NAME}. Try again in a moment.</div>}
                  {paused && <div className="status bad">pump.fun has paused new launches on this network.</div>}
                  {IS_TEST && <div className="status">Devnet: coins here are for testing and have no value. Use a devnet wallet with free SOL.</div>}
                  {!app.connected && <div className="status">Connect a wallet to launch. Everything above is saved.</div>}
                </>
              )}
            </div>
          </div>
          <div className="wiz-foot">
            <button className="btn ghost" onClick={back} disabled={step === 0}>← Back</button>
            {step === 3 ? <button className="btn" onClick={launch} disabled={!g || paused || !mint}>{app.connected ? '▶ Launch' : 'Insert coin · connect wallet'}</button> : <button className="btn" onClick={next}>Next →</button>}
          </div>
        </div>
      </div>
    </>
  );
}
