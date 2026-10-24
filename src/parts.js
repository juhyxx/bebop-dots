// Turns a lesson (chord chart + optional written melody) into playable parts:
// a list of events { beat, dur, notes: [note & { hand }] } in absolute beats.
import {
  parseChord, parseNote, transposeSymbol, transposeNote, simplifyNote, simplifyPc, spellMidi, keyInterval,
  chordPc, noteAt, placeAtOrAbove, OCTAVE, SCALES,
} from './theory.js';

// ---------- Parsing ----------

// "| Dm7 G7 | Cmaj7 |" — chords in a bar share its beats evenly; "." holds the previous chord for one
// more share, so in 5/4 "| Ebm6 . . Bbm7 . |" is 3 beats + 2 beats.
export function parseChart(text, beatsPerBar = 4, iv = null) {
  if (iv && iv.steps === 0 && iv.semis === 0) iv = null; // in its own key a chart keeps its spelling (C♭maj7, not Bmaj7)
  const bars = text.split('|').map((s) => s.trim()).filter(Boolean);
  const chords = [];
  bars.forEach((bar, i) => {
    const syms = bar.split(/\s+/);
    const dur = beatsPerBar / syms.length;
    syms.forEach((sym, j) => {
      if (sym === '.') {
        chords[chords.length - 1].dur += dur;
        return;
      }
      const symbol = iv ? transposeSymbol(sym, iv) : sym;
      chords.push({ ...parseChord(symbol), bar: i, beat: i * beatsPerBar + j * dur, dur });
    });
  });
  return { bars: bars.length, chords };
}

const DURATIONS = { 1: 4, 2: 2, 4: 1, 8: 0.5, 16: 0.25 };

function parseDuration(s) {
  const m = /^(1|2|4|8|16)(\.?)$/.exec(s);
  if (!m) throw new Error(`Bad duration "${s}"`);
  return DURATIONS[m[1]] * (m[2] ? 1.5 : 1);
}

// Tokens: "C5/4" (quarter), "Bb4/8", "F4/2." (dotted half), "r/4" (rest), "[C4 E4 G4]/2" (chord).
export function parseMelody(text, beatsPerBar = 4, hand = 'R') {
  const events = [];
  let beat = 0;
  text.split('|').map((s) => s.trim()).filter(Boolean).forEach((bar, i) => {
    const start = beat;
    for (const tok of bar.match(/\[[^\]]*\]\/\S+|\S+/g)) {
      const slash = tok.lastIndexOf('/');
      const head = tok.slice(0, slash);
      const dur = parseDuration(tok.slice(slash + 1));
      if (head !== 'r') {
        const names = head.startsWith('[') ? head.slice(1, -1).trim().split(/\s+/) : [head];
        events.push({ beat, dur, notes: names.map((n) => ({ ...parseNote(n), hand })) });
      }
      beat += dur;
    }
    if (Math.abs(beat - start - beatsPerBar) > 1e-6) {
      throw new Error(`Bar ${i + 1} of "${text.slice(0, 30)}…" has ${beat - start} beats`);
    }
  });
  return events;
}

function transposeEvents(events, iv) {
  if (!iv || (iv.steps === 0 && iv.semis === 0)) return events;
  return events.map((e) => ({
    ...e,
    notes: e.notes.map((n) => ({ ...simplifyNote(transposeNote(n, iv)), hand: n.hand })),
  }));
}

// ---------- Voice leading ----------

const avg = (notes) => notes.reduce((s, n) => s + n.midi, 0) / notes.length;

function motion(a, b) {
  if (a.length !== b.length) return Math.abs(avg(a) - avg(b)) * Math.max(a.length, b.length);
  return a.reduce((s, n, i) => s + Math.abs(n.midi - b[i].midi), 0);
}

// Low interval limits: lowest MIDI note at which each interval (in semitones) still sounds clear.
const LOW_LIMITS = { 1: 52, 2: 51, 3: 48, 4: 46, 5: 45, 6: 47, 7: 34, 8: 43, 9: 41, 10: 41, 11: 41 };

function muddiness(notes) {
  let penalty = 0;
  for (let k = 1; k < notes.length; k++) {
    const limit = LOW_LIMITS[notes[k].midi - notes[k - 1].midi];
    if (limit && notes[k - 1].midi < limit) penalty += 20;
  }
  return penalty;
}

