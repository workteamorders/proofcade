import './polyfill';
import {
  ComputeBudgetProgram, TransactionMessage, VersionedTransaction,
  type Connection, type Keypair, type PublicKey, type TransactionInstruction,
} from '@solana/web3.js';
import { GENESIS_HASH, PRIORITY_MICROLAMPORTS } from './config';
import { SubmittedTransactionError } from './errors';

/** What the wallet adapter's `useWallet()` gives us. */
export type Wallet = {
  publicKey: PublicKey;
  sendTransaction: (tx: VersionedTransaction, conn: Connection, opts?: { signers?: Keypair[]; skipPreflight?: boolean }) => Promise<string>;
};

const MAX_TX_BYTES = 1232;

export async function buildTx(conn: Connection, payer: PublicKey, ixs: TransactionInstruction[], units: number) {
  if (await conn.getGenesisHash() !== GENESIS_HASH) throw new Error('RPC network does not match this app. Check the RPC configuration before continuing.');
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  const msg = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_MICROLAMPORTS }),
      ...ixs,
    ],
  }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  /* serialize() throws when the transaction is over the packet limit; report that as an oversized size instead */
  let size = Infinity;
  try { size = tx.serialize().length; } catch { /* too large */ }
  return { tx, lastValidBlockHeight, size };
}

export const fits = (size: number) => size <= MAX_TX_BYTES;

/** Run the transaction against the cluster without signing, so a failure shows before the wallet is asked. */
export async function simulate(conn: Connection, tx: VersionedTransaction): Promise<void> {
  const r = await conn.simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: true, commitment: 'confirmed' });
  if (r.value.err) {
    const e = new Error(`Simulation failed: ${JSON.stringify(r.value.err)}`) as Error & { logs?: string[] };
    e.logs = r.value.logs ?? [];
    throw e;
  }
}

/** Poll for confirmation. The websocket-based confirm hangs on RPCs that block subscriptions. */
export async function confirm(conn: Connection, sig: string, lastValidBlockHeight: number, timeoutMs = 90_000): Promise<void> {
  try {
    if (await conn.getGenesisHash() !== GENESIS_HASH) throw new Error('RPC network does not match this app.');
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      let { value: [s] } = await conn.getSignatureStatuses([sig], { searchTransactionHistory: true });
      if (!(s && (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized'))) {
        if ((await conn.getBlockHeight('finalized')) <= lastValidBlockHeight) {
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
        // A transaction can land between the first status read and the height check.
        ({ value: [s] } = await conn.getSignatureStatuses([sig], { searchTransactionHistory: true }));
        if (!s) throw new SubmittedTransactionError(sig, lastValidBlockHeight, 'expired', 'The transaction expired before it confirmed (blockhash expired).');
        if (s.confirmationStatus !== 'confirmed' && s.confirmationStatus !== 'finalized') {
          throw new SubmittedTransactionError(sig, lastValidBlockHeight, 'unknown', 'The transaction is still awaiting confirmation.');
        }
      }
      if (s.err) throw new SubmittedTransactionError(sig, lastValidBlockHeight, 'failed', `The transaction failed on-chain: ${JSON.stringify(s.err)}`);
      return;
    }
    throw new SubmittedTransactionError(sig, lastValidBlockHeight, 'unknown', 'Timed out waiting for the transaction to confirm. Check its status before trying again.');
  } catch (e) {
    if (e instanceof SubmittedTransactionError) throw e;
    throw new SubmittedTransactionError(sig, lastValidBlockHeight, 'unknown', 'Could not determine whether the submitted transaction confirmed.', { cause: e });
  }
}

export type Step = (label: string, sig?: string, lastValidBlockHeight?: number) => void;

/** Build, simulate, sign with the wallet, send and wait for confirmation. Returns the signature. */
export async function run(
  conn: Connection, w: Wallet, ixs: TransactionInstruction[], opts: { units: number; signers?: Keypair[]; step?: Step; label?: string },
): Promise<string> {
  const { tx, lastValidBlockHeight, size } = await buildTx(conn, w.publicKey, ixs, opts.units);
  if (!fits(size)) throw new Error('This transaction is too large for Solana (1232 bytes). Shorten the text and try again.');
  opts.step?.('Checking the transaction…');
  await simulate(conn, tx);
  opts.step?.(opts.label ?? 'Confirm in your wallet…');
  const sig = await w.sendTransaction(tx, conn, { signers: opts.signers, skipPreflight: true });
  try {
    opts.step?.('Confirming on Solana…', sig, lastValidBlockHeight);
    await confirm(conn, sig, lastValidBlockHeight);
  } catch (e) {
    if (e instanceof SubmittedTransactionError) throw e;
    throw new SubmittedTransactionError(sig, lastValidBlockHeight, 'unknown', 'The transaction was submitted, but confirmation could not complete.', { cause: e });
  }
  return sig;
}
