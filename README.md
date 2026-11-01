# Theorema

Coins backed by a theorem, on Solana (pump.fun bonding curves), as a pixel arcade. Next.js 16 (App Router), React 19, TypeScript.
The layout follows the Harmonic Agent site (navy ground, white raised panels, mono labels, one signal colour); the look is arcade.

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm typecheck
pnpm test
pnpm build && pnpm start
```

## Rules this UI is built around

- The wallet button is pinned top right on every page (`components/SiteHeader.tsx`).
- Trade, launch, reactions and posting all go through `needWallet()`, and the one-time risk notice through `needRisk()`. Browsing and the arcade stay open.

## Routes

| Route | View |
| --- | --- |
| `/` | `components/views/Home.tsx` |
| `/explore` | `Explore.tsx` (search, sort, grid/list) |
| `/coin/[id]` | `Coin.tsx` (chart, trade panel, trades/callouts/theorem tabs) |
| `/launch` | `Launch.tsx` (4-step wizard) |
| `/live` | `Live.tsx` |
| `/portfolio` | `Portfolio.tsx` |
| `/verify` | `Verify.tsx` |
| `/arcade` | `Arcade.tsx` + `components/games/*` (Snake, 2048, Breakout, Memory, Whack-a-Rug, Minesweeper) |

## Living background

`components/BackdropFX.tsx` draws the cursor-reactive grid, drifting glyphs, shooting stars, click ripples and the pixel
reticle. Every click outside an element marked `data-nogun` fires a gunshot (`lib/audio.ts`). The ♪ button mutes it.
`prefers-reduced-motion` turns the motion off.

## Solana (devnet first, mainnet later)

The app talks to the real pump.fun program (`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`, the same address on devnet and mainnet) through `@pump-fun/pump-sdk`. There is no backend.

- Cluster: `NEXT_PUBLIC_SOLANA_CLUSTER=devnet` (default) or `mainnet-beta`. Solana's separate `testnet` cluster is not supported. The variable also switches the explorer links and the DEVNET chip; changing it alone does not establish mainnet readiness. Put your RPC provider URL in the **secret** `SOLANA_RPC_URL` (server only, no `NEXT_PUBLIC_` prefix): the browser reaches it through this site's `/api/rpc`, which restricts methods and checks the browser origin so the key never reaches the browser. Origin checks are not bot protection: configure provider budgets and edge rate limits before public testing. Public values live in `NEXT_PUBLIC_*`; see `.env.example`.
- Wallet: Solana wallet adapter with Phantom, Solflare and Wallet Standard auto-detection. For devnet, switch Phantom to Testnet Mode (Settings, Developer Settings) and fund it from a devnet faucet.
- Coins: every launch carries a Theorema tag account and a memo (mint, name, ticker, statement). The site lists the tag's signatures, checks that the curve exists and that the memo signer is the coin's creator, then reads each bonding curve live (`lib/sol/market.ts`).
- Trades and charts: parsed from the balance changes of each curve's transactions. "Raised" is SOL in the curve; change is since launch.
- Buy and sell: `buyInstructions` / `sellInstructions`; every transaction is simulated before the wallet is asked to sign.
- Launch: `create_v2` (Token-2022), with the first buy in the same transaction when it fits. The coin's sprite is drawn from its mint address and its metadata is served from `/api/meta/<mint>`, so the site must be reachable at a public URL (`NEXT_PUBLIC_SITE_URL`) for wallets to show names and images.
- Market caps show in USD using the live SOL price from `/api/price` (Pyth, then CoinGecko, then Coinbase; cached 60s on the server). If every feed is unreachable it falls back to `NEXT_PUBLIC_SOL_USD`, and the footer says it is a sample rate.

Optional services, each switched on by a secret variable and off (with a clear message) when it is missing:
- Custom logos: connect a **Vercel Blob** store (public) to the project; Vercel adds `BLOB_READ_WRITE_TOKEN`. The launch page then offers "Upload an image". The browser crops it to a 256 px square PNG, `/api/logo/<mint>` stores it once (`logos/<mint>.png`) and the launch memo carries `l: 1` so the site knows to load it.
- Rigor score: set the secret `ANTHROPIC_API_KEY`. `/api/rigor?s=<statement>` asks a Claude model how precisely the statement is written (0 to 100). It is an estimate, not a proof check. Optional: `RIGOR_MODEL` (default `claude-haiku-5-5`) and `RIGOR_DAILY_CAP` (default 300 model calls per server instance per day). Answers are cached in memory and at the CDN.

Features that need a service are hidden unless switched on, so the site never shows a badge or page that does nothing: `NEXT_PUBLIC_FEATURE_RIGOR=1` shows the rigor badge (and needs `ANTHROPIC_API_KEY`), `NEXT_PUBLIC_FEATURE_VERIFY=1` shows the Verify page (needs a Lean 4 checker service, not included). Both are public build-time values: redeploy after changing them. The `/risks` page holds the plain-language risk notice the launch dialog links to; it is not legal advice, so have it reviewed for your jurisdiction before mainnet.

Not connected (needs a backend that does not exist here): Lean verification and its reward pool, shared callouts. Launches feed the Live page; callouts you post stay in your browser.
The arcade games are standalone.

Not yet tested against a live cluster: the code was checked with a mock RPC only. Try a small devnet launch and trade before moving to mainnet.
Rigor scores are AI estimates, not proof checks.

## Vercel Devnet beta

The beta origin is `https://theorema.fun`. In Vercel Project Settings -> Environment Variables, configure the following for the deployment environment serving that domain:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | `devnet` |
| `NEXT_PUBLIC_SITE_URL` | `https://theorema.fun` |
| `SOLANA_RPC_URL` | The complete HTTPS URL of your **Devnet** RPC provider, kept secret |
| `NEXT_PUBLIC_SOL_USD` | `150` (fallback display rate, used only when no live feed answers) |

### Moving to theorema.fun

1. In Vercel, Project Settings -> Domains: add `theorema.fun` (and `www.theorema.fun` if you want it), set the DNS records Vercel shows at your registrar, and mark `theorema.fun` as the primary domain so other addresses redirect to it.
2. Set `NEXT_PUBLIC_SITE_URL` to `https://theorema.fun` for Production and Preview, then redeploy. The RPC proxy only answers requests whose `Origin` equals this value, so until it matches, the site on the new domain shows "Forbidden origin" errors.
3. Launch no coins you mean to keep until the domain is final. A coin's metadata address (name, ticker and image) is written on-chain with `NEXT_PUBLIC_SITE_URL` at launch time and cannot be changed. Coins launched before the switch keep pointing at `theorem-pi.vercel.app`, so leave that address reachable.

Leave `NEXT_PUBLIC_SOLANA_RPC_URL` unset to use the server proxy. Next.js does not load `.env.public.local` or `.env.secret.local`; use `.env.local` for local development and Vercel-managed environment variables for deployment. Do not commit secrets. `NEXT_PUBLIC_*` values are baked into the build: redeploy after changing them.

Use the Next.js framework preset with a server-capable deployment, not a static export. After deploying the current source, open `/api/rpc` in a browser. It should return uncached JSON with `status: "ok"`, `cluster: "devnet"`, and `programExecutable: true`. A 404 means this source's API route is not deployed. A 503 with `rpc: "wrong-cluster"` means the upstream does not match the selected cluster. `launch: "unknown"` means this health check has not checked pump.fun's launch-enable flag; it is not a transaction test. Do not share the beta until the health check passes. Also check a same-origin POST through the browser, since a healthy GET alone does not verify the browser origin configuration.

For localhost, leave `NEXT_PUBLIC_SITE_URL` unset or use `http://localhost:3000`. For a separate preview URL, use its own origin in that environment. A wrong canonical origin intentionally blocks RPC POST requests.

### Acceptance checklist

- Configure provider spending limits/alerts and Vercel edge rate limits; origin checks can be spoofed by non-browser clients.
- Use a dedicated test wallet, switch it to Devnet, and fund it at `https://faucet.solana.com`. Never use real SOL for this checklist.
- Connect before trading; also test clicking a trade while disconnected and then connecting.
- Launch without a first buy; verify the theorem memo and coin creation signatures in the Devnet explorer, then wait for Explore to list the coin.
- Launch with a small first buy; test both combined and separate buy paths when feasible.
- Buy and sell small amounts; verify balances, transaction links, and holdings after refresh. Maximum buy cost excludes network fees and account rent.
- Reject a wallet request, try insufficient SOL, and test a delayed/RPC-failed confirmation. Retry must first check a submitted signature, not buy twice.
- Keep the launch/trade page open while pending. Launch recovery is in-memory only; no mint private key is persisted. Reload/restart recovery is not implemented. Inspect submitted signatures before starting a new attempt after a reload.
- Check desktop and mobile wallet flows before inviting other testers. Verification, rewards, shared callouts, and shared arcade rankings are not acceptance requirements for this beta.

Automated tests use mocked RPC/wallet responses and send no transactions. A passing build or health check is not a substitute for the wallet-based checklist above.
