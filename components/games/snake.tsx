'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import { coinCanvas } from '@/lib/sprites';
import { rand } from '@/lib/util';
import { sfx } from '@/lib/audio';
import type { GameCtl, GameDef } from './types';
import { DPad, dirInput, scope, useLatest, type Dir } from './shared';

type P = [number, number];
const N = 18, C = 20;
const DIRS: Record<Dir, P> = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };

function SnakeGame({ ctl }: { ctl: GameCtl }): JSX.Element {
  const ctlRef = useLatest(ctl);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [msg, setMsg] = useState('Press an arrow key to start.');

  useEffect(() => {
    const host = wrapRef.current, cv = cvRef.current;
    if (!host || !cv) return;
    const x = cv.getContext('2d');
    if (!x) return;
    x.imageSmoothingEnabled = false;
    const sc = scope(), coin = coinCanvas(16);
    let snake: P[] = [], dir: P = [1, 0], food: P = [0, 0], score = 0, alive = true, speed = 130, started = false;

    const place = () => { do { food = [rand(N), rand(N)]; } while (snake.some((s) => s[0] === food[0] && s[1] === food[1])); };
    const draw = () => {
      x.fillStyle = '#03091f'; x.fillRect(0, 0, N * C, N * C);
      x.fillStyle = '#0a1a4d'; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if ((i + j) % 2) x.fillRect(i * C, j * C, C, C);
      x.drawImage(coin, food[0] * C + 1, food[1] * C + 1, C - 2, C - 2);
      snake.forEach((s, i) => { x.fillStyle = i ? '#3de8a0' : '#ffd23f'; x.fillRect(s[0] * C + 1, s[1] * C + 1, C - 2, C - 2); x.fillStyle = i ? '#1aa874' : '#e0a100'; x.fillRect(s[0] * C + 5, s[1] * C + 5, C - 10, C - 10); });
      const h = snake[0]; x.fillStyle = '#16233f'; x.fillRect(h[0] * C + 4, h[1] * C + 5, 3, 3); x.fillRect(h[0] * C + 13, h[1] * C + 5, 3, 3);
      if (!alive) { x.fillStyle = 'rgba(3,9,31,.78)'; x.fillRect(0, 0, N * C, N * C); x.fillStyle = '#ffd23f'; x.font = '16px "Press Start 2P", monospace'; x.textAlign = 'center'; x.fillText('GAME OVER', N * C / 2, N * C / 2 - 6); x.fillStyle = '#fff'; x.font = '10px "Press Start 2P", monospace'; x.fillText('tap or press a key', N * C / 2, N * C / 2 + 20); }
    }
    const reset = () => { snake = [[9, 9], [8, 9], [7, 9]]; dir = [1, 0]; score = 0; alive = true; speed = 130; started = false; place(); ctlRef.current.setScore(0); setMsg('Press an arrow key to start.'); draw(); };
    const turn = (k: Dir) => {
      if (!alive) { reset(); return; }
      const d = DIRS[k];
      if (!started) { started = true; setMsg(''); }
      if (d[0] === -dir[0] && d[1] === -dir[1]) return;
      dir = d;
    };
    const step = () => {
      if (!alive || !started) return;
      const h: P = [snake[0][0] + dir[0], snake[0][1] + dir[1]], eat = h[0] === food[0] && h[1] === food[1];
      const body = eat ? snake : snake.slice(0, -1);
      if (h[0] < 0 || h[1] < 0 || h[0] >= N || h[1] >= N || body.some((s) => s[0] === h[0] && s[1] === h[1])) { alive = false; draw(); ctlRef.current.end(score); return; }
      snake.unshift(h);
      if (eat) { score += 10; speed = Math.max(62, speed - 3); sfx.coin(); ctlRef.current.setScore(score); place(); } else snake.pop();
      draw();
    }
    dirInput(sc, host, cv, turn);
    sc.el(cv, 'click', () => { if (!alive) reset(); });
    sc.loop(() => { step(); return speed; });
    reset();
    return sc.stop;
  }, [ctlRef]);

  return (
    <div className="gwrap" ref={wrapRef}>
      <canvas className="gcv" ref={cvRef} width={N * C} height={N * C} aria-label="Snake board" />
      <p className="hint">{msg}</p>
      <DPad />
    </div>
  );
}

export const snake: GameDef = {
  id: 'snake',
  name: 'Snake',
  label: 'SCORE',
  desc: 'Eat coins, grow longer, never bite yourself. Arrow keys, WASD or swipe.',
  art(x) { x.fillStyle = '#3de8a0'; for (let i = 0; i < 7; i++) x.fillRect(8 + i * 3, 14, 3, 3); x.fillRect(26, 11, 3, 3); x.fillRect(26, 8, 3, 3); x.fillStyle = '#ffd23f'; x.fillRect(29, 8, 3, 3); x.fillRect(36, 15, 4, 4); x.fillStyle = '#8a5a00'; x.fillRect(37, 16, 2, 2); },
  Component: SnakeGame,
};
