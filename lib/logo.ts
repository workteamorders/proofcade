/** Shared rules for coin logos: a square PNG, 64–512 px, up to 150 KB. The browser resizes to 256 px before upload. */
export const LOGO_MAX_BYTES = 150 * 1024;
export const LOGO_SIZE = 256;
export const LOGO_MIN_DIM = 64;
export const LOGO_MAX_DIM = 512;

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Width and height read from the PNG header, or null when the bytes are not a PNG. */
export function pngSize(b: Uint8Array): { w: number; h: number } | null {
  if (b.length < 24 || SIGNATURE.some((v, i) => b[i] !== v)) return null;
  if (String.fromCharCode(b[12], b[13], b[14], b[15]) !== 'IHDR') return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { w: view.getUint32(16), h: view.getUint32(20) };
}

/** Why a PNG cannot be used as a logo, or null when it can. */
export function logoProblem(b: Uint8Array): string | null {
  if (b.length > LOGO_MAX_BYTES) return `The logo must be under ${LOGO_MAX_BYTES / 1024} KB.`;
  const s = pngSize(b);
  if (!s) return 'The logo must be a PNG image.';
  if (s.w !== s.h) return 'The logo must be square.';
  if (s.w < LOGO_MIN_DIM || s.w > LOGO_MAX_DIM) return `The logo must be between ${LOGO_MIN_DIM} and ${LOGO_MAX_DIM} pixels wide.`;
  return null;
}

export const LOGO_PATH = (mint: string) => `logos/${mint}.png`;
export const isMint = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
