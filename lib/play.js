// Playback: turns a parsed melody (and chords) into a list of timed pitches,
// and provides the small Web Audio player that renderPage embeds in each page.
// No Node-specific APIs, so this module also runs in a browser.

const SCALE = [0, 2, 4, 5, 7, 9, 11]; // major scale, in semitones above degree 1
const NOTE_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const LETTERS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const r4 = (n) => Math.round(n * 1e4) / 1e4;
const accShift = (acc) => (acc === '#' || acc === '♯' ? 1 : acc === 'b' || acc === '♭' ? -1 : 0);

// Semitones above degree 1 (of the first note's octave) for a position in
// scale steps, as produced by parseMelody.
export function semitones(pos, acc = null) {
  const oct = Math.floor(pos / 7);
  return 12 * oct + SCALE[pos - 7 * oct] + accShift(acc);
}

// "C4", "Bb3", "F#", "a2" → MIDI note number (C4 = 60). The octave defaults
// to 4. Returns null for anything else.
export function parseNoteName(s) {
  const m = String(s).trim().match(/^([A-Ga-g])([#b♯♭]?)(-?\d)?$/);
  if (!m) return null;
  const oct = m[3] === undefined ? 4 : +m[3];
  return 12 * (oct + 1) + LETTERS[m[1].toUpperCase()] + accShift(m[2]);
}

// Chord symbol → { root, tones }: root in semitones above degree 1 (0–11),
// tones as intervals above the root. Only the triad and 7th are played;
// other extensions are ignored. Returns null if the symbol has no degree.
export function chordTones(symbol) {
  const m = symbol.match(/^([#b♯♭]?)([1-7])(.*)$/);
  if (!m) return null;
  const q = m[3];
  let third = 4;
  let fifth = 7;
  let seventh = null;
  if (/^(-|m(?!aj))/.test(q)) third = 3;
  if (/^(o|°|dim)/.test(q)) [third, fifth, seventh] = [3, 6, /7/.test(q) ? 9 : null];
  if (/^ø/.test(q)) [third, fifth, seventh] = [3, 6, 10];
  if (/^(\+|aug)/.test(q)) fifth = 8;
  if (/sus4/.test(q)) third = 5;
  else if (/sus2/.test(q)) third = 2;
  if (/b5|♭5/.test(q)) fifth = 6;
  if (/#5|♯5/.test(q)) fifth = 8;
  if (/M|maj|Δ/.test(q)) seventh = 11;
  else if (seventh === null && /^D|7/.test(q)) seventh = 10;
  const tones = [0, third, fifth];
  if (seventh !== null) tones.push(seventh);
  else if (/6/.test(q)) tones.push(9);
  const root = (((SCALE[m[2] - 1] + accShift(m[1])) % 12) + 12) % 12;
  return { root, tones };
}

// Returns { length, notes, marks, chords }, with all times in beats:
//   notes:  what is played, { t, d, p, trill? }. p (and trill, the upper
//           neighbour) are semitones above degree 1. Holds and ties lengthen
//           the note instead of playing it again.
//   marks:  one per written note, { t, d } (d includes its holds), for
//           highlighting. Sets ev.i on each note event to its mark index.
//   chords: { t, d, root, tones }, each lasting until the next chord or the
//           end of its bar.
export function buildScore(melody, chordBars = []) {
  const notes = [];
  const marks = [];
  const chords = [];
  const soundOf = new Map();
  let t = 0;
  let barNo = 0;
  for (const line of melody.lines) {
    for (const bar of line.bars) {
      const start = t;
      for (const ev of bar.events) {
        if (ev.type === 'note') {
          ev.i = marks.length;
          marks.push({ t, d: ev.duration });
          const from = ev.tieFrom && (ev.tieFrom.type === 'note' ? ev.tieFrom : ev.tieFrom.note);
          let sound = from && soundOf.get(from);
          if (sound) {
            sound.d += ev.duration;
          } else {
            sound = { t, d: ev.duration, p: semitones(ev.pos, ev.acc) };
            if (ev.trill) sound.trill = semitones(ev.pos + 1);
            notes.push(sound);
          }
          soundOf.set(ev, sound);
        } else if (ev.type === 'hold') {
          marks[ev.note.i].d += ev.duration;
          soundOf.get(ev.note).d += ev.duration;
        }
        t += ev.duration;
      }
      const len = t - start;
      const starts = (chordBars[barNo++] || [])
        .map((c) => ({ at: c.beat ?? c.fraction * len, tones: chordTones(c.symbol) }))
        .filter((c) => c.tones && c.at < len - 1e-6);
      starts.forEach((c, k) => {
        const end = k + 1 < starts.length ? starts[k + 1].at : len;
        chords.push({ t: start + c.at, d: end - c.at, ...c.tones });
      });
    }
  }
  const round = (o) => ({ ...o, t: r4(o.t), d: r4(o.d) });
  return { length: r4(t), notes: notes.map(round), marks: marks.map(round), chords: chords.map(round) };
}

// Controls for the page. root is a MIDI note number.
export function playerHtml({ root, tempo, hasChords }) {
  const key = ((root % 12) + 12) % 12;
  const octave = Math.floor(root / 12) - 1;
  const keys = NOTE_NAMES.map((n, i) => `<option value="${i}"${i === key ? ' selected' : ''}>${n}</option>`).join('');
  const octaves = [1, 2, 3, 4, 5, 6]
    .map((o) => `<option value="${o}"${o === octave ? ' selected' : ''}>${o}</option>`)
    .join('');
  return `<div class="player" role="group" aria-label="Player">
<button class="play" type="button" aria-label="Play" title="Play (space). Click a note to play from there.">▶</button>
<label>1 = <select name="key" aria-label="Key">${keys}</select></label>
<select name="octave" aria-label="Octave">${octaves}</select>
<label><input name="tempo" type="number" min="30" max="300" step="5" value="${tempo}" aria-label="Tempo"> bpm</label>
${hasChords ? '<label><input name="melody" type="checkbox" checked> Melody</label>\n<label><input name="chords" type="checkbox" checked> Chords</label>' : ''}
</div>`;
}

export const PLAYER_CSS = `
.player { position: fixed; bottom: 14px; left: 50%; transform: translateX(-50%); display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px 14px; max-width: calc(100% - 32px); padding: 8px 16px; border: 1px solid var(--muted); border-radius: 22px; background: var(--bg); color: var(--ink); font-size: 14px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15); }
.player label { display: flex; align-items: center; gap: 5px; white-space: nowrap; }
.player select, .player input[type="number"] { font: inherit; color: inherit; background: var(--bg); border: 1px solid var(--muted); border-radius: 4px; padding: 2px 4px; }
.player input[type="number"] { width: 4.5em; }
.player .play { width: 30px; height: 30px; border: 1px solid var(--muted); border-radius: 50%; background: var(--bg); color: var(--ink); font-size: 13px; line-height: 1; cursor: pointer; }
.digit[data-i] { cursor: pointer; }
.digit.playing { fill: var(--accent); }
main { padding-bottom: 96px; }
@media print { .player { display: none; } main { padding-bottom: 0; } }
`;

// The in-page player, embedded as source by renderPage and called with the
// score and the default root/tempo. It must stay self-contained: it can't use
// anything else from this module.
export function player(score, defaults) {
  const bar = document.querySelector('.player');
  const btn = bar.querySelector('.play');
  const keySel = bar.querySelector('[name=key]');
  const octSel = bar.querySelector('[name=octave]');
  const tempoIn = bar.querySelector('[name=tempo]');
  const melodyBox = bar.querySelector('[name=melody]'); // melody and chords boxes only exist with chords
  const chordsBox = bar.querySelector('[name=chords]');
  const digits = [];
  document.querySelectorAll('.digit[data-i]').forEach((el) => (digits[+el.dataset.i] = el));

  // The viewer's last choice is remembered per page, unless the page has
  // since been re-rendered with different defaults.
  const storeKey = 'earcharts-player:' + location.pathname;
  const same = (a, b) => a && b && a.root === b.root && a.tempo === b.tempo;
  try {
    const saved = JSON.parse(localStorage.getItem(storeKey));
    if (saved && same(saved.defaults, defaults)) {
      keySel.value = saved.root % 12;
      octSel.value = Math.floor(saved.root / 12) - 1;
      tempoIn.value = saved.tempo;
      if (chordsBox) chordsBox.checked = saved.chords;
      if (melodyBox) melodyBox.checked = saved.melody !== false;
    }
  } catch (e) {}
  const settings = () => ({
    root: 12 * (+octSel.value + 1) + +keySel.value,
    tempo: Math.min(300, Math.max(30, +tempoIn.value || defaults.tempo)),
    chords: chordsBox ? chordsBox.checked : false,
    melody: melodyBox ? melodyBox.checked : true,
  });
  const save = () => {
    try {
      localStorage.setItem(storeKey, JSON.stringify({ ...settings(), defaults }));
    } catch (e) {}
  };

  let ctx = null;
  let run = null; // { master, t0, from, spb, frame, lit }

  const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  function voice(out, midi, t0, t1, type, level) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq(midi);
    const end = Math.max(t1 - 0.03, t0 + 0.04); // a small gap re-articulates repeated notes
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(level, t0 + 0.01);
    env.gain.setTargetAtTime(level * 0.6, t0 + 0.01, 0.2);
    env.gain.setTargetAtTime(0, end, 0.02);
    osc.connect(env).connect(out);
    osc.start(t0);
    osc.stop(end + 0.2);
  }

  function light(i, on) {
    if (digits[i]) digits[i].classList.toggle('playing', on);
  }

  function stop() {
    if (!run) return;
    const { master, frame, lit } = run;
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
    setTimeout(() => master.disconnect(), 200);
    cancelAnimationFrame(frame);
    lit.forEach((i) => light(i, false));
    run = null;
    btn.textContent = '▶';
    btn.setAttribute('aria-label', 'Play');
  }

  function play(from) {
    stop();
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume();
    const s = settings();
    const spb = 60 / s.tempo;
    const t0 = ctx.currentTime + 0.08;
    const at = (beat) => t0 + (beat - from) * spb;
    const master = ctx.createGain();
    master.connect(ctx.destination);

    // With the melody off the notes are still highlighted, to sing along to.
    for (const n of s.melody ? score.notes : []) {
      if (n.t + n.d <= from + 1e-6) continue;
      const start = Math.max(n.t, from);
      const end = n.t + n.d;
      if (n.trill === undefined) {
        voice(master, s.root + n.p, at(start), at(end), 'triangle', 0.3);
      } else {
        const step = Math.max(0.07, spb / 8);
        let k = 0;
        for (let x = at(start); x < at(end) - 0.02; x += step, k++) {
          voice(master, s.root + (k % 2 ? n.trill : n.p), x, Math.min(x + step + 0.03, at(end)), 'triangle', 0.3);
        }
      }
    }
    if (s.chords) {
      for (const c of score.chords) {
        if (c.t + c.d <= from + 1e-6) continue;
        // Chord roots sit between a 4th and an octave-and-a-half below degree 1.
        // They're a little louder when they play alone.
        const base = s.root - 12 + c.root - (c.root >= 6 ? 12 : 0);
        for (const tone of c.tones) {
          voice(master, base + tone, at(Math.max(c.t, from)), at(c.t + c.d), 'sine', s.melody ? 0.07 : 0.1);
        }
      }
    }

    run = { master, t0, from, spb, frame: 0, lit: new Set() };
    btn.textContent = '■';
    btn.setAttribute('aria-label', 'Stop');
    const self = run;
    const tick = () => {
      if (run !== self) return;
      const beat = from + (ctx.currentTime - t0) / spb;
      if (beat >= score.length) return stop();
      score.marks.forEach((m, i) => {
        const on = beat >= m.t && beat < m.t + m.d;
        if (on === run.lit.has(i)) return;
        light(i, on);
        if (on) {
          run.lit.add(i);
          const box = digits[i] && digits[i].getBoundingClientRect();
          if (box && (box.top < 0 || box.bottom > innerHeight - 90)) {
            digits[i].scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        } else {
          run.lit.delete(i);
        }
      });
      run.frame = requestAnimationFrame(tick);
    };
    run.frame = requestAnimationFrame(tick);
  }

  const position = () => (run ? run.from + Math.max(0, (ctx.currentTime - run.t0) / run.spb) : 0);

  btn.addEventListener('click', () => (run ? stop() : play(0)));
  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('.digit[data-i]');
    if (el) play(score.marks[+el.dataset.i].t);
  });
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.target.closest('input, select, button, textarea')) return;
    e.preventDefault();
    run ? stop() : play(0);
  });
  // Changing a setting while playing carries on from the same place.
  [keySel, octSel, tempoIn, melodyBox, chordsBox].forEach((el) => {
    if (!el) return;
    el.addEventListener('change', () => {
      save();
      if (run) play(position());
    });
  });
}
