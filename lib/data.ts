
export type Coin = {
  id: string;
  ticker: string;
  name: string;
  /** Theorem statement. Only coins launched on Theorem have one. */
  statement?: string;
  /** Plain description for coins that came from the wider pump.fun market. */
  blurb?: string;
  /** AI rigor estimate 0–100. Not a proof check. */
  rigor: number | null;
  formal: boolean;
  /** Launched here (has a theorem) vs. other pump.fun coins. */
  native: boolean;
  mcap: number;
  /** SOL raised on the curve so far (net of fees). */
  raised: number;
  /** Bonding-curve progress 0–1. */
  progress: number;
  age: string;
  change: number;
  /** The coin's mint address. Also its id. */
  address: string;
  creator: string;
  price: number;
  /** 0 on curve, 1 graduated (curve complete, moving to PumpSwap). */
  phase: number;
  order: number;
  mine?: boolean;
  /** Pump bonding-curve account that trades this coin. */
  curve: string;
  /** Unix seconds. */
  created: number;
  /** Price when the curve opened, in SOL. */
  launchPrice: number;
};

export const PHASE = ['On curve', 'Graduated', 'PumpSwap', 'Closed'];

export type ChatMsg = {
  id: number;
  kind: 'sys' | 'user';
  who: string;
  text: string;
  coinId: string;
  /** Ready-to-show age, e.g. "3 min" or "block 1,234". */
  ago: string;
  re: { r: number; e: number; s: number };
  me: { r?: boolean; e?: boolean; s?: boolean };
};

export const BOARD = [
  { who: 'SnugChalkWalrus', sec: 11 },
  { who: 'RareSandAntler', sec: 36 },
  { who: 'FairOrchidMeadow', sec: 75 },
  { who: 'LunarFogWeasel', sec: 140 },
];

export type ProofStatus = 'checking' | 'passed' | 'failed' | 'verified';
export type ProofRow = { coinId: string; who: string; status: ProofStatus; ago: string; mine?: boolean };
