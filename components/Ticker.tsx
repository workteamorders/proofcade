const ITEMS = [
  'NEW LAUNCH <b>$ZETA</b>',
  'SnugChalkWalrus bought <b>1.8 ETH</b> of <b>$EULER</b>',
  '<b>$SWITCH</b> graduated to Uniswap V4',
  'FORMAL ✓ <b>$PRIME</b> verified',
  'RareSandAntler sold <b>0.4 ETH</b> of <b>$NOETHER</b>',
  'NEW LAUNCH <b>$ZENO</b>',
  'LunarFogWeasel bought <b>0.9 ETH</b> of <b>$GAUSS</b>',
];

export function Ticker() {
  const row = ITEMS.map((t, i) => <span key={i} dangerouslySetInnerHTML={{ __html: t }} />);
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-in">{row}{ITEMS.map((t, i) => <span key={'b' + i} dangerouslySetInnerHTML={{ __html: t }} />)}</div>
    </div>
  );
}
