import { html, render, useState, useEffect, useRef, useMemo, useReducer } from '../vendor/preact-htm.js';
import { LESSONS, UNITS, lessonById } from './lessons.js';
import { COURSE, exercisesOf } from './course.js';
import { buildMaterial, partInfo } from './parts.js';
import { parseKey, prettyKey, prettyPc, prettySymbol, prettyNote, parseChord, pcName, pcSemis, mod } from './theory.js';
import { buildBand, swingBeat, swingRatio } from './band.js';
import { StepSession, PlayScorer, TIMING_WINDOWS } from './scoring.js';
import { AudioEngine } from './audio.js';
import { Player } from './player.js';
import { MidiInput } from './input.js';
import { load, save } from './store.js';
import { Keyboard } from './ui/keyboard.js';
import { Staff } from './ui/staff.js';

const DEFAULT_SETTINGS = {
  midiInput: 'all',
  playMine: true,
  anyOctave: true,
  showKeys: true,
  stepBass: false,
  timing: 'normal',
  latencyMs: 0,
  countInBars: 1,
  metronome: false, // with the band; also the metronome button on band exercises, or M
  clickBeats: 'all', // 'all' | 'backbeat'
  volMe: 0.9,
  volBand: 0.8,
  volClick: 0.7,
  unlockAll: false,
};

const PASS = 60; // band score needed to pass
const starsForPiano = (accuracy) => (accuracy >= 95 ? 3 : accuracy >= 75 ? 2 : 1);
const starsForBand = (score) => (score >= 90 ? 3 : score >= 75 ? 2 : score >= PASS ? 1 : 0);
const COLORS = { done: '#2e9d5b', shaky: '#d9822b', current: '#1769a6', wrong: '#e5484d' };
const HANDS = { L: 'left hand', R: 'right hand', LR: 'both hands' };

