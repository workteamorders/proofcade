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
import { BackdropFX } from '@/components/BackdropFX';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { Ticker } from '@/components/Ticker';

export const metadata: Metadata = {
  title: { default: "Sigmafun", template: "%s · Sigmafun" },
  description: 'Theorem-backed coins on Robinhood Chain, in a pixel arcade.',
};

export const viewport: Viewport = { themeColor: '#050f33', viewportFit: 'cover', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <BackdropFX />
          <a className="sr" href="#view">Skip to content</a>
          <SiteHeader />
          <Ticker />
          <main className="wrap" id="view" tabIndex={-1}>{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