// For each chord pick the form/octave (bottom note within lo..hi) that moves least from the previous one.
function voiceLead(chords, formsOf, { lo, hi, center }) {
  let prev = null;
  return chords.map((ch) => {
    let best = null;
    let bestScore = Infinity;
    for (const form of formsOf(ch)) {
      const pcs = form.map((iv) => chordPc(ch, iv));
      for (let base = placeAtOrAbove(pcs[0], lo); base.midi <= hi; base = transposeNote(base, OCTAVE)) {
        const notes = [base];
        for (let k = 1; k < pcs.length; k++) notes.push(placeAtOrAbove(pcs[k], notes[k - 1].midi + 1));
        const score = (prev ? motion(prev, notes) : 0) + 0.25 * Math.abs(base.midi - center) + muddiness(notes);
        if (score < bestScore) {
          bestScore = score;
          best = notes;
        }
      }
    }
    prev = best;
    return best;
  });
}

const withHand = (notes, hand) => notes.map((n) => ({ ...n, hand }));

// Comping rhythms as [beat, length] hits from the chord's start: `bar` for a chord lasting a bar or more,
// `part` for a shorter one. "sustain" (no entry) holds each chord.
const RHYTHMS = {
  charleston: { bar: [[0, 1.5], [1.5, 1]], part: [[0, 1.5]] }, // dotted quarter on 1, then the "and" of 2
  reverse: { bar: [[0.5, 1], [2, 1.5]], part: [[0.5, 1.5]] }, // reverse Charleston: the "and" of 1, then 3
  twoFour: { bar: [[1, 0.5], [3, 0.5]], part: [[1, 0.5]] }, // short chords on 2 and 4
  offbeats: { bar: [[1.5, 0.5], [3.5, 0.5]], part: [[1.5, 0.5]] }, // the "and" of 2 and the "and" of 4
};

function comp(chords, voicings, hand, rhythm = 'sustain') {
  const events = [];
  chords.forEach((ch, i) => {
    const notes = withHand(voicings[i], hand);
    const r = RHYTHMS[rhythm];
    const hits = r ? (ch.dur >= 4 ? r.bar : r.part).filter(([b]) => b < ch.dur - 1e-6) : [];
    if (!hits.length) events.push({ beat: ch.beat, dur: ch.dur, notes });
    for (const [b, len] of hits) events.push({ beat: ch.beat + b, dur: Math.min(len, ch.dur - b), notes });
  });
  return events;
}

const VOICINGS = {
  rootpos: { name: '7th chords in root position', hand: 'R', range: { lo: 60, hi: 71, center: 63 }, forms: (ch) => [ch.q.tones] },
  rootposL: { name: '7th chords in root position', hand: 'L', range: { lo: 48, hi: 59, center: 51 }, forms: (ch) => [ch.q.tones] },
  shells2: { name: 'Shells 1–3 / 1–7', hand: 'L', range: { lo: 40, hi: 52, center: 45 }, forms: (ch) => [['1', ch.q.g3], ['1', ch.q.g7]] },
  shells3: { name: 'Shells 1–3–7 / 1–7–3', hand: 'L', range: { lo: 40, hi: 52, center: 45 }, forms: (ch) => [['1', ch.q.g3, ch.q.g7], ['1', ch.q.g7, ch.q.g3]] },
  guide: { name: 'Guide-tone voicings 3–7', hand: 'L', range: { lo: 48, hi: 59, center: 53 }, forms: (ch) => [[ch.q.g3, ch.q.g7], [ch.q.g7, ch.q.g3]] },
  rootless: { name: 'Rootless voicings A/B', hand: 'L', range: { lo: 49, hi: 60, center: 54 }, forms: (ch) => [ch.q.A, ch.q.B] },
  fourths: { name: 'Fourth voicings', hand: 'L', range: { lo: 49, hi: 60, center: 55 }, forms: fourthForms },
};

export function rootlessVoicings(chords, range = VOICINGS.rootless.range) {
  return voiceLead(chords, VOICINGS.rootless.forms, range);
}

// ---------- Modern voicings (after Mark Levine, The Jazz Piano Book) ----------

