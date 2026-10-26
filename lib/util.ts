const SUB = '₀₁₂₃₄₅₆₇₈₉';

/** Compact number formatting with subscript-zero notation for tiny prices (0.0₈37). */
export function fmt(v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v), sg = v < 0 ? '-' : '';
  if (a >= 10000) return sg + a.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 });
  if (a >= 1) return sg + a.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (a >= 0.0001) return sg + a.toPrecision(3).replace(/\.?0+$/, '');
  let exp = Math.floor(Math.log10(a));
  let d = Math.round(a / 10 ** (exp - 2));
  if (d >= 1000) { d = Math.round(d / 10); exp += 1; }
  const z = -exp - 1;
  return `${sg}0.0${String(z).split('').map((x) => SUB[+x]).join('')}${String(d).replace(/0+$/, '')}`;
}

export const eth = (v: number) => `${fmt(v)} ETH`;

/** Sample ETH/USD rate used to show market caps in dollars. Replace with a live price feed in the real app. */
export const ETH_USD = 3000;
/** Market cap (given in ETH) as a compact dollar amount, e.g. $12.6K or $1.2M. */
export const usd = (ethValue: number) => {
  const d = ethValue * ETH_USD;
  if (d >= 1000) return '$' + d.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
  return '$' + d.toLocaleString('en-US', { maximumFractionDigits: 0 });
};
export const short = (a: string) => a.slice(0, 6) + '…' + a.slice(-4);
export const rand = (n: number) => Math.floor(Math.random() * n);

/** Small deterministic PRNG so sample data and sprites are stable between renders. */
export function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hex = (r: () => number, n: number) => Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(r() * 16)]).join('');
export const addrOf = (seed: string) => '0x' + hex(rng(seed), 40);
