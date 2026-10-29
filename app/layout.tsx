import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource/press-start-2p/400.css';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Web3 } from '@/components/Web3';
import { BackdropFX } from '@/components/BackdropFX';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { Ticker } from '@/components/Ticker';

export const metadata: Metadata = {
  title: { default: "Theorem", template: "%s · Theorem" },
  description: 'Theorem-backed coins on Solana, in a pixel arcade.',
  robots: process.env.NEXT_PUBLIC_SOLANA_CLUSTER === 'mainnet-beta' ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#050f33', viewportFit: 'cover', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Web3>
        <Providers>
          <BackdropFX />
          <a className="sr" href="#view">Skip to content</a>
          <SiteHeader />
          <Ticker />
          <main className="wrap" id="view" tabIndex={-1}>{children}</main>
          <SiteFooter />
        </Providers>
        </Web3>
      </body>
    </html>
  );
}
