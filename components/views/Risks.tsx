import Link from 'next/link';
import { IS_TEST } from '@/lib/sol/config';

const SECTIONS: [string, string[]][] = [
  ['What Theorem is', [
    'Theorem is a website that lets you launch and trade coins on the pump.fun program on Solana. Each coin carries a mathematical statement written on-chain by its creator.',
    'Theorem does not issue coins, hold your funds or keys, or run the pump.fun program. Your wallet signs every transaction, and Theorem cannot move your funds.',
  ]],
  ['You can lose everything', [
    'Coins like these are highly speculative. Prices can fall to zero quickly, and there may be no buyer when you want to sell.',
    'Only use money you can afford to lose. Nothing here is financial, investment, tax or legal advice.',
  ]],
  ['Statements are not proof', [
    'A coin’s theorem is whatever its creator wrote. It is not checked for truth, and a statement does not make a coin safe, valuable or endorsed.',
    'Formal verification is not available in this version of the site. Where a rigor score is shown, it is an AI estimate of how precisely a statement is written, not a check of any proof.',
  ]],
  ['Launches are permanent', [
    'A coin’s name, ticker, statement and logo cannot be changed after launch, and transactions on Solana cannot be undone. Check everything before you sign.',
    'Creators are responsible for what they launch. Do not launch anything unlawful, misleading, infringing or abusive, and do not use images you have no right to use. Theorem may hide coins from its own pages, but cannot remove a coin from the blockchain.',
  ]],
  ['Fees and third parties', [
    'You pay Solana network fees and account rent, and pump.fun charges its own trading and creator fees. SOL limits shown in the app do not include network fees.',
    'The site relies on third-party software and services, including pump.fun, wallets, RPC providers and price feeds. They can fail, change or be wrong. Displayed prices and USD values are estimates.',
  ]],
  ['Eligibility and local law', [
    'You must be an adult where you live. Rules on trading digital assets differ by country, and you are responsible for following the ones that apply to you. Do not use Theorem if it is not allowed where you are.',
  ]],
  ['No warranty', [
    'The site is provided as it is, without promises that it will be available, error-free or fit for any purpose. To the extent the law allows, Theorem is not liable for losses from using it.',
    'This page is a plain-language summary, not legal advice.',
  ]],
];

export function RisksView() {
  return (
    <>
      <div className="eyebrow">Read this once</div>
      <h1 style={{ margin: '14px 0 14px' }}>Risks and terms</h1>
      {IS_TEST && <p className="lead" style={{ marginBottom: 26 }}>This build runs on Solana devnet. Coins and SOL here have no real value.</p>}
      <div className="screen" style={{ padding: 26, display: 'grid', gap: 22, maxWidth: 820 }}>
        {SECTIONS.map(([h, ps]) => (
          <section key={h}>
            <h2 style={{ fontSize: '1.05rem', margin: '0 0 8px' }}>{h}</h2>
            {ps.map((p) => <p key={p} style={{ margin: '0 0 8px' }}>{p}</p>)}
          </section>
        ))}
        <p className="muted">By launching or trading on Theorem you confirm that you have read this page. <Link href="/">Back to start</Link></p>
      </div>
    </>
  );
}
