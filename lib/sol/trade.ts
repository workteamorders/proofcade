import './polyfill';
import type { Connection, PublicKey } from '@solana/web3.js';
import { getBuyTokenAmountFromSolAmount, getSellSolAmountFromTokenAmount } from '@pump-fun/pump-sdk';
import { CU } from './config';
import { BN, NATIVE_MINT, PUMP_SDK, TOKEN_2022_PROGRAM_ID, online } from './pump';
import { run, type Step, type Wallet } from './tx';

/** Fresh global and fee schedule, so a trade is priced on current state. */
async function fresh(conn: Connection) {
  const sdk = online(conn);
  const [global, feeConfig] = await Promise.all([sdk.fetchGlobal(), sdk.fetchFeeConfig().catch(() => null)]);
  return { sdk, global, feeConfig };
}

export async function buy(conn: Connection, w: Wallet, mint: PublicKey, lamports: BN, slippagePct: number, step: Step) {
  step('Reading the curve…');
  const { sdk, global, feeConfig } = await fresh(conn);
  const { bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo } = await sdk.fetchBuyState(mint, w.publicKey, TOKEN_2022_PROGRAM_ID);
  if (bondingCurve.complete) throw new Error('This curve has finished: the coin has graduated and curve trading is closed.');
  const amount = getBuyTokenAmountFromSolAmount({ global, feeConfig, mintSupply: bondingCurve.tokenTotalSupply, bondingCurve, amount: lamports, quoteMint: NATIVE_MINT });
  if (amount.lten(0)) throw new Error('This amount is too small to buy any tokens.');
  const ixs = await PUMP_SDK.buyInstructions({ global, bondingCurveAccountInfo, bondingCurve, associatedUserAccountInfo, mint, user: w.publicKey, amount, solAmount: lamports, slippage: slippagePct, tokenProgram: TOKEN_2022_PROGRAM_ID });
  const sig = await run(conn, w, ixs, { units: CU.trade, step });
  return { sig, tokens: amount };
}

export async function sell(conn: Connection, w: Wallet, mint: PublicKey, raw: BN, slippagePct: number, step: Step) {
  step('Reading the curve…');
  const { sdk, global, feeConfig } = await fresh(conn);
  const { bondingCurveAccountInfo, bondingCurve } = await sdk.fetchSellState(mint, w.publicKey, TOKEN_2022_PROGRAM_ID);
  if (bondingCurve.complete) throw new Error('This curve has finished: the coin has graduated and curve trading is closed.');
  const solAmount = getSellSolAmountFromTokenAmount({ global, feeConfig, mintSupply: bondingCurve.tokenTotalSupply, bondingCurve, amount: raw });
  if (solAmount.lten(0)) throw new Error('This amount is too small to sell.');
  const ixs = await PUMP_SDK.sellInstructions({ global, bondingCurveAccountInfo, bondingCurve, mint, user: w.publicKey, amount: raw, solAmount, slippage: slippagePct, tokenProgram: TOKEN_2022_PROGRAM_ID, mayhemMode: bondingCurve.isMayhemMode });
  const sig = await run(conn, w, ixs, { units: CU.trade, step });
  return { sig, lamports: solAmount };
}
