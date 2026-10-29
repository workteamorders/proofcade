import type { NextConfig } from 'next';

const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER;
if (cluster && cluster !== 'devnet' && cluster !== 'mainnet-beta') {
  throw new Error('NEXT_PUBLIC_SOLANA_CLUSTER must be devnet or mainnet-beta. Solana testnet is not supported.');
}
for (const key of ['SOLANA_RPC_URL', 'NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_SOLANA_RPC_URL']) {
  const value = process.env[key]?.trim();
  if (!value) continue;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error();
    if (key === 'NEXT_PUBLIC_SITE_URL' && (url.username || url.password || url.pathname !== '/' || url.search || url.hash)) throw new Error();
  } catch {
    throw new Error(`${key} must be a complete HTTP(S) URL${key === 'NEXT_PUBLIC_SITE_URL' ? ' containing only the site origin' : ''}.`);
  }
}

const config: NextConfig = {
  reactStrictMode: true,
};

export default config;
