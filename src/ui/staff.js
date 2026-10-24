// Grand-staff notation drawn with VexFlow (loaded as the global `Vex`): real note values, rests,
// beams, ties, bar lines and the key signature. The music is one long line that moves from right to
// left under a fixed cursor; the clefs and key signature stay at the left edge.
import { html, useEffect, useRef } from '../../vendor/preact-htm.js';
import { STEP_NAMES, accidentalText, prettySymbol } from '../theory.js';

const VF = window.Vex.Flow;
const LINE_H = 240; // the grand staff including chord symbols
const EPS = 1e-6;
const VALUES = [[4, 'w'], [3, 'hd'], [2, 'h'], [1.5, 'qd'], [1, 'q'], [0.75, '8d'], [0.5, '8'], [0.25, '16']];
const CURSOR_AT = 0.22; // where the cursor stands, as a share of the width right of the clefs
const NOTES_AT = 17; // where VexFlow puts a bar's first note: this far after the bar line (x = 0 of the bar's notes)
const BAR_GAP = 8; // the least room between a bar line and the accidentals of the note after it
const RES = 16; // points per beat on the path the music moves along with the band

const keyOf = (n) => `${STEP_NAMES[n.step].toLowerCase()}${accidentalText(n.alt)}/${n.oct}`;
const isUpper = (n) => (n.hand ? n.hand === 'R' : n.midi >= 60);

// Note values that add up to `len` beats (longest first; tied when there is more than one).
function split(len) {
  const out = [];
  let left = Math.round(len * 4) / 4;
  while (left > EPS) {
    const v = VALUES.find(([b]) => b <= left + EPS);
    out.push(v);
    left -= v[0];
  }
  return out;
}

// One staff, one bar: the note groups plus rests filling the gaps.
function barContent(groups, start, len) {
  const end = start + len;
  const out = [];
  let cursor = start;
  groups.forEach((g, i) => {
    if (g.beat > cursor + EPS) out.push({ beat: cursor, dur: g.beat - cursor, notes: null });
    const until = i + 1 < groups.length ? groups[i + 1].beat : end;
    let dur = Math.min(g.dur, until - g.beat);
    if (until - (g.beat + dur) < 0.25 - EPS) dur = until - g.beat; // close tiny gaps (e.g. staccato comping)
    dur = Math.max(0.25, Math.round(dur * 4) / 4);
    out.push({ ...g, dur });
    cursor = g.beat + dur;
  });
  if (end > cursor + EPS) out.push({ beat: cursor, dur: end - cursor, notes: null });
  return out;
}

function tickables(content, clef) {
  const notes = [];
  const ties = [];
  for (const c of content) {
    let prev = null;
    let beat = c.beat;
    for (const [beats, value] of split(c.dur)) {
      const sn = new VF.StaveNote({
        clef,
        keys: c.notes ? c.notes.map(keyOf) : [clef === 'treble' ? 'b/4' : 'd/3'],
        duration: c.notes ? value : `${value}r`,
        auto_stem: true,
      });
      if (value.includes('d')) VF.Dot.buildAndAttach([sn], { all: true });
      sn.beat = beat;
      if (c.notes) sn.stepIndex = c.step;
      if (prev) {
        const idx = c.notes.map((_, i) => i);
        ties.push(new VF.StaveTie({ first_note: prev, last_note: sn, first_indices: idx, last_indices: idx }));
      }
      if (c.notes) prev = sn;
      notes.push(sn);
      beat += beats;
    }
  }
  return { notes, ties };
}

const contextsOf = (formatter) => formatter.getTickContexts().list.map((t) => formatter.getTickContexts().map[t]);
const leftOf = (context) => context.getMetrics().totalLeftPx; // accidentals and the like, left of the note

// VexFlow spaces the notes by how they look; this moves each one to where its beat is (beat b of the bar
// at `shift` + b / beats of `barW`), so the music can move at an even speed and still bring every note to
// the cursor when it's due. Notes that would collide, or not fit in the bar, move only as far as they must.
function spaceByBeat(formatter, ticksPerBar, barW, shift) {
  const cs = contextsOf(formatter);
  const ticks = formatter.getTickContexts().list;
  const gap = (i) => cs[i - 1].getWidth() - leftOf(cs[i - 1]) + leftOf(cs[i]); // the least room from note i - 1 to i
  const xs = ticks.map((t) => shift + (t / ticksPerBar) * barW);
  const apart = () => {
    xs[0] = Math.max(xs[0], leftOf(cs[0]) + BAR_GAP - NOTES_AT);
    for (let i = 1; i < xs.length; i++) xs[i] = Math.max(xs[i], xs[i - 1] + gap(i));
  };
  apart();
  const last = cs.length - 1;
  xs[last] = Math.min(xs[last], barW - NOTES_AT - 4 - cs[last].getWidth() + leftOf(cs[last]));
  for (let i = last; i > 0; i--) xs[i - 1] = Math.min(xs[i - 1], xs[i] - gap(i));
  apart();
  cs.forEach((c, i) => c.setX(xs[i]));
}

