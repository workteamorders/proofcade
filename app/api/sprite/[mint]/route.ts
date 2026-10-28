import { spriteSvgMarkup } from '@/lib/sprites';

/** The coin's pixel sprite, derived from its mint address. */
export async function GET(_req: Request, ctx: { params: Promise<{ mint: string }> }) {
  const { mint } = await ctx.params;
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return new Response('bad mint', { status: 400 });
  return new Response(spriteSvgMarkup(mint), { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=31536000, immutable' } });
}
