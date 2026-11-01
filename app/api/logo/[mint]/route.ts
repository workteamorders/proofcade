import { head, put } from '@vercel/blob';
import { LOGO_MAX_BYTES, LOGO_PATH, isMint, logoProblem } from '../../../../lib/logo';

/**
 * Custom coin logos, stored in Vercel Blob as logos/<mint>.png.
 *  GET  redirects to the stored image (404 when the coin has none).
 *  PUT  stores a PNG for a mint, once. A logo cannot be replaced, which matches the coin's name and ticker.
 * The browser resizes to a square PNG first; the server re-checks the bytes anyway.
 */
const NO_STORE = { 'cache-control': 'no-store' };
const PER_HOUR = 10;
const hits = new Map<string, number[]>();

const fail = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });

/** Best-effort per-instance limit on uploads from one address. */
function limited(req: Request): boolean {
  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= PER_HOUR) { hits.set(ip, recent); return true; }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 3_600_000)) hits.delete(k);
  return false;
}

export async function GET(_req: Request, ctx: { params: Promise<{ mint: string }> }) {
  const { mint } = await ctx.params;
  if (!isMint(mint)) return fail(400, 'Bad mint.');
  if (!process.env.BLOB_READ_WRITE_TOKEN) return fail(404, 'No logo.');
  try {
    const blob = await head(LOGO_PATH(mint));
    return new Response(null, { status: 302, headers: { location: blob.url, 'cache-control': 'public, max-age=300, s-maxage=300', 'access-control-allow-origin': '*' } });
  } catch (e) {
    if (e instanceof Error && /not.?found|does not exist/i.test(`${e.name} ${e.message}`)) {
      return Response.json({ error: 'No logo.' }, { status: 404, headers: { 'cache-control': 'public, max-age=30' } });
    }
    return fail(502, 'Logo storage did not answer.');
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ mint: string }> }) {
  const { mint } = await ctx.params;
  if (!isMint(mint)) return fail(400, 'Bad mint.');
  if (!process.env.BLOB_READ_WRITE_TOKEN) return fail(503, 'Custom logos are not switched on for this site.');

  let site: URL;
  try { site = new URL(process.env.NEXT_PUBLIC_SITE_URL?.trim() || req.url); } catch { return fail(500, 'Invalid site configuration.'); }
  if (req.headers.get('origin') !== site.origin) return fail(403, 'Forbidden origin.');
  if ((req.headers.get('content-type') || '').split(';')[0].trim() !== 'image/png') return fail(415, 'Send the logo as image/png.');
  if (Number(req.headers.get('content-length')) > LOGO_MAX_BYTES) return fail(413, 'The logo is too large.');
  if (limited(req)) return fail(429, 'Too many uploads. Try again later.');

  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (reader) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LOGO_MAX_BYTES) { void reader.cancel().catch(() => {}); return fail(413, 'The logo is too large.'); }
      chunks.push(value);
    }
  } catch { return fail(400, 'Could not read the upload.'); }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { bytes.set(c, at); at += c.byteLength; }
  const problem = logoProblem(bytes);
  if (problem) return fail(400, problem);

  try {
    await put(LOGO_PATH(mint), Buffer.from(bytes), { access: 'public', addRandomSuffix: false, allowOverwrite: false, contentType: 'image/png', cacheControlMaxAge: 31_536_000 });
    return Response.json({ ok: true }, { status: 201, headers: NO_STORE });
  } catch (e) {
    if (e instanceof Error && /already exists/i.test(e.message)) return fail(409, 'This coin already has a logo.');
    return fail(502, 'Logo storage did not accept the upload.');
  }
}
