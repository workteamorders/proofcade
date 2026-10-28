'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { ChatMsg, Coin } from './data';
import type { Connection } from '@solana/web3.js';
import type { Ctx } from './sol/pump';
import type { Wallet } from './sol/tx';

export type DialogSpec = { title: string; node: ReactNode };

export type AppCtx = {
  /* wallet (Solana wallet adapter) */
  connected: boolean;
  address: string;
  /** SOL balance. */
  balance: number;
  /** Token balances per coin id, from the chain. */
  holdings: Record<string, number>;
  /** Average SOL paid per token, from the wallet's recent buys. */
  costBasis: Record<string, number>;
  /** RPC connection and the wallet's signer, for building and sending transactions. */
  conn: Connection;
  signer: Wallet | null;
  /** pump.fun global settings and fee schedule, for quotes. */
  pump: Ctx | null;
  openWallet: () => void;
  disconnect: () => void;
  /** Run fn once a wallet is connected. Opens the connect dialog if needed. */
  needWallet: (reason: string, fn: () => void) => void;
  /** Run fn once the one-time risk notice has been accepted. */
  needRisk: (fn: () => void) => void;
  acceptRisk: () => void;
  /* market, read from the chain */
  coins: Coin[];
  getCoin: (id: string) => Coin | undefined;
  market: { loading: boolean; error: string | null; ready: boolean };
  /** Re-read the chain now (after a transaction). */
  refresh: () => Promise<void>;
  /* callouts: on-chain activity plus posts kept in this browser */
  msgs: ChatMsg[];
  postMsg: (text: string) => void;
  react: (id: number, k: 'r' | 'e' | 's') => void;
  toastsOn: boolean;
  setToastsOn: (v: boolean) => void;
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
