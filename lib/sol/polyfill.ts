import { Buffer } from 'buffer';

/** web3.js and the pump SDK expect a global Buffer in the browser. */
const g = globalThis as unknown as { Buffer?: typeof Buffer };
if (typeof g.Buffer === 'undefined') g.Buffer = Buffer;