// Where `beat` is on the strip: between the notes and rests drawn around it ([beat, x] pairs), and before
// the first or after the last at `speed` px per beat.
function xAt(keys, beat, speed) {
  const n = keys.length - 1;
  if (beat <= keys[0][0]) return keys[0][1] + (beat - keys[0][0]) * speed;
  if (beat >= keys[n][0]) return keys[n][1] + (beat - keys[n][0]) * speed;
  let lo = 0;
  let hi = n;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (keys[mid][0] < beat) lo = mid;
    else hi = mid;
  }
  const [b0, x0] = keys[lo];
  const [b1, x1] = keys[hi];
  return x0 + ((beat - b0) / (b1 - b0)) * (x1 - x0);
}

// Each value averaged with the `n` around it (fewer at the ends).
function average(xs, n) {
  const h = n >> 1;
  const sum = [0];
  for (const x of xs) sum.push(sum[sum.length - 1] + x);
  return xs.map((_, i) => {
    const a = Math.max(0, i - h);
    const b = Math.min(xs.length, i + h + 1);
    return (sum[b] - sum[a]) / (b - a);
  });
}

// The path the music moves along while the band plays: xAt every 1/RES beat, averaged over a beat, twice.
// Where the notes are spaced evenly it's the same; where they can't be (accidentals crowding a bar line),
// the music speeds up or slows down gently over a beat or two instead of jolting from one note to the next,
// and the notes still pass within a few px of the middle of the cursor.
function smoothPath(keys, speed) {
  const from = keys[0][0] - 8; // room for the count-in
  const n = Math.ceil((keys[keys.length - 1][0] + 8 - from) * RES);
  const xs = Array.from({ length: n + 1 }, (_, i) => xAt(keys, from + i / RES, speed));
  return { from, xs: average(average(xs, RES), RES) };
}

function pathAt({ from, xs }, beat) {
  const f = Math.max(0, Math.min(xs.length - 1.001, (beat - from) * RES));
  const i = Math.floor(f);
  return xs[i] + (f - i) * (xs[i + 1] - xs[i]);
}

// Moves the strip so that `x` is under the cursor.
function place(strip, geo, x) {
  strip.style.transform = `translateX(${geo.cursorX - x}px)`;
}