// Stacks of perfect 4ths from each chord's scale (bottom → top). ♭3 spells the ♯9 so the 4ths read as 4ths.
function fourthForms(ch) {
  switch (ch.quality) {
    case 'maj7':
    case '6':
      return [['3', '6', '9'], ['6', '9', '5'], ['7', '3', '6']];
    case 'm7':
      return [['4', 'b7', 'b3'], ['1', '4', 'b7'], ['5', '1', '4']];
    case 'm6':
    case 'mMaj7':
      return [['6', '9', '5'], ['9', '5', '1']];
    case '7':
    case '7#11':
      return [['3', '13', '9'], ['13', '9', '5']];
    case '7sus4':
      return [['1', '4', 'b7'], ['5', '1', '4'], ['9', '5', '1']];
    case '7alt':
      return [['b7', 'b3', 'b13']];
    case 'm7b5':
      return [['4', 'b7', 'b3'], ['1', '4', 'b7']];
    default:
      return [ch.q.A.slice(0, 3)];
  }
}

// So What chord: three 4ths and a major 3rd (D G C F A on Dm7), started where the chord's scale allows.
function soWhatForm(ch) {
  if (ch.quality === 'm7') return ['1', '4', 'b7', 'b3', '5'];
  if (ch.quality === '7sus4') return ['5', '1', '4', 'b7', '9'];
  if (ch.q.kind === 'maj') return ['3', '6', '9', '5', '7'];
  return ['1', ch.q.tones[2], ch.q.g7, '9', ch.q.g3];
}

// Upper-structure triad over the 3rd and 7th: E♭ major on G7alt, A major on G7♯11, G major on Cmaj7…
function upperTriad(ch) {
  switch (ch.quality) {
    case 'maj7':
    case '6':
    case 'mMaj7':
      return ['5', '7', '9'];
    case 'm7':
      return ['5', 'b7', '9'];
    case 'm6':
      return ['9', '11', '13'];
    case '7':
    case '7#11':
      return ['9', '#11', '13'];
    case '7alt':
      return ['b13', '8', 'b3'];
    case '7sus4':
      return ['b7', '9', '11'];
    case 'm7b5':
      return ['b3', 'b5', 'b7'];
    default:
      return ch.q.A.slice(1);
  }
}

const inversions = ([a, b, c]) => [[a, b, c], [b, c, a], [c, a, b]];

// Drop 2: a close rootless voicing (any inversion) with its second note from the top dropped an octave.
const drop2Forms = (ch) =>
  [0, 1, 2, 3].map((r) => {
    const close = [...ch.q.A.slice(r), ...ch.q.A.slice(0, r)];
    return [close[2], close[0], close[1], close[3]];
  });

const splitAt = (voicings, n) => [voicings.map((v) => v.slice(0, n)), voicings.map((v) => v.slice(n))];

// Two-hand voicings: build(chords) → [left-hand notes, right-hand notes] for every chord.
const TWO_HAND = {
  twoHand: {
    name: 'LH root + RH rootless voicing',
    build: (chords) => [voiceLead(chords, () => [['1']], { lo: 40, hi: 52, center: 45 }), rootlessVoicings(chords, { lo: 57, hi: 68, center: 62 })],
  },
  soWhat: {
    name: 'So What chords',
    build: (chords) => splitAt(voiceLead(chords, (ch) => [soWhatForm(ch)], { lo: 48, hi: 59, center: 52 }), 3),
  },
  mccoy: {
    name: 'LH open 5th + RH 4ths',
    build: (chords) => [
      voiceLead(chords, (ch) => [ch.q.tones[2] === '5' ? ['1', '5', '8'] : ['1', ch.q.g7]], { lo: 36, hi: 47, center: 40 }),
      voiceLead(chords, fourthForms, { lo: 62, hi: 73, center: 66 }),
    ],
  },
  upper: {
    name: 'Upper-structure triads',
    build: (chords) => [
      voiceLead(chords, VOICINGS.guide.forms, { lo: 46, hi: 57, center: 51 }),
      voiceLead(chords, (ch) => inversions(upperTriad(ch)), { lo: 64, hi: 75, center: 67 }),
    ],
  },
  drop2: {
    name: 'Drop 2 voicings',
    build: (chords) => splitAt(voiceLead(chords, drop2Forms, { lo: 46, hi: 57, center: 51 }), 1),
  },
};

