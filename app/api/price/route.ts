/**
 * SOL/USD price for market-cap display. Read on the server so no price-feed key or CORS issue reaches the browser,
 * and cached so many visitors share one upstream call. Falls back through several sources, then to the
 * NEXT_PUBLIC_SOL_USD value, and always says where the number came from.
 */
const SOL_FEED = '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d';
const TIMEOUT_MS = 4_000;
const FRESH_MS = 60_000;
const STALE_MS = 15 * 60_000;

type Quote = { price: number; source: string; at: number };
let last: Quote | null = null;

const sane = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 1 && n < 100_000;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store', headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const sources: { name: string; get: () => Promise<number> }[] = [
  {
    name: 'pyth',
    get: async () => {
      const j = (await getJson(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${SOL_FEED}&parsed=true`)) as {
        parsed?: { price?: { price?: string; expo?: number } }[];
      };
      const p = j.parsed?.[0]?.price;
      return Number(p?.price) * Math.pow(10, Number(p?.expo));
    },
  },
  {
    name: 'coingecko',
    get: async () => {
      const j = (await getJson('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')) as { solana?: { usd?: number } };
      return Number(j.solana?.usd);
    },
  },
  {
    name: 'coinbase',
    get: async () => {
      const j = (await getJson('https://api.coinbase.com/v2/prices/SOL-USD/spot')) as { data?: { amount?: string } };
      return Number(j.data?.amount);
    },
  },
];

async function fetchQuote(): Promise<Quote | null> {
  for (const s of sources) {
    try {
      const price = await s.get();
      if (sane(price)) return { price: Math.round(price * 100) / 100, source: s.name, at: Date.now() };
    } catch {
      /* try the next source */
    }
  }
  return null;
}

export async function GET() {
  const now = Date.now();
  if (!last || now - last.at > FRESH_MS) {
    const q = await fetchQuote();
    if (q) last = q;
  }
  if (last && now - last.at <= STALE_MS + FRESH_MS) {
    return Response.json({ usd: last.price, source: last.source, live: true, at: last.at }, { headers: { 'cache-control': 'public, s-maxage=30, stale-while-revalidate=120' } });
  }
  const fixed = Number(process.env.NEXT_PUBLIC_SOL_USD);
  return Response.json({ usd: sane(fixed) ? fixed : 150, source: 'fixed', live: false, at: now }, { headers: { 'cache-control': 'no-store' } });
}
