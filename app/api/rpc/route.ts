import { clusterApiUrl } from '@solana/web3.js';

/**
 * RPC proxy. The browser sends JSON-RPC here and the server forwards it to SOLANA_RPC_URL, so the provider key
 * (a secret, server-only variable) never reaches the browser. Only the methods the app uses are forwarded, and
 * only for requests that come from this site.
 */
const ALLOWED = new Set([
  'getAccountInfo', 'getMultipleAccounts', 'getSignaturesForAddress', 'getTransaction', 'getBalance',
  'getLatestBlockhash', 'getBlockHeight', 'getSlot', 'getVersion', 'getSignatureStatuses', 'getTokenAccountsByOwner',
  'getParsedTokenAccountsByOwner', 'getMinimumBalanceForRentExemption', 'getFeeForMessage', 'getRecentPrioritizationFees',
  'simulateTransaction', 'sendTransaction', 'isBlockhashValid',
]);
const MAX_BODY = 256 * 1024;
const MAX_BATCH = 100;

const upstream = () => {
  const u = process.env.SOLANA_RPC_URL?.trim();
  return u || clusterApiUrl(process.env.NEXT_PUBLIC_SOLANA_CLUSTER === 'mainnet-beta' ? 'mainnet-beta' : 'devnet');
};

const err = (status: number, message: string) => Response.json({ jsonrpc: '2.0', id: null, error: { code: -32000, message } }, { status });

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  if (origin) {
    let ok = false;
    try { ok = new URL(origin).host === (req.headers.get('x-forwarded-host') ?? req.headers.get('host')); } catch { /* bad origin */ }
    if (!ok) return err(403, 'Forbidden origin.');
  }
  const text = await req.text();
  if (text.length > MAX_BODY) return err(413, 'Request too large.');
  let body: unknown;
  try { body = JSON.parse(text); } catch { return err(400, 'Invalid JSON.'); }
  const calls = Array.isArray(body) ? body : [body];
  if (!calls.length || calls.length > MAX_BATCH) return err(400, 'Bad batch size.');
  for (const c of calls) {
    const m = (c as { method?: unknown })?.method;
    if (typeof m !== 'string' || !ALLOWED.has(m)) return err(403, `Method not allowed: ${String(m)}`);
  }
  try {
    const r = await fetch(upstream(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: text, cache: 'no-store' });
    return new Response(await r.text(), { status: r.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  } catch {
    return err(502, 'The RPC provider did not answer.');
  }
}
