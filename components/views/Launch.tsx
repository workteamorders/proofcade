'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/app';
import { type Coin } from '@/lib/data';
import { addrOf, hex, rng } from '@/lib/util';
import { avatar, setAvatar } from '@/lib/sprites';

const STEPS: [string, string, string][] = [
  ['Identity', 'Name your coin', 'Pick a name, ticker and logo. They can never be changed after launch.'],
  ['Theorem', 'State your theorem', 'Every Proofcade coin carries a mathematical statement and an AI rigor score.'],
  ['Economics', 'Set the economics', 'Choose what the coin trades against, your creator fee and an optional dev buy.'],
  ['Review', 'Review and launch', 'Check everything. Pons launch settings are permanent.'],
];

type Form = { name: string; ticker: string; logo: string | null; stmt: string; proof: string; pair: string; tax: string; buy: string };
const EMPTY: Form = { name: '', ticker: '', logo: null, stmt: '', proof: '', pair: 'ETH', tax: '0', buy: '' };

function errorsFor(step: number, w: Form): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 0) {
    if (!w.name.trim() || w.name.length > 32) e.name = 'Use 1–32 characters.';
    if (!/^[A-Za-z0-9]{2,10}$/.test(w.ticker)) e.ticker = 'Use 2–10 letters or digits.';
    if (!w.logo) e.logo = 'Choose a logo image.';
  }
  if (step === 1 && w.stmt.trim().length < 12) e.stmt = 'State the theorem in at least 12 characters.';
  if (step === 2) {
    const t = Number(w.tax || 0);
    if (!(t >= 0 && t <= 2)) e.tax = 'Pons allows 0–2%.';
    if (w.buy && !(Number(w.buy) >= 0)) e.buy = 'Enter an amount like 0.05.';
  }
  return e;
}

