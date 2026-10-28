import './polyfill';
import {
  ComputeBudgetProgram, TransactionMessage, VersionedTransaction,
  type Connection, type Keypair, type PublicKey, type TransactionInstruction,
} from '@solana/web3.js';
import { PRIORITY_MICROLAMPORTS } from './config';

/** What the wallet adapter's `useWallet()` gives us. */
export type Wallet = {
  publicKey: PublicKey;
  sendTransaction: (tx: VersionedTransaction, conn: Connection, opts?: { signers?: Keypair[]; skipPreflight?: boolean }) => Promise<string>;
};

const MAX_TX_BYTES = 1232;

export async function buildTx(conn: Connection, payer: PublicKey, ixs: TransactionInstruction[], units: number) {
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
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const { value } = await conn.getSignatureStatuses([sig], { searchTransactionHistory: true });
    const s = value[0];
    if (s?.err) throw new Error(`The transaction failed on-chain: ${JSON.stringify(s.err)}`);
    if (s && (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized')) return;
    if ((await conn.getBlockHeight('confirmed')) > lastValidBlockHeight) throw new Error('The transaction expired before it confirmed (blockhash expired).');
    await new Promise((r) => setTimeout(r, 1200));
  }
  throw new Error('Timed out waiting for the transaction to confirm. Check the explorer before trying again.');
}

export type Step = (label: string, sig?: string) => void;

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
  opts.step?.('Confirming on Solana…', sig);
  await confirm(conn, sig, lastValidBlockHeight);
  return sig;
}
