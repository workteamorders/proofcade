'use client';

import { useEffect, useRef, useState, type JSX, type MouseEvent } from 'react';
import { sfx } from '@/lib/audio';
import type { GameCtl, GameDef } from './types';

type Cell = { m: boolean; n: number; o: boolean; f: boolean };
type Board = { cells: Cell[]; first: boolean; over: boolean; win: boolean; flag: boolean };
const MINES = 10;

const newBoard = (): Board => ({ cells: Array.from({ length: 81 }, () => ({ m: false, n: 0, o: false, f: false })), first: true, over: false, win: false, flag: false });

const nb = (i: number): number[] => {
  const r = Math.floor(i / 9), c = i % 9, o: number[] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < 9 && cc >= 0 && cc < 9) o.push(rr * 9 + cc);
  }
  return o;
};

/** Pure port of msOpen: returns the next board plus what happened, so the component can fire side effects. */
function open(b: Board, i: number): { board: Board; started: boolean; hit: boolean; won: boolean } {
  if (b.over || b.win || b.cells[i].o || b.cells[i].f) return { board: b, started: false, hit: false, won: false };
  const cells = b.cells.map((c) => ({ ...c }));
  let started = false;
  if (b.first) {
    started = true;
    const safe = new Set([i, ...nb(i)]);
    let k = 0;
    while (k < MINES) { const j = Math.floor(Math.random() * 81); if (!safe.has(j) && !cells[j].m) { cells[j].m = true; k++; } }
    cells.forEach((x, j) => { x.n = nb(j).filter((q) => cells[q].m).length; });
  }
  const next: Board = { ...b, cells, first: false };
  const st = [i];
  while (st.length) {
    const j = st.pop()!, x = cells[j];
    if (x.o || x.f) continue;
    x.o = true;
    if (x.m) {
      next.over = true;
      cells.forEach((y) => { if (y.m) y.o = true; });
      return { board: next, started, hit: true, won: false };
    }
    if (!x.n) nb(j).forEach((q) => st.push(q));
  }
  if (cells.every((x) => x.o || x.m)) { next.win = true; return { board: next, started, hit: false, won: true }; }
  return { board: next, started, hit: false, won: false };
}

function MinesGame({ ctl }: { ctl: GameCtl }): JSX.Element {
  const [board, setBoard] = useState<Board>(newBoard);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);

  const ctlRef = useRef(ctl); ctlRef.current = ctl;
  useEffect(() => { ctlRef.current.setScore(t); }, [t]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setT((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const toggleFlag = (i: number) => setBoard((b) => ({ ...b, cells: b.cells.map((c, j) => (j === i ? { ...c, f: !c.f } : c)) }));

  const click = (i: number) => {
    if (board.flag) { if (!board.cells[i].o) toggleFlag(i); return; }
    const r = open(board, i);
    if (r.board === board) return;
    setBoard(r.board);
    if (r.started) setRunning(true);
    if (r.hit) { setRunning(false); sfx.bad(); ctl.toast('BOOM', 'You hit a mine. Press the face to retry.'); }
    if (r.won) { setRunning(false); ctl.end(t, true); }
  };
  const flagAt = (e: MouseEvent, i: number) => {
    e.preventDefault();
    if (!board.cells[i].o && !board.over) toggleFlag(i);
  };
  const reset = () => { setRunning(false); setT(0); setBoard(newBoard()); };
  const left = MINES - board.cells.filter((c) => c.f).length;

  return (
    <div className="ms-wrap">
      <div className="ms-bar">
        <div className="lcd" aria-label="Mines left">{String(Math.max(0, left)).padStart(3, '0')}</div>
        <button className="face" aria-label="New game" onClick={reset}>{board.over ? 'X(' : board.win ? 'B)' : ':)'}</button>
        <div className="lcd" aria-label="Seconds">{String(Math.min(999, t)).padStart(3, '0')}</div>
      </div>
      <div className="ms" role="grid" aria-label="Minesweeper board">
        {board.cells.map((c, i) => (
          <button
            key={i}
            className={[c.o && 'open', c.o && c.m && 'boom', c.o && c.n ? `n${c.n}` : ''].filter(Boolean).join(' ')}
            aria-label={`Square ${i + 1}`}
            onClick={() => click(i)}
            onContextMenu={(e) => flagAt(e, i)}
          >
            {c.o ? (c.m ? '✹' : c.n || '') : c.f ? '⚑' : ''}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className={`btn sm${board.flag ? '' : ' ghost'}`} onClick={() => setBoard((b) => ({ ...b, flag: !b.flag }))}>{board.flag ? 'Flag mode: on' : 'Flag mode: off'}</button>
      </div>
      <p className="foot-note" style={{ textAlign: 'center' }}>Click to open. Right-click or Flag mode to mark a mine.</p>
    </div>
  );
}

export const mines: GameDef = {
  id: 'mines',
  name: 'Minesweeper',
  label: 'SECONDS',
  low: true,
  desc: 'Beginner board with flags. Your first click is always safe.',
  art(x) { x.fillStyle = '#c9d1e3'; for (let i = 0; i < 9; i++) for (let j = 0; j < 5; j++) x.fillRect(4 + i * 4, 3 + j * 4, 3, 3); x.fillStyle = '#ff4a3d'; x.fillRect(20, 11, 3, 3); x.fillStyle = '#1f4fd8'; x.fillRect(12, 7, 3, 3); },
  Component: MinesGame,
};
