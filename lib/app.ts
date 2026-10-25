'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { ChatMsg, Coin, ProofRow } from './data';

export type DialogSpec = { title: string; node: ReactNode };

export type TradeCheck = { ok: true } | { ok: false; msg: string };

export type AppCtx = {
  /* wallet (mock: swap this block for wagmi/RainbowKit in the real app) */
  connected: boolean;
  address: string;
  balance: number;
  holdings: Record<string, number>;
  costBasis: Record<string, number>;
  openWallet: () => void;
  disconnect: () => void;
  completeConnect: (walletName: string) => void;
  /** Run fn once a wallet is connected. Opens the connect dialog if needed. */
  needWallet: (reason: string, fn: () => void) => void;
  /** Run fn once the one-time risk notice has been accepted. */
  needRisk: (fn: () => void) => void;
  acceptRisk: () => void;
  validateTrade: (coin: Coin, side: 'buy' | 'sell', amount: number) => TradeCheck;
  applyTrade: (coin: Coin, side: 'buy' | 'sell', amountIn: number, amountOut: number) => void;
  /* market */
  coins: Coin[];
  addCoin: (c: Coin) => void;
  getCoin: (id: string) => Coin | undefined;
  /* chat */
  msgs: ChatMsg[];
  postMsg: (text: string) => void;
  react: (id: number, k: 'r' | 'e' | 's') => void;
  toastsOn: boolean;
  setToastsOn: (v: boolean) => void;
  /* verification */
  proofs: ProofRow[];
  addProof: (coinId: string) => void;
  /* ui */
  toast: (title: string, text: string) => void;
  showDialog: (d: DialogSpec) => void;
  closeDialog: () => void;
  sfxOn: boolean;
  toggleSfx: () => void;
};

export const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const v = useContext(AppContext);
  if (!v) throw new Error('useApp must be used inside <Providers>');
  return v;
}
