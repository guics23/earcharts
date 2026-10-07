import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMelody, parseChords, parseHeaderLine, resolvePos } from '../lib/parse.js';

// A title line first, so single-line inputs without "|" aren't read as the header.
const events = (text) => parseMelody(`Test\n${text}`).lines.flatMap((l) => l.bars.flatMap((b) => b.events));
const positions = (text) => events(text).filter((e) => e.type === 'note').map((e) => e.pos);

test('header: title and author', () => {
  assert.deepEqual(parseHeaderLine('Fly Me to the Moon - Bart Howard'), { title: 'Fly Me to the Moon', author: 'Bart Howard' });
  assert.deepEqual(parseHeaderLine('Just a title'), { title: 'Just a title', author: '' });
  assert.deepEqual(parseHeaderLine('Title-Author'), { title: 'Title', author: 'Author' });
});

test('header: hyphens in the title are kept when the separator is spaced', () => {
  assert.deepEqual(parseHeaderLine('Spider-Man - Paul Francis Webster'), { title: 'Spider-Man', author: 'Paul Francis Webster' });
  assert.deepEqual(parseHeaderLine('Spider-Man -'), { title: 'Spider-Man', author: '' });
});

test('header: only the first non-empty line, and only without "|"', () => {
  assert.deepEqual(parseMelody('\n\nSong - Me\n| 1 2 |').header, { title: 'Song', author: 'Me' });
  const noHeader = parseMelody('| 1 2 |\nnot a header');
  assert.equal(noHeader.header, null);
  assert.equal(noHeader.lines.length, 2);
});

test('direction: nearest note by default', () => {
  assert.deepEqual(positions('1 7 6 5 4'), [0, -1, -2, -3, -4]);
  assert.deepEqual(positions('1 2 3 4 5'), [0, 1, 2, 3, 4]);
  assert.deepEqual(positions('3 6'), [2, 5]); // up a 4th, not down a 5th
  assert.deepEqual(positions('6 3'), [5, 2]); // down a 4th
  assert.deepEqual(positions('1 1'), [0, 0]);
});

test('direction: accents, attached or standalone', () => {
  assert.deepEqual(positions('1 ´ 7'), [0, 6]);
  assert.deepEqual(positions('1 ´7'), [0, 6]);
  assert.deepEqual(positions('1 ` 2'), [0, -6]);
  assert.deepEqual(positions('1 ´1 `1'), [0, 7, 0]);
  assert.deepEqual(positions('1 ` 7'), [0, -1]); // matches the default
});

test('direction: doubled accents add octaves', () => {
  assert.deepEqual(positions('5 ´´ 3'), [4, 16]);
  assert.deepEqual(positions('1 ``1'), [0, -14]);
});

test('direction: accidentals are ignored, rests and holds are skipped', () => {
  assert.deepEqual(positions('6 ` #5'), [5, 4]);
  assert.deepEqual(positions('1 - = 7'), [0, -1]);
  assert.deepEqual(positions('1 ´ - 3'), [0, 2]); // the accent waits for the next note
  assert.equal(resolvePos(3, null, null), 2);
});

test('direction: carries across barlines and lines', () => {
  assert.deepEqual(positions('| 1 7 |\n| 6 5 |'), [0, -1, -2, -3]);
});

test('lengths: quarter, eighth, 16th, dotted', () => {
  const d = events('5 5\' 5" 5· 5·\' 5\'· 5"·').map((e) => e.duration);
  assert.deepEqual(d, [1, 0.5, 0.25, 1.5, 0.75, 0.75, 0.375]);
});

test('lengths: the last length mark wins', () => {
  assert.equal(events('5\'"')[0].duration, 0.25);
});

test('rests and holds', () => {
  const ev = events("3 = =' - -' -·");
  assert.deepEqual(ev.map((e) => e.type), ['note', 'hold', 'hold', 'rest', 'rest', 'rest']);
  assert.deepEqual(ev.map((e) => e.duration), [1, 1, 0.5, 1, 0.5, 1.5]);
  assert.equal(ev[1].note, ev[0]);
});

test('holds with no note are ignored', () => {
  assert.deepEqual(events('= 1').map((e) => e.type), ['note']);
  assert.deepEqual(events('1 - = 2').map((e) => e.type), ['note', 'rest', 'note']);
});

test('beaming: written together = same group', () => {
  const ev = events("4'3' 2'1' 7");
  assert.equal(ev[0].group, ev[1].group);
  assert.notEqual(ev[1].group, ev[2].group);
  assert.equal(ev[2].group, ev[3].group);
});

test('beaming: attached accents and ties keep the group, barlines break it', () => {
  const ev = events("4'´1' 3'3'_|3'");
  assert.equal(ev[0].group, ev[1].group);
  assert.equal(ev[2].group, ev[3].group);
  assert.notEqual(ev[3].group, ev[4].group);
});

