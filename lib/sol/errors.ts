export class SubmittedTransactionError extends Error {
  constructor(
    public readonly sig: string,
    public readonly lastValidBlockHeight: number,
    public readonly status: 'unknown' | 'failed' | 'expired',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'SubmittedTransactionError';
  }
}

/** One sentence for a failed wallet or program call. */
export function txError(e: unknown): string {
  if (e instanceof SubmittedTransactionError && e.status === 'unknown') {
    return 'This transaction was submitted, but its outcome is still unknown. Check its status before sending another transaction.';
  }
  /* wallet-adapter errors wrap the wallet's own error, which holds the useful message */
  const inner = (e as { error?: unknown })?.error;
  const raw = [e, inner].filter(Boolean).map((x) => (x instanceof Error ? `${x.name} ${x.message}` : String(x))).join(' ');
  const logs = (e as { logs?: string[] })?.logs?.join('\n') ?? '';
  const all = `${raw}\n${logs}`;
  if (/user rejected|rejected the request|declined|cancel/i.test(all)) return 'You cancelled the request in your wallet.';
  if (/insufficient (funds|lamports)|custom program error: 0x1$/im.test(all)) return 'This wallet does not have enough SOL for the amount, rent and fees.';
  if (/BondingCurveComplete|0x1775|6023/.test(all)) return 'This curve has finished: the coin has graduated and curve trading is closed.';
  if (/TooMuchSolRequired|0x1772|6020|slippage/i.test(all)) return 'The price moved past your slippage limit. Try again or allow more slippage.';
  if (/TooLittleSolReceived|0x1771|6019/.test(all)) return 'The price moved past your slippage limit. Try again or allow more slippage.';
  if (/blockhash not found|block height exceeded|expired/i.test(all)) return 'The transaction expired before it confirmed. Try again.';
  if (/WalletNotConnected|not connected/i.test(all)) return 'Connect a wallet first.';
  const m = ((inner instanceof Error && inner.message) || (e instanceof Error ? e.message : '')).split('\n')[0];
  return m || 'Something went wrong.';
}
