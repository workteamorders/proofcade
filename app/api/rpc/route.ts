import { clusterApiUrl } from '@solana/web3.js';

/**
 * RPC proxy. The browser sends JSON-RPC here and the server forwards it to SOLANA_RPC_URL, so the provider key
 * (a secret, server-only variable) never reaches the browser. Only the methods the app uses are forwarded, and
 * only for requests that come from this site.
 */
const ALLOWED = new Set([
  'getAccountInfo', 'getMultipleAccounts', 'getSignaturesForAddress', 'getTransaction', 'getBalance',
  'getLatestBlockhash', 'getBlockHeight', 'getSlot', 'getVersion', 'getGenesisHash', 'getSignatureStatuses', 'getTokenAccountsByOwner',
  'getParsedTokenAccountsByOwner', 'getMinimumBalanceForRentExemption', 'getFeeForMessage', 'getRecentPrioritizationFees',
  'simulateTransaction', 'sendTransaction', 'isBlockhashValid',
]);
const MAX_BODY = 256 * 1024;
const MAX_BATCH = 25;
const TIMEOUT_MS = 10_000;
const NO_STORE = { 'cache-control': 'no-store' };
const GENESIS = {
  devnet: 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG',
  'mainnet-beta': '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
};
const PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const cluster = () => process.env.NEXT_PUBLIC_SOLANA_CLUSTER === 'mainnet-beta' ? 'mainnet-beta' : 'devnet';

const upstream = () => {
  const url = new URL(process.env.SOLANA_RPC_URL?.trim() || clusterApiUrl(cluster()));
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Invalid RPC configuration.');
  return url.href;
};

const err = (status: number, message: string) => Response.json({ jsonrpc: '2.0', id: null, error: { code: -32000, message } }, { status, headers: NO_STORE });

export async function POST(req: Request) {
  let site: URL;
  try {
    site = new URL(process.env.NEXT_PUBLIC_SITE_URL?.trim() || req.url);
    if (site.protocol !== 'https:' && site.protocol !== 'http:') throw new Error();
  } catch {
    return err(500, 'Invalid site configuration.');
  }
  const origin = req.headers.get('origin');
  if (!origin || origin !== site.origin) return err(403, 'Forbidden origin.');

  if (Number(req.headers.get('content-length')) > MAX_BODY) return err(413, 'Request too large.');
  const reader = req.body?.getReader();
  let text = '';
  let bytes = 0;
  const decoder = new TextDecoder();
  try {
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BODY) {
          void reader.cancel().catch(() => {});
          return err(413, 'Request too large.');
        }
        text += decoder.decode(value, { stream: true });
      }
    }
    text += decoder.decode();
  } catch {
    return err(400, 'Could not read request body.');
  } finally {
    reader?.releaseLock();
  }
  let body: unknown;
  try { body = JSON.parse(text); } catch { return err(400, 'Invalid JSON.'); }
  const calls = Array.isArray(body) ? body : [body];
  if (!calls.length || calls.length > MAX_BATCH) return err(400, 'Bad batch size.');
  for (const c of calls) {
    if (!c || typeof c !== 'object' || Array.isArray(c) || c.jsonrpc !== '2.0' ||
      (c.params !== undefined && !Array.isArray(c.params)) ||
      (c.id !== undefined && c.id !== null && typeof c.id !== 'string' && typeof c.id !== 'number')) {
      return err(400, 'Invalid JSON-RPC request.');
    }
    if (typeof c.method !== 'string' || !ALLOWED.has(c.method)) return err(403, 'Method not allowed.');
  }
  let url: string;
  try { url = upstream(); } catch { return err(500, 'Invalid RPC configuration.'); }
  try {
    const r = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: text,
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r.ok) {
      void r.body?.cancel().catch(() => {});
      return err(r.status === 429 ? 429 : 502, 'The RPC provider rejected the request.');
    }
    const data = await r.json();
    // Provider error messages/data can include credential-bearing URLs.
    const safe = (value: { jsonrpc?: unknown; id?: unknown; result?: unknown; error?: { code?: unknown } }) => {
      if (!value || typeof value !== 'object' || value.jsonrpc !== '2.0' || !('result' in value || 'error' in value)) throw new Error();
      if (!value.error) return value;
      return {
        jsonrpc: '2.0', id: value.id ?? null,
        error: { code: typeof value.error.code === 'number' ? value.error.code : -32000, message: 'The RPC provider rejected the request.' },
      };
    };
    return Response.json(Array.isArray(data) ? data.map(safe) : safe(data), { headers: NO_STORE });
  } catch {
    return err(502, 'The RPC provider did not answer.');
  }
}

export async function GET() {
  const expectedCluster = cluster();
  let url: string;
  const health = (status: number, rpc: string, actualCluster: string | null = null, programExecutable = false) => Response.json({
    status: status === 200 ? 'ok' : 'unavailable', cluster: actualCluster, expectedCluster, rpc,
    programExecutable,
    // Executable code alone does not prove that Global.createV2Enabled is set.
    launch: status === 200 && programExecutable ? 'unknown' : 'unavailable',
  }, { status, headers: NO_STORE });
  try { url = upstream(); } catch { return health(503, 'misconfigured'); }
  let actualCluster: string | null = null;
  try {
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const read = async (method: string, params: unknown[]) => {
      const response = await fetch(url, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        cache: 'no-store', redirect: 'error', signal,
      });
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        throw new Error();
      }
      const data = await response.json();
      if (!data || data.error || !('result' in data)) throw new Error();
      return data.result;
    };
    const hash = await read('getGenesisHash', []);
    actualCluster = hash === GENESIS.devnet ? 'devnet' : hash === GENESIS['mainnet-beta'] ? 'mainnet-beta' : 'unknown';
    if (actualCluster !== expectedCluster) return health(503, 'wrong-cluster', actualCluster);
    const account = await read('getAccountInfo', [PUMP_PROGRAM, { encoding: 'base64', commitment: 'confirmed', dataSlice: { offset: 0, length: 0 } }]);
    const executable = account?.value?.executable === true;
    return health(executable ? 200 : 503, 'ok', actualCluster, executable);
  } catch {
    return health(503, 'error', actualCluster);
  }
}
