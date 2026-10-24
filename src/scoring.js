// Pure practice logic: step-by-step sessions and play-along scoring.
import { mod } from './theory.js';

const pcSet = (notes) => new Set(notes.map((n) => mod(n.midi, 12)));

// Learn mode: show one step at a time and wait until the right notes are held.
export class StepSession {
  constructor(steps, { anyOctave = true } = {}) {
    this.steps = steps;
    this.anyOctave = anyOctave;
    this.index = 0;
    this.held = new Set();
    this.fresh = new Set(); // keys pressed since the current step started
    this.errors = new Array(steps.length).fill(0);
    this.wrongTotal = 0;
    this.startedAt = null;
    this.finishedAt = null;
  }

  get current() {
    return this.steps[this.index] || null;
  }

  get done() {
    return this.index >= this.steps.length;
  }

  matches(midi) {
    const step = this.current;
    if (!step) return false;
    return this.anyOctave ? pcSet(step.notes).has(mod(midi, 12)) : step.notes.some((n) => n.midi === midi);
  }

  complete() {
    const step = this.current;
    const ready = [...this.held].filter((m) => this.fresh.has(m));
    if (this.anyOctave) {
      const have = new Set(ready.map((m) => mod(m, 12)));
      return [...pcSet(step.notes)].every((pc) => have.has(pc));
    }
    return step.notes.every((n) => ready.includes(n.midi));
  }

  // → 'wrong' | 'ok' (part of the step) | 'next' (step finished) | 'finished' (last step) | 'idle'
  noteOn(midi, now = Date.now()) {
    if (this.done) return 'idle';
    if (this.startedAt === null) this.startedAt = now;
    this.held.add(midi);
    this.fresh.add(midi);
    if (!this.matches(midi)) {
      this.errors[this.index]++;
      this.wrongTotal++;
      return 'wrong';
    }
    if (!this.complete()) return 'ok';
    this.index++;
    this.fresh.clear();
    if (this.done) {
      this.finishedAt = now;
      return 'finished';
    }
    return 'next';
  }

  noteOff(midi) {
    this.held.delete(midi);
    this.fresh.delete(midi);
  }

  goTo(index) {
    this.index = Math.max(0, Math.min(index, this.steps.length));
    this.fresh.clear();
  }

  summary() {
    const clean = this.errors.filter((e) => e === 0).length;
    return {
      steps: this.steps.length,
      clean,
      wrong: this.wrongTotal,
      accuracy: this.steps.length ? Math.round((100 * clean) / this.steps.length) : 0,
      seconds: this.finishedAt && this.startedAt ? (this.finishedAt - this.startedAt) / 1000 : null,
    };
  }
}

export const TIMING_WINDOWS = { relaxed: 0.2, normal: 0.14, strict: 0.08 };

// Play-along: every expected note has a time (seconds from song start). Played notes are
// matched to the nearest pending note of the same pitch inside the timing window.
export class PlayScorer {
  constructor(targets, { window = 0.14, anyOctave = true } = {}) {
    this.targets = targets
      .map((t, id) => ({ ...t, id, status: 'pending', offset: null }))
      .sort((a, b) => a.time - b.time);
    this.window = window;
    this.anyOctave = anyOctave;
    this.wrong = [];
    this.missCursor = 0;
  }

  same(a, b) {
    return this.anyOctave ? mod(a, 12) === mod(b, 12) : a === b;
  }

  // → { target } on a hit, { wrong } otherwise. Wrong notes take bar/step/chorus from the
  // nearest expected note, so a slightly early wrong note counts where it was meant to be.
  input(midi, sec, where = {}) {
    let best = null;
    for (let i = this.missCursor; i < this.targets.length; i++) {
      const t = this.targets[i];
      if (t.time - sec > this.window) break;
      if (t.status !== 'pending' || !this.same(t.midi, midi)) continue;
      const d = Math.abs(sec - t.time);
      if (d <= this.window && (!best || d < Math.abs(sec - best.time))) best = t;
    }
    if (best) {
      best.status = 'hit';
      best.offset = sec - best.time;
      return { target: best };
    }
    let near = null;
    for (const t of this.targets) if (!near || Math.abs(t.time - sec) < Math.abs(near.time - sec)) near = t;
    const wrong = { midi, sec, ...where, ...(near && { bar: near.bar, step: near.step, chorus: near.chorus }) };
    this.wrong.push(wrong);
    return { wrong };
  }

  // Marks notes whose window has passed; returns the newly missed ones.
  advance(sec) {
    const missed = [];
    while (this.missCursor < this.targets.length && this.targets[this.missCursor].time + this.window < sec) {
      const t = this.targets[this.missCursor++];
      if (t.status === 'pending') {
        t.status = 'missed';
        missed.push(t);
      }
    }
    return missed;
  }

  summary(bars) {
    const total = this.targets.length;
    const hits = this.targets.filter((t) => t.status === 'hit');
    const offsets = hits.map((t) => t.offset * 1000);
    const mean = offsets.length ? offsets.reduce((a, b) => a + b, 0) / offsets.length : 0;
    const perBar = Array.from({ length: bars }, () => ({ total: 0, hits: 0, wrong: 0 }));
    for (const t of this.targets) {
      const b = perBar[t.bar];
      if (!b) continue;
      b.total++;
      if (t.status === 'hit') b.hits++;
    }
    for (const w of this.wrong) {
      const b = perBar[w.bar];
      if (b) b.wrong++;
    }
    return {
      total,
      hits: hits.length,
      missed: this.targets.filter((t) => t.status === 'missed').length,
      wrong: this.wrong.length,
      score: total ? Math.round((100 * hits.length) / (total + this.wrong.length)) : 0,
      hitRate: total ? Math.round((100 * hits.length) / total) : 0,
      meanOffsetMs: Math.round(mean),
      meanAbsOffsetMs: offsets.length ? Math.round(offsets.reduce((a, b) => a + Math.abs(b), 0) / offsets.length) : 0,
      perBar,
    };
  }
}
