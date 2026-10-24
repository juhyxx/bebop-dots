// Web Audio engine: sampled grand piano and upright bass, a sampled jazz drum kit and a synthesized
// metronome, all through a small mixer with reverb.

const PIANO = ['A0', 'C1', 'Ds1', 'Fs1', 'A1', 'C2', 'Ds2', 'Fs2', 'A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4',
  'Fs4', 'A4', 'C5', 'Ds5', 'Fs5', 'A5', 'C6', 'Ds6', 'Fs6', 'A6', 'C7', 'Ds7', 'Fs7', 'A7', 'C8']
  .map((name, i) => ({ midi: 21 + 3 * i, url: `samples/piano/${name}.mp3` }));
const BASS = ['E1', 'G1', 'Bb1', 'Db2', 'E2', 'G2', 'Bb2', 'Db3', 'E3', 'G3']
  .map((name, i) => ({ midi: 28 + 3 * i, url: `samples/bass/${name}.mp3` }));
// The vdrummer Jazz kit (samples/drums/CREDITS.md): the files for each sound the band plays, with the
// softly played hit second where there is one. Ghost notes use it: it sounds different, not just quieter.
const DRUM_FILES = {
  kick: ['kick', 'kick-soft'],
  snare: ['snare', 'snare-soft'], // brushes: a tap, and a sweep for ghost notes
  hat: ['hhc', 'hhc-soft'], // closed hi-hat, played with a stick
  pedal: ['hhp'], // hi-hat closed with the foot
  ride: ['ride'],
  rim: ['rim'], // side stick
};
const SOFT_BELOW = 0.25; // hits softer than this play the soft sample
// Gain of each sample, matched by loudness to the drums the band had before, so the mix stays balanced.
const DRUM_LEVEL = {
  kick: 0.55, 'kick-soft': 0.52, snare: 1.4, 'snare-soft': 0.74, hhc: 0.26, 'hhc-soft': 0.25,
  hhp: 0.53, ride: 2.8, rim: 0.67,
};

const velocityGain = (v) => 0.04 + 0.96 * Math.pow(v, 1.6);

class Sampler {
  constructor(ctx, samples, { release = 0.3, brightness = true, gain = 1 } = {}) {
    this.ctx = ctx;
    this.samples = samples;
    this.release = release;
    this.brightness = brightness;
    this.gain = gain;
  }

