// Backing band: walking / two-feel / bossa bass, drums and piano comping, generated from chords.
// All positions are in beats; swing is applied later when beats are converted to seconds.
import { pcSemis, interval, SCALES, mod } from './theory.js';
import { rootlessVoicings } from './parts.js';

export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)];

export function swingRatio(style, tempo) {
  if (style === 'bossa' || style === 'latin' || style === 'even' || style === 'rag') return 0.5;
  if (style === 'shuffle') return 0.67;
  if (tempo < 100) return 0.66;
  if (tempo < 160) return 0.63;
  if (tempo < 220) return 0.6;
  return 0.56;
}

// Off-beat eighths land at `ratio` of the beat instead of halfway.
export function swingBeat(beat, ratio) {
  const whole = Math.floor(beat + 1e-9);
  const f = beat - whole;
  return whole + (f <= 0.5 ? f * 2 * ratio : ratio + (f - 0.5) * 2 * (1 - ratio));
}

const LO = 28;
const HI = 50;

function nearest(pc, target, lo = 31, hi = 48) {
  let best = null;
  for (let m = lo; m <= hi; m++) {
    if (mod(m, 12) === pc && (best === null || Math.abs(m - target) < Math.abs(best - target))) best = m;
  }
  return best;
}

const fit = (m) => (m < LO ? m + 12 : m > HI ? m - 12 : m);
const semis = (iv) => interval(iv).semis % 12;

function approachNote(next, last, rand) {
  const target = nearest(pcSemis(next.bass), last);
  const below = fit(target - 1);
  const above = fit(target + 1);
  const fifth = fit(target + 7 <= HI ? target + 7 : target - 5);
  const r = rand();
  const options = r < 0.65 ? [target > last ? below : above, fifth] : r < 0.85 ? [fifth, below] : [target > last ? above : below, fifth];
  return options.find((m) => m !== last) ?? above;
}

function walkingBass(chords, rand) {
  const out = [];
  let prev = 38;
  chords.forEach((ch, i) => {
    const next = chords[i + 1];
    const beats = Math.max(1, Math.round(ch.dur));
    const root = nearest(pcSemis(ch.bass), prev);
    const t = ch.q.tones.map(semis);
    const s = SCALES[ch.q.scale].map(semis);
    const up = [[s[1], t[1]], [t[1], t[2]], [t[2], s[5]], [t[1], s[3]]];
    const down = [[t[3] - 12, t[2] - 12], [t[2] - 12, t[1] - 12], [s[5] - 12, t[2] - 12]];
    const goUp = root <= 37 || (root < 44 && rand() < 0.5);
    const shape = pick(rand, goUp ? up : down);
    const notes = [root];
    for (let k = 1; k < beats - 1; k++) notes.push(fit(root + shape[(k - 1) % 2]));
    if (beats > 1) notes.push(next ? approachNote(next, notes[notes.length - 1], rand) : fit(root + 7));
    notes.forEach((midi, k) => {
      out.push({ beat: ch.beat + k, dur: 0.92, midi, vel: k === 0 ? 0.82 : 0.68 + rand() * 0.1 });
    });
    prev = notes[notes.length - 1];
  });
  return out;
}

function twoFeelBass(chords, rand) {
  const out = [];
  let prev = 38;
  chords.forEach((ch, i) => {
    const root = nearest(pcSemis(ch.bass), prev);
    out.push({ beat: ch.beat, dur: Math.min(ch.dur, 2) - 0.1, midi: root, vel: 0.8 });
    prev = root;
    if (ch.dur >= 4) {
      const next = chords[i + 1];
      const second = next && rand() < 0.5 ? approachNote(next, root, rand) : fit(root + 7 <= HI ? root + 7 : root - 5);
      out.push({ beat: ch.beat + 2, dur: 1.9, midi: second, vel: 0.72 });
      prev = second;
    }
  });
  return out;
}

function bossaBass(chords) {
  const out = [];
  let prev = 36;
  for (const ch of chords) {
    const root = nearest(pcSemis(ch.bass), prev, 31, 45);
    const fifth = root + 7 <= 50 ? root + 7 : root - 5;
    const hits = ch.dur >= 4
      ? [[0, 1.4, root], [1.5, 0.45, fifth], [2, 1.4, fifth], [3.5, 0.45, root]]
      : [[0, 1.4, root], [1.5, 0.45, fifth]];
    for (const [b, dur, midi] of hits) out.push({ beat: ch.beat + b, dur, midi, vel: b === 0 ? 0.8 : 0.66 });
    prev = root;
  }
  return out;
}

