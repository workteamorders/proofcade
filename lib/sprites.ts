/* Pixel sprites drawn on tiny canvases. Browser only: call from effects or event handlers. */
import { rng } from './util';

export const PAL = ['#ff6b5b', '#3de8a0', '#7fd6ff', '#a597ff', '#ffd23f', '#ff8ad8'];

const cache = new Map<string, string>();

/** 8×8 symmetric pixel avatar derived from a seed. Returns a PNG data URL. */
export function avatar(seed: string): string {
  const hit = cache.get(seed); if (hit) return hit;
  if (typeof document === 'undefined') return '';
  const r = rng(seed), c = document.createElement('canvas'); c.width = c.height = 8;
  const x = c.getContext('2d')!, col = PAL[Math.floor(r() * PAL.length)], dark = '#16233f';
  const g = Array.from({ length: 8 }, () => Array(8).fill(0));
  for (let y = 1; y < 7; y++) for (let i = 0; i < 4; i++) { const on = r() < 0.62; g[y][i] = on ? 1 : 0; g[y][7 - i] = on ? 1 : 0; }
  g[3][2] = g[3][5] = 2; g[2][2] = g[2][5] = 1; g[5][3] = g[5][4] = r() < 0.5 ? 3 : 1;
  for (let y = 0; y < 8; y++) for (let i = 0; i < 8; i++) {
    const v = g[y][i]; if (!v) continue;
    x.fillStyle = v === 2 ? dark : v === 3 ? '#fbfaf4' : col; x.fillRect(i, y, 1, 1);
  }
  const u = c.toDataURL(); cache.set(seed, u); return u;
}

/** Override the sprite for a seed (used for uploaded logos and freshly launched coins). */
export function setAvatar(seed: string, url: string) { cache.set(seed, url); }

const GLYPH = ['1111111', '1000000', '0100000', '0010000', '0001000', '0010000', '0100000', '1000000', '1111111'];

/** The Proofcade coin, N×N pixels. */
export function coinCanvas(N: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d')!;
  const m = (N - 1) / 2, k = N / 16;
  for (let y = 0; y < N; y++) for (let i = 0; i < N; i++) {
    const d = Math.hypot(i - m, y - m);
    if (d > m + 0.4) continue;
    x.fillStyle = d > m - 1.1 * k ? '#8a5a00' : d > m - 2.2 * k ? '#e0a100' : '#ffd23f';
    if (d <= m - 2.2 * k && i + y < N * 0.55 && d > m - 5 * k) x.fillStyle = '#ffe98a';
    x.fillRect(i, y, 1, 1);
  }
  x.fillStyle = '#7a5200';
  const gx = Math.round((N - 7 * k) / 2), gy = Math.round((N - 9 * k) / 2);
  GLYPH.forEach((row, y) => [...row].forEach((v, i) => { if (v === '1') x.fillRect(gx + Math.round(i * k), gy + Math.round(y * k), Math.ceil(k), Math.ceil(k)); }));
  return c;
}

/** Build a data URL from ASCII rows and a char→colour map. */
export function spriteURL(rows: string[], cols: Record<string, string>): string {
  const c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length;
  const x = c.getContext('2d')!;
  rows.forEach((row, y) => [...row].forEach((ch, i) => { if (cols[ch]) { x.fillStyle = cols[ch]; x.fillRect(i, y, 1, 1); } }));
  return c.toDataURL();
}
