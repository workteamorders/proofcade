import './polyfill';
import { PublicKey, type ParsedTransactionWithMeta, type Connection } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import type { Coin } from '../data';
import { LAMPORTS, MEMO_TAG, TAG, TOKEN_DECIMALS } from './config';
import { PUMP_SDK, bondingCurvePda, online, priceOf, progressOf, toSol, toTokens, type BondingCurve, type FeeConfig, type Global } from './pump';

/* ---------------- time ---------------- */
export function ago(ts: number, now = Date.now() / 1000): string {
  const s = Math.max(0, now - ts);
  if (s < 90) return 'moments';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}

/* ---------------- types ---------------- */
type Known = { id: string; curve: string; creator: string; name: string; symbol: string; statement: string; logo?: boolean; created: number; order: number };
export type Market = {
  coins: Coin[];
  global: Global;
  feeConfig: FeeConfig | null;
  known: Record<string, Known>;
  /** Launch memos whose coin does not exist yet: the memo lands a moment before the coin does. */
  pending?: Record<string, PendingLaunch>;
  /** Newest launch signature fully read, so unresolved transactions are retried. */
  newest?: string;
};
export type Trade = { sig: string; coin: string; side: 'buy' | 'sell'; trader: string; sol: number; tokens: number; price: number; time: number | null };

/* ---------------- launches ---------------- */
type Memo = { t: string; m: string; n: string; s: string; x: string; l?: 1 };
type PendingLaunch = { memo: Memo; payer: string; time: number; i: number };
const PENDING_SECONDS = 3600;

/** The Theorem memo of a launch transaction, with the wallet that paid for it. */
function readLaunch(tx: ParsedTransactionWithMeta | null): { memo: Memo; payer: string; time: number } | null {
  if (!tx || !tx.meta || tx.meta.err) return null;
  const keys = tx.transaction.message.accountKeys;
  const payer = keys[0]?.pubkey.toBase58();
  if (!payer) return null;
  for (const ix of tx.transaction.message.instructions) {
    const p = ix as { program?: string; parsed?: unknown };
    if (p.program !== 'spl-memo' || typeof p.parsed !== 'string') continue;
    try {
      const memo = JSON.parse(p.parsed);
      if (!memo || typeof memo !== 'object' || Array.isArray(memo) || Object.keys(memo).length !== (memo.l === undefined ? 5 : 6)) continue;
      if (memo.l !== undefined && memo.l !== 1) continue;
      if (memo.t !== MEMO_TAG || typeof memo.m !== 'string' || typeof memo.n !== 'string' || typeof memo.s !== 'string' || typeof memo.x !== 'string') continue;
      if (new PublicKey(memo.m).toBase58() !== memo.m) continue;
      if (!memo.n.trim() || Buffer.byteLength(memo.n, 'utf8') > 32 || !/^[a-zA-Z0-9]{2,10}$/.test(memo.s)) continue;
      if (memo.x.trim().length < 12 || Buffer.byteLength(memo.x, 'utf8') > 280) continue;
      return { memo, payer, time: tx.blockTime ?? 0 };
    } catch { /* not ours */ }
  }
  return null;
}

async function parsedTxs(conn: Connection, sigs: string[]): Promise<(ParsedTransactionWithMeta | null)[]> {
  const out: (ParsedTransactionWithMeta | null)[] = [];
  for (let i = 0; i < sigs.length; i += 25) {
    out.push(...(await conn.getParsedTransactions(sigs.slice(i, i + 25), { maxSupportedTransactionVersion: 0, commitment: 'confirmed' })));
  }
  return out;
}

async function curves(conn: Connection, ids: string[]): Promise<(BondingCurve | null)[]> {
  const out: (BondingCurve | null)[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const infos = await conn.getMultipleAccountsInfo(ids.slice(i, i + 100).map((m) => bondingCurvePda(m)), 'confirmed');
    out.push(...infos.map((a) => (a ? PUMP_SDK.decodeBondingCurveNullable(a) : null)));
  }
  return out;
}

