'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import { sfx } from '@/lib/audio';
import type { GameCtl, GameDef } from './types';
import { scope, typing, useLatest } from './shared';

const W = 360, H = 440, PY = 410, PW = 70, PH = 10, BW = 40, BH = 16;
const colors = ['#ff6b5b', '#ff8ad8', '#a597ff', '#7fd6ff', '#3de8a0'];
type Brick = { x: number; y: number; c: string; on: boolean; p: number };

function BreakoutGame({ ctl }: { ctl: GameCtl }): JSX.Element {
  const ctlRef = useLatest(ctl);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [msg, setMsg] = useState('Click or press Space to launch.');

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const x = cv.getContext('2d');
    if (!x) return;
    x.imageSmoothingEnabled = false;
    const sc = scope();
    let px = W / 2, bx = 0, by = 0, vx = 0, vy = 0, lives = 3, score = 0, bricks: Brick[] = [], stuck = true, over = false, speed = 4.2;
    const keys = { l: false, r: false };

    const build = () => { bricks = []; for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) bricks.push({ x: 20 + c * BW, y: 50 + r * (BH + 4), c: colors[r], on: true, p: 50 - r * 8 }); };
    const reset = () => { build(); lives = 3; score = 0; speed = 4.2; over = false; stuck = true; px = W / 2; ctlRef.current.setScore(0); setMsg('Click or press Space to launch.'); };
    const launch = () => { if (over) { reset(); return; } if (!stuck) return; stuck = false; const a = (Math.random() - .5) * .9; vx = speed * Math.sin(a); vy = -speed * Math.cos(a); setMsg(''); sfx.blip(); };
    const aim = (clientX: number) => { const r = cv.getBoundingClientRect(); px = Math.max(PW / 2, Math.min(W - PW / 2, ((clientX - r.left) / r.width) * W)); };
    sc.el(cv, 'pointermove', (e) => aim(e.clientX));
    sc.el(cv, 'pointerdown', (e) => { aim(e.clientX); launch(); });
    sc.doc('keydown', (e) => {
      if (typing(e)) return;
      if (e.key === 'ArrowLeft' || e.key === 'a') { keys.l = true; e.preventDefault(); }
      if (e.key === 'ArrowRight' || e.key === 'd') { keys.r = true; e.preventDefault(); }
      if (e.key === ' ') { e.preventDefault(); launch(); }
    });
    sc.doc('keyup', (e) => { if (e.key === 'ArrowLeft' || e.key === 'a') keys.l = false; if (e.key === 'ArrowRight' || e.key === 'd') keys.r = false; });
    const draw = () => {
      x.fillStyle = '#03091f'; x.fillRect(0, 0, W, H);
      bricks.forEach((b) => { if (!b.on) return; x.fillStyle = b.c; x.fillRect(b.x + 1, b.y + 1, BW - 2, BH - 2); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(b.x + 1, b.y + 1, BW - 2, 3); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(b.x + 1, b.y + BH - 4, BW - 2, 3); });
      x.fillStyle = '#fbfaf4'; x.fillRect(px - PW / 2, PY, PW, PH); x.fillStyle = '#7fd6ff'; x.fillRect(px - PW / 2, PY, PW, 3);
      x.fillStyle = '#ffd23f'; x.fillRect(bx - 6, by - 6, 12, 12); x.fillStyle = '#8a5a00'; x.fillRect(bx - 2, by - 2, 4, 4);
      x.fillStyle = '#ff5577'; for (let i = 0; i < lives; i++) x.fillRect(10 + i * 16, H - 16, 10, 8);
      if (over) { x.fillStyle = 'rgba(3,9,31,.78)'; x.fillRect(0, 0, W, H); x.fillStyle = '#ffd23f'; x.font = '16px "Press Start 2P", monospace'; x.textAlign = 'center'; x.fillText('GAME OVER', W / 2, H / 2); x.fillStyle = '#fff'; x.font = '10px "Press Start 2P", monospace'; x.fillText('click to retry', W / 2, H / 2 + 26); }
    };
    sc.raf((dt) => {
      const k = Math.min(2.2, dt / 16.7);
      if (!over) {
        if (keys.l) px -= 6 * k;
        if (keys.r) px += 6 * k;
        px = Math.max(PW / 2, Math.min(W - PW / 2, px));
        if (stuck) { bx = px; by = PY - 8; }
        else {
          bx += vx * k; by += vy * k;
          if (bx < 6) { bx = 6; vx = Math.abs(vx); }
          if (bx > W - 6) { bx = W - 6; vx = -Math.abs(vx); }
          if (by < 6) { by = 6; vy = Math.abs(vy); }
          if (vy > 0 && by + 6 >= PY && by + 6 <= PY + PH + vy * k + 2 && bx >= px - PW / 2 - 5 && bx <= px + PW / 2 + 5) {
            const a = ((bx - px) / (PW / 2)) * 1.05, sp = Math.hypot(vx, vy); vx = sp * Math.sin(a); vy = -sp * Math.cos(a); by = PY - 6; sfx.blip();
          }
          for (const b of bricks) {
            if (!b.on || bx + 6 <= b.x || bx - 6 >= b.x + BW || by + 6 <= b.y || by - 6 >= b.y + BH) continue;
            b.on = false; score += b.p; ctlRef.current.setScore(score); sfx.coin();
            if (Math.min(bx + 6 - b.x, b.x + BW - (bx - 6)) < Math.min(by + 6 - b.y, b.y + BH - (by - 6))) vx = -vx; else vy = -vy;
            break;
          }
          if (by > H + 10) { lives--; stuck = true; sfx.bad(); if (lives <= 0) { over = true; setMsg(''); ctlRef.current.end(score); } else setMsg(`${lives} ${lives === 1 ? 'life' : 'lives'} left. Click to launch.`); }
          if (!bricks.some((b) => b.on)) { speed = Math.min(8, speed + .7); build(); stuck = true; ctlRef.current.toast('LEVEL UP', 'Board cleared. The ball gets faster.'); sfx.win(); setMsg('Next board. Click to launch.'); }
        }
      }
      draw();
    });
    reset();
    return sc.stop;
  }, [ctlRef]);

  return (
    <div className="gwrap">
      <canvas className="gcv" ref={cvRef} width={W} height={H} aria-label="Breakout board" />
      <p className="hint">{msg}</p>
    </div>
  );
}

export const breakout: GameDef = {
  id: 'breakout',
  name: 'Breakout',
  label: 'SCORE',
  desc: 'Bounce the coin, clear every brick, keep three lives. Pointer or arrow keys.',
  art(x) { ['#ff6b5b', '#ffd23f', '#3de8a0'].forEach((c, r) => { x.fillStyle = c; for (let i = 0; i < 8; i++) x.fillRect(5 + i * 5, 4 + r * 3, 4, 2); }); x.fillStyle = '#fbfaf4'; x.fillRect(19, 21, 10, 2); x.fillStyle = '#ffd23f'; x.fillRect(24, 15, 2, 2); },
  Component: BreakoutGame,
};
