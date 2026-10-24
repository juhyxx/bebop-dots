import { html } from '../../vendor/preact-htm.js';

const WHITE = new Set([0, 2, 4, 5, 7, 9, 11]);
const W = 20;
const H = 112;
const BW = 12;
const BH = 70;

// targets: Map midi → 'L' | 'R', the notes to play and which hand plays them (coloured per hand);
// pressed: Map midi → 'ok' | 'wrong' | 'held'
export function Keyboard({ lo, hi, targets, pressed, onDown, onUp }) {
  const whites = [];
  const blacks = [];
  let x = 0;
  for (let m = lo; m <= hi; m++) {
    if (WHITE.has(m % 12)) {
      whites.push({ m, x });
      x += W;
    } else blacks.push({ m, x: x - BW / 2 });
  }

  const cls = (m, black) => {
    const p = pressed.get(m);
    return `key ${black ? 'black' : 'white'}${targets.has(m) ? ` target hand-${targets.get(m)}` : ''}${p ? ` p-${p}` : ''}`;
  };
  const handlers = (m) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.dataset.down = '1';
      onDown(m);
    },
    onPointerUp: (e) => {
      if (e.currentTarget.dataset.down) onUp(m);
      delete e.currentTarget.dataset.down;
    },
    onPointerLeave: (e) => {
      if (e.currentTarget.dataset.down) onUp(m);
      delete e.currentTarget.dataset.down;
    },
  });

  return html`
    <svg class="keyboard" viewBox="0 0 ${x} ${H}" preserveAspectRatio="xMidYMid meet">
      ${whites.map((k) => html`<rect class=${cls(k.m, false)} x=${k.x + 0.5} y="0" width=${W - 1} height=${H} rx="3" ...${handlers(k.m)} />`)}
      ${whites.filter((k) => targets.has(k.m)).map((k) => html`<circle class=${`key-dot hand-${targets.get(k.m)}`} cx=${k.x + W / 2} cy=${H - 24} r="4.5" />`)}
      <rect class="felt" x="0" y="0" width=${x} height="3" />
      ${whites
        .filter((k) => k.m % 12 === 0)
        .map((k) => html`<text class="key-label" x=${k.x + W / 2} y=${H - 8}>C${k.m / 12 - 1}</text>`)}
      ${blacks.map((k) => html`<rect class=${cls(k.m, true)} x=${k.x} y="0" width=${BW} height=${BH} rx="2" ...${handlers(k.m)} />`)}
      ${blacks.filter((k) => targets.has(k.m)).map((k) => html`<circle class="key-dot on-black" cx=${k.x + BW / 2} cy=${BH - 12} r="3.5" />`)}
    </svg>
  `;
}
