'use client';

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { avatar } from '@/lib/sprites';
import { rand } from '@/lib/util';
import { sfx } from '@/lib/audio';
import type { GameCtl, GameDef } from './types';
import { useLatest } from './shared';

const SEEDS = ['mem1', 'mem2', 'mem3', 'mem4', 'mem5', 'mem6', 'mem7', 'mem8'];
type View = { cards: string[]; open: number[]; done: number[] };
type Live = { cards: string[]; open: number[]; done: Set<number>; moves: number; lock: boolean; timer: number | undefined };

function MemoryGame({ ctl }: { ctl: GameCtl }): JSX.Element {
  const ctlRef = useLatest(ctl);
  const g = useRef<Live>({ cards: [...SEEDS, ...SEEDS], open: [], done: new Set(), moves: 0, lock: false, timer: undefined });
  const [msg, setMsg] = useState('Flip two cards. Matches stay open.');
  const [view, setView] = useState<View>({ cards: [...SEEDS, ...SEEDS], open: [], done: [] });

  const sync = useCallback(() => {
    const s = g.current;
    setView({ cards: s.cards.slice(), open: s.open.slice(), done: [...s.done] });
  }, []);

  const reset = useCallback(() => {
    const s = g.current;
    window.clearTimeout(s.timer); s.timer = undefined;
    const cards = [...SEEDS, ...SEEDS];
    for (let i = cards.length - 1; i > 0; i--) { const j = rand(i + 1); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    s.cards = cards; s.open = []; s.done = new Set(); s.moves = 0; s.lock = false;
    ctlRef.current.setScore(0); setMsg('Flip two cards. Matches stay open.'); sync();
  }, [ctlRef, sync]);

  useEffect(() => {
    const s = g.current;
    reset();
    return () => { window.clearTimeout(s.timer); s.timer = undefined; s.lock = false; };
  }, [reset]);

  const flip = (i: number) => {
    const s = g.current;
    if (s.lock || s.open.includes(i) || s.done.has(i)) return;
    s.open.push(i); sfx.blip(); sync();
    if (s.open.length < 2) return;
    s.moves++; ctlRef.current.setScore(s.moves);
    const [a, c] = s.open;
    if (s.cards[a] === s.cards[c]) {
      s.done.add(a); s.done.add(c); s.open = []; sfx.coin(); sync();
      if (s.done.size === 16) { setMsg(`Cleared in ${s.moves} moves.`); ctlRef.current.end(s.moves, true); }
    } else {
      s.lock = true;
      s.timer = window.setTimeout(() => { s.timer = undefined; s.open = []; s.lock = false; sync(); }, 700);
    }
  };

  return (
    <div className="gwrap">
      <div className="mem">
        {view.cards.map((seed, i) => {
          const ok = view.done.includes(i), up = ok || view.open.includes(i);
          return (
            <button key={i} className={`mc${up ? ' up' : ''}${ok ? ' ok' : ''}`} data-i={i} aria-label={`Card ${i + 1}${up ? ', face up' : ''}`} onClick={() => flip(i)}>
              {up ? <img className="sp" src={avatar(seed)} alt="" /> : '?'}
            </button>
          );
        })}
      </div>
      <p className="hint">{msg}</p>
      <button className="btn sm ghost" onClick={reset}>Shuffle again</button>
    </div>
  );
}

export const memory: GameDef = {
  id: 'memory',
  name: 'Memory',
  label: 'MOVES',
  low: true,
  desc: 'Find the eight matching pixel pairs in as few moves as you can.',
  art(x) { [6, 15, 24, 33].forEach((a, i) => { x.fillStyle = '#fbfaf4'; x.fillRect(a, 8, 7, 10); x.fillStyle = i % 3 === 0 ? '#ffd23f' : ['#ff6b5b', '#3de8a0', '#7fd6ff'][i % 3]; x.fillRect(a + 2, 11, 3, 4); }); },
  Component: MemoryGame,
};