const engine = new AudioEngine();
const player = new Player(engine);
// The screens swap these handlers in on every render so they always see current state.
const input = { on() {}, off() {}, pedal() {}, devices() {} };
const midi = new MidiInput({
  onNoteOn: (m, v, ts) => input.on(m, v, ts),
  onNoteOff: (m, ts) => input.off(m, ts),
  onPedal: (down) => input.pedal(down),
  onDevices: (list) => input.devices(list),
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const shortKey = (k) => prettyPc(parseKey(k).tonic) + (parseKey(k).minor ? 'm' : '');

function partName(lesson, partId) {
  const p = partInfo(lesson, partId);
  return p.id.includes('+') ? p.name : `${p.name} (${HANDS[p.hands]})`;
}

const Stars = ({ n }) => html`<span class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(3 - n)}</span></span>`;

// Text set like hand-cut paper letters: each letter gets its own small tilt, lift and size (.cut in styles.css).
const TILT = [-3, 2, -1, 3.5, -2, 1, -4];
const LIFT = [0.02, -0.03, 0.01, -0.01, 0.03];
const SIZE = [1, 1.05, 0.96];
function Cut({ text }) {
  let i = 0;
  const letter = (c) => {
    const n = i++;
    return html`<span style=${`--r:${TILT[n % 7]}deg;--y:${LIFT[n % 5]}em;--s:${SIZE[n % 3]}`}>${c}</span>`;
  };
  const words = text.split(' ').map((w, k) => html`${k ? ' ' : ''}<span class="w">${[...w].map(letter)}</span>`);
  return html`<span class="cut"><span class="sr">${text}</span><span aria-hidden="true">${words}</span></span>`;
}

// The two beamed eighths from the app icon (icons/icon.svg), in the page's colours so they follow dark mode.
const Mark = () => html`
  <svg class="mark" viewBox="104 72 308 344" aria-hidden="true">
    <g transform="rotate(-4 256 270)">
      <path d="M208 118 410 86v48l-202 32z" />
      <rect x="208" y="140" width="22" height="207" />
      <rect x="388" y="110" width="22" height="176" />
      <ellipse class="head" cx="166" cy="353" rx="66" ry="50" transform="rotate(-20 166 353)" />
      <ellipse class="head" cx="346" cy="292" rx="66" ry="50" transform="rotate(-20 346 292)" />
    </g>
  </svg>
`;

// A metronome cut from paper like the Mark: the case with its window, tilted the same way, and the
// pendulum in the second colour (see .metro in styles.css).
const MetronomeIcon = () => html`
  <svg class="metro-icon" viewBox="0 0 24 24" aria-hidden="true">
    <g transform="rotate(-4 12 12)">
      <path fill-rule="evenodd" d="M10 2h4l5.4 17.5H4.6zM10.9 5.5 8.9 15.5h6.2l-2-10zM3 19.5h18V22H3z" />
      <g class="pendulum" transform="rotate(24 12 15.5)">
        <rect x="11.15" y="0.5" width="1.7" height="15.5" />
        <rect x="9.6" y="6.2" width="4.8" height="2.6" />
      </g>
    </g>
  </svg>
`;

// ---------- routes: home · #/<lesson> (its exercises) · #/<lesson>/<n> (exercise n)

function parseRoute() {
  const [id, n] = location.hash.replace(/^#\/?/, '').split('/');
  if (!id || !lessonById(id)) return { screen: 'home' };
  const num = Number(n);
  if (num >= 1 && num <= exercisesOf(id).length) return { screen: 'exercise', lessonId: id, n: num };
  return { screen: 'lesson', lessonId: id };
}

function go(path, { replace = false } = {}) {
  const url = path ? `#/${path}` : location.pathname + location.search;
  history[replace ? 'replaceState' : 'pushState'](null, '', url);
  window.dispatchEvent(new Event('routechange'));
}

function nextOf(ex) {
  const nx = COURSE[ex.index + 1];
  if (!nx) return null;
  const n = exercisesOf(nx.lessonId).findIndex((e) => e.id === nx.id) + 1;
  return {
    path: `${nx.lessonId}/${n}`,
    label: nx.lessonId === ex.lessonId ? 'Next exercise →' : `Next lesson: ${lessonById(nx.lessonId).title} →`,
  };
}

function playRoot(symbol) {
  const pc = pcSemis(parseChord(symbol).bass);
  engine.bandNote('bass', 36 + pc, engine.ctx.currentTime + 0.01, 0.65, 1.6);
}

// Keys to light up on the keyboard: MIDI number → 'L' | 'R' (notes without a hand go by register, as on the staff).
const handsOf = (notes) => new Map(notes.map((n) => [n.midi, n.hand ?? (n.midi >= 60 ? 'R' : 'L')]));

// The notes of `steps` that sound at `beat` (including ones held from earlier steps), as handsOf gives them.
function soundingAt(steps, beat) {
  const out = [];
  for (const s of steps) {
    if (s.beat > beat) break;
    for (const n of s.notes) if (beat < s.beat + (n.dur ?? s.dur)) out.push(n);
  }
  return handsOf(out);
}

function timingText(sum) {
  const m = sum.meanOffsetMs;
  return m > 20 ? `${m} ms late` : m < -20 ? `${-m} ms early` : 'in the pocket';
}

// ============================================================ app shell

function App() {
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...load('settings', {}) }));
  const [progress, setProgress] = useState(() => load('progress', {})); // exercise id → { stars, best }
  const [route, setRoute] = useState(parseRoute);
  const [sound, setSound] = useState({ loaded: 0, ready: false, running: false, error: null });
  const [midiState, setMidiState] = useState({ on: false, devices: [] });
  const [showSettings, setShowSettings] = useState(false);

  const set = (patch) => setSettings((s) => ({ ...s, ...patch }));
  useEffect(() => save('settings', settings), [settings]);
  useEffect(() => save('progress', progress), [progress]);

  async function connectMidi() {
    const on = await midi.init();
    setMidiState({ on, devices: midi.devices() });
  }

  useEffect(() => {
    const update = () => setRoute(parseRoute());
    window.addEventListener('popstate', update);
    window.addEventListener('routechange', update);
    // Sounds load straight away; the browser lets audio play after the first click or key press.
    engine
      .init((p) => setSound((s) => ({ ...s, loaded: p })))
      .then(() => setSound((s) => ({ ...s, ready: true })))
      .catch((e) => setSound((s) => ({ ...s, error: String(e.message || e) })));
    engine.ctx.onstatechange = () => setSound((s) => ({ ...s, running: engine.running }));
    const unlock = () => engine.resume();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    // reconnect a keyboard that was allowed before, without asking again
    navigator.permissions?.query({ name: 'midi' }).then((p) => p.state === 'granted' && connectMidi()).catch(() => {});
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener('routechange', update);
    };
  }, []);

  useEffect(() => {
    if (!sound.ready) return;
    engine.setVolume('me', settings.volMe);
    engine.setVolume('band', settings.volBand);
    engine.setVolume('click', settings.volClick);
  }, [sound.ready, settings.volMe, settings.volBand, settings.volClick]);
  useEffect(() => midi.select(settings.midiInput), [settings.midiInput]);

  const starsOf = (e) => progress[e.id]?.stars || 0;
  // Open: the first exercise, the one after a passed one, and any you have passed before (also when keys were added in between).
  const unlocked = (list, i) => settings.unlockAll || i === 0 || starsOf(list[i - 1]) > 0 || starsOf(list[i]) > 0;
  const record = (e, stars, best) =>
    setProgress((prev) => {
      const p = prev[e.id] || {};
      return { ...prev, [e.id]: { stars: Math.max(p.stars || 0, stars), best: Math.max(p.best || 0, best) } };
    });

  // outside an exercise the keyboard just plays the piano
  input.devices = (devices) => setMidiState((s) => ({ ...s, devices }));
  input.pedal = (down) => engine.ready && engine.pedal(down);
  input.on = (m, v) => {
    engine.resume();
    if (engine.ready && settings.playMine) engine.liveOn(m, v);
  };
  input.off = (m) => engine.ready && engine.liveOff(m);

  const lesson = route.lessonId && lessonById(route.lessonId);
  const list = lesson ? exercisesOf(lesson.id) : [];
  const locked = route.screen === 'exercise' && !unlocked(list, route.n - 1);
  useEffect(() => {
    if (locked) go(lesson.id, { replace: true });
  }, [locked]);
  const inGame = route.screen === 'exercise' && !locked;
  useEffect(() => document.body.classList.toggle('in-game', inGame), [inGame]);
  useEffect(() => window.scrollTo(0, 0), [route.screen, route.lessonId, route.n]);

  let screen;
  if (inGame) {
    const ex = list[route.n - 1];
    screen = html`<${ExerciseScreen} key=${ex.id} lesson=${lesson} ex=${ex} settings=${settings} set=${set}
      next=${nextOf(ex)} record=${record} ensureMidi=${() => midiState.on || connectMidi()} />`;
  } else if (lesson) {
    screen = html`<${LessonScreen} lesson=${lesson} list=${list} starsOf=${starsOf} unlocked=${unlocked} progress=${progress} />`;
  } else {
    screen = html`<${Home} starsOf=${starsOf} />`;
  }

  let soundChip = null;
  if (sound.error) soundChip = html`<span class="chip bad" title=${sound.error}>Sounds failed to load</span>`;
  else if (!sound.ready) soundChip = html`<span class="chip">Loading sounds ${Math.round(sound.loaded * 100)}%</span>`;
  else if (!sound.running) soundChip = html`<button class="chip warn" onClick=${() => engine.resume()}>🔇 Click to turn sound on</button>`;

  const midiLabel = !midi.supported
    ? 'No MIDI in this browser'
    : !midiState.on
      ? 'MIDI off'
      : midiState.devices.length
        ? `🎹 ${midiState.devices.map((d) => d.name).join(', ')}`
        : 'MIDI: no keyboard';

  return html`
    <header class="topbar">
      <button class="brand" onClick=${() => go('')}>
        <span class="logo"><${Mark} /><${Cut} text="BeBop Dots" /></span><span class="tag">jazz piano, step by step</span>
      </button>
      <div class="topbar-right">
        ${soundChip}
        <button class="chip${midiState.on && midiState.devices.length ? ' on' : ''}" onClick=${connectMidi}
          title=${midi.supported ? 'Connect your MIDI keyboard' : 'Web MIDI works in Chrome and Edge'}>${midiLabel}</button>
        <button class="icon-btn" aria-label="Settings" onClick=${() => setShowSettings(true)}>⚙</button>
      </div>
    </header>
    <main>${screen}</main>
    ${showSettings && html`<${Settings} settings=${settings} set=${set} devices=${midiState.devices}
      onClose=${() => setShowSettings(false)} onReset=${() => setProgress({})} />`}
  `;
}

