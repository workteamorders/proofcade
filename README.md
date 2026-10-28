# Theorem

Theorem-backed coins on Solana (pump.fun bonding curves), as a pixel arcade. Next.js 16 (App Router), React 19, TypeScript.
The layout follows the Harmonic Agent site (navy ground, white raised panels, mono labels, one signal colour); the look is arcade.

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm typecheck
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

- Cluster: `NEXT_PUBLIC_SOLANA_CLUSTER=devnet` (default) or `mainnet-beta`. That one variable also switches the explorer links and the DEVNET chip. Use your own RPC in `NEXT_PUBLIC_SOLANA_RPC_URL`; the public one is rate-limited, and mainnet needs a real provider.
- Wallet: Solana wallet adapter with Phantom, Solflare and Wallet Standard auto-detection. For devnet, switch Phantom to Testnet Mode (Settings, Developer Settings) and fund it from a devnet faucet.
- Coins: every launch carries a Theorem tag account and a memo (mint, name, ticker, statement). The site lists the tag's signatures, checks that the curve exists and that the memo signer is the coin's creator, then reads each bonding curve live (`lib/sol/market.ts`).
- Trades and charts: parsed from the balance changes of each curve's transactions. "Raised" is SOL in the curve; change is since launch.
- Buy and sell: `buyInstructions` / `sellInstructions`; every transaction is simulated before the wallet is asked to sign.
- Launch: `create_v2` (Token-2022), with the first buy in the same transaction when it fits. The coin's sprite is drawn from its mint address and its metadata is served from `/api/meta/<mint>`, so the site must be reachable at a public URL (`NEXT_PUBLIC_SITE_URL`) for wallets to show names and images.
- Market caps and balances show in USD using `NEXT_PUBLIC_SOL_USD` (a fixed sample rate, not a live price).

Not connected (needs a backend that does not exist here): rigor scores, Lean verification and its reward pool, custom logo upload, shared callouts. Launches feed the Live page; callouts you post stay in your browser.
The arcade games are standalone.

Not yet tested against a live cluster: the code was checked with a mock RPC only. Try a small devnet launch and trade before moving to mainnet.
Rigor scores, when they exist, are AI estimates, not proof checks.
