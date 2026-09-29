// Parsers for the melody and chords text formats described in SPEC.md.
// No Node-specific APIs, so this module also runs in a browser.

const UP = new Set(['´', 'ˊ']);
const DOWN = new Set(['`', 'ˋ']);
const SHARP = new Set(['#', '♯']);
const FLAT = new Set(['b', '♭']);
const DOT = '·';

const isDegree = (c) => typeof c === 'string' && c >= '1' && c <= '7';
const isSpace = (c) => /\s/.test(c);

// "Title - Author". The separator is the last "-" preceded by whitespace,
// or the last "-" if there is no spaced one.
export function parseHeaderLine(line) {
  const s = line.trim();
  const m = s.match(/^(.*)\s-(.*)$/) || s.match(/^(.*)-(.*)$/);
  if (!m) return { title: s, author: '' };
  return { title: m[1].trim(), author: m[2].trim() };
}

// The first non-empty line is a header if it contains no "|".
export function splitHeader(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const i = lines.findIndex((l) => l.trim() !== '');
  if (i === -1 || lines[i].includes('|')) return { header: null, lines };
  return { header: parseHeaderLine(lines[i]), lines: lines.slice(i + 1) };
}

// Splits a line into bar segments. A "|" at the start or end of the line is optional.
export function splitBars(line) {
  const parts = line.split('|');
  if (parts.length > 1 && !parts[0].trim()) parts.shift();
  if (parts.length > 1 && !parts[parts.length - 1].trim()) parts.pop();
  return parts;
}

// Position in scale steps (degree 1 of the first note's octave = 0) of the
// next note, given the previous position and any direction accents.
export function resolvePos(degree, prevPos, accents) {
  const d = degree - 1;
  if (prevPos === null) return d;
  const prevDeg = ((prevPos % 7) + 7) % 7;
  const up = (d - prevDeg + 7) % 7;
  if (!accents) return prevPos + (up <= 3 ? up : up - 7);
  const extra = 7 * (accents.count - 1);
  if (accents.dir > 0) return prevPos + (up === 0 ? 7 : up) + extra;
  const down = (7 - up) % 7;
  return prevPos - (down === 0 ? 7 : down) - extra;
}

export function duration(ev) {
  const base = ev.flags === 2 ? 0.25 : ev.flags === 1 ? 0.5 : 1;
  return base * (ev.dotted ? 1.5 : 1) * (ev.triplet ? 2 / 3 : 1);
}

// Returns { header, lines: [{ bars: [{ events: [...] }], sectionStart }] }.
// Events are notes, rests and holds:
//   note: { type, degree, acc, pos, flags, dotted, trill, tieFrom?, tieTo? }
//   rest: { type, flags, dotted }
//   hold: { type, note, pos, flags, dotted, tieTo? }
// Every event also has group (beam group id), triplet (id or 0), line,
// onset (beats from the start of its bar) and duration.
export function parseMelody(text) {
  const { header, lines } = splitHeader(text);
  const st = {
    prevPos: null,
    accents: null,
    lastNote: null, // the note currently sounding; null after a rest
    lastChain: null, // last event of that note's chain (the note or one of its holds)
    tie: null,
    group: 0,
    triplet: 0,
    tripletCount: 0,
    line: 0,
  };
  const out = [];
  let blank = false;
  for (const raw of lines) {
    if (!raw.trim()) {
      blank = true;
      continue;
    }
    const bars = splitBars(raw).map((seg) => ({ events: parseBar(seg, st) }));
    // Blank lines between music lines start a new section.
    out.push({ bars, sectionStart: blank && out.length > 0 });
    blank = false;
    st.triplet = 0;
    st.line++;
  }
  return { header, lines: out };
}