// ============================================================ home: all lessons

function Home({ starsOf }) {
  let num = 0;
  return html`
    <section class="screen">
      <div class="hero-wrap">
        <h1 class="hero"><small><${Cut} text="Learn" /></small> <${Cut} text="Jazz piano" /></h1>
        <div class="hero-block ink">
          <p class="hero-sub"><${Cut} text="take one" /> <span class="wink"><${Cut} text="(not five)" /></span> <${Cut} text="step at a time" /></p>
          <p class="lead">Each lesson starts on the piano alone — one chord or note at a time, in C, then in other keys — and ends with you playing along with a swinging band.</p>
        </div>
      </div>
      ${UNITS.map((u) => html`
        <h2 class="unit-title"><span class="unit-num">${u.title.split(' · ')[0].padStart(2, '0')}</span><${Cut} text=${u.title.split(' · ')[1]} /></h2>
        <div class="level-grid">
          ${LESSONS.filter((l) => l.unit === u.id).map((l) => {
            num++;
            const list = exercisesOf(l.id);
            const got = list.reduce((a, e) => a + starsOf(e), 0);
            const done = list.filter((e) => starsOf(e) > 0).length;
            return html`
              <button class="level-card" onClick=${() => go(l.id)}>
                <span class="badge" title=${`Level ${l.level}`}>${'●'.repeat(l.level)}${'○'.repeat(3 - l.level)}</span>
                <span class="num">${num}</span>
                <span class="lname">${l.title}</span>
                <span class="lnotes">${l.desc}</span>
                <span class="lfoot"><span class="stars">★ ${got} / ${list.length * 3}</span><span class="best">${done} of ${list.length}</span></span>
              </button>`;
          })}
        </div>`)}
    </section>
  `;
}

