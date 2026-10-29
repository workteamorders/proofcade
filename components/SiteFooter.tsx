import Link from 'next/link';
import { IS_TEST, SOL_USD_NOTE } from '@/lib/sol/footer';

export function SiteFooter() {
  return (
    <footer>
      <div className="wrap">
        <div className="cols">
          <div><b style={{ color: '#fff' }}>THEOREM</b><br />Theorem-backed coins on Solana.<br />Trades run on the pump.fun program.</div>
          <div><Link href="/explore">Explore</Link><Link href="/launch">Launch</Link><Link href="/arcade">Arcade</Link></div>
          <div>Rigor scores, when they exist, are AI estimates, not proof checks.<br />pump.fun is third-party software. Not financial advice.<br />{SOL_USD_NOTE}</div>
        </div>
        {IS_TEST && <div className="demo">Devnet beta. Coins and SOL here have no real value. Use a test wallet and free devnet SOL. Verification and rewards are not available.</div>}
      </div>
    </footer>
  );
}