export async function readMarket(conn: Connection, prev?: Market): Promise<Market> {
  const sdk = online(conn);
  const [global, feeConfig] = await Promise.all([sdk.fetchGlobal(), sdk.fetchFeeConfig().catch(() => null)]);

  /* 1. new launches: signatures that reference the Theorem tag */
  const sigs: string[] = [];
  let before: string | undefined;
  let newest = prev?.newest;
  for (let page = 0; page < 4; page++) {
    const batch = await conn.getSignaturesForAddress(TAG, { before, until: prev?.newest, limit: 1000 }, 'confirmed');
    if (page === 0 && batch.length) newest = batch[0].signature;
    sigs.push(...batch.filter((s) => !s.err).map((s) => s.signature));
    if (batch.length < 1000) break;
    before = batch[batch.length - 1].signature;
  }
  const known: Record<string, Known> = { ...(prev?.known ?? {}) };
  const pending: Record<string, PendingLaunch> = { ...(prev?.pending ?? {}) };
  if (sigs.length) {
    const txs = await parsedTxs(conn, sigs);
    /* A confirmed signature can precede its parsed transaction on the RPC node. */
    if (sigs.some((_, i) => !txs[i])) newest = prev?.newest;
    const found = txs.flatMap((t, i) => { const l = readLaunch(t); return l ? [{ ...l, i }] : []; }).reverse(); /* oldest first */
    for (const f of found) if (!known[f.memo.m]) pending[`${f.memo.m}:${f.payer}`] = f;
  }
  const fresh = Object.entries(pending).filter(([, f]) => !known[f.memo.m]);
  if (fresh.length) {
    const cs = await curves(conn, fresh.map(([, f]) => f.memo.m));
    const nowS = Date.now() / 1000;
    fresh.forEach(([key, f], k) => {
      const c = cs[k], m = f.memo.m;
      if (!c) { if (nowS - f.time > PENDING_SECONDS) delete pending[key]; return; } /* the coin may still be on its way */
      delete pending[key];
      /* the coin must belong to the wallet that paid for the launch, or the memo is someone else's */
      if (c.creator.toBase58() !== f.payer) return;
      known[m] = { id: m, curve: bondingCurvePda(m).toBase58(), creator: f.payer, name: f.memo.n, symbol: f.memo.s, statement: f.memo.x, logo: f.memo.l === 1, created: f.time, order: f.time * 1000 + f.i };
    });
  }

  /* 2. live state of every known curve */
  const list = Object.values(known);
  const state = await curves(conn, list.map((k) => k.id));
  const now = Date.now() / 1000;
  const launchPrice = global.initialVirtualTokenReserves.isZero() ? 0 : toSol(global.initialVirtualSolReserves) / toTokens(global.initialVirtualTokenReserves);
  const coins: Coin[] = list.flatMap((k, i): Coin[] => {
    const c = state[i]; if (!c) return [];
    const price = priceOf(c);
    return [{
      id: k.id, ticker: k.symbol, name: k.name, statement: k.statement, logo: k.logo, rigor: null, formal: false, native: true,
      mcap: price * toTokens(c.tokenTotalSupply), raised: toSol(c.realQuoteReserves), progress: progressOf(c, global), age: ago(k.created, now),
      change: launchPrice > 0 ? (price / launchPrice - 1) * 100 : 0,
      address: k.id, creator: k.creator, price, phase: c.complete ? 1 : 0, order: k.order, curve: k.curve, created: k.created, launchPrice,
    }];
  });
  return { coins, global, feeConfig, known, pending, newest };
}

/* ---------------- trades ---------------- */
/**
 * A trade, read from the balance changes of a transaction rather than from program events: the curve's lamports
 * against the signer's balance of the coin. That holds however the program emits its events.
 */
function tradeOf(tx: ParsedTransactionWithMeta | null, coin: { id: string; curve: string }, sig: string): Trade | null {
  if (!tx || !tx.meta || tx.meta.err) return null;
  const keys = tx.transaction.message.accountKeys;
  const ci = keys.findIndex((k) => k.pubkey.toBase58() === coin.curve);
  if (ci < 0) return null;
  const payer = keys[0].pubkey.toBase58();
  const sum = (arr: typeof tx.meta.preTokenBalances) => (arr ?? []).filter((b) => b.mint === coin.id && b.owner === payer).reduce((a, b) => a + BigInt(b.uiTokenAmount.amount), 0n);
  const dTokens = sum(tx.meta.postTokenBalances) - sum(tx.meta.preTokenBalances);
  const dSol = tx.meta.postBalances[ci] - tx.meta.preBalances[ci];
  if (dTokens === 0n || dSol === 0) return null;
  const tokens = Math.abs(Number(dTokens)) / 10 ** TOKEN_DECIMALS, sol = Math.abs(dSol) / LAMPORTS;
  return { sig, coin: coin.id, side: dTokens > 0n ? 'buy' : 'sell', trader: payer, sol, tokens, price: sol / tokens, time: tx.blockTime ?? null };
}

/** The latest trades on one curve, newest first. */
export async function readTrades(conn: Connection, coin: { id: string; curve: string }, limit = 60): Promise<Trade[]> {
  const sigs = (await conn.getSignaturesForAddress(new PublicKey(coin.curve), { limit }, 'confirmed')).filter((s) => !s.err).map((s) => s.signature);
  const txs = await parsedTxs(conn, sigs);
  return txs.flatMap((t, i) => { const x = tradeOf(t, coin, sigs[i]); return x ? [x] : []; });
}

/** Coin balances (in whole tokens) of one wallet. */
export async function readHoldings(conn: Connection, owner: PublicKey, coins: Coin[]): Promise<Record<string, number>> {
  const ids = new Set(coins.map((c) => c.id));
  const out: Record<string, number> = {};
  for (const programId of [TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID]) {
    const r = await conn.getParsedTokenAccountsByOwner(owner, { programId }, 'confirmed');
    for (const a of r.value) {
      const info = a.account.data.parsed?.info; if (!info || !ids.has(info.mint)) continue;
      const amt = Number(info.tokenAmount.uiAmountString ?? info.tokenAmount.uiAmount ?? 0);
      if (amt > 0) out[info.mint] = (out[info.mint] ?? 0) + amt;
    }
  }
  return out;
}

/** Average SOL paid per token across a wallet's recent buys. Sells are ignored. */
export async function readCostBasis(conn: Connection, owner: PublicKey, coins: Coin[]): Promise<Record<string, number>> {
  if (!coins.length) return {};
  const sigs = (await conn.getSignaturesForAddress(owner, { limit: 100 }, 'confirmed')).filter((s) => !s.err).map((s) => s.signature);
  const txs = await parsedTxs(conn, sigs);
  const me = owner.toBase58();
  const q: Record<string, number> = {}, t: Record<string, number> = {};
  txs.forEach((tx, i) => {
    for (const c of coins) {
      const x = tradeOf(tx, c, sigs[i]);
      if (x && x.side === 'buy' && x.trader === me) { q[c.id] = (q[c.id] ?? 0) + x.sol; t[c.id] = (t[c.id] ?? 0) + x.tokens; }
    }
  });
  const out: Record<string, number> = {};
  for (const k of Object.keys(q)) if (t[k] > 0) out[k] = q[k] / t[k];
  return out;
}