// ============================================================ one lesson: its exercises

function LessonScreen({ lesson, list, starsOf, unlocked, progress }) {
  const got = list.reduce((a, e) => a + starsOf(e), 0);
  return html`
    <section class="screen">
      <div class="levels-head">
        <button class="btn ghost small" onClick=${() => go('')}>← Lessons</button>
        <h2><${Cut} text=${lesson.title} /></h2>
        <span class="muted">★ ${got} / ${list.length * 3}</span>
      </div>
      <p class="lesson-about">${lesson.about}</p>
      <div class="level-grid">
        ${list.map((e, i) => {
          const ok = unlocked(list, i);
          const best = progress[e.id]?.best;
          return html`
            <button class="level-card${ok ? '' : ' locked'}" onClick=${() => ok && go(`${lesson.id}/${i + 1}`)}>
              <span class="badge ${e.band ? 'band' : 'piano'}">${e.band ? 'Band' : 'Piano'}</span>
              <span class="num">${ok ? i + 1 : '🔒'}</span>
              <span class="lname">${partName(lesson, e.partId)}</span>
              <span class="lnotes">${e.band ? `With the band · ${lesson.tempo} bpm` : `Key of ${shortKey(e.key)}`}</span>
              <span class="lfoot"><${Stars} n=${starsOf(e)} />${best ? html`<span class="best">best ${best} %</span>` : null}</span>
            </button>`;
        })}
      </div>
      <div class="tips">
        <b>Tips</b>
        <ul>${lesson.tips.map((t) => html`<li>${t}</li>`)}</ul>
        ${lesson.credit && html`<p class="muted small">${lesson.credit}</p>`}
      </div>
    </section>
  `;
}

// ============================================================ one exercise