  start(midi, time, velocity, out) {
    const { ctx } = this;
    const s = this.samples.reduce((a, b) => (Math.abs(b.midi - midi) < Math.abs(a.midi - midi) ? b : a));
    const src = ctx.createBufferSource();
    src.buffer = s.buffer;
    src.playbackRate.value = Math.pow(2, (midi - s.midi) / 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(velocityGain(velocity) * this.gain, time);
    let node = src;
    if (this.brightness) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1500 + 15000 * velocity * velocity;
      src.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(out);
    src.start(time);
    const voice = { src, g, released: false };
    src.onended = () => g.disconnect();
    return voice;
  }

  stop(voice, time) {
    if (voice.released) return;
    voice.released = true;
    const t = Math.max(time, this.ctx.currentTime);
    voice.g.gain.cancelScheduledValues(t);
    voice.g.gain.setTargetAtTime(0, t, this.release / 4);
    try {
      voice.src.stop(t + this.release * 1.5 + 0.05);
    } catch {
      // already stopped
    }
  }
}

function impulse(ctx, seconds, decay) {
  const len = Math.ceil(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

async function loadBuffer(ctx, url, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await ctx.decodeAudioData(await res.arrayBuffer());
    } catch (e) {
      if (attempt >= tries) throw new Error(`Could not load ${url} (${e.message})`);
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
}

// A few downloads at a time: simple local servers drop connections under a burst of requests.
async function loadAll(ctx, urls, onEach, parallel = 6) {
  const out = new Array(urls.length);
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const i = next++;
      out[i] = await loadBuffer(ctx, urls[i]);
      onEach();
    }
  };
  await Promise.all(Array.from({ length: parallel }, worker));
  return out;
}

function render(sampleRate, seconds, build) {
  const o = new OfflineAudioContext(1, Math.ceil(sampleRate * seconds), sampleRate);
  build(o, o.destination);
  return o.startRendering();
}

function envelope(o, points) {
  const g = o.createGain();
  g.gain.setValueAtTime(points[0][1], 0);
  for (const [t, v] of points.slice(1)) g.gain.exponentialRampToValueAtTime(v, t);
  return g;
}

const synthClick = (sr, freq) =>
  render(sr, 0.08, (o, out) => {
    const osc = o.createOscillator();
    osc.frequency.value = freq;
    osc.connect(envelope(o, [[0, 0.8], [0.05, 0.001]])).connect(out);
    osc.start(0);
  });

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.live = new Map(); // midi → voice for notes you are playing
    this.sustained = new Set();
    this.pedalDown = false;
    this.bandVoices = new Set();
  }

  async init(onProgress = () => {}) {
    // Created at page load, so the browser keeps it suspended until the first click or key press (see resume).
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    this.ctx = ctx;

    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 3;
    comp.attack.value = 0.005;
    comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = impulse(ctx, 2.6, 3);
    this.reverb.connect(this.master);

    this.bus = {};
    for (const [name, send] of [['me', 0.18], ['bandPiano', 0.2], ['bass', 0.05], ['drums', 0.12], ['click', 0]]) {
      const g = ctx.createGain();
      g.connect(this.master);
      if (send) {
        const s = ctx.createGain();
        s.gain.value = send;
        g.connect(s).connect(this.reverb);
      }
      this.bus[name] = g;
    }

    const drumNames = Object.values(DRUM_FILES).flat();
    const files = [...PIANO.map((s) => s.url), ...BASS.map((s) => s.url), ...drumNames.map((n) => `samples/drums/${n}.wav`)];
    let loaded = 0;
    const buffers = await loadAll(ctx, files, () => onProgress(++loaded / files.length));
    const take = (list) => list.map((s) => ({ ...s, buffer: buffers.shift() }));
    this.piano = new Sampler(ctx, take(PIANO), { release: 0.45 });
    this.bass = new Sampler(ctx, take(BASS), { release: 0.08, brightness: false, gain: 2 });
    // each sound: { hit, soft } as { buffer, level } (soft is null when the kit has no soft hit)
    const sample = (name) => ({ buffer: buffers.shift(), level: DRUM_LEVEL[name] });
    this.drums = {};
    for (const [sound, [hard, soft]] of Object.entries(DRUM_FILES)) this.drums[sound] = { hit: sample(hard), soft: soft ? sample(soft) : null };
    const [clickHi, clickLo] = await Promise.all([synthClick(ctx.sampleRate, 1600), synthClick(ctx.sampleRate, 1050)]);
    this.drums.clickHi = { hit: { buffer: clickHi, level: 1 }, soft: null };
    this.drums.clickLo = { hit: { buffer: clickLo, level: 1 }, soft: null };
    this.ready = true;
  }

  get running() {
    return this.ctx?.state === 'running';
  }

  resume() {
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  setVolume(name, value) {
    const targets = name === 'band' ? ['bandPiano', 'bass', 'drums'] : [name];
    for (const t of targets) this.bus[t]?.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
  }

  // ----- your own playing -----
  liveOn(midi, velocity = 0.7) {
    if (!this.ready) return;
    const old = this.live.get(midi);
    if (old) this.piano.stop(old, this.ctx.currentTime);
    this.sustained.delete(midi);
    this.live.set(midi, this.piano.start(midi, this.ctx.currentTime, velocity, this.bus.me));
  }

  liveOff(midi) {
    if (this.pedalDown) {
      this.sustained.add(midi);
      return;
    }
    const v = this.live.get(midi);
    if (v) this.piano.stop(v, this.ctx.currentTime);
    this.live.delete(midi);
  }

  pedal(down) {
    this.pedalDown = down;
    if (down) return;
    for (const midi of this.sustained) {
      const v = this.live.get(midi);
      if (v) this.piano.stop(v, this.ctx.currentTime);
      this.live.delete(midi);
    }
    this.sustained.clear();
  }

  // ----- band & preview -----
  bandNote(instrument, midi, time, velocity, duration) {
    const sampler = instrument === 'bass' ? this.bass : this.piano;
    const voice = sampler.start(midi, time, velocity, instrument === 'bass' ? this.bus.bass : this.bus.bandPiano);
    sampler.stop(voice, time + duration);
    voice.sampler = sampler;
    this.bandVoices.add(voice);
    voice.src.addEventListener('ended', () => this.bandVoices.delete(voice));
  }

  hit(sound, time, velocity = 0.6) {
    const drum = this.drums[sound];
    if (!drum) return;
    const s = (velocity < SOFT_BELOW && drum.soft) || drum.hit;
    const src = this.ctx.createBufferSource();
    src.buffer = s.buffer;
    const g = this.ctx.createGain();
    g.gain.value = velocity * s.level;
    src.connect(g).connect(sound.startsWith('click') ? this.bus.click : this.bus.drums);
    src.start(time);
    const voice = { src, g, drum: true };
    this.bandVoices.add(voice);
    src.onended = () => {
      g.disconnect();
      this.bandVoices.delete(voice);
    };
  }

  click(time, accent) {
    this.hit(accent ? 'clickHi' : 'clickLo', time, accent ? 0.9 : 0.6);
  }

  preview(midis, duration = 1.2, velocity = 0.6) {
    const t = this.ctx.currentTime + 0.01;
    for (const m of midis) this.bandNote('piano', m, t, velocity, duration);
  }

  stopBand() {
    const t = this.ctx.currentTime;
    for (const v of this.bandVoices) {
      if (v.drum) {
        v.g.gain.setTargetAtTime(0, t, 0.02);
        try {
          v.src.stop(t + 0.1);
        } catch {
          // not started
        }
      } else v.sampler.stop(v, t);
    }
    this.bandVoices.clear();
  }

  // Audio-clock time that was audible at `perfMs` (a performance.now() / MIDI event timestamp).
  heardTime(perfMs = performance.now()) {
    const ctx = this.ctx;
    if (ctx.getOutputTimestamp) {
      const ts = ctx.getOutputTimestamp();
      if (ts.contextTime > 0 && ts.performanceTime > 0) return ts.contextTime + (perfMs - ts.performanceTime) / 1000;
    }
    return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0) - (performance.now() - perfMs) / 1000;
  }
}
