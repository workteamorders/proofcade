'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import { rand } from '@/lib/util';
import { sfx } from '@/lib/audio';
import type { GameCtl, GameDef } from './types';
import { gemURL, rugURL, scope, useLatest } from './shared';

type Kind = 'r' | 'g';
type Phase = 'idle' | 'run' | 'done';
const EMPTY: Array<Kind | null> = Array.from({ length: 9 }, () => null);

function WhackGame({ ctl }: { ctl: GameCtl }): JSX.Element {
  const ctlRef = useLatest(ctl);
  const wrapRef = useRef<HTMLDivElement>(null);
  const goRef = useRef<HTMLButtonElement>(null);
  const [msg, setMsg] = useState('Press start.');
  const [time, setTime] = useState(30);
  const [phase, setPhase] = useState<Phase>('idle');
  const [holes, setHoles] = useState<Array<Kind | null>>(EMPTY);

  useEffect(() => {
    const host = wrapRef.current, go = goRef.current;
    if (!host || !go) return;
    const sc = scope(), live = new Map<number, ReturnType<typeof setTimeout>>(), cur: Array<Kind | null> = EMPTY.slice();
    let t = 30, score = 0, run = false;

    const hide = (i: number) => {
      clearTimeout(live.get(i)); live.delete(i); cur[i] = null; setHoles(cur.slice());
    };
    const clear = () => { [...live.keys()].forEach(hide); };
    const show = (i: number, k: Kind) => {
      cur[i] = k; setHoles(cur.slice());
      live.set(i, setTimeout(() => hide(i), Math.max(520, 1000 - (30 - t) * 14)));
    };
    const finish = () => { run = false; clear(); setPhase('done'); setMsg(`Time! ${score} points.`); ctlRef.current.end(score); };

    sc.loop(() => {
      if (!run) return 250;
      const free = cur.map((_, i) => i).filter((i) => !live.has(i));
      if (free.length) show(free[rand(free.length)], Math.random() < .78 ? 'r' : 'g');
      return Math.max(360, 800 - (30 - t) * 14);
    });
    sc.every(() => { if (!run) return; t--; setTime(t); if (t <= 0) finish(); }, 1000);
    sc.el(host, 'pointerdown', (e) => {
      const h = e.target instanceof Element ? e.target.closest<HTMLElement>('.hole') : null;
      if (!h || !run) return;
      const i = Number(h.dataset.i), k = cur[i];
      if (!k) return;
      hide(i);
      if (k === 'r') { score += 10; sfx.coin(); setMsg('Rug pulled. Nice.'); } else { score = Math.max(0, score - 20); sfx.bad(); setMsg('Oops. Those were diamond hands.'); }
      ctlRef.current.setScore(score);
    });
    sc.el(go, 'click', () => {
      t = 30; score = 0; run = true;
      ctlRef.current.setScore(0); setTime(30); setMsg('Go!'); setPhase('run');
    });
    sc.add(clear);
    return sc.stop;
  }, [ctlRef]);

  return (
    <div className="gwrap" ref={wrapRef}>
      <div className="wbar"><span>TIME <b>{time}</b>s</span><span>{msg}</span></div>
      <div className="holes">
        {holes.map((k, i) => (
          <button key={i} className="hole" data-i={i} data-k={k ?? undefined} aria-label={`Hole ${i + 1}`}>
            {k && <img className="sp" src={k === 'r' ? rugURL() : gemURL()} alt={k === 'r' ? 'Rug puller' : 'Diamond'} />}
          </button>
        ))}
      </div>
      <button className="btn" ref={goRef} disabled={phase === 'run'}>{phase === 'run' ? 'Playing…' : phase === 'done' ? '▶ Play again' : '▶ Start'}</button>
    </div>
  );
}

export const whack: GameDef = {
  id: 'whack',
  name: 'Whack-a-Rug',
  label: 'SCORE',
  desc: 'Thirty seconds. Smack the rug pullers, spare the diamond hands.',
  art(x) { x.fillStyle = '#0b1747'; [8, 19, 30].forEach((a) => x.fillRect(a, 17, 8, 4)); x.fillStyle = '#ff6b5b'; x.fillRect(20, 10, 6, 7); x.fillStyle = '#fbfaf4'; x.fillRect(21, 12, 1, 1); x.fillRect(24, 12, 1, 1); x.fillStyle = '#7fd6ff'; x.fillRect(31, 12, 5, 5); },
  Component: WhackGame,
};
