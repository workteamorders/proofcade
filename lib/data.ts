import { addrOf } from './util';

export type Coin = {
  id: string;
  ticker: string;
  name: string;
  /** Theorem statement. Only coins launched on Sigmafun have one. */
  statement?: string;
  /** Plain description for coins that came from the wider Pons market. */
  blurb?: string;
  /** AI rigor estimate 0–100. Not a proof check. */
  rigor: number | null;
  formal: boolean;
  /** Launched here (has a theorem) vs. other Pons coins. */
  native: boolean;
  mcap: number;
  vol: number;
  /** Bonding-curve progress 0–1. */
  progress: number;
  age: string;
  change: number;
  address: string;
  creator: string;
  price: number;
  /** 0 on curve, 1 graduating, 2 Uniswap V4, 3 rescued. */
  phase: number;
  order: number;
  mine?: boolean;
};

type Seed = Omit<Coin, 'address' | 'creator' | 'price' | 'phase' | 'order'>;

const SEEDS: Seed[] = [
  { id: 'fermat', ticker: 'FERMAT', name: 'Fermat Last Margin', statement: 'xⁿ + yⁿ = zⁿ has no solution in positive integers for n > 2.', rigor: 94, formal: true, native: true, mcap: 4.21, vol: 38.2, progress: 0.62, age: '2 d', change: 12.4 },
  { id: 'euler', ticker: 'EULER', name: 'Euler Identity', statement: 'e^(iπ) + 1 = 0, tying five constants into one line.', rigor: 91, formal: false, native: true, mcap: 2.08, vol: 12.7, progress: 0.34, age: '5 d', change: -3.1 },
  { id: 'prime', ticker: 'PRIME', name: 'Infinite Primes', statement: 'There are infinitely many prime numbers.', rigor: 97, formal: true, native: true, mcap: 6.9, vol: 51.4, progress: 0.81, age: '9 d', change: 4.6 },
  { id: 'gauss', ticker: 'GAUSS', name: 'Gauss Sum', statement: 'The sum of 1 through n equals n(n + 1) / 2.', rigor: 88, formal: true, native: true, mcap: 1.34, vol: 6.1, progress: 0.27, age: '1 d', change: 40.2 },
  { id: 'cantor', ticker: 'CANTOR', name: 'Cantor Diagonal', statement: 'No bijection exists between the naturals and their power set.', rigor: 90, formal: true, native: true, mcap: 3.02, vol: 14.9, progress: 0.52, age: '4 d', change: 7.7 },
  { id: 'noether', ticker: 'NOETHER', name: 'Noether Charge', statement: 'Every continuous symmetry of a system implies a conserved quantity.', rigor: 83, formal: false, native: true, mcap: 0.92, vol: 3.3, progress: 0.18, age: '3 d', change: -8.4 },
  { id: 'godel', ticker: 'GODEL', name: 'Godel Loop', statement: 'No consistent formal system can prove its own consistency.', rigor: 86, formal: false, native: true, mcap: 1.77, vol: 8.8, progress: 0.39, age: '6 d', change: 1.2 },
  { id: 'pi', ticker: 'PIRRAT', name: 'Pi Irrational', statement: 'Pi cannot be written as a ratio of two integers.', rigor: 92, formal: true, native: true, mcap: 2.66, vol: 10.4, progress: 0.47, age: '7 d', change: 2.3 },
  { id: 'turing', ticker: 'HALT', name: 'Halting Problem', statement: 'No program decides whether every program halts.', rigor: 89, formal: false, native: true, mcap: 1.12, vol: 4.9, progress: 0.22, age: '2 d', change: -1.9 },
  { id: 'monty', ticker: 'SWITCH', name: 'Monty Hall', statement: 'Switching doors wins with probability two thirds.', rigor: 78, formal: false, native: true, mcap: 0.41, vol: 1.4, progress: 0.09, age: '12 h', change: 22.8 },
  { id: 'zeno', ticker: 'ZENO', name: 'Zeno Limit', statement: '0.999… repeating equals exactly one.', rigor: 85, formal: false, native: true, mcap: 0.66, vol: 2.2, progress: 0.13, age: '1 d', change: -5.2 },
  { id: 'riemann', ticker: 'ZETA', name: 'Riemann Hunch', statement: 'All non-trivial zeros of zeta lie on the line Re(s) = ½.', rigor: 41, formal: false, native: true, mcap: 0.27, vol: 0.8, progress: 0.05, age: '3 h', change: 61.5 },
  { id: 'rcat', ticker: 'HOODCAT', name: 'Hood Cat', blurb: 'A cat on a chain. That is the whole pitch.', rigor: null, formal: false, native: false, mcap: 8.4, vol: 22.1, progress: 0.96, age: '20 d', change: 3.3 },
  { id: 'robin', ticker: 'WIFHOOD', name: 'Robin Wif Hood', blurb: 'A hat for the green feather crowd.', rigor: null, formal: false, native: false, mcap: 3.7, vol: 9.9, progress: 0.64, age: '14 d', change: -6.0 },
];

