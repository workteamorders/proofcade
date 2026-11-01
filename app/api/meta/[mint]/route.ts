/** Token metadata that wallets and explorers read from the coin's URI. Stateless: everything comes from the URL. */
export async function GET(req: Request, ctx: { params: Promise<{ mint: string }> }) {
  const { mint } = await ctx.params;
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return Response.json({ error: 'bad mint' }, { status: 400 });
  const u = new URL(req.url);
  const name = (u.searchParams.get('n') || 'Theorema coin').slice(0, 32);
  const symbol = (u.searchParams.get('s') || 'THM').slice(0, 10);
  return Response.json(
    { name, symbol, description: 'A coin backed by a theorem, launched on Theorema. The statement is stored on-chain with the launch.', image: u.searchParams.get('l') === '1' ? `${u.origin}/api/logo/${mint}` : `${u.origin}/api/sprite/${mint}`, external_url: `${u.origin}/coin/${mint}` },
    { headers: { 'cache-control': 'public, max-age=3600', 'access-control-allow-origin': '*' } },
  );
}
