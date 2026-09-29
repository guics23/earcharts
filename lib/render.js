// Lays out parsed melody lines, draws each one as an SVG, and wraps them in
// a printable HTML page. No Node-specific APIs, so this module also runs in
// a browser.

import { parseMelody, parseChords } from './parse.js';
import { buildScore, player, playerHtml, PLAYER_CSS } from './play.js';

const WIDTH = 1000; // SVG units; the page scales it to fit
const MARGIN = 12; // left and right margin of each line
const MIN_BARS = 4; // lines with fewer bars keep the width of a 4-bar line's bars
const BAR_PAD_L = 14;
const BAR_PAD_R = 8;

const DIGIT_SIZE = 22; // digit font size
const DIGIT_W = 12.5; // approximate digit width at DIGIT_SIZE
const CAP = 16; // approximate digit height at DIGIT_SIZE
const ACC_SIZE = 15;
const ACC_W = 10; // room for a ♯ or ♭ before the digit
const DOT_W = 7; // room for a dot after the digit
const STEP = 5; // vertical distance per scale step

const STEM_GAP = 5; // space between a digit and its stem
const STEM_LEN = 13;
const FLAG_W = 7;
const BEAM_W = 3;
const BEAM_GAP = 5; // distance between first and second beam
const NOTE_TOP = 40; // top of the highest digit: room for stems, beams, triplets, trills
const CHORD_SIZE = 17;
const CHORD_EXT_SIZE = 12;