/** The staged "launching…" dialog. Calls onDone once the demo transaction has "confirmed". */
function LaunchProgress({ form, onDone }: { form: Form; onDone: (coin: Coin) => void }) {
  const app = useApp();
  const steps = ['Signing in with your wallet', 'Uploading logo and theorem to IPFS', 'Waiting for your signature', 'Confirming on Robinhood Chain', 'Recording the launch on Proofcade'];
  const [i, setI] = useState(0);
  const { coins, address } = app;
  useEffect(() => {
    if (i >= steps.length) {
      const t = form.ticker.toUpperCase();
      const maxOrder = coins.reduce((m, c) => Math.max(m, c.order), 0);
      onDone({ id: 'new' + Date.now(), ticker: t, name: form.name, statement: form.stmt, rigor: 72, formal: false, native: true, mcap: 0.02, vol: 0, progress: 0.01, age: '1 min', change: 0, address: addrOf(t), creator: address, price: 0.02 / 1e9, phase: 0, order: maxOrder + 1, mine: true });
      return;
    }
    const id = setTimeout(() => setI((n) => n + 1), 800);
    return () => clearTimeout(id);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const filled = Math.min(20, Math.round(((i + 0.5) / steps.length) * 20));
  return (
    <div className="dlg-body">
      <ul className="progress">{steps.map((s, k) => <li key={s} className={k < i ? 'done' : k === i ? 'cur' : ''}><span>{k < i ? '✓' : k === i ? '▸' : ' '}</span>{s}</li>)}</ul>
      <div className="hp" style={{ marginTop: 6 }}>{Array.from({ length: 20 }, (_, n) => <i key={n} className={n < filled ? 'on' : ''} />)}</div>
    </div>
  );
}

function LaunchDone({ coin }: { coin: Coin }) {
  const app = useApp();
  const router = useRouter();
  return (
    <>
      <div className="dlg-body">
        <p><b>${coin.ticker}</b> is live on Pons.</p>
        <p className="mono muted" style={{ fontSize: 13 }}>Tx 0x{hex(rng('l' + coin.id), 6)}… · Rigor scored: Σ 72</p>
      </div>
      <div className="dlg-foot">
        <button className="btn ghost" onClick={app.closeDialog}>OK</button>
        <button className="btn" onClick={() => { app.closeDialog(); router.push(`/coin/${coin.id}`); }}>View coin</button>
      </div>
    </>
  );
}

export function LaunchView() {
  const app = useApp();
  const [step, setStep] = useState(0);
  const [w, setW] = useState<Form>(EMPTY);
  const [tried, setTried] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setW((f) => ({ ...f, [k]: v }));
  const errs = errorsFor(step, w);
  const err = (k: string) => (tried && errs[k] ? <small className="err">{errs[k]}</small> : null);
  const [, title, sub] = STEPS[step];

  const next = () => { setTried(true); if (Object.keys(errs).length) return; setTried(false); setStep((s) => s + 1); };
  const back = () => { setStep((s) => Math.max(0, s - 1)); setTried(false); };
  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 1048576) { app.toast('TOO BIG', 'Use an image of 1 MB or less.'); return; }
    const r = new FileReader(); r.onload = () => set('logo', String(r.result)); r.readAsDataURL(f);
  };
  const launch = () => app.needWallet('A wallet is needed to launch.', () => app.needRisk(() => {
    const snapshot = w;
    app.showDialog({
      title: 'Launching…',
      node: <LaunchProgress form={snapshot} onDone={(coin) => {
        if (snapshot.logo) setAvatar(coin.id, snapshot.logo); else avatar(coin.id);
        app.addCoin(coin);
        setW(EMPTY); setStep(0); setTried(false);
        app.toast('LEVEL CLEAR', `$${coin.ticker} launched.`);
        app.showDialog({ title: 'LEVEL CLEAR', node: <LaunchDone coin={coin} /> });
      }} />,
    });
  }));

  const q = Number(w.buy) || 0;
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
                      <img className="px" src={w.logo || avatar('blank')} alt="Logo preview" width={88} height={88} />
                      <div style={{ display: 'grid', gap: 10 }}>
                        <label className="btn sm ghost" htmlFor="logo" style={{ cursor: 'pointer' }}>Choose image</label>
                        <input id="logo" className="sr" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => pickFile(e.target.files?.[0])} />
                        <button className="btn sm ghost" type="button" onClick={() => set('logo', avatar('roll' + Math.random()))}>Roll a sprite</button>
                        <small className="mono muted">PNG, JPG or WebP up to 1 MB. Shown pixelated.</small>
                      </div>
                    </div>
                    {err('logo')}
                  </div>
                </>
              )}
              {step === 1 && (
                <>
                  <div className="field"><label className="label" htmlFor="ws">Theorem statement</label><textarea id="ws" value={w.stmt} onChange={(e) => set('stmt', e.target.value)} placeholder="For every n greater than 2, xⁿ + yⁿ = zⁿ has no positive integer solutions." />{err('stmt')}<small>Math notation (LaTeX) is rendered live in the full app.</small></div>
                  <div><span className="label">Live preview</span><div className="preview-stmt" style={{ marginTop: 8 }}>{w.stmt.trim() ? w.stmt : <span className="muted">Your statement appears here.</span>}</div></div>
                  <div className="field"><label className="label" htmlFor="wp">Proof sketch (optional)</label><textarea id="wp" value={w.proof} onChange={(e) => set('proof', e.target.value)} placeholder="A few lines on why it holds." /></div>
                </>
              )}
              {step === 2 && (
                <>
                  <div className="two">
                    <div className="field"><label className="label" htmlFor="wpair">Trades against</label><select id="wpair" value={w.pair} onChange={(e) => set('pair', e.target.value)}>{['ETH', 'USDG', 'NVDA', 'SPY'].map((p) => <option key={p}>{p}</option>)}</select></div>
                    <div className="field"><label className="label" htmlFor="wtax">Creator fee %</label><input id="wtax" type="text" inputMode="decimal" value={w.tax} onChange={(e) => set('tax', e.target.value)} />{err('tax')}<small>Max 2%.</small></div>
                  </div>
                  <div className="field"><label className="label" htmlFor="wbuy">Dev buy ({w.pair}, optional)</label><input id="wbuy" type="text" inputMode="decimal" value={w.buy} onChange={(e) => set('buy', e.target.value)} placeholder="0.05" />{err('buy')}</div>
                  <div><span className="label">Bonding curve preview</span>
                    <div className="curve crt" style={{ marginTop: 8 }}>
                      <svg viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 112 C 120 108, 220 90, 300 52 S 380 8, 400 4" fill="none" stroke="#3de8a0" strokeWidth="3" /><path d="M0 112 C 120 108, 220 90, 300 52 S 380 8, 400 4 V120 H0Z" fill="rgba(61,232,160,.12)" /></svg>
                    </div>
                  </div>
                </>
              )}
              {step === 3 && (
                <>
                  <div className="review">
                    <div><dt>Name</dt><dd>{w.name}</dd></div><div><dt>Ticker</dt><dd>${w.ticker.toUpperCase()}</dd></div><div><dt>Theorem</dt><dd>{w.stmt}</dd></div>
                    <div><dt>Pair</dt><dd>{w.pair}</dd></div><div><dt>Creator fee</dt><dd>{w.tax || '0'}%</dd></div><div><dt>Dev buy</dt><dd>{q ? `${q} ${w.pair}` : 'None'}</dd></div><div><dt>Rigor score</dt><dd>Scored after you launch</dd></div>
                  </div>
                  {!app.connected && <div className="status">Connect a wallet to launch. Everything above is saved.</div>}
                </>
              )}
            </div>
          </div>
          <div className="wiz-foot">
            <button className="btn ghost" onClick={back} disabled={step === 0}>← Back</button>
            {step === 3 ? <button className="btn" onClick={launch}>{app.connected ? '▶ Launch' : 'Insert coin · connect wallet'}</button> : <button className="btn" onClick={next}>Next →</button>}
          </div>
        </div>
      </div>
    </>
  );
}
