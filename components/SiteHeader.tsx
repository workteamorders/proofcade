'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/lib/app';
import { coinCanvas } from '@/lib/sprites';
import { fmt, short } from '@/lib/util';
import { IS_TEST } from '@/lib/sol/config';
import { VERIFY_ON } from '@/lib/features';

const ALL_NAV: { href: string; label: string; tag?: string }[] = [
  { href: '/', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/launch', label: 'Launch' },
  { href: '/live', label: 'Live' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/verify', label: 'Verify', tag: 'LEAN' },
  { href: '/arcade', label: 'Arcade' },
];
export const NAV = ALL_NAV.filter((n) => n.href !== '/verify' || VERIFY_ON);

const active = (path: string, href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));

export function SiteHeader() {
  const app = useApp();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const logo = useRef<HTMLCanvasElement>(null);

  useEffect(() => { const c = logo.current; if (c) c.getContext('2d')!.drawImage(coinCanvas(16), 0, 0); }, []);
  useEffect(() => { setOpen(false); }, [path]);

  return (
    <header className="top">
      <div className="wrap">
        <Link className="logo" href="/" aria-label="Theorema home">
          <canvas ref={logo} width={16} height={16} aria-hidden="true" /><span>THEOREMA</span>
        </Link>
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(path, n.href) ? 'page' : undefined}>
              {n.label}{n.tag && <span className="tag">{n.tag}</span>}
            </Link>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <span className="chip hide-m"><span className={`led ${app.connected ? '' : 'off'}`} />{IS_TEST ? 'DEVNET' : 'SOLANA'}</span>
        <button className="iconbtn" type="button" aria-pressed={app.sfxOn} aria-label="Toggle sound effects" title="Sound effects" onClick={app.toggleSfx}>♪</button>
        {/* The wallet control is pinned top right on every page. */}
        <button className={`wallet ${app.connected ? 'on' : ''}`} type="button" aria-label={app.connected ? 'Wallet account' : 'Connect wallet'} onClick={app.openWallet}>
          <span className="slot" />
          {app.connected ? (<><span>{short(app.address)}</span><span className="long mono">· {fmt(app.balance)} SOL</span></>) : (<><span className="long">Insert coin ·</span><span>Connect</span></>)}
        </button>
        <button className="burger" type="button" aria-label="Menu" aria-expanded={open} aria-controls="menu" onClick={() => setOpen((o) => !o)}><span /><span /><span /></button>
      </div>
      <nav className={`menu wrap ${open ? 'open' : ''}`} id="menu" aria-label="Mobile">
        {NAV.map((n) => <Link key={n.href} href={n.href} aria-current={active(path, n.href) ? 'page' : undefined}>{n.label}</Link>)}
      </nav>
    </header>
  );
}
