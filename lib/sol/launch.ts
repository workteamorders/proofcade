import './polyfill';
import { Keypair, SystemProgram, TransactionInstruction, type Connection, type PublicKey } from '@solana/web3.js';
import { getBuyTokenAmountFromSolAmount } from '@pump-fun/pump-sdk';
import { CU, MEMO_PROGRAM_ID, MEMO_TAG, SITE_URL, TAG } from './config';
import { BN, NATIVE_MINT, PUMP_SDK, bondingCurvePda, online } from './pump';
import { buildTx, fits, run, type Step, type Wallet } from './tx';
import * as trade from './trade';

export type LaunchInput = { name: string; symbol: string; statement: string; devBuy: BN | null; mint: Keypair; slippagePct: number };

/** Metadata URI stored in the coin: a tiny route on this site that serves name, symbol and the sprite. */
export function metadataUri(mint: PublicKey, name: string, symbol: string): string {
  const origin = SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const full = `${origin}/api/meta/${mint.toBase58()}?n=${encodeURIComponent(name)}&s=${encodeURIComponent(symbol)}`;
  /* the metadata program caps the URI at 200 bytes */
  return full.length <= 200 ? full : `${origin}/api/meta/${mint.toBase58()}`;
}

/**
 * The memo that lets Theorem find and read its own launches: the mint, name, symbol and theorem statement.
 * The tag key rides on a zero-lamport self transfer, the way Solana Pay attaches a reference.
 */
export function marker(user: PublicKey, input: LaunchInput): TransactionInstruction[] {
  const memo = JSON.stringify({ t: MEMO_TAG, m: input.mint.publicKey.toBase58(), n: input.name, s: input.symbol, x: input.statement });
  const tag = SystemProgram.transfer({ fromPubkey: user, toPubkey: user, lamports: 0 });
  tag.keys.push({ pubkey: TAG, isSigner: false, isWritable: false });
  return [new TransactionInstruction({ programId: MEMO_PROGRAM_ID, keys: [], data: Buffer.from(memo, 'utf8') }), tag];
}

/** What has already happened in this launch, so a retry does not repeat it. */
export type LaunchState = { marker?: string; created?: string; bought?: string };

/**
 * Launch in up to three transactions, since one cannot hold the statement and the coin:
 *   1. the Theorem memo (so the site can find the coin),
 *   2. the coin itself (create_v2, Token-2022), with the first buy when it fits,
 *   3. the first buy on its own, when it did not fit.
 * `state` records what is done, so "try again" resumes instead of starting over.
 */
export async function launch(conn: Connection, w: Wallet, input: LaunchInput, step: Step, state: LaunchState = {}): Promise<{ mint: string; sigs: string[] }> {
  step('Reading pump.fun launch terms…');
  const sdk = online(conn);
  const [global, feeConfig] = await Promise.all([sdk.fetchGlobal(), sdk.fetchFeeConfig().catch(() => null)]);
  if (!global.createV2Enabled) throw new Error('pump.fun has paused new launches on this cluster.');
  const mint = input.mint.publicKey, user = w.publicKey;
  const uri = metadataUri(mint, input.name, input.symbol);
  const base = { mint, name: input.name, symbol: input.symbol, uri, creator: user, user, mayhemMode: false };
  const sigs: string[] = [];

  if (!state.marker) {
    state.marker = await run(conn, w, marker(user, input), { units: CU.marker, step, label: 'Confirm 1 of 2 in your wallet: the theorem…' });
    sigs.push(state.marker);
  }
  if (!state.created) {
    let ixs: TransactionInstruction[] = [await PUMP_SDK.createV2Instruction(base)];
    let withBuy = false;
    if (input.devBuy) {
      const amount = getBuyTokenAmountFromSolAmount({ global, feeConfig, mintSupply: null, bondingCurve: null, amount: input.devBuy, quoteMint: NATIVE_MINT });
      const together = await PUMP_SDK.createV2AndBuyInstructions({ global, ...base, amount, solAmount: input.devBuy });
      const { size } = await buildTx(conn, user, together, CU.launch);
      if (fits(size)) { ixs = together; withBuy = true; }
    }
    const sig = await run(conn, w, ixs, { units: CU.launch, signers: [input.mint], step, label: 'Confirm 2 of 2 in your wallet: the coin…' });
    state.created = sig; sigs.push(sig);
    if (withBuy) state.bought = sig;
  }
  if (input.devBuy && !state.bought) {
    step('Your first buy needs its own transaction…');
    /* the new curve can take a few seconds to show up on the RPC node */
    let seen = false;
    for (let i = 0; i < 15 && !seen; i++) {
      seen = !!(await conn.getAccountInfo(bondingCurvePda(mint), 'confirmed'));
      if (!seen) await new Promise((r) => setTimeout(r, 1000));
    }
    if (!seen) throw new Error('Your coin was created, but its first buy could not start yet. Press Try again in a moment.');
    const r = await trade.buy(conn, w, mint, input.devBuy, input.slippagePct, step);
    state.bought = r.sig; sigs.push(r.sig);
  }
  return { mint: mint.toBase58(), sigs };
}
