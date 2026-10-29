import './polyfill';
import { clusterApiUrl, PublicKey, SystemProgram } from '@solana/web3.js';

/**
 * Solana cluster. Devnet first; flip NEXT_PUBLIC_SOLANA_CLUSTER to `mainnet-beta` to go live.
 * RPC: the browser talks to this site's own /api/rpc, which forwards to the secret SOLANA_RPC_URL (server only).
 * Setting NEXT_PUBLIC_SOLANA_RPC_URL instead sends the browser straight to that URL, so never put a key in it.
 */
const env = (v: string | undefined, d: string) => (v && v.trim() ? v.trim() : d);

export type Cluster = 'devnet' | 'mainnet-beta';
export const CLUSTER: Cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === 'mainnet-beta' ? 'mainnet-beta' : 'devnet';
export const GENESIS_HASH = CLUSTER === 'devnet' ? 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG' : '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
export const IS_TEST = CLUSTER !== 'mainnet-beta';
export const NETWORK_NAME = IS_TEST ? 'Solana Devnet' : 'Solana';
export const PUBLIC_RPC_URL = env(process.env.NEXT_PUBLIC_SOLANA_RPC_URL, '');
/** The RPC endpoint the browser should use. */
export const rpcEndpoint = () => PUBLIC_RPC_URL || (typeof window !== 'undefined' ? `${window.location.origin}/api/rpc` : clusterApiUrl(CLUSTER));

export const EXPLORER = 'https://solscan.io';
const q = IS_TEST ? '?cluster=devnet' : '';
export const txUrl = (sig: string) => `${EXPLORER}/tx/${sig}${q}`;
export const addressUrl = (a: string) => `${EXPLORER}/account/${a}${q}`;
export const tokenUrl = (a: string) => `${EXPLORER}/token/${a}${q}`;

/** Pump coins have 6 decimals and a 1B supply. */
export const TOKEN_DECIMALS = 6;
export const LAMPORTS = 1_000_000_000;

export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

/**
 * Every Theorem launch carries this key as a read-only account, so `getSignaturesForAddress(TAG)` lists
 * exactly the launches made here. It is an off-curve address nobody can sign for.
 */
export const TAG = PublicKey.findProgramAddressSync([Buffer.from('theorem:launch:v1')], SystemProgram.programId)[0];
export const MEMO_TAG = 'theorem/1';

/** Compute budget and priority fee for each kind of transaction. */
export const CU = { launch: 400_000, trade: 250_000, marker: 30_000 } as const;
export const PRIORITY_MICROLAMPORTS = 20_000;

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
