'use client';
import Link from 'next/link';
import { IS_TEST } from '@/lib/sol/footer';
import { useSolUsd } from '@/lib/price';
import { RIGOR_ON } from '@/lib/features';

export function SiteFooter() {
  const { usd, live } = useSolUsd();
  const note = live ? `Market caps in USD use the live SOL price (1 SOL = $${usd.toLocaleString('en-US')}).` : `Market caps in USD use a sample rate of 1 SOL = $${usd.toLocaleString('en-US')}.`;
  return (
    <footer>
      <div className="wrap">
        <div className="cols">
          <div><b style={{ color: '#fff' }}>THEOREMA</b><br />Coins backed by a theorem, on Solana.<br />Trades run on the pump.fun program.</div>
          <div><Link href="/explore">Explore</Link><Link href="/launch">Launch</Link><Link href="/arcade">Arcade</Link><Link href="/risks">Risks and terms</Link></div>
          <div>{RIGOR_ON ? 'Rigor scores are AI estimates, not proof checks.' : 'Theorem statements are written by coin creators and are not verified.'}<br />pump.fun is third-party software. Not financial advice. Coins can lose all their value.<br />{note}</div>
        </div>
        {IS_TEST && <div className="demo">Devnet beta. Coins and SOL here have no real value. Use a test wallet and free devnet SOL. Verification and rewards are not available.</div>}
      </div>
    </footer>
  );
}