function ExerciseScreen({ lesson, ex, settings, set, next, record, ensureMidi }) {
  const material = useMemo(() => buildMaterial(lesson, { key: ex.key, partId: ex.partId, rhythm: lesson.rhythm || 'sustain' }), [ex.id]);
  const steps = useMemo(() => material.steps.map((s, index) => ({ ...s, index })), [material]);
  const bpb = material.beatsPerBar;
  const formBeats = material.bars * bpb;
  const choruses = clamp(Math.round(24 / material.bars), 1, 4);
  const name = partName(lesson, ex.partId);

  const [phase, setPhase] = useState('intro'); // intro | learn | play | demo
  const [results, setResults] = useState(null);
  const [drill, setDrill] = useState(false);
  const [tempo, setTempo] = useState(lesson.tempo);
  const [count, setCount] = useState(null);
  const [, redraw] = useReducer((x) => x + 1, 0);

  const session = useRef(null);
  const play = useRef(null);
  const pressed = useRef(new Map());
  const flash = useRef(false);
  const playIdx = useRef(0);
  const demoKeys = useRef(new Map()); // what "Listen first" is playing right now, for the keyboard
  const countRef = useRef(null);
  const fill = useRef(null);
  const keyAction = useRef(null);
  const resultsAt = useRef(0);
  useEffect(() => {
    if (results) resultsAt.current = performance.now();
  }, [results]);

  useEffect(() => () => player.playing && player.stop(), []);

  // ---- the metronome plays with the band. Played step by step there's no beat to keep, so not there
  // (the piano exercises, and practising the missed spots).
  player.metronome = settings.metronome ? settings.clickBeats : 'off';
  const hasMetronome = ex.band && phase !== 'learn';
  function toggleMetronome() {
    engine.resume();
    set({ metronome: !settings.metronome });
  }

  // ---- piano only: one step at a time
  function learn(list, isDrill) {
    session.current = new StepSession(list, { anyOctave: settings.anyOctave });
    flash.current = false;
    setDrill(isDrill);
    setResults(null);
    setPhase('learn');
  }

  function finishLearn() {
    const summary = session.current.summary();
    if (drill) return setResults({ kind: 'drill', summary });
    const stars = starsForPiano(summary.accuracy);
    record(ex, stars, summary.accuracy);
    setResults({ kind: 'piano', summary, stars });
  }

  // ---- with the band
  function stop() {
    if (player.playing) player.stop();
    setPhase('intro');
    setCount(null);
  }

  function startRun(kind, runTempo = tempo) {
    if (!engine.ready) return;
    if (player.playing) player.stop();
    const style = lesson.style;
    const spb = 60 / runTempo;
    const ratio = swingRatio(style, runTempo);
    const n = kind === 'demo' ? 1 : choruses;
    const totalBeats = formBeats * n;
    const targets = [];
    const chords = [];
    for (let c = 0; c < n; c++) {
      for (const s of steps) {
        const beat = s.beat + c * formBeats;
        for (const note of s.notes) {
          targets.push({ midi: note.midi, beat, time: swingBeat(beat, ratio) * spb, bar: Math.floor(beat / bpb), chorus: c, step: s.index });
        }
      }
      for (const ch of material.chords) chords.push({ ...ch, beat: ch.beat + c * formBeats });
    }
    const { tonic, minor } = parseKey(ex.key);
    const band = buildBand(chords, {
      style, beatsPerBar: bpb, totalBeats, chorusBars: material.bars,
      bass: !material.part.ownBass,
      drums: true,
      piano: kind === 'play' && !material.part.hands.includes('L'),
      endChord: parseChord(pcName(tonic) + (minor ? 'm6' : '6')),
    });
    const timingWindow = TIMING_WINDOWS[settings.timing];
    play.current = {
      choruses: n, totalBeats, window: timingWindow, chorus: 0,
      scorer: kind === 'play' ? new PlayScorer(targets, { window: timingWindow, anyOctave: settings.anyOctave }) : null,
    };
    playIdx.current = 0;
    demoKeys.current = new Map();
    setResults(null);
    setDrill(false);
    player.start({
      tempo: runTempo, style, beatsPerBar: bpb, totalBeats, band,
      countInBeats: settings.countInBars * bpb,
      demo: kind === 'demo' ? steps : [],
      tail: 3,
      onEnd: () => finishRun(),
    });
    setPhase(kind);
  }

  function finishRun() {
    const p = play.current;
    setPhase('intro');
    setCount(null);
    if (!p?.scorer) return;
    p.scorer.advance(Infinity);
    const summary = p.scorer.summary(material.bars * p.choruses);
    const trouble = new Set(p.scorer.targets.filter((t) => t.status === 'missed').map((t) => t.step));
    for (const w of p.scorer.wrong) if (w.step !== undefined) trouble.add(w.step);
    const stars = starsForBand(summary.score);
    record(ex, stars, summary.score);
    setResults({ kind: 'band', summary, trouble, stars });
  }

  function begin() {
    engine.resume();
    ensureMidi();
    if (ex.band) startRun('play');
    else learn(steps, false);
  }

  const slowerTempo = Math.max(50, Math.round((tempo * 0.85) / 2) * 2);
  function slower() {
    setTempo(slowerTempo);
    startRun('play', slowerTempo);
  }

  // ---- input
  input.on = (m, velocity, ts) => {
    // On the intro and results screens a piano key works like Enter, silently. Keys in the first
    // moments after the results appear are ignored, so the last notes of a song don't skip them.
    if (results) {
      if (performance.now() - resultsAt.current > 1200) primary?.run();
      return;
    }
    if (phase === 'intro') return begin();
    engine.resume();
    if (engine.ready && settings.playMine) engine.liveOn(m, velocity);
    let state = 'held';
    const p = play.current;
    if (phase === 'play' && p) {
      const sec = player.songSec(ts) - settings.latencyMs / 1000;
      if (sec >= -p.window) state = p.scorer.input(m, sec, { beat: mod(sec / player.spb, formBeats) }).target ? 'ok' : 'wrong';
    } else if (phase === 'learn' && session.current && !session.current.done) {
      const s = session.current;
      const before = s.current;
      const r = s.noteOn(m);
      state = r === 'wrong' ? 'wrong' : 'ok';
      flash.current = r === 'wrong';
      if (r === 'next' && settings.stepBass && s.current.chord !== before.chord) playRoot(s.current.chord);
      if (r === 'finished') finishLearn();
    }
    pressed.current.set(m, state);
    redraw();
  };
  input.off = (m) => {
    if (engine.ready) engine.liveOff(m);
    session.current?.noteOff(m);
    pressed.current.delete(m);
    redraw();
  };

  // ---- Enter starts / takes the main result action, Escape stops, M turns the metronome on or off
  const primary = results && resultActions()[0];
  keyAction.current = (e) => {
    if (e.target.closest?.('input, select, textarea, button')) return;
    if (e.key === 'Enter' && primary) primary.run();
    else if (e.key === 'Enter' && phase === 'intro') begin();
    else if (e.key === 'Escape' && (phase === 'play' || phase === 'demo')) stop();
    else if (e.key.toLowerCase() === 'm' && hasMetronome && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) toggleMetronome();
  };
  useEffect(() => {
    const onKey = (e) => keyAction.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---- animation while the band plays: count-in, misses, current step, progress bar
  useEffect(() => {
    if (phase !== 'play' && phase !== 'demo') return undefined;
    let raf;
    const tick = () => {
      const p = play.current;
      const sec = player.songSec();
      const beat = sec / player.spb;
      let dirty = p.scorer ? p.scorer.advance(sec - settings.latencyMs / 1000).length > 0 : false;
      const c = beat < 0 ? ((Math.floor(beat) + settings.countInBars * bpb) % bpb) + 1 : null;
      if (c !== countRef.current) {
        countRef.current = c;
        setCount(c);
      }
      const chorus = clamp(Math.floor(beat / formBeats), 0, p.choruses - 1);
      const local = clamp(beat - chorus * formBeats, 0, formBeats - 0.001);
      let idx = 0;
      while (idx + 1 < steps.length && steps[idx + 1].beat <= local + 0.5) idx++;
      if (idx !== playIdx.current || chorus !== p.chorus) {
        playIdx.current = idx;
        p.chorus = chorus;
        dirty = true;
      }
      if (phase === 'demo') {
        const heard = soundingAt(steps, player.beatAt(sec));
        if ([...heard].join() !== [...demoKeys.current].join()) {
          demoKeys.current = heard;
          dirty = true;
        }
      }
      if (fill.current) fill.current.style.width = `${clamp(beat / p.totalBeats, 0, 1) * 100}%`;
      if (dirty) redraw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // ---- result actions (first = main one, also on Enter)
  function resultActions() {
    const toLesson = { label: 'Exercises', run: () => go(lesson.id) };
    const nextAct = next && { label: next.label, run: () => go(next.path) };
    if (results.kind === 'drill') {
      return [{ label: '▶ Back to the band', run: () => { setDrill(false); setResults(null); setPhase('intro'); } }, { label: '⟲ Again', run: () => learn(session.current.steps, true) }];
    }
    if (results.kind === 'piano') return [nextAct, { label: '⟲ Again', run: () => learn(steps, false) }, toLesson].filter(Boolean);
    if (results.stars > 0) return [nextAct, { label: '▶ Play again', run: () => startRun('play') }, toLesson].filter(Boolean);
    return [
      results.trouble.size > 0 && { label: 'Practise the missed spots', run: () => learn(steps.filter((s) => results.trouble.has(s.index)), true) },
      { label: '▶ Try again', run: () => startRun('play') },
      { label: `🐢 Slower (${slowerTempo} bpm)`, run: slower },
      toLesson,
    ].filter(Boolean);
  }

  // ---- what to show
  const s = session.current;
  const p = play.current;
  let staffIndex = 0;
  let colorOf = () => null;
  let version = `${phase}`;
  let targets = new Map();

  if (phase === 'learn' && s) {
    const at = s.index;
    const posOf = new Map(s.steps.map((st, i) => [st.index, i]));
    staffIndex = (s.current || s.steps[s.steps.length - 1]).index;
    colorOf = (idx) => {
      const i = posOf.get(idx);
      if (i === undefined) return null;
      return i < at ? (s.errors[i] ? COLORS.shaky : COLORS.done) : i === at ? (flash.current ? COLORS.wrong : COLORS.current) : null;
    };
    version = `learn-${at}-${flash.current}-${s.errors[at] ?? 0}`;
    if (s.current && settings.showKeys) targets = handsOf(s.current.notes);
    if (fill.current) fill.current.style.width = `${(100 * at) / s.steps.length}%`;
  } else if (ex.band && p?.scorer) {
    const live = phase === 'play';
    const status = new Map();
    let hits = 0;
    let missed = 0;
    const rank = { hit: 1, pending: 2, missed: 3 };
    // while playing, each chorus on the staff shows its own notes; afterwards they show together
    const chorusOf = (c) => (live ? c : 0);
    for (const t of p.scorer.targets) {
      const k = `${chorusOf(t.chorus)}:${t.step}:${t.midi}`;
      if (!status.has(k) || rank[t.status] > rank[status.get(k)]) status.set(k, t.status);
      if (t.status === 'hit') hits++;
      if (t.status === 'missed') missed++;
    }
    staffIndex = live ? playIdx.current : 0;
    colorOf = (i, c) => {
      const st = steps[i].notes.map((n) => status.get(`${chorusOf(c)}:${i}:${n.midi}`));
      if (st.includes('missed')) return COLORS.wrong;
      if (st.every((x) => x === 'hit')) return COLORS.done;
      return live && i === staffIndex && c === p.chorus ? COLORS.current : null;
    };
    version = `${phase}-${staffIndex}-${hits}-${missed}-${p.chorus}`;
    const cur = live && steps[playIdx.current];
    if (cur && settings.showKeys) targets = handsOf(cur.notes);
  } else if (phase === 'demo') {
    staffIndex = playIdx.current;
    colorOf = (i, c) => (i === staffIndex && c === p.chorus ? COLORS.current : null);
    version = `demo-${staffIndex}`;
    targets = demoKeys.current;
  }

  // the staff cursor: on the first notes before you start, then on whatever is to be played now
  const cursor = !results && (phase === 'intro' || phase === 'play' || phase === 'demo' || (phase === 'learn' && !!s?.current));

  const mids = material.steps.flatMap((st) => st.notes.map((n) => n.midi));
  const kbLo = Math.min(36, Math.floor(Math.min(...mids) / 12) * 12);
  const kbHi = Math.max(96, Math.ceil((Math.max(...mids) + 1) / 12) * 12);
  const running = phase === 'play' || phase === 'demo';
  const cur = s?.current;
  // how many times the staff lays out the form: every chorus the band will play, but once for
  // "Listen first" and for practising the missed spots, which go through it once
  const passes = ex.band && (phase === 'intro' || phase === 'play') ? choruses : 1;
  // while the band plays, the staff scrolls along with it (beats from the start of the first chorus)
  const clock = useMemo(() => (running ? (time) => player.steadyBeat(time) : null), [running]);
  // HUD buttons don't take the focus, so Enter still starts and Escape still stops
  const keepFocus = (e) => e.preventDefault();

  return html`
    <section class="screen game">
      <div class="hud">
        <button class="btn ghost small" onClick=${() => go(lesson.id)}>← ${lesson.title}</button>
        <div class="hud-title"><span class="lvl">${ex.n}</span><span>${name}</span>
          <span class="muted">${ex.band ? '· with the band' : `· ${prettyKey(ex.key)}`}</span></div>
        <div class="hud-tools">
          ${hasMetronome && html`
            <button class="btn small metro${settings.metronome ? ' on' : ' ghost'}" aria-label="Metronome" title="Metronome (M)"
              aria-pressed=${settings.metronome} onMouseDown=${keepFocus} onClick=${toggleMetronome}><${MetronomeIcon} /></button>`}
          ${running && html`<button class="btn small stop" onClick=${stop}>■ Stop <kbd>Esc</kbd></button>`}
        </div>
      </div>
      <div class="progress"><div class="progress-fill" ref=${fill}></div></div>

      ${phase === 'intro' && html`
        <div class="intro ink">
          <div class="intro-meta">
            <div class="intro-title">${name}</div>
            <div class="intro-desc">${ex.band
              ? `Play it with the band: ${choruses}× through the ${material.bars}-bar form at ${tempo} bpm, after a one-bar count-in.`
              : `${prettyKey(ex.key)}, piano only. The notes light up one at a time — play them and the next ones come. No clock: take your time.`}</div>
            <div class="intro-rules">${ex.band
              ? `Score ${PASS} % to pass · ★★ 75 % · ★★★ 90 % · any piano key starts too`
              : 'Few wrong notes = more stars · any piano key starts too'}</div>
          </div>
          <div class="intro-buttons">
            <button class="btn big" onClick=${begin}>Start <kbd>Enter</kbd></button>
            ${ex.band && html`<button class="btn ghost" onClick=${() => { engine.resume(); startRun('demo'); }}>🔊 Listen first</button>`}
          </div>
        </div>`}

      ${phase === 'learn' && html`
        <div class="intro stepbar ink">
          <div class="step-chord">${cur ? prettySymbol(cur.chord) : '✓'}</div>
          <div class="intro-meta">
            <div class="step-notes">${!cur ? 'Done!' : settings.showKeys ? cur.notes.map((n) => prettyNote(n)).join(' · ') : 'Read the notes from the staff'}</div>
            <div class="intro-rules">${cur ? `Step ${s.index + 1} of ${s.steps.length}${drill ? ' · practising the missed spots' : ''}` : ''}</div>
          </div>
          <div class="intro-buttons">
            <button class="btn ghost" disabled=${!cur} onClick=${() => cur && engine.preview(cur.notes.map((n) => n.midi))}>🔊 Hear it</button>
            <button class="btn ghost" onClick=${() => learn(s.steps, drill)}>⟲ Restart</button>
          </div>
        </div>`}

      <div class="stage">
        ${count && html`<div class="count-in">${count}</div>`}
        ${phase === 'demo' && html`<div class="demo-badge">Listening — the app plays the part</div>`}
        <${Staff} steps=${steps} chords=${material.chords} bars=${material.bars} bpb=${bpb} keySpec=${ex.key}
          repeats=${passes} chorus=${running ? p.chorus : 0} clock=${clock}
          current=${staffIndex} colorOf=${colorOf} version=${version} cursor=${cursor} />
      </div>

      <div class="input-panel">
        <${Keyboard} lo=${kbLo} hi=${kbHi} targets=${targets} pressed=${pressed.current}
          onDown=${(m) => input.on(m, 0.7, performance.now())} onUp=${(m) => input.off(m)} />
        <div class="kbd-hint"><span class="hand-key L"></span>left hand <span class="hand-key R"></span>right hand</div>
      </div>

      ${results && html`<${ResultCard} results=${results} actions=${resultActions()} />`}
    </section>
  `;
}

function ResultCard({ results, actions }) {
  const sum = results.summary;
  let title;
  let sub = '';
  let grid;
  if (results.kind === 'band') {
    title = results.stars === 3 ? 'Excellent!' : results.stars ? 'Passed!' : 'Not yet';
    if (!results.stars) sub = `You need ${PASS} % to pass. Practise the missed spots, go again, or try it slower.`;
    grid = [
      ['Score', `${sum.score} %`],
      ['Notes hit', `${sum.hits} / ${sum.total}`],
      ['Wrong notes', sum.wrong],
      ['Timing', sum.hits ? timingText(sum) : '—'],
    ];
  } else {
    title = results.kind === 'drill' ? 'Missed spots practised' : results.stars === 3 ? 'Flawless!' : 'Well done!';
    grid = [
      ['Clean steps', `${sum.accuracy} %`],
      ['Wrong notes', sum.wrong],
    ];
  }
  return html`
    <div class="overlay">
      <div class="overlay-card">
        ${results.kind !== 'drill' && html`<div class="big-stars"><${Stars} n=${results.stars} /></div>`}
        <h2><${Cut} text=${title} /></h2>
        ${sub && html`<p class="muted">${sub}</p>`}
        <div class="result-grid">${grid.map(([k, v]) => html`<div><span>${k}</span><b>${v}</b></div>`)}</div>
        <div class="overlay-actions">
          ${actions.map((a, i) => html`<button class=${i === 0 ? 'btn' : 'btn ghost'} onClick=${a.run}>${a.label}${i === 0 ? html` <kbd>Enter</kbd>` : null}</button>`)}
        </div>
        <p class="muted small">Enter or any key on your piano picks the first button.</p>
      </div>
    </div>
  `;
}

// ============================================================ settings

function Settings({ settings, set, devices, onClose, onReset }) {
  const check = (key, label, hint) => html`
    <label class="check"><input type="checkbox" checked=${settings[key]} onChange=${(e) => set({ [key]: e.target.checked })} />
      <span>${label}${hint && html`<small>${hint}</small>`}</span></label>`;
  const slider = (key, label, min, max, step, unit) => html`
    <label class="field">${label}
      <span class="slider"><input type="range" min=${min} max=${max} step=${step} value=${settings[key]}
        onInput=${(e) => set({ [key]: Number(e.target.value) })} /> <b>${unit ? `${settings[key]} ${unit}` : `${Math.round(settings[key] * 100)} %`}</b></span></label>`;
  const select = (key, label, options) => html`
    <label class="field">${label}
      <select value=${settings[key]} onChange=${(e) => set({ [key]: isNaN(e.target.value) ? e.target.value : Number(e.target.value) })}>
        ${options.map(([v, t]) => html`<option value=${v}>${t}</option>`)}
      </select></label>`;
  return html`
    <div class="overlay" onClick=${(e) => e.target.classList.contains('overlay') && onClose()}>
      <div class="overlay-card settings">
        <h2><${Cut} text="Settings" /></h2>
        ${select('midiInput', 'MIDI input', [['all', 'All connected devices'], ...devices.map((d) => [d.id, d.name])])}
        ${check('playMine', "Play my notes with the app's piano", 'Turn off if your keyboard has its own sound.')}
        ${check('anyOctave', 'Right note in any octave counts', 'Turn off to require the exact keys shown.')}
        ${check('showKeys', 'Show the notes on the keyboard', 'Turn off to read from the staff only.')}
        ${check('stepBass', 'Piano exercises: bass note on each new chord')}
        ${check('metronome', 'Metronome with the band', 'Also the metronome button on band exercises, or the M key.')}
        ${select('clickBeats', 'Metronome clicks', [['all', 'Every beat'], ['backbeat', 'On 2 & 4']])}
        ${select('timing', 'Timing window', [['relaxed', 'Relaxed (±200 ms)'], ['normal', 'Normal (±140 ms)'], ['strict', 'Strict (±80 ms)']])}
        ${slider('latencyMs', 'Latency compensation', 0, 200, 5, 'ms')}
        ${slider('volMe', 'My piano', 0, 1.5, 0.05)}
        ${slider('volBand', 'Band', 0, 1.5, 0.05)}
        ${slider('volClick', 'Metronome', 0, 1.5, 0.05)}
        ${check('unlockAll', 'Unlock all exercises')}
        <div class="settings-foot">
          <button class="btn ghost small" onClick=${() => confirm('Reset all stars and progress?') && onReset()}>Reset progress</button>
          <button class="btn" onClick=${onClose}>Done</button>
        </div>
      </div>
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('app'));
