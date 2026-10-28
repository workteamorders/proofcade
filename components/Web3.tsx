'use client';
import '@/lib/sol/polyfill';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CLUSTER, rpcEndpoint } from '@/lib/sol/config';

const onError = (e: Error) => {
  const m = /reject|denied|cancel|closed/i.test(e.message) ? 'You cancelled the request in your wallet.' : e.message.split('\n')[0] || 'The wallet did not connect.';
  window.dispatchEvent(new CustomEvent('wallet-error', { detail: m }));
};

/**
 * MetaMask supports Solana through its own SDK, which registers it as a Wallet Standard wallet.
 * Once registered, the wallet adapter below lists it with the other wallets.
 */
function useMetaMask() {
  useEffect(() => {
    let dead = false;
    import('@metamask/connect-solana')
      .then(({ createSolanaClient }) => {
        if (dead) return;
        const net = CLUSTER === 'devnet' ? 'devnet' : 'mainnet';
        return createSolanaClient({
          dapp: { name: 'Theorem', url: window.location.origin },
          api: { supportedNetworks: { [net]: rpcEndpoint() } },
        });
      })
      .catch((e) => console.warn('[metamask]', e));
    return () => { dead = true; };
  }, []);
}

/** Phantom and Solflare as explicit adapters; any Wallet Standard wallet (MetaMask, Backpack, …) is found on its own. */
export function Web3({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: false } } }));
  useMetaMask();
  const endpoint = useMemo(() => rpcEndpoint(), []);
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  return (
    <QueryClientProvider client={qc}>
      <ConnectionProvider endpoint={endpoint} config={{ commitment: 'confirmed' }}>
        <WalletProvider wallets={wallets} autoConnect onError={onError}>{children}</WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}
