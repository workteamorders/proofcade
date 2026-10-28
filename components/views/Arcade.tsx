'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/lib/app';
import { BOARD } from '@/lib/data';
import { sfx } from '@/lib/audio';
import { GAMES, GAME_ORDER } from '../games';
import type { GameCtl } from '../games/types';
import { CabArt } from '../ui';

const STORE = 'proofcade_best';
type Best = Record<string, number>;

function loadBest(): Best { try { return JSON.parse(localStorage.getItem(STORE) || '{}') as Best; } catch { return {}; } }
function saveBest(b: Best) { try { localStorage.setItem(STORE, JSON.stringify(b)); } catch { /* storage can be unavailable */ } }

function GamePanel({ id, best, onBest, onClose }: { id: string; best: Best; onBest: (id: string, n: number) => void; onClose: () => void }) {
  const app = useApp();
  const g = GAMES[id];
  const [runKey, setRunKey] = useState(0);
  const [score, setScore] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const { toast, connected } = app;

  useEffect(() => { box.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [id]);

  const ctl: GameCtl = useMemo(() => ({
    setScore,
    toast,
    end: (n, win) => {
      const prev = best[id];
      const ok = g.low ? !!win : n > 0;
      const isBest = ok && (prev == null || (g.low ? n < prev : n > prev));
      if (isBest) onBest(id, n);
      if (ok) sfx.win(); else sfx.bad();
      toast(win ? 'LEVEL CLEAR' : 'GAME OVER', `${g.name}: ${n}${isBest ? ' · NEW BEST' : ''}${connected ? '' : ' · connect a wallet to rank it'}`);
    },
  }), [id, g, best, onBest, toast, connected]);

  const Game = g.Component;
  return (
    <div className="screen section" id="gamebox" ref={box} data-nogun style={{ marginTop: 36 }}>
      <div className="gp-head">
        <b>{g.name}</b>
        <span>BEST <b>{best[id] == null ? '—' : best[id]}</b></span>
        <span>{g.label} <b>{score}</b></span>
        <div className="gp-btns">
          <button className="btn sm ghost" aria-pressed={app.sfxOn} onClick={app.toggleSfx}>Sound: {app.sfxOn ? 'on' : 'off'}</button>
          <button className="btn sm ghost" onClick={() => { setScore(0); setRunKey((k) => k + 1); }}>Restart</button>
          <button className="btn sm ghost" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="gp-host"><Game key={`${id}-${runKey}`} ctl={ctl} /></div>
    </div>
  );
}

export function ArcadeView() {
  const app = useApp();
  const [active, setActive] = useState<string | null>(null);
  const [best, setBest] = useState<Best>({});
  useEffect(() => { setBest(loadBest()); }, []);
  const onBest = useCallback((id: string, n: number) => setBest((b) => { const nb = { ...b, [id]: n }; saveBest(nb); return nb; }), []);

  return (
    <>
      <div className="eyebrow">Theorem · {GAME_ORDER.length} cabinets</div>
      <h1 style={{ margin: '14px 0 14px' }}>Time for a little downtime.</h1>
      <p className="lead" style={{ marginBottom: 26 }}>Six games, no wallet needed. Move your cursor, click anything: the whole room reacts. A wallet only unlocks the ranked board.</p>
      <div className="cabs">
        {GAME_ORDER.map((id) => {
          const g = GAMES[id];
          return (
            <div className="screen cab" key={id}>
              <div className="cab-screen crt"><CabArt draw={g.art} /></div>
              <div className="cab-body">
                <h3>{g.name}</h3>
                <p>{g.desc}</p>
                <div className="cab-foot">
                  <button className="btn" onClick={() => setActive(id)}>▶ Play</button>
                  <span className="mono best">{best[id] == null ? 'No score yet' : `Best ${best[id]}`}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {active && <GamePanel key={active} id={active} best={best} onBest={onBest} onClose={() => setActive(null)} />}

      <div className="screen pad on-dark" style={{ marginTop: 28, background: 'var(--tile)', color: '#fff', borderColor: 'var(--void)' }}>
        <div className="eyebrow"><b>Ranked</b> · today&apos;s leaderboard</div>
        <div className="scroll-x">
          <table className="list" style={{ marginTop: 14, color: '#fff' }}>
            <thead><tr>{['#', 'Player', 'Game', 'Time'].map((h, i) => <th key={h} className={i === 3 ? 'r' : ''} style={{ background: 'transparent', color: 'var(--hero-faint)', borderColor: 'var(--edge)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {BOARD.map((b, i) => (
                <tr key={b.who} style={{ cursor: 'default' }}>
                  <td style={{ borderColor: 'var(--edge)' }}>{i + 1}</td><td style={{ borderColor: 'var(--edge)' }}>{b.who}</td>
                  <td style={{ borderColor: 'var(--edge)' }}>Minesweeper · Beginner</td><td className="r" style={{ borderColor: 'var(--edge)' }}>{b.sec}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mono" style={{ fontSize: 12, color: 'var(--hero-dim)', margin: '14px 0 0' }}>{app.connected ? 'Signed in. Your wins are ranked.' : 'Connect a wallet to post your time. Playing stays free.'}</p>
      </div>
    </>
  );
}
