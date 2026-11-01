'use client';
import { useEffect, useState } from 'react';
import { avatar, generated } from '@/lib/sprites';

const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Seeded 8×8 pixel avatar, drawn on a canvas after mount so server and client markup match. */
export function Px({ seed, large, className = '', size, logo }: { seed: string; large?: boolean; className?: string; size?: number; logo?: boolean }) {
  const [src, setSrc] = useState(BLANK);
  /* a coin with a custom logo loads it; if it is missing the sprite stands in */
  useEffect(() => { setSrc(logo ? `/api/logo/${seed}` : avatar(seed)); }, [seed, logo]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`px ${large ? 'lg' : ''} ${className}`} src={src} alt="" onError={() => setSrc((cur) => (cur.startsWith('/api/logo/') ? avatar(seed) : generated(seed)))} width={size ?? (large ? 72 : 48)} height={size ?? (large ? 72 : 48)} />
  );
}