// Afro-Cuban tumbao: the bass skips the downbeat and plays ahead of the harmony. On the "and" of 2 it
// sounds the 5th (or the root of a chord arriving on beat 3), on 4 the root of the next bar's chord.
function tumbaoBass(chords, beatsPerBar) {
  const at = (beat) => chords.reduce((found, c) => (c.beat <= beat + 1e-6 ? c : found), chords[0]);
  const last = chords[chords.length - 1];
  const end = last.beat + last.dur;
  const out = [];
  let prev = 36;
  const play = (beat, ch, fifth) => {
    const root = nearest(pcSemis(ch.bass), prev, 31, 45);
    out.push({ beat, dur: 1.4, midi: fifth ? (root + 7 <= 50 ? root + 7 : root - 5) : root, vel: 0.78 });
    prev = root;
  };
  play(chords[0].beat, chords[0], false);
  for (let bar = chords[0].beat; bar < end - 1e-6; bar += beatsPerBar) {
    const half = at(bar + 2);
    play(bar + 1.5, half, half === at(bar + 1.5));
    play(bar + beatsPerBar - 1, at(Math.min(bar + beatsPerBar, end - 0.01)), false);
  }
  return out;
}

// Blues shuffle: quarter-note boogie line, up the chord one bar and back down the next.
function shuffleBass(chords) {
  const out = [];
  let prev = 36;
  chords.forEach((ch) => {
    const root = nearest(pcSemis(ch.bass), prev, 29, 40); // a full octave, so every root fits
    const [, third, , seventh] = ch.q.tones.map(semis);
    const shape = ch.bar % 2 === 0 ? [0, third, 7, 9] : [seventh, 9, 7, third];
    for (let k = 0; k < Math.round(ch.dur); k++) {
      out.push({ beat: ch.beat + k, dur: 0.85, midi: root + shape[k % 4], vel: k === 0 ? 0.82 : 0.7 });
    }
    prev = root;
  });
  return out;
}

function shuffleDrums(bars, beatsPerBar) {
  const out = [];
  for (let bar = 0; bar < bars; bar++) {
    for (let beat = 0; beat < beatsPerBar; beat++) {
      const b = bar * beatsPerBar + beat;
      out.push({ beat: b, sound: 'hat', vel: 0.4 }, { beat: b + 0.5, sound: 'hat', vel: 0.22 });
      out.push(beat % 2 ? { beat: b, sound: 'snare', vel: 0.55 } : { beat: b, sound: 'kick', vel: 0.5 });
    }
  }
  return out;
}

// Ragtime: light two-beat — bass drum on 1 and 3, snare on 2 and 4.
function ragDrums(bars, beatsPerBar) {
  const out = [];
  for (let bar = 0; bar < bars; bar++) {
    for (let beat = 0; beat < beatsPerBar; beat++) {
      const b = bar * beatsPerBar + beat;
      out.push(beat % 2 ? { beat: b, sound: 'snare', vel: 0.3 } : { beat: b, sound: 'kick', vel: 0.4 });
      out.push({ beat: b + 0.5, sound: 'hat', vel: 0.15 });
    }
  }
  return out;
}

function swingDrums(bars, beatsPerBar, style, rand, chorusBars) {
  const out = [];
  const ballad = style === 'ballad';
  for (let bar = 0; bar < bars; bar++) {
    const b0 = bar * beatsPerBar;
    const hit = (beat, sound, vel) => out.push({ beat: b0 + beat, sound, vel });
    for (let beat = 0; beat < beatsPerBar; beat++) {
      const backbeat = beat % 2 === 1;
      hit(beat, 'ride', (ballad ? 0.32 : 0.5) + (backbeat ? 0.12 : 0));
      if (!ballad && backbeat) hit(beat + 0.5, 'ride', 0.32);
      if (backbeat) hit(beat, 'pedal', 0.45);
      if (style === 'swing') hit(beat, 'kick', 0.12);
    }
    if (bar % chorusBars === 0) hit(0, 'kick', 0.45);
    if (style === 'two') {
      hit(0, 'kick', 0.25);
      hit(2, 'kick', 0.2);
    }
    if (!ballad && rand() < 0.25) hit(pick(rand, [1.5, 2.5, 3.5]), 'snare', 0.12 + rand() * 0.1);
  }
  return out;
}

function bossaDrums(bars, beatsPerBar) {
  const out = [];
  for (let bar = 0; bar < bars; bar++) {
    const b0 = bar * beatsPerBar;
    for (let e = 0; e < beatsPerBar * 2; e++) out.push({ beat: b0 + e / 2, sound: 'hat', vel: e % 2 ? 0.16 : 0.28 });
    for (const [b, v] of [[0, 0.5], [1.5, 0.3], [2, 0.45], [3.5, 0.3]]) out.push({ beat: b0 + b, sound: 'kick', vel: v });
    for (const b of bar % 2 === 0 ? [0, 1.5, 3] : [1, 2.5]) out.push({ beat: b0 + b, sound: 'rim', vel: 0.4 });
  }
  return out;
}

