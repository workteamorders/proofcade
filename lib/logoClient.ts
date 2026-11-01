import { LOGO_SIZE, LOGO_MAX_BYTES } from './logo';

/** Crop an image file to a centred square and draw it at 256 px as a PNG. */
export async function prepareLogo(file: File): Promise<Blob> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error('Use a PNG, JPEG, WebP or GIF image.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Pick an image under 8 MB.');
  const bmp = await createImageBitmap(file).catch(() => { throw new Error('That image could not be read.'); });
  try {
    const side = Math.min(bmp.width, bmp.height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = LOGO_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser cannot resize images.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, LOGO_SIZE, LOGO_SIZE);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) throw new Error('That image could not be converted.');
    if (blob.size > LOGO_MAX_BYTES) throw new Error('That image is too detailed. Try a simpler one.');
    return blob;
  } finally {
    bmp.close();
  }
}

export async function logosEnabled(): Promise<boolean> {
  try {
    const r = await fetch('/api/logo', { cache: 'no-store' });
    return r.ok && (await r.json()).enabled === true;
  } catch { return false; }
}

/** Store the logo for a coin. A 409 means it is already stored, which is what a retry wants. */
export async function uploadLogo(mint: string, blob: Blob): Promise<void> {
  const r = await fetch(`/api/logo/${mint}`, { method: 'PUT', headers: { 'content-type': 'image/png' }, body: blob });
  if (r.ok || r.status === 409) return;
  const msg = await r.json().then((j: { error?: string }) => j.error).catch(() => undefined);
  throw new Error(msg || 'The logo could not be uploaded.');
}