// So What "amen": on minor chords the shape a step higher (short), then back down (long).
function soWhatAmen(chords) {
  const [left, right] = TWO_HAND.soWhat.build(chords);
  const up = (notes) => notes.map((n) => transposeNote(n, { steps: 1, semis: 2 }));
  return chords.flatMap((ch, i) => {
    const chord = [...withHand(left[i], 'L'), ...withHand(right[i], 'R')];
    if (ch.quality !== 'm7' || ch.dur < 2) return [{ beat: ch.beat, dur: ch.dur, notes: chord }];
    return [
      { beat: ch.beat, dur: 0.5, notes: [...withHand(up(left[i]), 'L'), ...withHand(up(right[i]), 'R')] },
      { beat: ch.beat + 0.5, dur: ch.dur - 0.5, notes: chord },
    ];
  });
}

// ---------- Melodic lines ----------

function zigzag(len, top) {
  const out = [];
  let i = 0;
  let dir = 1;
  while (out.length < len) {
    out.push(i);
    if (i + dir > top || i + dir < 0) dir = -dir;
    i += dir;
  }
  return out;
}

// pattern(ch) → [[interval name | (root) => note, beats], ...]. The root (F3–G4) is chosen so each
// chord's first note lies close to the previous chord's last note.
function line(chords, pattern, { lo = 53, hi = 67 } = {}) {
  const events = [];
  let last = 64;
  for (const ch of chords) {
    const steps = pattern(ch);
    const render = (root) => steps.map(([what]) => (typeof what === 'function' ? what(root) : noteAt(root, what)));
    let best = null;
    for (let root = placeAtOrAbove(ch.root, lo); root.midi <= hi; root = transposeNote(root, OCTAVE)) {
      const notes = render(root);
      if (!best || Math.abs(notes[0].midi - last) < Math.abs(best[0].midi - last)) best = notes;
    }
    let t = ch.beat;
    steps.forEach(([, dur], k) => {
      events.push({ beat: t, dur, notes: [{ ...best[k], hand: 'R' }] });
      t += dur;
    });
    last = best[best.length - 1].midi;
  }
  return events;
}

// Keep written melodies in a readable register after transposing.
function fitRegister(events, lo = 55, hi = 81) {
  const mids = events.flatMap((e) => e.notes.map((n) => n.midi));
  let shift = 0;
  while (Math.max(...mids) + shift > hi) shift -= 12;
  while (Math.min(...mids) + shift < lo) shift += 12;
  if (!shift) return events;
  const iv = { steps: (7 * shift) / 12, semis: shift };
  return events.map((e) => ({ ...e, notes: e.notes.map((n) => ({ ...transposeNote(n, iv), hand: n.hand })) }));
}

const eighths = (list) => list.map((iv) => [iv, 0.5]);

const LINES = {
  arpeggio: {
    name: 'Arpeggios 1–3–5–7',
    pattern: (ch) => eighths(zigzag(ch.dur * 2, 4).map((i) => (i === 4 ? '8' : ch.q.tones[i]))),
  },
  scale: {
    name: 'Chord scales',
    pattern: (ch) => {
      const deg = SCALES[ch.q.scale];
      return eighths(zigzag(ch.dur * 2, deg.length).map((i) => (i === deg.length ? '8' : deg[i])));
    },
  },
  digital: {
    name: '1–2–3–5 patterns',
    pattern: (ch) => {
      const two = SCALES[ch.q.scale][1];
      const [, third, fifth] = ch.q.tones;
      return eighths(['1', two, third, fifth, '8', fifth, third, two].slice(0, ch.dur * 2));
    },
  },
  enclosure: {
    name: 'Enclosures of the 3rd',
    pattern: (ch) => {
      const upper = ch.q.g3 === '4' ? '5' : '4';
      const below = (root) => transposeNote(noteAt(root, ch.q.g3), { steps: 1, semis: 1 }, -1);
      if (ch.dur < 2) return [[ch.q.g3, ch.dur]];
      const tail = ch.dur >= 4 ? [[ch.q.tones[2], 1], [ch.q.tones[3], ch.dur - 3]] : [];
      return [[upper, 0.5], [below, 0.5], [ch.q.g3, 1], ...tail];
    },
  },
  bebop: {
    name: 'Bebop dominant scale',
    pattern: (ch) => {
      if (ch.q.kind === 'dom') return eighths(['8', '7', 'b7', '6', '5', '4', '3', '2'].slice(0, ch.dur * 2));
      return ch.dur >= 4 ? [['5', 1], ['3', 1], ['1', ch.dur - 2]] : [['3', ch.dur / 2], ['1', ch.dur / 2]];
    },
  },
  guideLine: {
    name: 'Guide-tone line',
    voiced: true,
  },
  pentatonic: {
    name: 'Pentatonic lines',
    pattern: (ch) => {
      const p = pentatonic(ch);
      return eighths(zigzag(ch.dur * 2, 5).map((i) => (i === 5 ? octaveUp(p[0]) : p[i])));
    },
  },
};

