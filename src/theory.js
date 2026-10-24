// Music theory core: spelled notes, intervals, chord symbols, keys.
// A "pc" (pitch class) is { step: 0..6 (C..B), alt: -2..2 }.
// A "note" is a pc with an octave plus its MIDI number: { step, alt, oct, midi }.

export const STEP_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const STEP_SEMI = [0, 2, 4, 5, 7, 9, 11];
const ACC = { '': 0, '#': 1, '##': 2, x: 2, b: -1, bb: -2 };

export const mod = (n, m) => ((n % m) + m) % m;

export function midiOf(step, alt, oct) {
  return 12 * (oct + 1) + STEP_SEMI[step] + alt;
}

export function makeNote(step, alt, oct) {
  return { step, alt, oct, midi: midiOf(step, alt, oct) };
}

export function pcSemis(pc) {
  return mod(STEP_SEMI[pc.step] + pc.alt, 12);
}

export function parsePc(str) {
  const m = /^([A-Ga-g])(##|bb|#|b|x)?$/.exec(str);
  if (!m) throw new Error(`Bad pitch class "${str}"`);
  return { step: STEP_NAMES.indexOf(m[1].toUpperCase()), alt: ACC[m[2] || ''] };
}

export function parseNote(str) {
  const m = /^([A-Ga-g](?:##|bb|#|b|x)?)(-?\d)$/.exec(str);
  if (!m) throw new Error(`Bad note "${str}"`);
  const pc = parsePc(m[1]);
  return makeNote(pc.step, pc.alt, Number(m[2]));
}

const accText = (alt) => (alt > 0 ? '#'.repeat(alt) : 'b'.repeat(-alt));
const accPretty = (alt) => (alt > 0 ? '♯'.repeat(alt) : '♭'.repeat(-alt));

export const pcName = (pc) => STEP_NAMES[pc.step] + accText(pc.alt);
export const prettyPc = (pc) => STEP_NAMES[pc.step] + accPretty(pc.alt);
export const noteName = (n) => pcName(n) + n.oct;
export const prettyNote = (n) => prettyPc(n) + n.oct;
export const accidentalText = accText;

export function prettySymbol(symbol) {
  return symbol
    .replace(/^([A-G])b/, '$1♭')
    .replace(/^([A-G])#/, '$1♯')
    .replace(/\/([A-G])b/, '/$1♭')
    .replace(/\/([A-G])#/, '/$1♯')
    .replace('m7b5', 'm7♭5')
    .replace('7b9', '7♭9')
    .replace('7#11', '7♯11');
}

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export function spellMidi(midi, preferFlats = true) {
  const pc = parsePc((preferFlats ? FLAT_NAMES : SHARP_NAMES)[mod(midi, 12)]);
  return makeNote(pc.step, pc.alt, Math.floor(midi / 12) - 1);
}

// Replace double accidentals (and Cb/Fb/E#/B# when asked) with a plain spelling.
export function simplifyPc(pc, strict = false) {
  const odd =
    Math.abs(pc.alt) >= 2 ||
    (strict && ((pc.alt === 1 && (pc.step === 2 || pc.step === 6)) || (pc.alt === -1 && (pc.step === 0 || pc.step === 3))));
  if (!odd) return pc;
  return parsePc((pc.alt < 0 ? FLAT_NAMES : SHARP_NAMES)[pcSemis(pc)]);
}

export function simplifyNote(n) {
  if (Math.abs(n.alt) < 2) return n;
  return spellMidi(n.midi, n.alt < 0);
}

// ---------- Intervals ----------
// [diatonic steps, semitones]; compound intervals keep their real size.
const INTERVALS = {
  '1': [0, 0], b2: [1, 1], '2': [1, 2], '#2': [1, 3], b3: [2, 3], '3': [2, 4], '4': [3, 5], '#4': [3, 6],
  b5: [4, 6], '5': [4, 7], '#5': [4, 8], b6: [5, 8], '6': [5, 9], bb7: [6, 9], b7: [6, 10], '7': [6, 11],
  '8': [7, 12], b9: [8, 13], '9': [8, 14], '#9': [8, 15], '11': [10, 17], '#11': [10, 18], b13: [12, 20], '13': [12, 21],
};

export function interval(name) {
  const v = INTERVALS[name];
  if (!v) throw new Error(`Unknown interval "${name}"`);
  return { steps: v[0], semis: v[1] };
}

export const OCTAVE = { steps: 7, semis: 12 };

export function pcPlus(pc, iv) {
  const step = mod(pc.step + iv.steps, 7);
  const alt = mod(STEP_SEMI[pc.step] + pc.alt + iv.semis - STEP_SEMI[step] + 6, 12) - 6;
  return { step, alt };
}

export function transposeNote(n, iv, dir = 1) {
  const abs = n.oct * 7 + n.step + dir * iv.steps;
  const oct = Math.floor(abs / 7);
  const step = abs - oct * 7;
  const midi = n.midi + dir * iv.semis;
  return makeNote(step, midi - midiOf(step, 0, oct), oct);
}

// Note above a root by a named interval (keeps compound size).
export const noteAt = (root, ivName) => transposeNote(root, interval(ivName));

// ---------- Placement in a register ----------
export function placeAtOrAbove(pc, minMidi) {
  let oct = Math.floor(minMidi / 12) - 2;
  let n = makeNote(pc.step, pc.alt, oct);
  while (n.midi < minMidi) n = makeNote(pc.step, pc.alt, ++oct);
  return n;
}
export const placeNear = (pc, target) => placeAtOrAbove(pc, target - 6);
export const placeAtOrBelow = (pc, maxMidi) => placeAtOrAbove(pc, maxMidi - 11);

// ---------- Scales & chord qualities ----------
export const SCALES = {
  ionian: ['1', '2', '3', '4', '5', '6', '7'],
  dorian: ['1', '2', 'b3', '4', '5', '6', 'b7'],
  mixolydian: ['1', '2', '3', '4', '5', '6', 'b7'],
  locrian: ['1', 'b2', 'b3', '4', 'b5', 'b6', 'b7'],
  melodicMinor: ['1', '2', 'b3', '4', '5', '6', '7'],
  phrygianDominant: ['1', 'b2', '3', '4', '5', 'b6', 'b7'],
  altered: ['1', 'b2', '#2', '3', '#4', '#5', 'b7'],
  lydianDominant: ['1', '2', '3', '#4', '5', '6', 'b7'],
  wholeHalf: ['1', '2', 'b3', '4', 'b5', '#5', '6', '7'],
  blues: ['1', 'b3', '4', 'b5', '5', 'b7'],
};

export const SCALE_LABELS = {
  ionian: 'Ionian (major)', dorian: 'Dorian', mixolydian: 'Mixolydian', locrian: 'Locrian',
  melodicMinor: 'Melodic minor', phrygianDominant: 'Phrygian dominant', altered: 'Altered',
  lydianDominant: 'Lydian dominant', wholeHalf: 'Diminished (whole-half)', blues: 'Blues',
};

// tones: chord tones; g3/g7: guide tones; A/B: rootless voicing forms (bottom → top).
export const QUALITIES = {
  maj7: { kind: 'maj', tones: ['1', '3', '5', '7'], g3: '3', g7: '7', A: ['3', '5', '7', '9'], B: ['7', '9', '3', '5'], scale: 'ionian' },
  '6': { kind: 'maj', tones: ['1', '3', '5', '6'], g3: '3', g7: '6', A: ['3', '5', '6', '9'], B: ['6', '9', '3', '5'], scale: 'ionian' },
  m7: { kind: 'min', tones: ['1', 'b3', '5', 'b7'], g3: 'b3', g7: 'b7', A: ['b3', '5', 'b7', '9'], B: ['b7', '9', 'b3', '5'], scale: 'dorian' },
  m6: { kind: 'min', tones: ['1', 'b3', '5', '6'], g3: 'b3', g7: '6', A: ['b3', '5', '6', '9'], B: ['6', '9', 'b3', '5'], scale: 'melodicMinor' },
  mMaj7: { kind: 'min', tones: ['1', 'b3', '5', '7'], g3: 'b3', g7: '7', A: ['b3', '5', '7', '9'], B: ['7', '9', 'b3', '5'], scale: 'melodicMinor' },
  '7': { kind: 'dom', tones: ['1', '3', '5', 'b7'], g3: '3', g7: 'b7', A: ['3', '13', 'b7', '9'], B: ['b7', '9', '3', '13'], scale: 'mixolydian' },
  '7b9': { kind: 'dom', tones: ['1', '3', '5', 'b7'], g3: '3', g7: 'b7', A: ['3', '5', 'b7', 'b9'], B: ['b7', 'b9', '3', '5'], scale: 'phrygianDominant' },
  '7alt': { kind: 'dom', tones: ['1', '3', '#5', 'b7'], g3: '3', g7: 'b7', A: ['3', 'b13', 'b7', '#9'], B: ['b7', '#9', '3', 'b13'], scale: 'altered' },
  '7#11': { kind: 'dom', tones: ['1', '3', '5', 'b7'], g3: '3', g7: 'b7', A: ['3', '#11', 'b7', '9'], B: ['b7', '9', '3', '#11'], scale: 'lydianDominant' },
  '7sus4': { kind: 'dom', tones: ['1', '4', '5', 'b7'], g3: '4', g7: 'b7', A: ['4', '5', 'b7', '9'], B: ['b7', '9', '4', '5'], scale: 'mixolydian' },
  m7b5: { kind: 'hdim', tones: ['1', 'b3', 'b5', 'b7'], g3: 'b3', g7: 'b7', A: ['b3', 'b5', 'b7', '8'], B: ['b7', '8', 'b3', 'b5'], scale: 'locrian' },
  dim7: { kind: 'dim', tones: ['1', 'b3', 'b5', 'bb7'], g3: 'b3', g7: 'bb7', A: ['b3', 'b5', 'bb7', '8'], B: ['bb7', '8', 'b3', 'b5'], scale: 'wholeHalf' },
};

const ALIASES = {
  maj7: 'maj7', M7: 'maj7', 'Δ': 'maj7', 'Δ7': 'maj7', ma7: 'maj7', maj9: 'maj7',
  '': '6', '6': '6', '69': '6', maj6: '6',
  m7: 'm7', '-7': 'm7', min7: 'm7', mi7: 'm7', m9: 'm7', m11: 'm7',
  m: 'm6', '-': 'm6', m6: 'm6', '-6': 'm6', m69: 'm6',
  mMaj7: 'mMaj7', 'm(maj7)': 'mMaj7', mM7: 'mMaj7', '-maj7': 'mMaj7',
  '7': '7', '9': '7', '13': '7',
  '7b9': '7b9', '7(b9)': '7b9',
  '7alt': '7alt', alt: '7alt', '7#9': '7alt', '7#5': '7alt', '7+5': '7alt', '+7': '7alt', aug7: '7alt', '7b13': '7alt',
  '7#11': '7#11', '9#11': '7#11',
  '7sus4': '7sus4', '7sus': '7sus4', sus: '7sus4', sus4: '7sus4', '9sus': '7sus4', '9sus4': '7sus4',
  m7b5: 'm7b5', 'ø': 'm7b5', 'ø7': 'm7b5', '-7b5': 'm7b5', min7b5: 'm7b5',
  dim7: 'dim7', o7: 'dim7', dim: 'dim7', o: 'dim7', '°': 'dim7', '°7': 'dim7',
};

export function parseChord(symbol) {
  const [main, bassStr] = symbol.split('/');
  const m = /^([A-G](?:#|b)?)(.*)$/.exec(main);
  if (!m) throw new Error(`Bad chord symbol "${symbol}"`);
  const qid = ALIASES[m[2]];
  if (!qid) throw new Error(`Unknown chord quality "${m[2]}" in "${symbol}"`);
  const root = parsePc(m[1]);
  return { symbol, root, suffix: m[2], quality: qid, q: QUALITIES[qid], bass: bassStr ? parsePc(bassStr) : root };
}

export const chordPc = (chord, ivName) => pcPlus(chord.root, interval(ivName));

export function transposeSymbol(symbol, iv) {
  const c = parseChord(symbol);
  const root = simplifyPc(pcPlus(c.root, iv), true);
  const bass = c.bass !== c.root ? '/' + pcName(simplifyPc(pcPlus(c.bass, iv), true)) : '';
  return pcName(root) + c.suffix + bass;
}

// ---------- Keys ----------
export const MAJOR_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const MINOR_KEYS = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];

export function parseKey(key) {
  const minor = key.endsWith('m');
  return { tonic: parsePc(minor ? key.slice(0, -1) : key), minor };
}

export const keyChoices = (key) => (parseKey(key).minor ? MINOR_KEYS : MAJOR_KEYS);

// Interval that moves one key's tonic to another's, kept within -5..+6 semitones.
export function keyInterval(fromKey, toKey) {
  const a = parseKey(fromKey).tonic;
  const b = parseKey(toKey).tonic;
  let steps = mod(b.step - a.step, 7);
  let semis = mod(pcSemis(b) - pcSemis(a), 12);
  if (semis > 6) {
    steps -= 7;
    semis -= 12;
  }
  return { steps, semis };
}

export const prettyKey = (key) => {
  const { tonic, minor } = parseKey(key);
  return prettyPc(tonic) + (minor ? ' minor' : ' major');
};
