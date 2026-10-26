# Sigmafun

Theorem-backed coins on Robinhood Chain, rebuilt as a pixel arcade. Next.js 16 (App Router), React 19, TypeScript.
The layout follows the Harmonic Agent site (navy ground, white raised panels, mono labels, one signal colour); the look is arcade.

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm typecheck
pnpm build && pnpm start
```

## Rules this UI is built around

- The wallet button is pinned top right on every page (`components/SiteHeader.tsx`).
- Trade, launch, verification, reactions and posting all go through `needWallet()`, and the one-time risk notice through `needRisk()`. Browsing and the arcade stay open.

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

## What is sample data

This is a design build. Coins, prices, trades, chat and the wallet are mock data so the UI can be judged on its own:

- `lib/data.ts`: coins, callouts, verification queue, wallet list.
- `components/Providers.tsx`: the demo wallet, balances, trade settlement and toasts.

To make it real, replace the wallet block in `Providers.tsx` with wagmi + RainbowKit on Robinhood Chain and fill
`lib/data.ts` from the API. The rest of the UI only talks to the `useApp()` context in `lib/app.ts`, so views do not change.
Rigor scores are AI estimates, not proof checks.
