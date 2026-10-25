'use client';
import { useEffect, useRef } from 'react';
import { PAL } from '@/lib/sprites';
import { sfx } from '@/lib/audio';
import { rand } from '@/lib/util';

type Glyph = { x: number; y: number; g: string; v: number; sw: number; a: number; s: number; c: string };
type Part = { x: number; y: number; vx: number; vy: number; l: number; d: number; s: number; c: string };
type Ripple = { x: number; y: number; r: number; p: number };
type Star = { x: number; y: number; vx: number; vy: number; tr: [number, number][] };
type Shot = { x: number; y: number; l: number };

const GLY = ['Σ', 'π', '∞', '∫', '√', '∀', '∃', '≠', 'φ', 'Δ', '⊢', 'ℵ'];
const GAP = 30;

/**
 * The living backdrop: a pixel grid that swells, wanders and reacts to the pointer, drifting math glyphs,
 * shooting stars, click ripples, a trailing reticle and a gunshot on every click outside a game panel.
 * Mark any area that should stay quiet with `data-nogun`.
 */
export function BackdropFX() {
  const bgRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const bg = bgRef.current!, fx = fxRef.current!;
    const bx = bg.getContext('2d')!, fxc = fx.getContext('2d')!;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, cols = 0, rows = 0, glyphs: Glyph[] = [];
    const m = { x: -999, y: -999, rx: -999, ry: -999, on: false, fine: false };
    const rip: Ripple[] = [], parts: Part[] = [], stars: Star[] = [], shots: Shot[] = [];
    let recoil = 0, lastMove = -1e9, lx = 0, ly = 0, nextRip = 1200, nextStar = 2500, raf = 0;
    const orbs = [0, 1, 2, 3].map((i) => ({ i, x: -999, y: -999 }));
    const root = document.documentElement;

    const size = () => {
      W = bg.width = fx.width = innerWidth; H = bg.height = fx.height = innerHeight;
      cols = Math.ceil(W / GAP) + 2; rows = Math.ceil(H / GAP) + 2;
      const n = Math.max(8, Math.round((W * H) / 70000));
      glyphs = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H, g: GLY[rand(GLY.length)], v: 0.12 + Math.random() * 0.3, sw: Math.random() * 6.28,
        a: 0.09 + Math.random() * 0.12, s: 14 + rand(3) * 6, c: Math.random() < 0.25 ? '#ffd23f' : Math.random() < 0.5 ? '#3de8a0' : '#7fd6ff',
      }));
    };
    size();

    const spawn = (x: number, y: number, n: number, burst: boolean) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, s = burst ? 1.5 + Math.random() * 4 : 0.3 + Math.random() * 0.9;
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (burst ? 1.8 : 0.2), l: 1, d: burst ? 0.018 : 0.03, s: 4 + rand(3) * 2, c: PAL[rand(PAL.length)] });
      }
      if (parts.length > 260) parts.splice(0, parts.length - 260);
    };

    const onMove = (e: PointerEvent) => {
      lastMove = performance.now(); m.x = e.clientX; m.y = e.clientY; m.on = true; m.fine = e.pointerType === 'mouse';
      if (m.rx < -900) { m.rx = m.x; m.ry = m.y; }
      root.style.setProperty('--mx', ((e.clientX / innerWidth - 0.5) * 2).toFixed(3));
      root.style.setProperty('--my', ((e.clientY / innerHeight - 0.5) * 2).toFixed(3));
      if (!reduce && Math.hypot(e.clientX - lx, e.clientY - ly) > 16) { spawn(e.clientX, e.clientY, 1, false); lx = e.clientX; ly = e.clientY; }
      /* 3D tilt on cartridges and cabinets */
      if (!reduce && e.pointerType === 'mouse') {
        const t = (e.target as Element).closest?.('.cart, .cab') as HTMLElement | null;
        if (t) {
          const r = t.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
          t.style.setProperty('--ry', (px * 10).toFixed(1) + 'deg'); t.style.setProperty('--rx', (-py * 10).toFixed(1) + 'deg');
        }
      }
    };
    const onOut = (e: PointerEvent) => {
      const t = (e.target as Element).closest?.('.cart, .cab') as HTMLElement | null;
      if (t && !t.contains(e.relatedTarget as Node | null)) { t.style.removeProperty('--rx'); t.style.removeProperty('--ry'); }
    };
    const onDown = (e: PointerEvent) => {
      if (e.button > 0) return;
      const quiet = (e.target as Element).closest?.('[data-nogun]');
      if (!quiet) { sfx.shot(); if (!reduce) { shots.push({ x: e.clientX, y: e.clientY, l: 1 }); recoil = 1; } }
      if (!reduce) { rip.push({ x: e.clientX, y: e.clientY, r: 0, p: 1 }); spawn(e.clientX, e.clientY, 12, true); if (rip.length > 7) rip.shift(); }
    };
    const onLeave = () => { m.on = false; };
    const onEnter = () => { m.on = true; };
    addEventListener('resize', size);
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('pointerout', onOut);
    root.addEventListener('mouseleave', onLeave);
    root.addEventListener('mouseenter', onEnter);

    const T0 = performance.now(); let prev = T0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      const t = now - T0, dt = Math.min(50, now - prev); prev = now;
      if (!reduce && now - lastMove > 1500) { /* idle sway for the hero cabinet and symbols */
        root.style.setProperty('--mx', (Math.sin(t / 2600) * 0.55).toFixed(3));
        root.style.setProperty('--my', (Math.cos(t / 3100) * 0.4).toFixed(3));
      }
      m.rx += (m.x - m.rx) * 0.22; m.ry += (m.y - m.ry) * 0.22;
      bx.clearRect(0, 0, W, H);

      if (!reduce) {
        for (const o of orbs) { o.x = W * (0.5 + 0.46 * Math.sin(t / (5200 + o.i * 1300) + o.i * 2.1)); o.y = H * (0.5 + 0.42 * Math.cos(t / (6100 + o.i * 900) + o.i * 1.3)); }
        if (t > nextRip) { rip.push({ x: Math.random() * W, y: Math.random() * H, r: 0, p: 0.55 }); if (rip.length > 7) rip.shift(); nextRip = t + 2600 + Math.random() * 2600; }
        if (t > nextStar) { const dir = Math.random() < 0.5 ? 1 : -1; stars.push({ x: dir > 0 ? -20 : W + 20, y: Math.random() * H * 0.6, vx: dir * (7 + Math.random() * 5), vy: 2.4 + Math.random() * 2.4, tr: [] }); nextStar = t + 3500 + Math.random() * 4500; }
      }
      for (const q of rip) q.r += 9 * (dt / 16.7);
      while (rip.length && rip[0].r > 620) rip.shift();

      const wave = t / 650;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const gx = c * GAP + (r % 2 ? GAP / 2 : 0), gy = r * GAP;
          let k = 0, sx = 0, sy = 0, sd = 1;
          const src = (cx: number, cy: number, rad: number, mul: number) => {
            const dx = gx - cx, dy = gy - cy, d = Math.hypot(dx, dy), v = d < rad ? (1 - d / rad) * mul : 0;
            if (v > k) { k = v; sx = dx; sy = dy; sd = d || 1; }
          };
          if (m.on) src(m.rx, m.ry, 200, 1);
          if (!reduce) {
            for (const o of orbs) src(o.x, o.y, 150, 0.8);
            for (const q of rip) {
              const dx = gx - q.x, dy = gy - q.y, d = Math.hypot(dx, dy), qd = Math.abs(d - q.r);
              if (qd < 28) { const v = (1 - qd / 28) * (1 - q.r / 620) * 1.25 * q.p; if (v > k) { k = v; sx = dx; sy = dy; sd = d || 1; } }
            }
          }
          const sw = reduce ? 0 : Math.max(0, Math.sin((gx + gy * 0.6) / 150 - wave) - 0.55) * 1.1;
          if (sw > k) { k = sw * 0.7; sx = 0; sy = 0; sd = 1; }
          const a = reduce ? 0.22 : 0.16 + 0.12 * Math.sin(t / 800 + c * 0.7 + r * 0.9);
          const push = k * k * 16, ox = (sx / sd) * push, oy = (sy / sd) * push;
          const s = 2 + Math.round((k * 6) / 2) * 2;
          bx.fillStyle = k > 0.7 ? `rgba(255,210,63,${0.55 + k * 0.4})` : k > 0.35 ? `rgba(61,232,160,${0.35 + k * 0.6})` : `rgba(127,214,255,${a + k * 0.7})`;
          bx.fillRect(Math.round(gx + ox - s / 2), Math.round(gy + oy - s / 2), s, s);
        }
      }

      bx.textAlign = 'center'; bx.textBaseline = 'middle';
      for (const g of glyphs) {
        if (!reduce) { g.y -= g.v * (dt / 16.7); g.x += Math.sin(t / 1800 + g.sw) * 0.25; if (g.y < -30) { g.y = H + 30; g.x = Math.random() * W; } }
        bx.globalAlpha = g.a * (0.7 + 0.3 * Math.sin(t / 1100 + g.sw)); bx.fillStyle = g.c;
        bx.font = `${g.s}px "Press Start 2P", monospace`; bx.fillText(g.g, Math.round(g.x), Math.round(g.y));
      }
      bx.globalAlpha = 1;

      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i]; s.x += s.vx * (dt / 16.7); s.y += s.vy * (dt / 16.7); s.tr.push([s.x, s.y]); if (s.tr.length > 14) s.tr.shift();
        s.tr.forEach(([x, y], j) => { bx.fillStyle = `rgba(255,255,255,${(j / s.tr.length) * 0.7})`; const q = j > 10 ? 4 : j > 5 ? 3 : 2; bx.fillRect(Math.round(x), Math.round(y), q, q); });
        if (s.x < -60 || s.x > W + 60 || s.y > H + 20) stars.splice(i, 1);
      }

      fxc.clearRect(0, 0, W, H);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.09; p.l -= p.d;
        if (p.l <= 0) { parts.splice(i, 1); continue; }
        fxc.globalAlpha = Math.min(1, p.l * 1.4); fxc.fillStyle = p.c;
        const s = Math.max(2, Math.round((p.s * p.l) / 2) * 2); fxc.fillRect(Math.round(p.x), Math.round(p.y), s, s);
      }
      fxc.globalAlpha = 1;
      for (let i = shots.length - 1; i >= 0; i--) { /* muzzle flash */
        const s = shots[i]; s.l -= 0.14; if (s.l <= 0) { shots.splice(i, 1); continue; }
        const z = Math.round(s.l * 7) * 2 + 2;
        fxc.fillStyle = '#ffffff'; fxc.fillRect(Math.round(s.x - z / 2), Math.round(s.y - z / 2), z, z);
        fxc.fillStyle = '#ffd23f'; fxc.fillRect(Math.round(s.x - z * 1.6), Math.round(s.y - 1), z * 3.2, 2); fxc.fillRect(Math.round(s.x - 1), Math.round(s.y - z * 1.6), 2, z * 3.2);
      }
      recoil = Math.max(0, recoil - 0.08);
      if (m.on && m.fine && !reduce) { /* pixel reticle that trails the pointer and kicks on each shot */
        const x = Math.round(m.rx), y = Math.round(m.ry), g = 11 + Math.round(recoil * 9), l = 5;
        const tick = (c: string, o: number) => {
          fxc.fillStyle = c;
          fxc.fillRect(x - g - l - o, y - 1 - o, l + 2 * o, 2 + 2 * o); fxc.fillRect(x + g - o, y - 1 - o, l + 2 * o, 2 + 2 * o);
          fxc.fillRect(x - 1 - o, y - g - l - o, 2 + 2 * o, l + 2 * o); fxc.fillRect(x - 1 - o, y + g - o, 2 + 2 * o, l + 2 * o);
        };
        tick('#16233f', 1); tick('#ffd23f', 0);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', size);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerout', onOut);
      root.removeEventListener('mouseleave', onLeave);
      root.removeEventListener('mouseenter', onEnter);
    };
  }, []);

  return (<><canvas id="bg" ref={bgRef} aria-hidden="true" /><canvas id="fx" ref={fxRef} aria-hidden="true" /></>);
}