// Colors come from the page theme: ink follows the SVG's CSS color, chords
// use the .chord rule. The attribute values are fallbacks for a bare SVG.
const INK = 'currentColor';
const CHORD_INK = '#8a8a8a';

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const r = (n) => Math.round(n * 10) / 10;
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const accGlyph = (s) => s.replace(/#/g, '♯').replace(/b/g, '♭');

const seg = (x1, y1, x2, y2, w = 1.5) =>
  `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke-width="${w}"/>`;
const dot = (x, y) => `<circle cx="${r(x)}" cy="${r(y)}" r="2.2" fill="${INK}" stroke="none"/>`;
const beam = (x1, x2, y) =>
  `<rect x="${r(x1 - 0.75)}" y="${r(y)}" width="${r(x2 - x1 + 1.5)}" height="${BEAM_W}" fill="${INK}" stroke="none"/>`;
const arc = (x1, x2, y) => {
  const depth = Math.min(9, 4 + (x2 - x1) * 0.05);
  return `<path d="M${r(x1)} ${r(y)} Q${r((x1 + x2) / 2)} ${r(y + depth * 2)} ${r(x2)} ${r(y)}" fill="none" stroke-width="1.4"/>`;
};

// Sets e.left (slot start), e.x (digit centre) and e.right (digit or dot end)
// for every event in a bar. Each event gets a fixed width plus a share of the
// spare room proportional to the square root of its duration. Bars with less
// than four quarters' worth of weight (like a pickup) don't stretch to fill.
function layoutBar(bar, x0, w) {
  const evs = bar.events;
  const fixed = evs.map((e) => DIGIT_W + 8 + (e.acc ? ACC_W : 0) + (e.dotted ? DOT_W : 0));
  const flex = evs.map((e) => Math.sqrt(e.duration));
  const inner = w - BAR_PAD_L - BAR_PAD_R;
  const fixedSum = sum(fixed);
  const flexSum = Math.max(sum(flex), 4);
  const scale = fixedSum > inner ? inner / fixedSum : 1;
  const spare = Math.max(0, inner - fixedSum);
  let x = x0 + BAR_PAD_L;
  evs.forEach((e, i) => {
    e.left = x;
    e.x = x + (e.acc ? ACC_W : 0) * scale + (DIGIT_W * scale) / 2;
    e.right = e.x + DIGIT_W / 2 + 2 + (e.dotted ? DOT_W : 0);
    x += fixed[i] * scale + (flexSum ? (spare * flex[i]) / flexSum : 0);
  });
  bar.x0 = x0;
  bar.w = w;
}

function chordSvg(x, y, symbol) {
  const attrs = `x="${r(x)}" y="${r(y)}" class="chord" fill="${CHORD_INK}"`;
  const m = symbol.match(/^([#b♯♭]?[1-7])([-+DMoø°]*)(.*)$/);
  if (!m) return `<text ${attrs}>${esc(symbol)}</text>`;
  const ext = m[3] ? `<tspan class="chord-ext" dy="-7">${esc(accGlyph(m[3]))}</tspan>` : '';
  return `<text ${attrs}>${esc(accGlyph(m[1]))}${esc(m[2])}${ext}</text>`;
}

// Draws one line of music. chordBars is indexed by bar number through the
// whole piece; firstBar is the number of this line's first bar.
export function renderLineSvg(line, { chordBars = [], firstBar = 0, withChords = false, label = '' } = {}) {
  const events = line.bars.flatMap((b) => b.events);
  const pitched = events.filter((e) => e.type !== 'rest');
  const maxPos = pitched.length ? Math.max(...pitched.map((e) => e.pos)) : 0;
  const minPos = pitched.length ? Math.min(...pitched.map((e) => e.pos)) : 0;
  const midPos = (maxPos + minPos) / 2;
  const baseline = (pos) => NOTE_TOP + CAP + (maxPos - pos) * STEP;
  const noteBottom = baseline(minPos);
  const chordY = noteBottom + 16 + CHORD_SIZE;
  const height = Math.round(withChords ? chordY + 12 : noteBottom + 22);

  const barW = (WIDTH - 2 * MARGIN) / Math.max(line.bars.length, MIN_BARS);
  line.bars.forEach((bar, k) => layoutBar(bar, MARGIN + k * barW, barW));
  const lineEnd = MARGIN + line.bars.length * barW;

  const ink = []; // stroked shapes
  const text = []; // digits, accidentals, labels

  for (let k = 0; k <= line.bars.length; k++) {
    ink.push(seg(MARGIN + k * barW, 8, MARGIN + k * barW, height - 6, 1.2));
  }

  // Digits, rest dashes and hold lines. Sets e.top (top of the digit area).
  events.forEach((e) => {
    if (e.type === 'note') {
      const y = baseline(e.pos);
      if (e.acc) {
        text.push(`<text x="${r(e.x - DIGIT_W / 2)}" y="${r(y - 4)}" class="acc" text-anchor="end">${accGlyph(e.acc)}</text>`);
      }
      text.push(`<text x="${r(e.x)}" y="${r(y)}" class="digit" text-anchor="middle"${e.i === undefined ? '' : ` data-i="${e.i}"`}>${e.degree}</text>`);
      if (e.dotted) ink.push(dot(e.x + DIGIT_W / 2 + 3.5, y - 2));
      e.top = y - CAP;
    } else if (e.type === 'rest') {
      const y = baseline(midPos) - CAP / 2;
      ink.push(seg(e.x - 6, y, e.x + 6, y, 2));
      if (e.dotted) ink.push(dot(e.x + 10, y));
      e.top = baseline(midPos) - CAP;
    } else {
      // Holds draw nothing in the digit row, only their rhythm mark (and dot).
      const y = baseline(e.pos);
      if (e.dotted) ink.push(dot(e.x + DIGIT_W / 2 + 3.5, y - 2));
      e.top = y - CAP;
    }
    e.stemBottom = e.top - STEM_GAP;
    e.stemTop = e.stemBottom - STEM_LEN;
  });

  // Stems, flags and beams. Beams join consecutive eighths/16ths written
  // together (same group) within a bar. Sets e.markTop (highest point of the mark).
  for (const bar of line.bars) {
    const evs = bar.events;
    let i = 0;
    while (i < evs.length) {
      const e = evs[i];
      let j = i + 1;
      if (e.flags > 0) {
        while (j < evs.length && evs[j].flags > 0 && evs[j].group === e.group) j++;
      }
      const run = evs.slice(i, j);
      if (run.length === 1) {
        ink.push(seg(e.x, e.stemBottom, e.x, e.stemTop));
        for (let f = 0; f < e.flags; f++) {
          const y = e.stemTop + f * 4.5;
          ink.push(seg(e.x, y, e.x + FLAG_W, y));
        }
        e.markTop = e.stemTop;
      } else {
        const beamY = Math.min(...run.map((x) => x.stemTop));
        for (const x of run) {
          ink.push(seg(x.x, x.stemBottom, x.x, beamY));
          x.markTop = beamY;
        }
        ink.push(beam(run[0].x, run[run.length - 1].x, beamY));
        let a = 0;
        while (a < run.length) {
          if (run[a].flags < 2) {
            a++;
            continue;
          }
          let b = a + 1;
          while (b < run.length && run[b].flags === 2) b++;
          const y = beamY + BEAM_GAP;
          if (b - a > 1) ink.push(beam(run[a].x, run[b - 1].x, y));
          else if (a === run.length - 1) ink.push(beam(run[a].x - FLAG_W, run[a].x, y));
          else ink.push(beam(run[a].x, run[a].x + FLAG_W, y));
          a = b;
        }
      }
      i = j;
    }
  }

  // Triplets: a "3" over the group, with a bracket unless a single beam
  // already shows which notes belong to it.
  const triplets = new Map();
  for (const e of events) {
    if (!e.triplet) continue;
    if (!triplets.has(e.triplet)) triplets.set(e.triplet, []);
    triplets.get(e.triplet).push(e);
  }
  for (const group of triplets.values()) {
    const first = group[0];
    const last = group[group.length - 1];
    const x = (first.x + last.x) / 2;
    const top = Math.min(...group.map((e) => e.markTop));
    const beamed = group.length > 1 && group.every((e) => e.flags > 0 && e.group === first.group);
    if (beamed) {
      text.push(`<text x="${r(x)}" y="${r(top - 4)}" class="triplet" text-anchor="middle">3</text>`);
    } else {
      const y = top - 8;
      const x1 = first.x - 4;
      const x2 = last.x + 4;
      ink.push(`<path d="M${r(x1)} ${r(y + 4)} V${r(y)} H${r(x - 7)} M${r(x + 7)} ${r(y)} H${r(x2)} V${r(y + 4)}" fill="none" stroke-width="1"/>`);
      text.push(`<text x="${r(x)}" y="${r(y + 4)}" class="triplet" text-anchor="middle">3</text>`);
    }
  }

  // Trills: a small wave above the rhythm mark.
  for (const e of events) {
    if (!e.trill) continue;
    const y = e.markTop - 7;
    ink.push(`<path d="M${r(e.x - 9)} ${r(y)} q2.25 -4 4.5 0 t4.5 0 t4.5 0 t4.5 0" fill="none" stroke-width="1.5"/>`);
  }

  // Ties: an arc below the digits. Ties crossing a line break get a half-arc
  // on each line.
  for (const e of events) {
    const t = e.tieTo;
    if (t) {
      const y = baseline(t.pos) + 5;
      const x1 = e.x + 3;
      ink.push(arc(x1, t.line === e.line ? t.x - 3 : lineEnd + 4, y));
    }
    if (e.tieFrom && e.tieFrom.line !== e.line) {
      ink.push(arc(MARGIN - 4, e.x - 3, baseline(e.pos) + 5));
    }
  }

  // Chords: under the event that starts on the chord's beat, or at the
  // matching fraction of the bar when no event starts there.
  line.bars.forEach((bar, k) => {
    const chords = chordBars[firstBar + k] || [];
    const dur = sum(bar.events.map((e) => e.duration));
    for (const c of chords) {
      const beat = c.beat ?? c.fraction * (dur || 4);
      const at = bar.events.find((e) => Math.abs(e.onset - beat) < 1e-6);
      const inner = bar.w - BAR_PAD_L - BAR_PAD_R;
      const x = at ? at.left : bar.x0 + BAR_PAD_L + Math.min(beat / Math.max(dur, 4), 0.9) * inner;
      text.push(chordSvg(x, chordY, c.symbol));
    }
  });

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${height}" width="${WIDTH}" height="${height}" role="img"${label ? ` aria-label="${esc(label)}"` : ''}>` +
    `<g stroke="${INK}" stroke-linecap="round">${ink.join('')}</g>` +
    `<g fill="${INK}">${text.join('')}</g>` +
    `</svg>`
  );
}

const PAGE_CSS = `
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
:root { --bg: #fff; --ink: #222; --muted: #444; --chord-ink: #8a8a8a; --accent: #d9480f; color-scheme: light; }
@media screen and (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bg: #141414; --ink: #e6e6e6; --muted: #b3b3b3; --chord-ink: #8c8c8c; --accent: #ff8a4c; color-scheme: dark; }
}
@media screen {
  :root[data-theme="dark"] { --bg: #141414; --ink: #e6e6e6; --muted: #b3b3b3; --chord-ink: #8c8c8c; --accent: #ff8a4c; color-scheme: dark; }
}
html { background: var(--bg); color: var(--ink); }
body { margin: 0; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; }
main { max-width: 900px; margin: 0 auto; padding: 40px 16px 48px; }
header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 4px 24px; margin: 0 0 36px; padding: 0 ${(MARGIN / WIDTH) * 100}%; }
h1 { font-size: 30px; font-weight: 700; margin: 0; }
.author { margin: 0 0 0 auto; font-size: 16px; color: var(--muted); }
.line { break-inside: avoid; page-break-inside: avoid; margin: 0 0 24px; }
.line.section { margin-top: 40px; }
.line svg { display: block; width: 100%; height: auto; color: var(--ink); }
.digit { font-size: ${DIGIT_SIZE}px; }
.acc { font-size: ${ACC_SIZE}px; }
.triplet { font-size: 12px; font-style: italic; }
.chord { font-size: ${CHORD_SIZE}px; fill: var(--chord-ink); }
.chord-ext { font-size: ${CHORD_EXT_SIZE}px; }
.theme-toggle { position: fixed; top: 12px; right: 12px; width: 34px; height: 34px; border: 1px solid var(--muted); border-radius: 50%; background: var(--bg); color: var(--ink); font-size: 17px; line-height: 1; cursor: pointer; opacity: 0.55; }
.theme-toggle:hover, .theme-toggle:focus-visible { opacity: 1; }
@media print { main { max-width: none; padding: 0; } .theme-toggle { display: none; } }
${PLAYER_CSS}`;

// Theme toggle. The saved choice is applied in <head> so a dark page doesn't
// flash white; without one, the page follows the system setting. Storage can
// be unavailable, so every access is guarded.
const THEME_KEY = 'earcharts-theme';
const THEME_HEAD_JS = `try { var t = localStorage.getItem('${THEME_KEY}'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}`;
const THEME_TOGGLE_JS = `
document.querySelector('.theme-toggle').addEventListener('click', function () {
  var root = document.documentElement;
  var dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('${THEME_KEY}', root.dataset.theme); } catch (e) {}
});`;

// Builds the full HTML page. The chords file's header, if any, replaces the
// melody file's header. root (a MIDI note number for degree 1) and tempo are
// the player's defaults.
export function renderPage({ melodyText, chordsText = null, fallbackTitle = '', root = 60, tempo = 100 }) {
  const melody = parseMelody(melodyText);
  const chords = chordsText == null ? null : parseChords(chordsText);
  const header = (chords && chords.header) || melody.header || { title: fallbackTitle, author: '' };
  const chordBars = chords ? chords.bars : [];
  const score = buildScore(melody, chordBars); // also numbers the notes for highlighting
  const scoreJson = JSON.stringify(score).replace(/</g, '\\u003c');

  let firstBar = 0;
  const lines = melody.lines.map((line, n) => {
    // Only lines that have at least one chord get a chord row.
    const withChords = line.bars.some((_, k) => (chordBars[firstBar + k] || []).length > 0);
    const svg = renderLineSvg(line, { chordBars, firstBar, withChords, label: `Line ${n + 1}` });
    firstBar += line.bars.length;
    return `<div class="line${line.sectionStart ? ' section' : ''}">${svg}</div>`;
  });

  const pageTitle = header.author ? `${header.title} – ${header.author}` : header.title;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle || 'Melody')}</title>
<style>${PAGE_CSS}</style>
<script>${THEME_HEAD_JS}</script>
</head>
<body>
<button class="theme-toggle" type="button" aria-label="Toggle dark theme" title="Toggle dark theme">◐</button>
<main>
<header>
${header.title ? `<h1>${esc(header.title)}</h1>` : ''}
${header.author ? `<p class="author">${esc(header.author)}</p>` : ''}
</header>
${lines.join('\n')}
</main>
${playerHtml({ root, tempo, hasChords: score.chords.length > 0 })}
<script>${THEME_TOGGLE_JS}</script>
<script>(${player})(${scoreJson}, ${JSON.stringify({ root, tempo })});</script>
</body>
</html>
`;
}
