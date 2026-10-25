/* Tiny square-wave synth plus the click gunshot. Everything is a no-op until the first user gesture. */

export const audio = { on: true };

let AC: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    AC = AC || new (W.AudioContext || W.webkitAudioContext!)();
    if (AC.state === 'suspended') void AC.resume();
    return AC;
  } catch { return null; }
}

function beep(f: number, d: number, type: OscillatorType = 'square', v = 0.035, slide = 0) {
  if (!audio.on) return;
  const a = ctx(); if (!a) return;
  const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.linearRampToValueAtTime(f + slide, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d);
}

export const sfx = {
  blip: () => beep(660, 0.05),
  coin: () => { beep(988, 0.06); setTimeout(() => beep(1319, 0.12), 60); },
  bad: () => beep(180, 0.28, 'sawtooth', 0.04, -90),
  win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.12), i * 90)),
  /** Gunshot: a noise crack through a falling low-pass, plus a short pitch-dropping thump. */
  shot: () => {
    if (!audio.on) return;
    const a = ctx(); if (!a) return;
    const t = a.currentTime, len = 0.26, n = Math.floor(a.sampleRate * len);
    const buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const src = a.createBufferSource(); src.buffer = buf;
    const lp = a.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(7000, t); lp.frequency.exponentialRampToValueAtTime(380, t + len);
    const ng = a.createGain(); ng.gain.setValueAtTime(0.32, t); ng.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(lp); lp.connect(ng); ng.connect(a.destination); src.start(t);
    const o = a.createOscillator(), og = a.createGain(); o.type = 'triangle';
    o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    og.gain.setValueAtTime(0.4, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(og); og.connect(a.destination); o.start(t); o.stop(t + 0.17);
  },
};
