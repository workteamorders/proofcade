import { IS_TEST } from './config';
import { SOL_USD } from '../util';

export { IS_TEST };
export const SOL_USD_NOTE = `Market caps in USD use a sample rate of 1 SOL = $${SOL_USD.toLocaleString('en-US')}.`;
