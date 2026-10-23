// Builds Knightly's sounds as 16-bit mono WAV files: board moves from CC0
// recorded pieces (assets/audio/source), everything else synthesized.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const rate = 44100;
function chime(out, start, freq, length, gain) {
  for (let i = 0; i < rate * length; i++) {
    const t = i / rate,
      index = Math.round(start * rate) + i;
    if (index >= out.length) break;
    const env = Math.min(1, t / 0.005) * Math.exp(-t / (length / 3));
    out[index] +=
      gain *
      env *
      (Math.sin(2 * Math.PI * freq * t) +
        0.25 * Math.sin(4 * Math.PI * freq * t));
  }
}
function ding(out, start, freq, length, gain) {
  // A small struck coin: a bright fundamental with the inharmonic partials of
  // a metal disc, each fading faster than the last.
  const partials = [
    [1, 1, 1],
    [2.32, 0.5, 0.6],
    [4.25, 0.28, 0.35],
    [6.8, 0.12, 0.2],
  ];
  for (let i = 0; i < rate * length; i++) {
    const t = i / rate,
      index = Math.round(start * rate) + i;
    if (index >= out.length) break;
    const attack = Math.min(1, t / 0.002);
    let v = 0;
    for (const [ratio, amp, life] of partials)
      v +=
        amp *
        Math.exp(-t / ((length / 4) * life)) *
        Math.sin(2 * Math.PI * freq * ratio * t);
    out[index] += gain * attack * v;
  }
}
function buzz(out, start, freq, length, gain) {
  // A soft, low square-ish tone for refusals.
  for (let i = 0; i < rate * length; i++) {
    const t = i / rate;
    const index = Math.round(start * rate) + i;
    if (index >= out.length) break;
    const env = Math.min(1, t / 0.004) * Math.min(1, (length - t) / 0.02);
    const wave = Math.tanh(3 * Math.sin(2 * Math.PI * freq * t));
    out[index] += gain * env * wave;
  }
}
function pop(out, start, freq, gain) {
  // A soft, rounded wooden pop: a sine whose pitch drops fast, no click.
  let phase = 0;
  for (let i = 0; i < rate * 0.12; i++) {
    const t = i / rate,
      index = Math.round(start * rate) + i;
    if (index >= out.length) break;
    const f = freq * (0.62 + 0.38 * Math.exp(-t / 0.018));
    phase += (2 * Math.PI * f) / rate;
    const env = Math.min(1, t / 0.003) * Math.exp(-t / 0.035);
    out[index] += gain * env * (Math.sin(phase) + 0.18 * Math.sin(2 * phase));
  }
}
function brass(out, start, freqs, length, gain) {
  // A soft brass chord: a few odd harmonics, a gentle swell and release.
  for (let i = 0; i < rate * length; i++) {
    const t = i / rate,
      index = Math.round(start * rate) + i;
    if (index >= out.length) break;
    const env =
      Math.min(1, t / 0.06) * Math.min(1, (length - t) / (length * 0.45));
    let v = 0;
    for (const f of freqs)
      v +=
        Math.sin(2 * Math.PI * f * t) +
        0.35 * Math.sin(2 * Math.PI * 2 * f * t) +
        0.15 * Math.sin(2 * Math.PI * 3 * f * t);
    out[index] += (gain * env * v) / freqs.length;
  }
}
function wav(samples, level) {
  const peak = Math.max(...samples.map(Math.abs)) || 1;
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => {
    data.writeInt16LE(Math.round((v / peak) * level * 32767), i * 2);
  });
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVE', 8);
  head.write('fmt ', 12);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}