// The pentatonic scale to play over each chord, as intervals above its root (low → high).
function pentatonic(ch) {
  switch (ch.quality) {
    case 'maj7':
    case '6':
      return ['2', '3', '5', '6', '7']; // major pentatonic on the 5th
    case 'm7':
      return ['1', 'b3', '4', '5', 'b7']; // minor pentatonic on the root
    case 'm6':
    case 'mMaj7':
      return ['1', '2', 'b3', '5', '6'];
    case '7':
    case '7#11':
      return ['1', '2', '3', '5', '6']; // major pentatonic on the root
    case '7sus4':
      return ['1', '2', '4', '5', 'b7']; // major pentatonic on the ♭7
    case '7alt':
    case 'm7b5':
      return ['b2', 'b3', 'b5', 'b6', 'b7']; // major pentatonic on the ♭5 (alt) = minor pentatonic on the ♭3 (m7♭5)
    default:
      return ['1', ...ch.q.A];
  }
}

// ---------- Blues, boogie & ragtime ----------

// Repeat a list of [what, beats] cells until they fill `beats`.
function cycle(cells, beats) {
  const out = [];
  for (let t = 0, i = 0; t < beats - 1e-6; i++) {
    out.push(cells[i % cells.length]);
    t += cells[i % cells.length][1];
  }
  return out;
}

const octaveUp = (iv) => (root) => transposeNote(noteAt(root, iv), OCTAVE);

// pattern(ch) → [[intervals | null (rest), beats], ...] built on a root kept between lo and hi.
function figure(chords, pattern, { lo, hi, hand }) {
  const events = [];
  let anchor = (lo + hi) / 2;
  for (const ch of chords) {
    let root = placeAtOrAbove(ch.root, lo);
    const higher = root.midi + 12;
    if (higher <= hi && Math.abs(higher - anchor) < Math.abs(root.midi - anchor)) root = transposeNote(root, OCTAVE);
    let t = ch.beat;
    for (const [what, dur] of pattern(ch)) {
      if (what) {
        const notes = what.map((iv) => ({ ...(typeof iv === 'function' ? iv(root) : noteAt(root, iv)), hand }));
        events.push({ beat: t, dur, notes });
      }
      t += dur;
    }
    anchor = root.midi;
  }
  return events;
}

const FIGURES = {
  // left-hand 5–6–♭7 shuffle, two eighths per dyad
  shuffle: {
    name: 'Blues shuffle', hand: 'L', range: { lo: 40, hi: 51 },
    pattern: (ch) => cycle(['5', '5', '6', '6', ch.q.tones[3], ch.q.tones[3], '6', '6'].map((iv) => [['1', iv], 0.5]), ch.dur),
  },
  // 1-3-5-6-♭7-6-5-3 in eighths
  boogieBass: {
    name: 'Boogie-woogie bass', hand: 'L', range: { lo: 36, hi: 47 },
    pattern: (ch) => {
      const [, third, , seventh] = ch.q.tones;
      return cycle(['1', third, '5', '6', seventh, '6', '5', third].map((iv) => [[iv], 0.5]), ch.dur);
    },
  },
  // broken octaves walking up 1-3-5-6
  octaveBoogie: {
    name: 'Walking octaves', hand: 'L', range: { lo: 36, hi: 45 },
    pattern: (ch) => cycle(['1', ch.q.tones[1], '5', '6'].flatMap((iv) => [[[iv], 0.5], [[octaveUp(iv)], 0.5]]), ch.dur),
  },
  // right-hand "crush": ♭3 slides into 3 under the 5th, off the beat
  crush: {
    name: 'Boogie riff', hand: 'R', range: { lo: 65, hi: 76 },
    pattern: (ch) => cycle([[null, 0.5], [['b3', '5'], 0.5], [['3', '5'], 1]], ch.dur),
  },
};

