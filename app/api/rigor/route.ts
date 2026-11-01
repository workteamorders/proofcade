import { createHash } from 'node:crypto';
import { RIGOR_SYSTEM, parseRigor, validStatement, type Rigor } from '../../../lib/rigor';

/**
 * AI rigor estimate for a theorem statement: GET /api/rigor?s=<statement>.
 * Needs ANTHROPIC_API_KEY (server-only). The answer depends only on the statement, so it is cached hard: in memory here
 * and at the CDN through cache-control. Spend is bounded by a per-address hourly limit and a daily cap per server instance.
 */
const TIMEOUT_MS = 15_000;
const CACHE_MAX = 2000;
const PER_IP_HOUR = 40;
const cache = new Map<string, Rigor>();
const hits = new Map<string, number[]>();
let day = { key: '', n: 0 };

const model = () => process.env.RIGOR_MODEL?.trim() || 'claude-haiku-5-5';
const dailyCap = () => { const n = Number(process.env.RIGOR_DAILY_CAP); return Number.isFinite(n) && n >= 0 ? n : 300; };
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: { 'cache-control': 'no-store' } });

function limited(req: Request): boolean {
  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= PER_IP_HOUR) { hits.set(ip, recent); return true; }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 3_600_000)) hits.delete(k);
  return false;
}

function underCap(): boolean {
  const key = new Date().toISOString().slice(0, 10);
  if (day.key !== key) day = { key, n: 0 };
  if (day.n >= dailyCap()) return false;
  day.n++;
  return true;
}

async function ask(statement: string, apiKey: string): Promise<Rigor | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: model(), max_tokens: 200, system: RIGOR_SYSTEM,
      messages: [{ role: 'user', content: `<statement>${statement}</statement>` }],
    }),
    cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) { void res.body?.cancel().catch(() => {}); return null; }
  const j = (await res.json()) as { content?: { type?: string; text?: string }[] };
  const text = (j.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
  return parseRigor(text);
}

export async function GET(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return fail(503, 'Rigor scoring is not switched on for this site.');
  const statement = (new URL(req.url).searchParams.get('s') ?? '').trim();
  if (!validStatement(statement)) return fail(400, 'Send a statement of 12 to 280 bytes.');

  const key = createHash('sha256').update(statement).digest('hex');
  const hit = cache.get(key);
  const ok = (r: Rigor) => Response.json(r, { headers: { 'cache-control': 'public, s-maxage=604800, max-age=86400, immutable' } });
  if (hit) return ok(hit);

  if (limited(req)) return fail(429, 'Too many requests. Try again later.');
  if (!underCap()) return fail(429, 'The daily scoring limit has been reached.');
  try {
    const r = await ask(statement, apiKey);
    if (!r) return fail(502, 'The scorer did not return a usable answer.');
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(key, r);
    return ok(r);
  } catch {
    return fail(502, 'The scorer did not answer.');
  }
}