function parseBar(seg, st) {
  const chars = [...seg];
  const events = [];
  let onset = 0;
  st.group++;
  let i = 0;
  while (i < chars.length) {
    const c = chars[i];
    let ev;
    if (isSpace(c)) {
      st.group++;
      i++;
      continue;
    }
    if (UP.has(c) || DOWN.has(c)) {
      addAccent(st, UP.has(c) ? 1 : -1);
      i++;
      continue;
    }
    if (c === '_') {
      startTie(st);
      i++;
      continue;
    }
    if (c === '(') {
      if (!st.triplet) st.triplet = ++st.tripletCount;
      i++;
      continue;
    }
    if (c === ')') {
      st.triplet = 0;
      i++;
      continue;
    }
    if ((SHARP.has(c) || FLAT.has(c)) && isDegree(chars[i + 1])) {
      ev = note(+chars[i + 1], SHARP.has(c) ? '#' : 'b', st);
      i += 2;
    } else if (isDegree(c)) {
      ev = note(+c, null, st);
      i++;
    } else if (c === '-') {
      ev = rest(st);
      i++;
    } else if (c === '=') {
      ev = hold(st); // null when there is no note to hold
      i++;
    } else {
      i++;
      continue;
    }
    i = readMarks(chars, i, ev, st);
    if (!ev) continue;
    ev.duration = duration(ev);
    ev.onset = onset;
    onset += ev.duration;
    events.push(ev);
  }
  return events;
}

function base(st) {
  return { flags: 0, dotted: false, trill: false, group: st.group, triplet: st.triplet, line: st.line };
}

function addAccent(st, dir) {
  if (st.accents && st.accents.dir === dir) st.accents.count++;
  else st.accents = { dir, count: 1 };
}

function note(degree, acc, st) {
  const pos = resolvePos(degree, st.prevPos, st.accents);
  st.prevPos = pos;
  st.accents = null;
  const ev = { type: 'note', degree, acc, pos, ...base(st) };
  if (st.tie && st.tie.note.pos === pos && st.tie.note.acc === acc) {
    ev.tieFrom = st.tie.from;
    st.tie.from.tieTo = ev;
  }
  st.tie = null;
  st.lastNote = ev;
  st.lastChain = ev;
  return ev;
}

function rest(st) {
  st.tie = null;
  st.lastNote = null;
  st.lastChain = null;
  return { type: 'rest', ...base(st) };
}

function hold(st) {
  if (!st.lastNote) return null;
  const ev = { type: 'hold', note: st.lastNote, pos: st.lastNote.pos, ...base(st) };
  st.lastChain = ev;
  if (st.tie) st.tie.from = ev;
  return ev;
}

function startTie(st) {
  if (st.lastNote) st.tie = { note: st.lastNote, from: st.lastChain };
}

// Marks directly after a note, rest or hold. ev may be null (an ignored
// hold), in which case the marks are consumed and dropped.
function readMarks(chars, i, ev, st) {
  for (; i < chars.length; i++) {
    const c = chars[i];
    if (c === "'") {
      if (ev) ev.flags = 1;
    } else if (c === '"') {
      if (ev) ev.flags = 2;
    } else if (c === DOT) {
      if (ev) ev.dotted = true;
    } else if (c === '~') {
      if (ev && ev.type === 'note') ev.trill = true;
    } else if (c === '_') {
      startTie(st);
    } else {
      break;
    }
  }
  return i;
}

// Returns { header, bars: [[{ symbol, beat } | { symbol, fraction }]] }.
// Line breaks don't matter: bars are numbered through the whole file.
export function parseChords(text) {
  const { header, lines } = splitHeader(text);
  const bars = [];
  for (const raw of lines) {
    if (!raw.trim()) continue;
    for (const seg of splitBars(raw)) bars.push(parseChordBar(seg));
  }
  return { header, bars };
}

function parseChordBar(seg) {
  const tokens = seg.trim().split(/\s+/).filter(Boolean);
  // With "." placeholders every token takes one beat; otherwise chords are spread evenly.
  if (tokens.includes('.')) {
    return tokens.flatMap((symbol, beat) => (symbol === '.' ? [] : [{ symbol, beat }]));
  }
  return tokens.map((symbol, i) => ({ symbol, fraction: i / tokens.length }));
}