// Draws the whole strip: the form `repeats` times, bar g at x = g × barW. It's drawn again only when the
// music or the size changes; the colours and the strip's position change without a redraw (paint, Staff).
function layout({ el, strip, clefs, mark }, props, geo) {
  const { steps, chords, bars, bpb, keySpec, repeats = 1 } = props;
  const { BRACE, SINGLE_LEFT, SINGLE_RIGHT, THIN_DOUBLE, BOLD_DOUBLE_RIGHT } = VF.StaveConnector.type;
  const { NONE, SINGLE, DOUBLE, END } = VF.BarlineType;
  geo.width = el.clientWidth;
  geo.height = el.clientHeight;
  const width = Math.max(320, el.clientWidth);
  const perView = width >= 1000 ? 4 : width >= 640 ? 3 : 2;
  const y = 34 + Math.max(0, Math.round((el.clientHeight - LINE_H) / 2));
  const height = y + LINE_H - 34;

  // the clefs and key signature, which stay put; the music slides under them
  clefs.innerHTML = '';
  const headW = new VF.Stave(0, 0, 400).addClef('treble').addKeySignature(keySpec).getNoteStartX() + 4;
  const left = 10 + headW;
  const clefRenderer = new VF.Renderer(clefs, VF.Renderer.Backends.SVG);
  clefRenderer.resize(left, height);
  const clefCtx = clefRenderer.getContext();
  const clefTop = new VF.Stave(10, y, headW).addClef('treble').addKeySignature(keySpec);
  const clefBottom = new VF.Stave(10, y + 100, headW).addClef('bass').addKeySignature(keySpec);
  VF.Stave.formatBegModifiers([clefTop, clefBottom]);
  for (const st of [clefTop, clefBottom]) {
    st.setEndBarType(NONE);
    st.setContext(clefCtx).draw();
  }
  for (const type of [BRACE, SINGLE_LEFT]) new VF.StaveConnector(clefTop, clefBottom).setType(type).setContext(clefCtx).draw();
  clefs.style.width = `${left}px`;

  // each step's notes, split between the two staves; a hand with nothing to play gets rests
  const groups = { treble: [], bass: [] };
  for (const s of steps) {
    for (const staff of ['treble', 'bass']) {
      const ns = s.notes.filter((n) => (staff === 'treble') === isUpper(n));
      if (ns.length) groups[staff].push({ beat: s.beat, dur: Math.max(...ns.map((n) => n.dur ?? s.dur)), notes: ns, step: s.index });
    }
  }

  const barW = (width - left) / perView;
  const cursorX = left + CURSOR_AT * (width - left);
  const total = bars * repeats;
  const formBeats = bars * bpb;

  strip.innerHTML = '';
  const lead = cursorX + 2 * barW; // empty staff before the first bar, which comes in during the count-in
  const x0 = -lead; // the SVG's left edge on the strip
  const renderer = new VF.Renderer(strip, VF.Renderer.Backends.SVG);
  renderer.resize(total * barW + lead + 2, height);
  const ctx = renderer.getContext();
  strip.querySelector('svg').style.left = `${x0}px`;
  for (const st of [new VF.Stave(0, y, lead), new VF.Stave(0, y + 100, lead)]) {
    st.setBegBarType(NONE);
    st.setEndBarType(NONE);
    st.setContext(ctx).draw();
  }

  // the bars of the form: where each starts, and its chords and notes
  const measures = [];
  for (let bar = 0; bar < bars; bar++) {
    const start = bar * bpb;
    const inBar = (x) => x.beat >= start - EPS && x.beat < start + bpb - EPS;
    measures.push({ start, chords: chords.filter(inBar), notes: { treble: groups.treble.filter(inBar), bass: groups.bass.filter(inBar) } });
  }

  const keys = [];
  geo.notes = []; // each note drawn: its SVG group, step and chorus, and the colour it has
  // every bar of the strip, formatted by VexFlow
  const drawn = [];
  for (let g = 0; g < total; g++) {
    const { start, notes } = measures[g % bars];
    const T = tickables(barContent(notes.treble, start, bpb), 'treble');
    const B = tickables(barContent(notes.bass, start, bpb), 'bass');
    const vt = new VF.Voice(`${bpb}/4`).addTickables(T.notes);
    const vb = new VF.Voice(`${bpb}/4`).addTickables(B.notes);
    VF.Accidental.applyAccidentals([vt], keySpec);
    VF.Accidental.applyAccidentals([vb], keySpec);
    const beams = [...VF.Beam.generateBeams(T.notes), ...VF.Beam.generateBeams(B.notes)];
    const formatter = new VF.Formatter().joinVoices([vt]).joinVoices([vb]).format([vt, vb], barW - NOTES_AT - 10);
    drawn.push({ T, B, vt, vb, beams, formatter });
  }
  // The beats sit at the same place in every bar, late enough for the accidentals on the bars' first notes
  // (but at most half a beat late): the music moves at one speed, and no note has to be pushed off its beat.
  const firstLeft = Math.max(...drawn.map((d) => leftOf(contextsOf(d.formatter)[0])));
  const shift = clamp(firstLeft + BAR_GAP - NOTES_AT, 0, barW / bpb / 2);

  for (let g = 0; g < total; g++) {
    const bar = g % bars;
    const c = Math.floor(g / bars);
    const last = g === total - 1;
    const formEnd = bar === bars - 1;
    const top = new VF.Stave(g * barW - x0, y, barW);
    const bottom = new VF.Stave(g * barW - x0, y + 100, barW);
    top.setMeasure(bar + 1);
    for (const st of [top, bottom]) {
      st.setBegBarType(NONE);
      st.setEndBarType(last ? END : formEnd ? DOUBLE : SINGLE);
      st.setContext(ctx).draw();
    }
    new VF.StaveConnector(top, bottom).setType(last ? BOLD_DOUBLE_RIGHT : formEnd ? THIN_DOUBLE : SINGLE_RIGHT).setContext(ctx).draw();

    const { start } = measures[bar];
    const { T, B, vt, vb, beams, formatter } = drawn[g];
    spaceByBeat(formatter, vt.getTotalTicks().value(), barW, shift);
    vt.draw(ctx, top);
    vb.draw(ctx, bottom);
    for (const b of beams) b.setContext(ctx).draw();
    for (const t of [...T.ties, ...B.ties]) t.setContext(ctx).draw();
    for (const n of [...T.notes, ...B.notes]) {
      keys.push([c * formBeats + n.beat, x0 + (n.getNoteHeadBeginX() + n.getNoteHeadEndX()) / 2]);
      if (n.stepIndex !== undefined) geo.notes.push({ el: n.getSVGElement(), step: n.stepIndex, chorus: c, color: null });
    }

    // chord symbols above the bar, over the note that starts with the chord
    for (const ch of measures[bar].chords) {
      const at = [...T.notes, ...B.notes].find((n) => Math.abs(n.beat - ch.beat) < EPS);
      const fx = top.getX() + NOTES_AT + shift + ((ch.beat - start) / bpb) * barW - 2;
      const label = document.createElement('div');
      label.className = 'staff-chord';
      label.textContent = prettySymbol(ch.symbol);
      label.style.left = `${x0 + (at ? at.getAbsoluteX() - 2 : fx)}px`;
      label.style.top = `${y - 26}px`;
      strip.appendChild(label);
    }
  }
  keys.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const path = keys.filter((k, i) => i === 0 || k[0] > keys[i - 1][0] + EPS);
  path.push([total * bpb, path[0][1] + total * barW]); // the end, at the same speed
  geo.keys = path;
  geo.speed = barW / bpb;
  geo.path = smoothPath(path, geo.speed);
  geo.cursorX = cursorX;

  // the cursor: a band across both staves, with an arrow above it
  const y0 = clefTop.getYForLine(0) - 14;
  const y1 = clefBottom.getYForLine(4) + 14;
  Object.assign(mark.style, { left: `${cursorX - 17}px`, width: '34px', top: `${y0}px`, height: `${y1 - y0}px` });
}

