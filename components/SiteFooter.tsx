import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer>
      <div className="wrap">
        <div className="cols">
          <div><b style={{ color: '#fff' }}>PROOFCADE</b><br />Theorem-backed coins on Robinhood Chain.<br />Routed through Pons.</div>
          <div><Link href="/explore">Explore</Link><Link href="/launch">Launch</Link><Link href="/arcade">Arcade</Link></div>
          <div>Rigor scores are AI estimates, not proof checks.<br />Pons V2 is unaudited software. Not financial advice.</div>
        </div>
        <div className="demo">Demo build. Coins, prices, trades and the wallet connection are sample data. Nothing here touches a chain.</div>
      </div>
    </footer>
  );
}
