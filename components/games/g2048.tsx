'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import { rand } from '@/lib/util';
import { sfx } from '@/lib/audio';
import type { GameCtl, GameDef } from './types';
import { DPad, dirInput, scope, useLatest, type Dir } from './shared';

const COL: Record<number, string> = { 2: '#e5e9f4', 4: '#cfe0ff', 8: '#7fd6ff', 16: '#3de8a0', 32: '#a597ff', 64: '#ff8ad8', 128: '#ffd23f', 256: '#ffb02e', 512: '#ff6b5b', 1024: '#ff5577', 2048: '#ffffff' };

type View = { b: number[]; fresh: number; seq: number };

function Game2048({ ctl }: { ctl: GameCtl }): JSX.Element {
  const ctlRef = useLatest(ctl);
  const wrapRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState('Merge tiles with the same number.');
  const [view, setView] = useState<View>({ b: new Array<number>(16).fill(0), fresh: -1, seq: 0 });

  useEffect(() => {
    const host = wrapRef.current, el = boardRef.current;
    if (!host || !el) return;
    const sc = scope();
    let b: number[] = [], score = 0, won = false, fresh = -1, dead = false, seq = 0;

    const add = () => { const e: number[] = []; b.forEach((v, i) => { if (!v) e.push(i); }); if (!e.length) return; fresh = e[rand(e.length)]; b[fresh] = Math.random() < .9 ? 2 : 4; };
    const draw = () => setView({ b: b.slice(), fresh, seq: ++seq });
    const reset = () => { b = new Array<number>(16).fill(0); score = 0; won = false; dead = false; fresh = -1; add(); add(); ctlRef.current.setScore(0); setMsg('Merge tiles with the same number.'); draw(); };
    const slide = (a: number[]): [number[], number] => { const r = a.filter(Boolean); let g = 0; for (let i = 0; i < r.length - 1; i++) if (r[i] === r[i + 1]) { r[i] *= 2; g += r[i]; r.splice(i + 1, 1); } while (r.length < 4) r.push(0); return [r, g]; };
    const stuck = () => { if (b.includes(0)) return false; for (let i = 0; i < 16; i++) { if (i % 4 < 3 && b[i] === b[i + 1]) return false; if (i < 12 && b[i] === b[i + 4]) return false; } return true; };
    const move = (d: Dir) => {
      if (dead) { reset(); return; }
      const before = b.join(','); let gain = 0;
      for (let k = 0; k < 4; k++) {
        const idx = d === 'l' ? [0, 1, 2, 3].map((i) => k * 4 + i) : d === 'r' ? [3, 2, 1, 0].map((i) => k * 4 + i) : d === 'u' ? [0, 1, 2, 3].map((i) => i * 4 + k) : [3, 2, 1, 0].map((i) => i * 4 + k);
        const [r, g] = slide(idx.map((i) => b[i])); gain += g; idx.forEach((i, j) => { b[i] = r[j]; });
      }
      if (b.join(',') === before) return;
      score += gain; if (gain) sfx.coin(); else sfx.blip(); add(); ctlRef.current.setScore(score); draw();
      if (!won && b.includes(2048)) { won = true; ctlRef.current.toast('2048!', 'You reached 2048. Keep going.'); sfx.win(); }
      if (stuck()) { dead = true; setMsg('No moves left. Press any direction to play again.'); ctlRef.current.end(score); }
    };
    dirInput(sc, host, el, move);
    reset();
    return sc.stop;
  }, [ctlRef]);

  return (
    <div className="gwrap" ref={wrapRef}>
      <div className="g48" ref={boardRef} aria-label="2048 board">
        {view.b.map((v, i) => (
          <i
            // the newest tile gets a fresh key per draw so its pop animation replays
            key={i === view.fresh ? `${i}-${view.seq}` : i}
            className={i === view.fresh ? 'pop' : ''}
            style={v ? { background: COL[v] || '#fff', ...(v > 999 ? { fontSize: 14 } : null) } : undefined}
          >
            {v || ''}
          </i>
        ))}
      </div>
      <p className="hint">{msg}</p>
      <DPad />
    </div>
  );
}

export const g2048: GameDef = {
  id: 'g2048',
  name: '2048',
  label: 'SCORE',
  desc: 'Slide and merge equal tiles. Reach 2048. Arrow keys, WASD or swipe.',
  art(x) { const tiles: Array<[string, number, number]> = [['#7fd6ff', 12, 4], ['#3de8a0', 23, 4], ['#ffd23f', 12, 14], ['#ff6b5b', 23, 14]]; tiles.forEach(([c, a, b]) => { x.fillStyle = c; x.fillRect(a, b, 9, 9); x.fillStyle = '#16233f'; x.fillRect(a + 3, b + 3, 3, 3); }); },
  Component: Game2048,
};