// Colours the notes and shows the cursor. While the band plays, its clock moves the strip (see Staff);
// otherwise the strip glides to the current step.
function paint({ strip, mark }, props, geo) {
  const { steps, bars, bpb, current, colorOf, cursor, clock, chorus = 0 } = props;
  for (const n of geo.notes) {
    const color = colorOf(n.step, n.chorus);
    if (color === n.color) continue;
    n.color = color;
    n.el.classList.toggle('tinted', !!color);
    if (color) n.el.style.setProperty('--tint', color);
  }
  mark.hidden = !cursor;
  if (clock) return;
  strip.classList.toggle('glide', !!geo.placed);
  place(strip, geo, xAt(geo.keys, chorus * bars * bpb + (steps[current]?.beat ?? 0), geo.speed));
  // glide from the next frame on: turned on with the first position, it would slide the music in from the side
  if (!geo.placed) requestAnimationFrame(() => (geo.placed = true));
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// While the band counts in, the music waits half a beat before the cursor (gliding there from where it
// was) and sets off in the last beat, so it is at full speed when the first note reaches the cursor.
const setOff = (beat) => (beat >= 0 ? beat : beat > -1 ? (beat + 1) ** 2 / 2 - 0.5 : -0.5);

// steps: one pass of the form; current: index of the step being played; colorOf(stepIndex, chorus) → CSS
// colour or null. `repeats` lays the form out that many times (the band's choruses) and `chorus` says which
// one `current` is in. `version` changes when the colours do; `cursor` shows the cursor. While the band
// plays, `clock(frameTime)` gives the beat (counted from the first chorus) to keep under the cursor.
export function Staff(props) {
  const ref = useRef(null);
  const strip = useRef(null);
  const clefs = useRef(null);
  const mark = useRef(null);
  const geo = useRef({ keys: [], notes: [], path: null, cursorX: 0 });
  const latest = useRef(props);
  latest.current = props;
  const parts = () => ({ el: ref.current, strip: strip.current, clefs: clefs.current, mark: mark.current });
  const redraw = () => {
    layout(parts(), latest.current, geo.current);
    paint(parts(), latest.current, geo.current);
  };

  useEffect(redraw, [props.steps, props.chords, props.bars, props.bpb, props.keySpec, props.repeats]);
  useEffect(() => paint(parts(), latest.current, geo.current), [props.current, props.chorus, props.version, props.cursor, props.clock]);
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      const g = geo.current;
      if (ref.current.clientWidth !== g.width || ref.current.clientHeight !== g.height) redraw();
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const { clock } = props;
    if (!clock) return undefined;
    let raf;
    const follow = (time) => {
      const beat = clock(time);
      strip.current.classList.toggle('glide', beat < -1);
      if (geo.current.path) place(strip.current, geo.current, pathAt(geo.current.path, setOff(beat)));
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [props.clock]);

  return html`
    <div class="staff" ref=${ref}>
      <div class="staff-cursor" ref=${mark}></div>
      <div class="staff-strip" ref=${strip}></div>
      <div class="staff-clefs" ref=${clefs}></div>
    </div>
  `;
}