const make = (seconds, draw, level = 0.8) => {
  const out = new Float64Array(Math.round(rate * seconds));
  draw(out);
  return wav([...out], level);
};
// A recorded piece, set down: CC0 hits from Freesound (see the asset
// licenses), mixed with a pitch shift (a lower, slower take for the opponent
// or the captured piece) and a gain.
function hit(out, start, source, { pitch = 1, gain = 1 } = {}) {
  const at = Math.round(start * rate);
  for (let i = 0; at + i < out.length; i++) {
    const pos = i * pitch;
    const j = Math.floor(pos);
    if (j + 1 >= source.length) break;
    out[at + i] += gain * (source[j] + (pos - j) * (source[j + 1] - source[j]));
  }
}
const recorded = (name) => {
  const bytes = readFileSync(
    new URL(`../assets/audio/source/${name}.wav`, import.meta.url),
  );
  // 16-bit mono PCM after the 44-byte header written by the slicer.
  const samples = new Float64Array((bytes.length - 44) / 2);
  for (let i = 0; i < samples.length; i++)
    samples[i] = bytes.readInt16LE(44 + i * 2) / 32767;
  return samples;
};
const piece = ['piece-1', 'piece-2', 'piece-3', 'piece-4'].map(recorded);
const clack = recorded('clack-1');
const drop = recorded('pieces-drop');
const coinDrop = recorded('coin-drop');
const sounds = {
  // Your piece lands; its variants are the takes closest to it.
  'move-self': make(0.26, (o) => hit(o, 0, piece[0])),
  'move-self-2': make(0.26, (o) => hit(o, 0, piece[1])),
  'move-self-3': make(0.26, (o) => hit(o, 0, piece[2])),
  // The opponent's piece lands a little lower and softer.
  'move-opponent': make(0.28, (o) => hit(o, 0, piece[0], { pitch: 0.9 }), 0.7),
  'move-opponent-2': make(
    0.28,
    (o) => hit(o, 0, piece[1], { pitch: 0.9 }),
    0.7,
  ),
  'move-opponent-3': make(
    0.28,
    (o) => hit(o, 0, piece[3], { pitch: 0.9 }),
    0.7,
  ),
  // Two pieces clack together, then the capturer lands.
  capture: make(0.32, (o) => {
    hit(o, 0, clack);
    hit(o, 0.035, piece[0], { gain: 0.7 });
  }),
  'capture-2': make(0.32, (o) => {
    hit(o, 0, clack, { pitch: 0.95 });
    hit(o, 0.035, piece[1], { gain: 0.7 });
  }),
  // King, then rook.
  castle: make(0.36, (o) => {
    hit(o, 0, piece[0]);
    hit(o, 0.1, piece[1], { pitch: 0.95, gain: 0.8 });
  }),
  // The piece lands, then a light tap for attention.
  check: make(0.3, (o) => {
    hit(o, 0, piece[0]);
    hit(o, 0.09, clack, { pitch: 1.1, gain: 0.55 });
  }),
  // Three hits rising in pitch as the pawn becomes a piece.
  promote: make(0.36, (o) => {
    hit(o, 0, piece[0], { gain: 0.9 });
    hit(o, 0.07, piece[1], { pitch: 1.12, gain: 0.7 });
    hit(o, 0.14, piece[2], { pitch: 1.26, gain: 0.6 });
  }),
  illegal: make(
    0.24,
    (o) => {
      buzz(o, 0, 150, 0.08, 1);
      buzz(o, 0.11, 130, 0.1, 1);
    },
    0.5,
  ),
  // The game is over: pieces poured onto the board, as when the app opens.
  'game-end': make(0.95, (o) => hit(o, 0, drop), 0.6),
  // The incorrect chime's tone, rising: three notes up (A, C#, E) where the
  // incorrect falls (A, then E below), so the two answers sound like a pair.
  correct: make(
    0.46,
    (o) => {
      chime(o, 0, 440, 0.2, 0.4);
      chime(o, 0.1, 554, 0.2, 0.4);
      chime(o, 0.2, 659, 0.26, 0.4);
    },
    0.6,
  ),
  incorrect: make(
    0.36,
    (o) => {
      chime(o, 0, 440, 0.2, 0.4);
      chime(o, 0.12, 330, 0.24, 0.4);
    },
    0.6,
  ),
  // The app opening: a handful of pieces poured onto the board.
  launch: make(0.9, (o) => hit(o, 0, drop), 0.5),
  // A star shard landing in the counter: a real coin dropped on a surface.
  coin: make(0.2, (o) => hit(o, 0, coinDrop), 0.6),
  // The run bonus's brighter synthesized cascade. No noise, so earlier files
  // are unchanged.
  'coin-bonus': make(
    0.8,
    (o) => {
      [1319, 1568, 2093, 2637].forEach((f, i) => {
        ding(o, i * 0.055, f, 0.5, 0.5);
      });
      chime(o, 0.22, 2637, 0.5, 0.18);
    },
    0.6,
  ),
  // UI sounds (docs/art-direction.md#ui-sound-palette), generated last so the
  // shared noise sequence leaves every file above unchanged. Quieter than the
  // board: they accompany motion rather than announce it.
  pop: make(0.13, (o) => pop(o, 0, 520, 1), 0.4),
  'pop-2': make(0.13, (o) => pop(o, 0, 600, 1), 0.4),
  'pop-3': make(0.13, (o) => pop(o, 0, 690, 1), 0.4),
  tick: make(0.04, (o) => chime(o, 0, 1760, 0.03, 1), 0.22),
  // Mallet notes rising to a resolved C major chord over soft brass.
  'fanfare-short': make(
    1.05,
    (o) => {
      [523, 659, 784].forEach((f, i) => {
        ding(o, i * 0.09, f * 2, 0.4, 0.35);
      });
      brass(o, 0.27, [262, 330, 392, 523], 0.75, 0.6);
      ding(o, 0.27, 2093, 0.6, 0.3);
    },
    0.55,
  ),
  fanfare: make(
    2.5,
    (o) => {
      [392, 523, 659, 784, 1047].forEach((f, i) => {
        ding(o, i * 0.1, f * 2, 0.45, 0.32);
      });
      brass(o, 0.12, [196, 247, 294], 0.5, 0.45);
      brass(o, 0.55, [262, 330, 392, 523], 1.9, 0.62);
      [2093, 2637, 3136].forEach((f, i) => {
        ding(o, 0.55 + i * 0.08, f, 1, 0.22);
      });
    },
    0.6,
  ),
};
const dir =
  process.argv[2] ?? new URL('../assets/audio', import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
for (const [name, bytes] of Object.entries(sounds))
  writeFileSync(`${dir}/${name}.wav`, bytes);
