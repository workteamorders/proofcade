'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AppContext, type AppCtx, type DialogSpec, type TradeCheck } from '@/lib/app';
import { INITIAL_COINS, INITIAL_MSGS, INITIAL_PROOFS, type ChatMsg, type Coin, type ProofRow } from '@/lib/data';
import { audio, sfx } from '@/lib/audio';
import { short } from '@/lib/util';
import { AccountDialog, ConnectDialog, RiskDialog } from './dialogs';

const DEMO_ADDRESS = '0x7a3fb1e9c05d2480a6be1137d9c24a5f8e91c91e';
type Toast = { id: number; title: string; text: string };

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  /* ---- wallet (demo) ---- */
  const [connected, setConnected] = useState(false);
  const [balance, setBalance] = useState(1.284);
  const [holdings, setHoldings] = useState<Record<string, number>>({});
  const [costBasis, setCostBasis] = useState<Record<string, number>>({});
  const [riskOK, setRiskOK] = useState(false);
  /* refs let queued callbacks see the latest wallet state after the connect dialog resolves */
  const live = useRef({ connected, balance, holdings, riskOK });
  live.current = { connected, balance, holdings, riskOK };
  const pendingWallet = useRef<(() => void) | null>(null);
  const pendingRisk = useRef<(() => void) | null>(null);

  /* ---- ui ---- */
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sfxOn, setSfxOn] = useState(true);
  const lastFocus = useRef<HTMLElement | null>(null);
  const toastId = useRef(0);

  const toast = useCallback((title: string, text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, title, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4800);
  }, []);

  const showDialog = useCallback((d: DialogSpec) => {
    lastFocus.current = document.activeElement as HTMLElement | null;
    setDialog(d);
  }, []);
  const closeDialog = useCallback(() => {
    setDialog(null);
    setTimeout(() => { if (lastFocus.current?.isConnected) lastFocus.current.focus(); }, 0);
  }, []);

  const toggleSfx = useCallback(() => {
    const next = !audio.on;
    audio.on = next; setSfxOn(next);
    if (next) sfx.blip();
    toast(next ? 'SOUND ON' : 'SOUND OFF', next ? 'Arcade beeps and gunshots enabled.' : 'Muted.');
  }, [toast]);

  /* ---- wallet actions ---- */
  const completeConnect = useCallback((walletName: string) => {
    setConnected(true);
    setHoldings({ fermat: 1_200_000, prime: 640_000, gauss: 2_100_000 });
    setCostBasis({ fermat: 0.0031, prime: 0.0021, gauss: 0.0011 });
    live.current.connected = true;
    setDialog(null);
    toast('PLAYER 1 READY', `${walletName} connected on Robinhood Chain.`);
    const p = pendingWallet.current; pendingWallet.current = null;
    if (p) setTimeout(p, 0);
  }, [toast]);

  const disconnect = useCallback(() => {
    setConnected(false); setHoldings({}); setDialog(null);
    toast('GAME OVER', 'Wallet disconnected.');
  }, [toast]);

  const openWallet = useCallback(() => {
    showDialog(live.current.connected ? { title: 'Player 1', node: <AccountDialog /> } : { title: 'Insert coin', node: <ConnectDialog /> });
  }, [showDialog]);

  const needWallet = useCallback((reason: string, fn: () => void) => {
    if (live.current.connected) { fn(); return; }
    pendingWallet.current = fn;
    showDialog({ title: 'Insert coin', node: <ConnectDialog reason={reason} /> });
  }, [showDialog]);

  const needRisk = useCallback((fn: () => void) => {
    if (live.current.riskOK) { fn(); return; }
    pendingRisk.current = fn;
    showDialog({ title: 'Before you continue', node: <RiskDialog /> });
  }, [showDialog]);

  const acceptRisk = useCallback(() => {
    setRiskOK(true); live.current.riskOK = true; setDialog(null);
    const f = pendingRisk.current; pendingRisk.current = null;
    if (f) setTimeout(f, 0);
  }, []);

  const validateTrade = useCallback((coin: Coin, side: 'buy' | 'sell', amount: number): TradeCheck => {
    const l = live.current;
    if (side === 'buy' && amount > l.balance) return { ok: false, msg: 'Not enough ETH.' };
    if (side === 'sell' && amount > (l.holdings[coin.id] || 0)) return { ok: false, msg: `Not enough $${coin.ticker}.` };
    return { ok: true };
  }, []);

  const applyTrade = useCallback((coin: Coin, side: 'buy' | 'sell', amountIn: number, amountOut: number) => {
    if (side === 'buy') {
      setBalance((b) => b - amountIn);
      setHoldings((h) => ({ ...h, [coin.id]: (h[coin.id] || 0) + amountOut }));
      setCostBasis((c) => ({ ...c, [coin.id]: coin.price }));
    } else {
      setBalance((b) => b + amountOut);
      setHoldings((h) => ({ ...h, [coin.id]: (h[coin.id] || 0) - amountIn }));
    }
  }, []);

  /* ---- market ---- */
  const [coins, setCoins] = useState<Coin[]>(INITIAL_COINS);
  const addCoin = useCallback((c: Coin) => setCoins((cs) => [c, ...cs]), []);
  const getCoin = useCallback((id: string) => coins.find((c) => c.id === id), [coins]);

  /* ---- chat ---- */
  const [msgs, setMsgs] = useState<ChatMsg[]>(INITIAL_MSGS);
  const [toastsOn, setToastsOn] = useState(true);
  const postMsg = useCallback((text: string) => {
    setMsgs((m) => [{ id: Date.now(), kind: 'user', who: short(DEMO_ADDRESS), text, coinId: '', ago: 0, re: { r: 0, e: 0, s: 0 }, me: {} }, ...m]);
  }, []);
  const react = useCallback((id: number, k: 'r' | 'e' | 's') => {
    setMsgs((ms) => ms.map((m) => {
      if (m.id !== id) return m;
      const on = !m.me[k];
      return { ...m, me: { ...m.me, [k]: on }, re: { ...m.re, [k]: m.re[k] + (on ? 1 : -1) } };
    }));
  }, []);

  /* ---- verification ---- */
  const [proofs, setProofs] = useState<ProofRow[]>(INITIAL_PROOFS);
  const addProof = useCallback((coinId: string) => {
    setProofs((p) => [{ coinId, who: short(DEMO_ADDRESS), status: 'checking', ago: 'just now', mine: true }, ...p]);
  }, []);

  /* ambient callout toasts, away from the Live page */
  const ambient = useRef({ toastsOn, pathname, msgs });
  ambient.current = { toastsOn, pathname, msgs };
  useEffect(() => {
    const id = setInterval(() => {
      const a = ambient.current;
      if (!a.toastsOn || a.pathname === '/live') return;
      const m = a.msgs.find((x) => x.kind === 'user');
      if (m && Math.random() < 0.35) toast('NEW CALLOUT', `${m.who}: ${m.text.slice(0, 80)}`);
    }, 14000);
    return () => clearInterval(id);
  }, [toast]);

  /* dialog: Esc to close, focus the first control when it opens */
  const dlgRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDialog(); };
    document.addEventListener('keydown', onKey);
    const f = dlgRef.current?.querySelector<HTMLElement>('button:not([data-close]), input, select');
    (f || dlgRef.current?.querySelector<HTMLElement>('[data-close]'))?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [dialog, closeDialog]);

  const value: AppCtx = useMemo(() => ({
    connected, address: DEMO_ADDRESS, balance, holdings, costBasis,
    openWallet, disconnect, completeConnect, needWallet, needRisk, acceptRisk, validateTrade, applyTrade,
    coins, addCoin, getCoin, msgs, postMsg, react, toastsOn, setToastsOn, proofs, addProof,
    toast, showDialog, closeDialog, sfxOn, toggleSfx,
  }), [connected, balance, holdings, costBasis, openWallet, disconnect, completeConnect, needWallet, needRisk, acceptRisk, validateTrade, applyTrade,
    coins, addCoin, getCoin, msgs, postMsg, react, toastsOn, proofs, addProof, toast, showDialog, closeDialog, sfxOn, toggleSfx]);

  return (
    <AppContext.Provider value={value}>
      {children}
      {dialog && (
        <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) closeDialog(); }}>
          <div className="dlg" role="dialog" aria-modal="true" aria-label={dialog.title} ref={dlgRef}>
            <div className="dlg-head"><span>{dialog.title}</span><button data-close onClick={closeDialog} aria-label="Close">×</button></div>
            {dialog.node}
          </div>
        </div>
      )}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div className="toast" key={t.id}><b>{t.title}</b>{t.text}</div>)}
      </div>
    </AppContext.Provider>
  );
}
