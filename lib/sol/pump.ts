import './polyfill';
import BN from 'bn.js';
import { NATIVE_MINT, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';
import {
  OnlinePumpSdk, PUMP_SDK, bondingCurvePda, getBuyTokenAmountFromSolAmount, getSellSolAmountFromTokenAmount,
  type BondingCurve, type FeeConfig, type Global,
} from '@pump-fun/pump-sdk';
import { LAMPORTS, TOKEN_DECIMALS } from './config';

export { PUMP_SDK, OnlinePumpSdk, bondingCurvePda, BN, NATIVE_MINT, TOKEN_2022_PROGRAM_ID };
export type { BondingCurve, FeeConfig, Global };

export const toSol = (lamports: BN | bigint | number) => Number(lamports.toString()) / LAMPORTS;
export const toTokens = (raw: BN | bigint | number) => Number(raw.toString()) / 10 ** TOKEN_DECIMALS;
export const lamportsOf = (sol: string): BN | null => {
  const v = sol.trim().replace(',', '.');
  if (!/^\d*\.?\d+$|^\d+\.?$/.test(v)) return null;
  const [w, f = ''] = v.replace(/\.$/, '').split('.');
  const out = new BN(w || '0').mul(new BN(LAMPORTS)).add(new BN((f + '000000000').slice(0, 9)));
  return out.gtn(0) ? out : null;
};
export const rawOf = (tokens: string): BN | null => {
  const v = tokens.trim().replace(',', '.');
  if (!/^\d*\.?\d+$|^\d+\.?$/.test(v)) return null;
  const [w, f = ''] = v.replace(/\.$/, '').split('.');
  const out = new BN(w || '0').mul(new BN(10 ** TOKEN_DECIMALS)).add(new BN((f + '000000').slice(0, TOKEN_DECIMALS)));
  return out.gtn(0) ? out : null;
};

/** SOL per whole token, from the curve's virtual reserves. */
export const priceOf = (c: BondingCurve) =>
  c.virtualTokenReserves.isZero() ? 0 : toSol(c.virtualQuoteReserves) / toTokens(c.virtualTokenReserves);

export type Ctx = { global: Global; feeConfig: FeeConfig | null };

export function quoteBuy(ctx: Ctx, curve: BondingCurve, lamports: BN) {
  if (curve.complete) return null;
  try {
    const tokens = getBuyTokenAmountFromSolAmount({ global: ctx.global, feeConfig: ctx.feeConfig, mintSupply: curve.tokenTotalSupply, bondingCurve: curve, amount: lamports, quoteMint: NATIVE_MINT });
    if (tokens.lten(0)) return null;
    const exec = toSol(lamports) / toTokens(tokens);
    return { tokens, impact: priceOf(curve) > 0 ? (exec / priceOf(curve) - 1) * 100 : 0 };
  } catch { return null; }
}

export function quoteSell(ctx: Ctx, curve: BondingCurve, raw: BN) {
  if (curve.complete) return null;
  try {
    const lamports = getSellSolAmountFromTokenAmount({ global: ctx.global, feeConfig: ctx.feeConfig, mintSupply: curve.tokenTotalSupply, bondingCurve: curve, amount: raw });
    if (lamports.lten(0)) return null;
    const exec = toSol(lamports) / toTokens(raw);
    return { lamports, impact: priceOf(curve) > 0 ? (1 - exec / priceOf(curve)) * 100 : 0 };
  } catch { return null; }
}

/** Share of the curve's token supply sold so far, 0–1. */
export const progressOf = (c: BondingCurve, g: Global) => {
  if (c.complete) return 1;
  const init = g.initialRealTokenReserves;
  if (init.isZero()) return 0;
  return Math.min(1, Math.max(0, 1 - Number(c.realTokenReserves.toString()) / Number(init.toString())));
};

/** Points for drawing a curve before it exists: price (SOL per token) against share of tokens sold. */
export function curvePreview(g: Global, steps = 48) {
  const vq0 = Number(g.initialVirtualSolReserves.toString()), vt0 = Number(g.initialVirtualTokenReserves.toString());
  const sold = Number(g.initialRealTokenReserves.toString());
  const k = vq0 * vt0;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const vt = vt0 - (sold * i) / steps, vq = k / vt;
    return { progress: i / steps, price: vq / LAMPORTS / (vt / 10 ** TOKEN_DECIMALS) };
  });
}

export const online = (c: Connection) => new OnlinePumpSdk(c);
export const curveAddress = (mint: PublicKey | string) => bondingCurvePda(mint);
