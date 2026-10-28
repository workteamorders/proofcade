'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AppContext, type AppCtx, type DialogSpec } from '@/lib/app';
import { type ChatMsg, type Coin } from '@/lib/data';
import { audio, sfx } from '@/lib/audio';
import { short } from '@/lib/util';
import { ago, readCostBasis, readHoldings, readMarket, type Market } from '@/lib/sol/market';
import type { Wallet } from '@/lib/sol/tx';
import { AccountDialog, ConnectDialog, RiskDialog } from './dialogs';

type Toast = { id: number; title: string; text: string };
const NO_COINS: Coin[] = [];

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const qc = useQueryClient();

  /* ---- wallet (Solana wallet adapter) ---- */
  const { connection: conn } = useConnection();
  const w = useWallet();
  const pk = w.publicKey;
  const address = pk?.toBase58();
  const connected = w.connected && !!pk;
  const balQ = useQuery({
    queryKey: ['sol-balance', address],
    enabled: connected,
    refetchInterval: 12_000,
    queryFn: () => conn.getBalance(pk!, 'confirmed'),
  });
  const [riskOK, setRiskOK] = useState(false);
  const live = useRef({ connected, riskOK });
  live.current = { connected, riskOK };
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
  const wasConnected = useRef(false);
  useEffect(() => {
    if (connected && !wasConnected.current) {
      setDialog((d) => (d && d.title === 'Insert coin' ? null : d));
      toast('PLAYER 1 READY', `${short(address!)} connected.`);
      const p = pendingWallet.current; pendingWallet.current = null;
      if (p) setTimeout(p, 0);
    }
    if (!connected && wasConnected.current) toast('GAME OVER', 'Wallet disconnected.');
    wasConnected.current = connected;
  }, [connected, address, toast]);

  const disconnect = useCallback(() => { void w.disconnect().catch(() => {}); setDialog(null); }, [w]);

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

  const sendTransaction = w.sendTransaction;
  const signer = useMemo<Wallet | null>(() => (pk ? { publicKey: pk, sendTransaction: sendTransaction as Wallet['sendTransaction'] } : null), [pk, sendTransaction]);

  /* ---- market, straight from the chain ---- */
  const marketQ = useQuery({
    queryKey: ['market'],
    refetchInterval: 20_000,
    queryFn: () => readMarket(conn, qc.getQueryData<Market>(['market'])),
  });
  const coins = marketQ.data?.coins ?? NO_COINS;
  const pump = useMemo(() => (marketQ.data ? { global: marketQ.data.global, feeConfig: marketQ.data.feeConfig } : null), [marketQ.data]);

  const holdQ = useQuery({
    queryKey: ['holdings', address, coins.length],
    enabled: connected && coins.length > 0,
    refetchInterval: 20_000,
    queryFn: () => readHoldings(conn, pk!, coins),
  });
  const costQ = useQuery({
    queryKey: ['cost', address, coins.length],
    enabled: connected && coins.length > 0,
    staleTime: 60_000,
    queryFn: () => readCostBasis(conn, pk!, coins),
  });
  const holdings = useMemo(() => (connected ? holdQ.data ?? {} : {}), [connected, holdQ.data]);
  const costBasis = useMemo(() => (connected ? costQ.data ?? {} : {}), [connected, costQ.data]);
  const myCoins = useMemo(() => coins.map((c) => (address && c.creator === address ? { ...c, mine: true } : c)), [coins, address]);
  const getCoin = useCallback((id: string) => myCoins.find((c) => c.id === id), [myCoins]);

  const refresh = useCallback(async () => {
    await Promise.all(['market', 'holdings', 'cost', 'sol-balance', 'trades', 'user-trades'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  }, [qc]);

  /* ---- callouts: on-chain activity, plus posts kept in this browser ---- */
  const [posts, setPosts] = useState<ChatMsg[]>([]);
  const [toastsOn, setToastsOn] = useState(true);
  const sys = useMemo<ChatMsg[]>(() => {
    const now = Date.now() / 1000;
    return coins.slice().sort((a, b) => b.order - a.order).slice(0, 30).map((c): ChatMsg => ({ id: c.order, kind: 'sys', who: 'THEOREM', text: `$${c.ticker} launched.`, coinId: c.id, ago: `${ago(c.created, now)} ago`, re: { r: 0, e: 0, s: 0 }, me: {} }));
  }, [coins]);
  const [reacts, setReacts] = useState<Record<number, { me: ChatMsg['me']; re: ChatMsg['re'] }>>({});
  const msgs = useMemo(() => [...posts, ...sys].map((m) => (reacts[m.id] ? { ...m, ...reacts[m.id] } : m)), [posts, sys, reacts]);
  const postMsg = useCallback((text: string) => {
    setPosts((m) => [{ id: Date.now(), kind: 'user', who: address ? short(address) : 'you', text, coinId: '', ago: 'just now', re: { r: 0, e: 0, s: 0 }, me: {} }, ...m]);
  }, [address]);
  const react = useCallback((id: number, k: 'r' | 'e' | 's') => {
    setReacts((rs) => {
      const m = [...posts, ...sys].find((x) => x.id === id); if (!m) return rs;
      const cur = rs[id] ?? { me: m.me, re: m.re };
      const on = !cur.me[k];
      return { ...rs, [id]: { me: { ...cur.me, [k]: on }, re: { ...cur.re, [k]: cur.re[k] + (on ? 1 : -1) } } };
    });
  }, [posts, sys]);

  /* ambient callout toasts, away from the Live page */
  const ambient = useRef({ toastsOn, pathname, msgs });
  ambient.current = { toastsOn, pathname, msgs };
  useEffect(() => {
    let seen: number | null = null;
    const id = setInterval(() => {
      const a = ambient.current;
      const top = a.msgs[0];
      if (!top) return;
      if (seen === null) { seen = top.id; return; }
      if (top.id !== seen) {
        seen = top.id;
        if (a.toastsOn && a.pathname !== '/live') toast('NEW CALLOUT', `${top.who}: ${top.text.slice(0, 80)}`);
      }
    }, 6000);
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

  const market = useMemo(() => ({
    loading: marketQ.isLoading,
    error: marketQ.error ? 'Could not read Solana. The RPC did not answer.' : null,
    ready: !!marketQ.data,
  }), [marketQ.isLoading, marketQ.error, marketQ.data]);
  const balance = balQ.data != null ? balQ.data / 1e9 : 0;

  const value: AppCtx = useMemo(() => ({
    connected, address: address ?? '', balance, holdings, costBasis, conn, signer, pump,
    openWallet, disconnect, needWallet, needRisk, acceptRisk,
    coins: myCoins, getCoin, market, refresh, msgs, postMsg, react, toastsOn, setToastsOn,
    toast, showDialog, closeDialog, sfxOn, toggleSfx,
  }), [connected, address, balance, holdings, costBasis, conn, signer, pump, openWallet, disconnect, needWallet, needRisk, acceptRisk,
    myCoins, getCoin, market, refresh, msgs, postMsg, react, toastsOn, toast, showDialog, closeDialog, sfxOn, toggleSfx]);

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