// ---------- Bass lines ----------

const HALF_STEP = { steps: 1, semis: 1 };

// A bass note in C2–C4, in the octave nearest to `near` (roots stay at C2–C3).
function placeBass(pc, near) {
  let n = placeAtOrAbove(pc, 36);
  while (n.midi + 12 <= 48 && Math.abs(n.midi + 12 - near) < Math.abs(n.midi - near)) n = transposeNote(n, OCTAVE);
  return n;
}

// C♭, F♭, E♯ and B♯ read as B, E, F and C.
const plain = (n) => (simplifyPc(n, true) === n ? n : spellMidi(n.midi, n.alt < 0));

// Two-feel: the root then the 5th in half notes. Walking: quarter notes through the chord — up (1, 3, 5) when
// the next root is higher, down (1, 7, 5) when it is lower — and on the last beat a half step above or below
// the next root (the approach note). The last chord leads back to the first, as the form repeats.
function bassLines(chords, walk) {
  const events = [];
  const L = (n) => [{ ...n, hand: 'L' }];
  let prev = 40;
  chords.forEach((ch, i) => {
    const root = placeBass(ch.bass, prev);
    const next = chords[i + 1] || chords[0];
    if (!walk) {
      events.push({ beat: ch.beat, dur: Math.min(2, ch.dur), notes: L(root) });
      if (ch.dur >= 4) events.push({ beat: ch.beat + 2, dur: ch.dur - 2, notes: L(noteAt(root, ch.q.tones[2])) });
      prev = root.midi;
      return;
    }
    const down = placeBass(next.bass, root.midi).midi < root.midi && root.midi >= 43;
    const tone = (k) => (down ? transposeNote(noteAt(root, ch.q.tones[3 - (k % 3)]), OCTAVE, -1) : noteAt(root, ch.q.tones[1 + (k % 3)]));
    const line = [root];
    const beats = Math.max(1, Math.round(ch.dur));
    for (let k = 0; k < beats - 2; k++) line.push(tone(k));
    if (beats > 1) {
      const last = line[line.length - 1];
      const target = placeBass(next.bass, last.midi);
      line.push(plain(target.midi > last.midi ? transposeNote(target, HALF_STEP, -1) : transposeNote(target, HALF_STEP)));
    }
    line.forEach((n, k) => events.push({ beat: ch.beat + k, dur: 1, notes: L(n) }));
    prev = line[line.length - 1].midi;
  });
  return events;
}

// Ragtime oom-pah: bass note on 1 and 3 (root, then 5th), chord on 2 and 4.
function stride(chords) {
  const triad = (ch) => (ch.q.kind === 'dom' ? ['3', '5', 'b7'] : ch.q.kind === 'dim' ? ['b3', 'b5', 'bb7'] : ch.q.tones.slice(0, 3));
  const upper = voiceLead(chords, (ch) => {
    const [a, b, c] = triad(ch);
    return [[a, b, c], [b, c, a], [c, a, b]];
  }, { lo: 52, hi: 63, center: 56 });
  const bass = figure(chords, (ch) => cycle([[['1'], 1], [null, 1], [['5'], 1], [null, 1]], ch.dur), { lo: 36, hi: 45, hand: 'L' });
  const offbeats = [];
  chords.forEach((ch, i) => {
    for (let b = 1; b < ch.dur; b += 2) offbeats.push({ beat: ch.beat + b, dur: 0.9, notes: withHand(upper[i], 'L') });
  });
  return [...bass, ...offbeats];
}

// ---------- Public API ----------

const BASE_PARTS = {
  ...Object.fromEntries(Object.entries(VOICINGS).map(([id, v]) => [id, { name: v.name, hands: v.hand, comp: true }])),
  ...Object.fromEntries(Object.entries(TWO_HAND).map(([id, v]) => [id, { name: v.name, hands: 'LR', comp: true }])),
  soWhatAmen: { name: 'So What chords, a step up and back', hands: 'LR' },
  ...Object.fromEntries(Object.entries(LINES).map(([id, v]) => [id, { name: v.name, hands: 'R' }])),
  ...Object.fromEntries(Object.entries(FIGURES).map(([id, f]) => [id, { name: f.name, hands: f.hand, ownBass: f.hand === 'L' }])),
  stride: { name: 'Oom-pah stride', hands: 'L', ownBass: true },
  twoFeel: { name: 'Two-feel bass (half notes)', hands: 'L', ownBass: true },
  walking: { name: 'Walking bass', hands: 'L', ownBass: true },
  melody: { name: 'Melody', hands: 'R' },
};