// Afro-Cuban: son clave (2-3) on the rim, a bell-like ride on the beats, bass drum with the tumbao.
function latinDrums(bars, beatsPerBar) {
  const out = [];
  for (let bar = 0; bar < bars; bar++) {
    const b0 = bar * beatsPerBar;
    for (let beat = 0; beat < beatsPerBar; beat++) {
      out.push({ beat: b0 + beat, sound: 'ride', vel: beat % 2 ? 0.3 : 0.42 }, { beat: b0 + beat + 0.5, sound: 'hat', vel: 0.14 });
    }
    for (const [b, v] of [[1.5, 0.35], [3, 0.45]]) out.push({ beat: b0 + b, sound: 'kick', vel: v });
    for (const b of bar % 2 === 0 ? [1, 2] : [0, 1.5, 3]) out.push({ beat: b0 + b, sound: 'rim', vel: 0.45 });
  }
  return out;
}

const COMP = {
  swing: { long: [[[0, 1.3], [1.5, 0.9]], [[0, 0.8], [2.5, 1.2]], [[1.5, 0.45], [2, 1.6]], [[0, 2.6]]], short: [[[0, 1.4]], [[0.5, 1.2]]] },
  bossa: { long: [[[0, 1.2], [1.5, 1], [3, 0.8]], [[0, 1], [1.5, 1.2], [3.5, 0.4]]], short: [[[0, 1]], [[0, 0.9], [1.5, 0.4]]] },
  latin: { long: [[[0.5, 0.4], [1.5, 0.9], [3, 0.4], [3.5, 0.45]], [[0, 0.4], [1, 0.4], [2.5, 0.9]]], short: [[[0.5, 0.4], [1.5, 0.45]]] },
  rag: { long: [[[1, 0.5], [3, 0.5]]], short: [[[1, 0.5]]] },
};

function pianoComp(chords, style, rand) {
  const voicings = rootlessVoicings(chords, { lo: 50, hi: 61, center: 55 });
  const out = [];
  chords.forEach((ch, i) => {
    const midis = voicings[i].map((n) => n.midi);
    let pattern;
    if (style === 'ballad') pattern = [[0, ch.dur - 0.1]];
    else {
      const set = COMP[style] || COMP.swing;
      pattern = pick(rand, ch.dur >= 4 ? set.long : set.short);
    }
    for (const [b, dur] of pattern) out.push({ beat: ch.beat + b, dur, midis, vel: 0.38 + rand() * 0.1 });
  });
  return out;
}

// chords: the whole run (all choruses) in absolute beats. endChord: parsed tonic chord for the final hit.
export function buildBand(chords, { style = 'swing', beatsPerBar = 4, totalBeats, chorusBars, bass = true, drums = true, piano = false, endChord = null, seed = Date.now() }) {
  const rand = random(seed);
  const bars = Math.round(totalBeats / beatsPerBar);
  const band = { bass: [], drums: [], piano: [] };
  if (bass) {
    if (style === 'bossa') band.bass = bossaBass(chords);
    else if (style === 'latin') band.bass = tumbaoBass(chords, beatsPerBar);
    else if (style === 'shuffle') band.bass = shuffleBass(chords);
    else if (style === 'two' || style === 'ballad' || style === 'rag') band.bass = twoFeelBass(chords, rand);
    else band.bass = walkingBass(chords, rand);
  }
  if (drums) {
    if (style === 'bossa') band.drums = bossaDrums(bars, beatsPerBar);
    else if (style === 'latin') band.drums = latinDrums(bars, beatsPerBar);
    else if (style === 'shuffle') band.drums = shuffleDrums(bars, beatsPerBar);
    else if (style === 'rag') band.drums = ragDrums(bars, beatsPerBar);
    else band.drums = swingDrums(bars, beatsPerBar, style, rand, chorusBars || bars);
  }
  if (piano) band.piano = pianoComp(chords, style, rand);
  if (endChord) {
    const end = { ...endChord, beat: totalBeats, dur: 4 };
    if (bass) band.bass.push({ beat: totalBeats, dur: 3, midi: nearest(pcSemis(end.root), 36), vel: 0.85 });
    if (drums) band.drums.push({ beat: totalBeats, sound: 'ride', vel: 0.7 }, { beat: totalBeats, sound: 'kick', vel: 0.5 });
    if (piano) band.piano.push({ beat: totalBeats, dur: 3, midis: rootlessVoicings([end])[0].map((n) => n.midi), vel: 0.5 });
  }
  return band;
}
