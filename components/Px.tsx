'use client';
import { useEffect, useState } from 'react';
import { avatar, generated } from '@/lib/sprites';

const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Seeded 8×8 pixel avatar, drawn on a canvas after mount so server and client markup match. */
export function Px({ seed, large, className = '', size }: { seed: string; large?: boolean; className?: string; size?: number }) {
  const [src, setSrc] = useState(BLANK);
  useEffect(() => { setSrc(avatar(seed)); }, [seed]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`px ${large ? 'lg' : ''} ${className}`} src={src} alt="" onError={() => setSrc(generated(seed))} width={size ?? (large ? 72 : 48)} height={size ?? (large ? 72 : 48)} />
  );
}
