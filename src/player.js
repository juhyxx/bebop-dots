// Look-ahead scheduler: turns beat-based band/metronome events into audio-clock times.
import { swingBeat, swingRatio } from './band.js';

// One metronome beat. mode: 'off' | 'all' (every beat, the first of the bar accented) | 'backbeat' (2 and 4)
function click(engine, mode, beat, beatsPerBar, time) {
  if (mode === 'off' || (mode === 'backbeat' && beat % 2 === 0)) return;
  engine.click(time, mode === 'all' && beat % beatsPerBar === 0);
}

export class Player {
  constructor(engine) {
    this.engine = engine;
    this.timer = null;
    this.metronome = 'off'; // can change while the band plays
    this.offset = null;
  }

  get playing() {
    return this.timer !== null;
  }

  // demo: steps to play on piano (to hear the part)
  start({ tempo, style, beatsPerBar, countInBeats, totalBeats, band, demo = [], tail = 0, onEnd }) {
    const e = this.engine;
    const spb = 60 / tempo;
    const ratio = swingRatio(style, tempo);
    this.spb = spb;
    this.ratio = ratio;
    this.onEnd = onEnd;
    this.offset = null;
    const startTime = e.ctx.currentTime + 0.25;
    this.songStart = startTime + countInBeats * spb;
    const at = (beat) => this.songStart + swingBeat(beat, ratio) * spb;
    const length = (beat, dur) => (swingBeat(beat + dur, ratio) - swingBeat(beat, ratio)) * spb;

    const queue = [];
    const add = (time, run) => queue.push({ time, run });
    for (let i = 0; i < countInBeats; i++) add(startTime + i * spb, (t) => e.click(t, i % beatsPerBar === 0));
    for (let b = 0; b < totalBeats; b++) add(at(b), (t) => click(e, this.metronome, b, beatsPerBar, t));
    for (const n of band.bass) add(at(n.beat), (t) => e.bandNote('bass', n.midi, t, n.vel, length(n.beat, n.dur)));
    for (const c of band.piano) add(at(c.beat), (t) => c.midis.forEach((m) => e.bandNote('piano', m, t, c.vel, length(c.beat, c.dur))));
    for (const d of band.drums) add(at(d.beat), (t) => e.hit(d.sound, t, d.vel));
    for (const s of demo) add(at(s.beat), (t) => s.notes.forEach((n) => e.bandNote('piano', n.midi, t, 0.6, length(s.beat, s.dur) * 0.95)));
    queue.sort((a, b) => a.time - b.time);

    this.queue = queue;
    this.next = 0;
    this.endTime = at(totalBeats) + tail * spb + 0.2;
    this.timer = setInterval(() => this.pump(), 25);
    this.pump();
  }

  pump() {
    const now = this.engine.ctx.currentTime;
    while (this.next < this.queue.length && this.queue[this.next].time < now + 0.15) {
      const ev = this.queue[this.next++];
      ev.run(Math.max(ev.time, now));
    }
    if (now > this.endTime) {
      this.stop(false);
      this.onEnd?.();
    }
  }

  stop(silence = true) {
    clearInterval(this.timer);
    this.timer = null;
    if (silence) this.engine.stopBand();
  }

  // Seconds since the song's beat 0 as the listener hears it at `perfMs`.
  songSec(perfMs = performance.now()) {
    return this.engine.heardTime(perfMs) - this.songStart;
  }

  // The beat heard at `perfMs`, for moving the music on screen: in straight time (swung, it would lurch on
  // every beat) and following the audio clock without its jitter, so the music moves at an even speed.
  steadyBeat(perfMs = performance.now()) {
    const offset = this.engine.heardTime(perfMs) - perfMs / 1000;
    if (this.offset === null || Math.abs(offset - this.offset) > 0.03) this.offset = offset;
    else this.offset += (offset - this.offset) * 0.02;
    return (perfMs / 1000 + this.offset - this.songStart) / this.spb;
  }

  // Where (in seconds from song start) a written beat actually sounds, swing included.
  timeOfBeat(beat) {
    return swingBeat(beat, this.ratio) * this.spb;
  }

  // The written beat that sounds `sec` seconds after the song start (the inverse of timeOfBeat).
  beatAt(sec) {
    const s = sec / this.spb;
    const whole = Math.floor(s);
    const f = s - whole;
    const r = this.ratio;
    return whole + (f <= r ? f / (2 * r) : 0.5 + (f - r) / (2 * (1 - r)));
  }
}
