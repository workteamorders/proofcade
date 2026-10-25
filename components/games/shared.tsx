'use client';

import { useRef, type JSX, type MutableRefObject } from 'react';
import { spriteURL } from '@/lib/sprites';

/** Always points at the latest value, so effects can call ctlRef.current.* without listing ctl as a dependency. */
export function useLatest<T>(value: T): MutableRefObject<T> {
  const r = useRef(value);
  r.current = value;
  return r;
}

export type Dir = 'u' | 'd' | 'l' | 'r';

/** Per-game lifecycle: listeners, timers and loops are all released on stop(). */
export type Scope = ReturnType<typeof scope>;
export function scope() {
  const offs: Array<() => void> = [];
  return {
    doc<K extends keyof DocumentEventMap>(e: K, f: (ev: DocumentEventMap[K]) => void) {
      document.addEventListener(e, f);
      offs.push(() => document.removeEventListener(e, f));
    },
    el<K extends keyof HTMLElementEventMap>(t: HTMLElement, e: K, f: (ev: HTMLElementEventMap[K]) => void) {
      t.addEventListener(e, f);
      offs.push(() => t.removeEventListener(e, f));
    },
    every(f: () => void, ms: number) {
      const id = setInterval(f, ms);
      offs.push(() => clearInterval(id));
    },
    add(f: () => void) { offs.push(f); },
    /** Self-rescheduling timeout: f runs, and returns the delay until its next run. */
    loop(f: () => number) {
      let id: ReturnType<typeof setTimeout>;
      const run = () => { id = setTimeout(run, f()); };
      id = setTimeout(run, 0);
      offs.push(() => clearTimeout(id));
    },
    /** requestAnimationFrame loop; f receives the frame delta in ms. */
    raf(f: (dt: number) => void) {
      let on = true, last = 0, id = 0;
      const go = (t: number) => {
        if (!on) return;
        f(last ? t - last : 16.7);
        last = t;
        id = requestAnimationFrame(go);
      };
      id = requestAnimationFrame(go);
      offs.push(() => { on = false; cancelAnimationFrame(id); });
    },
    stop() { offs.splice(0).forEach((f) => f()); },
  };
}

export const KEYD: Record<string, Dir> = {
  ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd',
  ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r',
};

/** True when the keyboard event came from a form field and the game must not react. */
export const typing = (e: Event): boolean => e.target instanceof Element && e.target.matches('input,textarea,select');

/** Arrow keys / WASD, dpad buttons inside host, and swipes on el all funnel into fn. */
export function dirInput(sc: Scope, host: HTMLElement, el: HTMLElement, fn: (d: Dir) => void) {
  sc.doc('keydown', (e) => {
    const k = KEYD[e.key];
    if (!k || e.ctrlKey || e.metaKey || typing(e)) return;
    e.preventDefault();
    fn(k);
  });
  sc.el(host, 'pointerdown', (e) => {
    const b = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-d]') : null;
    const d = b?.dataset.d;
    if (d === 'u' || d === 'd' || d === 'l' || d === 'r') { e.preventDefault(); fn(d); }
  });
  let sx: number | null = null, sy = 0;
  sc.el(el, 'pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  sc.el(el, 'pointerup', (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    sx = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 24) fn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u'));
  });
}

export function DPad(): JSX.Element {
  return (
    <div className="dpad" aria-label="Direction pad">
      <button data-d="u" aria-label="Up">▲</button>
      <button data-d="l" aria-label="Left">◀</button>
      <button data-d="d" aria-label="Down">▼</button>
      <button data-d="r" aria-label="Right">▶</button>
    </div>
  );
}

let _rug: string | undefined, _gem: string | undefined;
/** Browser only: call from handlers or from render of client-only state. */
export const rugURL = () => _rug || (_rug = spriteURL(['..1111..', '.122221.', '12222221', '12322321', '12422421', '12222221', '.125521.', '..1111..'], { 1: '#16233f', 2: '#ff6b5b', 3: '#fbfaf4', 4: '#16233f', 5: '#16233f' }));
export const gemURL = () => _gem || (_gem = spriteURL(['..1111..', '.123321.', '12333321', '12222221', '.122221.', '..1221..', '...11...', '........'], { 1: '#16233f', 2: '#7fd6ff', 3: '#fbfaf4' }));
