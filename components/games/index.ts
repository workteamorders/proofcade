import type { GameDef } from './types';
import { snake } from './snake';
import { g2048 } from './g2048';
import { breakout } from './breakout';
import { memory } from './memory';
import { whack } from './whack';
import { mines } from './mines';

export const GAMES: Record<string, GameDef> = { snake, g2048, breakout, memory, whack, mines };

export const GAME_ORDER: string[] = ['snake', 'g2048', 'breakout', 'memory', 'whack', 'mines'];