test('beaming: a comma separates without breaking the group', () => {
  const ev = events("-'1,4' 2");
  assert.deepEqual(ev.map((e) => e.duration), [0.5, 1, 0.5, 1]);
  assert.equal(ev[0].group, ev[2].group);
  assert.notEqual(ev[2].group, ev[3].group);
});

test('ties: all spacing variants', () => {
  for (const t of ['4_ 4', '4 _4', '4 __ 4', '4_|4', '4 _|_ 4', '4_ | _4']) {
    const [a, b] = events(t);
    assert.equal(b.tieFrom, a, t);
    assert.equal(a.tieTo, b, t);
  }
});

test('ties: across lines', () => {
  const [a, b] = events('| 1 2 3_ |\n| 3 |').slice(2);
  assert.equal(b.tieFrom, a);
  assert.notEqual(a.line, b.line);
});

test('ties: different pitches, rests, or no following note are ignored', () => {
  assert.equal(events('4 _ 5')[1].tieFrom, undefined);
  assert.equal(events('4 _ ´4')[1].tieFrom, undefined); // an octave up
  assert.equal(events('4 _ #4')[1].tieFrom, undefined);
  assert.equal(events('4 _ - 4')[2].tieFrom, undefined);
  assert.equal(events('4_')[0].tieTo, undefined);
});

test('ties: after a hold, from the hold', () => {
  const ev = events('3 = _ 3');
  assert.equal(ev[2].tieFrom, ev[1]);
  assert.equal(ev[1].tieTo, ev[2]);
});

test('triplets', () => {
  const ev = events("(6'5'4') (6 5 4) 3");
  assert.deepEqual(ev.map((e) => Math.round(e.duration * 1000) / 1000), [0.333, 0.333, 0.333, 0.667, 0.667, 0.667, 1]);
  assert.equal(ev[0].triplet, ev[2].triplet);
  assert.notEqual(ev[0].triplet, ev[3].triplet);
  assert.equal(ev[6].triplet, 0);
});

test('triplets: nested parentheses are ignored', () => {
  const ev = events('((1 2) 3)');
  assert.equal(ev[0].triplet, ev[1].triplet);
  assert.equal(ev[2].triplet, 0);
});

test('trills and accidentals', () => {
  const [a, b] = events("5~ b7'~");
  assert.equal(a.trill, true);
  assert.equal(b.trill, true);
  assert.equal(b.acc, 'b');
  assert.equal(b.duration, 0.5);
});

test('onsets within a bar', () => {
  const bar = parseMelody("| 7· 6' 5 4'3' | 1 |").lines[0].bars[0];
  assert.deepEqual(bar.events.map((e) => e.onset), [0, 1.5, 2, 3, 3.5]);
});

test('bars: optional outer barlines, empty bars kept', () => {
  assert.equal(parseMelody('1 2 | 3 4').lines[0].bars.length, 2);
  assert.equal(parseMelody('| 1 2 | 3 4 |').lines[0].bars.length, 2);
  assert.equal(parseMelody('| 1 | | 2 |').lines[0].bars.length, 3);
});

test('unknown characters are ignored', () => {
  assert.deepEqual(events('| 1 x 8 0 ? 2 |').map((e) => e.degree), [1, 2]);
});

test('chords: bar by bar, line breaks ignored', () => {
  const { bars } = parseChords('| 6- | 2- |\n| 5D | 1 |');
  assert.deepEqual(bars.map((b) => b.map((c) => c.symbol)), [['6-'], ['2-'], ['5D'], ['1']]);
});

test('chords: spread evenly, or placed with dots', () => {
  const { bars } = parseChords('| 2- 5D | 2- . 5D . | 2- . . 5D | |');
  assert.deepEqual(bars[0], [{ symbol: '2-', fraction: 0 }, { symbol: '5D', fraction: 0.5 }]);
  assert.deepEqual(bars[1], [{ symbol: '2-', beat: 0 }, { symbol: '5D', beat: 2 }]);
  assert.deepEqual(bars[2], [{ symbol: '2-', beat: 0 }, { symbol: '5D', beat: 3 }]);
  assert.deepEqual(bars[3], []);
});

test('chords: header', () => {
  assert.deepEqual(parseChords('Other title\n| 1 |').header, { title: 'Other title', author: '' });
});

test('sections: blank lines between music lines', () => {
  const { lines } = parseMelody('Song\n\n| 1 |\n| 2 |\n\n\n| 3 |\n\n| 4 |');
  assert.deepEqual(lines.map((l) => l.sectionStart), [false, false, true, true]);
});
