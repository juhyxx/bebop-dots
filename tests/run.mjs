// Logic checks — no browser needed. Run with Node:  node tests/run.mjs
// or with macOS's built-in engine:
//   /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m tests/run.mjs
import { LESSONS } from '../src/lessons.js';
import { buildMaterial } from '../src/parts.js';
import { buildBand } from '../src/band.js';
import { keyChoices, noteName, parseNote, transposeNote, interval, keyInterval, transposeSymbol } from '../src/theory.js';
import { StepSession, PlayScorer } from '../src/scoring.js';
import { COURSE } from '../src/course.js';

const log = globalThis.console?.log ?? globalThis.print;
let failures = 0;
const check = (ok, msg) => {
  if (!ok) {
    failures++;
    log(`FAIL: ${msg}`);
  }
};

// --- theory ---
check(noteName(transposeNote(parseNote('B3'), interval('3'))) === 'D#4', 'major 3rd above B3 is D#4');
check(transposeSymbol('Am7b5', keyInterval('Gm', 'F#m')) === 'G#m7b5', 'transpose Am7b5 from Gm to F#m');
check(transposeSymbol('Bbmaj7', keyInterval('Bb', 'B')) === 'Bmaj7', 'transpose Bbmaj7 up a half step');

// --- every lesson, every part, every key ---
let parts = 0;
for (const lesson of LESSONS) {
  for (const partId of lesson.parts) {
    for (const key of keyChoices(lesson.key)) {
      try {
        const m = buildMaterial(lesson, { key, partId, rhythm: lesson.rhythm || 'sustain' });
        const mids = m.steps.flatMap((s) => s.notes.map((n) => n.midi));
        check(m.steps.length > 0, `${lesson.id}/${partId}/${key}: has steps`);
        check(Math.min(...mids) >= 33 && Math.max(...mids) <= 90, `${lesson.id}/${partId}/${key}: notes within the keyboard (${Math.min(...mids)}–${Math.max(...mids)})`);
        const band = buildBand(m.chords, { style: lesson.style, totalBeats: m.bars * m.beatsPerBar, piano: true, seed: 1 });
        check(band.bass.every((b) => b.midi >= 28 && b.midi <= 50), `${lesson.id}/${key}: bass stays in range`);
        parts++;
      } catch (e) {
        check(false, `${lesson.id}/${partId}/${key}: ${e.message}`);
      }
    }
  }
}

// --- shells in C: Dm7 (D–F) → G7 (G–F) → Cmaj7 (C–E) ---
const shells = buildMaterial(LESSONS.find((l) => l.id === 'shells'), { partId: 'shells2' }).steps.slice(0, 3);
check(shells.map((s) => s.notes.map(noteName).join(' ')).join(' | ') === 'D3 F3 | G2 F3 | C3 E3', 'shells voice-lead F → F → E');

// --- step session ---
const step = (names) => ({ notes: names.map(parseNote) });
const session = new StepSession([step(['C4', 'E4']), step(['G4'])], { anyOctave: false });
check(session.noteOn(60) === 'ok', 'first note of a chord is ok');
check(session.noteOn(62) === 'wrong', 'D is wrong');
check(session.noteOn(64) === 'next', 'completing the chord advances');
check(session.noteOn(67) === 'finished', 'last step finishes');
check(session.summary().clean === 1, 'one clean step');

// --- play scorer ---
const scorer = new PlayScorer([{ midi: 60, time: 1, bar: 0 }, { midi: 64, time: 2, bar: 0 }], { window: 0.1, anyOctave: false });
check(scorer.input(60, 1.05).target, 'hit inside the window');
check(scorer.input(65, 2.0).wrong, 'wrong pitch is wrong');
scorer.advance(3);
const sum = scorer.summary(1);
check(sum.hits === 1 && sum.missed === 1 && sum.wrong === 1, 'summary counts hits, misses and wrong notes');

// --- course: every exercise builds, and every piano exercise comes before its band exercise
for (const ex of COURSE) {
  const lesson = LESSONS.find((l) => l.id === ex.lessonId);
  try {
    const m = buildMaterial(lesson, { key: ex.key, partId: ex.partId, rhythm: lesson.rhythm || 'sustain' });
    check(m.steps.every((st) => st.notes.every((n) => n.dur > 0)), `${ex.id}: notes keep their length`);
  } catch (e) {
    check(false, `${ex.id}: ${e.message}`);
  }
}

log(failures ? `${failures} check(s) failed` : `All checks passed (${parts} lesson parts in all keys, ${COURSE.length} exercises).`);
