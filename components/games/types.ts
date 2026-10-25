import type { ComponentType } from 'react';

/** What the arcade panel gives each game. */
export type GameCtl = {
  /** Update the SCORE / MOVES / SECONDS readout in the panel header. */
  setScore: (n: number) => void;
  /** Show a short toast (title in caps, one line of text). */
  toast: (title: string, text: string) => void;
  /** Report the end of a run. The panel handles best score, toast, sound and the "connect a wallet to rank it" hint. */
  end: (score: number, win?: boolean) => void;
};

export type GameDef = {
  id: string;
  name: string;
  /** Header label for the score readout. */
  label: string;
  /** If true, lower is better and only wins count towards the best score. */
  low?: boolean;
  desc: string;
  /** Draws a 45×27 pixel cabinet screen. */
  art: (ctx: CanvasRenderingContext2D) => void;
  /** The playable game. Remounted (via `key`) on Restart. Must clean up all listeners and timers on unmount. */
  Component: ComponentType<{ ctl: GameCtl }>;
};