export const INITIAL_COINS: Coin[] = SEEDS.map((c, i) => ({
  ...c,
  address: addrOf(c.id),
  creator: addrOf(c.id + 'by'),
  price: c.mcap / 1e9,
  phase: c.progress >= 0.96 ? 1 : 0,
  order: 42 - i,
}));

export const PHASE = ['On curve', 'Graduating', 'Uniswap V4', 'Rescued'];

export type ChatMsg = {
  id: number;
  kind: 'sys' | 'user';
  who: string;
  text: string;
  coinId: string;
  ago: number;
  re: { r: number; e: number; s: number };
  me: { r?: boolean; e?: boolean; s?: boolean };
};

const MSG_SEEDS: [ChatMsg['kind'], string, string, string, number][] = [
  ['sys', 'SIGMAFUN', '$ZETA launched.', 'riemann', 3],
  ['user', 'SnugChalkWalrus', 'prime is the safest proof on the board. formal check is in, rigor 97.', 'prime', 11],
  ['user', 'RareSandAntler', 'fermat curve at 62%. graduation soon.', 'fermat', 14],
  ['sys', 'SIGMAFUN', 'Big buy: 0xA17c…92fe bought 1.8 ETH of $EULER.', 'euler', 22],
  ['user', 'WittyFogIsland', 'who is checking the zeta lean proof?', 'riemann', 31],
  ['user', 'CleverPewterValley', 'GAUSS +40% today. i only read the statement and bought.', 'gauss', 46],
  ['sys', 'SIGMAFUN', '$SWITCH graduated to Uniswap V4.', 'monty', 58],
];

export const INITIAL_MSGS: ChatMsg[] = MSG_SEEDS.map(([kind, who, text, coinId, ago], i) => ({
  id: i, kind, who, text, coinId, ago, re: { r: 3 + i, e: 1, s: 0 }, me: {},
}));

export const BOARD = [
  { who: 'SnugChalkWalrus', sec: 11 },
  { who: 'RareSandAntler', sec: 36 },
  { who: 'FairOrchidMeadow', sec: 75 },
  { who: 'LunarFogWeasel', sec: 140 },
];

export type ProofStatus = 'checking' | 'passed' | 'failed' | 'verified';
export type ProofRow = { coinId: string; who: string; status: ProofStatus; ago: string; mine?: boolean };

export const INITIAL_PROOFS: ProofRow[] = [
  { coinId: 'riemann', who: 'RareSandAntler', status: 'checking', ago: '4 min' },
  { coinId: 'noether', who: 'WittyFogIsland', status: 'passed', ago: '1 h' },
  { coinId: 'godel', who: 'CleverPewterValley', status: 'failed', ago: '3 h' },
  { coinId: 'cantor', who: 'LunarFogWeasel', status: 'verified', ago: '1 d' },
  { coinId: 'prime', who: 'SnugChalkWalrus', status: 'verified', ago: '2 d' },
  { coinId: 'gauss', who: 'FairOrchidMeadow', status: 'verified', ago: '3 d' },
];

export const WALLETS: { name: string; color: string; note: string }[] = [
  { name: 'MetaMask', color: '#ff9a3d', note: 'Browser' },
  { name: 'Coinbase Wallet', color: '#3d74ff', note: 'Browser or app' },
  { name: 'Rainbow', color: '#a597ff', note: 'Mobile' },
  { name: 'WalletConnect', color: '#3de8a0', note: 'Scan a code' },
];

export const OFFICIAL_CA = '0x5d1c7e0f2b94a3ce81f6d07a49b3e2c1f805a9d4';