export function partInfo(lesson, id) {
  const custom = lesson.customParts?.find((p) => p.id === id);
  if (custom) return { id, name: custom.name, hands: custom.hand || 'R' };
  if (id.includes('+')) {
    const [a, b] = id.split('+').map((x) => partInfo(lesson, x));
    return { id, name: `${a.name} (RH) + ${b.name} (LH)`, hands: 'LR', comp: false, ownBass: !!(a.ownBass || b.ownBass) };
  }
  const p = BASE_PARTS[id];
  if (!p) throw new Error(`Unknown part "${id}"`);
  return { id, ...p };
}

export const lessonParts = (lesson) => lesson.parts.map((id) => partInfo(lesson, id));

function generate(lesson, id, chords, iv, rhythm) {
  const custom = lesson.customParts?.find((p) => p.id === id);
  if (custom) return fitRegister(transposeEvents(parseMelody(custom.notation, lesson.beatsPerBar || 4, custom.hand || 'R'), iv));
  if (id.includes('+')) {
    const [a, b] = id.split('+');
    return [...generate(lesson, a, chords, iv, rhythm), ...generate(lesson, b, chords, iv, 'sustain')];
  }
  if (id === 'melody') return fitRegister(transposeEvents(parseMelody(lesson.melody, lesson.beatsPerBar || 4), iv));
  if (VOICINGS[id]) {
    const v = VOICINGS[id];
    return comp(chords, voiceLead(chords, v.forms, v.range), v.hand, rhythm);
  }
  if (TWO_HAND[id]) {
    const [left, right] = TWO_HAND[id].build(chords);
    return [...comp(chords, left, 'L', rhythm), ...comp(chords, right, 'R', rhythm)];
  }
  if (id === 'soWhatAmen') return soWhatAmen(chords);
  if (id === 'guideLine') {
    const notes = voiceLead(chords, (ch) => [[ch.q.g3], [ch.q.g7]], { lo: 62, hi: 74, center: 67 });
    return comp(chords, notes, 'R', 'sustain');
  }
  if (LINES[id]) return line(chords, LINES[id].pattern);
  if (FIGURES[id]) return figure(chords, FIGURES[id].pattern, { ...FIGURES[id].range, hand: FIGURES[id].hand });
  if (id === 'stride') return stride(chords);
  if (id === 'twoFeel' || id === 'walking') return bassLines(chords, id === 'walking');
  throw new Error(`Unknown part "${id}"`);
}

// Merge events that start together into one "step" (what you play at once).
export function groupOnsets(events) {
  const groups = new Map();
  for (const e of events) {
    const k = Math.round(e.beat * 1000);
    if (!groups.has(k)) groups.set(k, { beat: e.beat, dur: e.dur, notes: [] });
    const g = groups.get(k);
    g.dur = Math.max(g.dur, e.dur);
    for (const n of e.notes) if (!g.notes.some((m) => m.midi === n.midi)) g.notes.push({ ...n, dur: e.dur });
  }
  return [...groups.values()]
    .sort((a, b) => a.beat - b.beat)
    .map((g) => ({ ...g, notes: g.notes.sort((a, b) => a.midi - b.midi) }));
}

export function chordAt(chords, beat) {
  let found = chords[0];
  for (const c of chords) if (c.beat <= beat + 1e-6) found = c;
  return found;
}

// Everything the practice screens need for one lesson/part/key.
export function buildMaterial(lesson, { key = lesson.key, partId = lesson.parts[0], rhythm = 'sustain' } = {}) {
  const iv = keyInterval(lesson.key, key);
  const beatsPerBar = lesson.beatsPerBar || 4;
  const { bars, chords } = parseChart(lesson.chart, beatsPerBar, iv);
  const steps = groupOnsets(generate(lesson, partId, chords, iv, rhythm)).map((s) => ({
    ...s,
    chord: chordAt(chords, s.beat).symbol,
    bar: Math.floor(s.beat / beatsPerBar + 1e-6),
  }));
  const part = partInfo(lesson, partId);
  return { bars, beatsPerBar, chords, steps, part, key };
}
