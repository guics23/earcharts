import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMelody, parseChords } from '../lib/parse.js';
import { semitones, parseNoteName, chordTones, buildScore } from '../lib/play.js';

const score = (melody, chords) => buildScore(parseMelody(`Test\n${melody}`), chords ? parseChords(chords).bars : []);

test('semitones: major scale, octaves, accidentals', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map((p) => semitones(p)), [0, 2, 4, 5, 7, 9, 11, 12]);
  assert.equal(semitones(-1), -1); // 7 below
  assert.equal(semitones(-7), -12);
  assert.equal(semitones(4, '#'), 8);
  assert.equal(semitones(6, 'b'), 10);
});

test('note names', () => {
  assert.equal(parseNoteName('C4'), 60);
  assert.equal(parseNoteName('A4'), 69);
  assert.equal(parseNoteName('Bb3'), 58);
  assert.equal(parseNoteName('f#'), 66);
  assert.equal(parseNoteName('H2'), null);
});

test('chord tones', () => {
  assert.deepEqual(chordTones('1'), { root: 0, tones: [0, 4, 7] });
  assert.deepEqual(chordTones('6-'), { root: 9, tones: [0, 3, 7] });
  assert.deepEqual(chordTones('5D'), { root: 7, tones: [0, 4, 7, 10] });
  assert.deepEqual(chordTones('7-b5'), { root: 11, tones: [0, 3, 6] });
  assert.deepEqual(chordTones('#4-7b5'), { root: 6, tones: [0, 3, 6, 10] });
  assert.deepEqual(chordTones('b7'), { root: 10, tones: [0, 4, 7] });
  assert.deepEqual(chordTones('4M7'), { root: 5, tones: [0, 4, 7, 11] });
  assert.deepEqual(chordTones('2-7'), { root: 2, tones: [0, 3, 7, 10] });
  assert.equal(chordTones('.'), null);
});

test('notes: pitch and timing, rests leave gaps', () => {
  const { notes, length } = score("| 1 7' `6' - #5 |");
  assert.deepEqual(notes, [
    { t: 0, d: 1, p: 0 },
    { t: 1, d: 0.5, p: -1 },
    { t: 1.5, d: 0.5, p: -3 },
    { t: 3, d: 1, p: -4 },
  ]);
  assert.equal(length, 4);
});

test('holds and ties lengthen the note; each written note keeps its own mark', () => {
  const { notes, marks } = score('| 3 = = | _3 2 |');
  assert.deepEqual(notes, [
    { t: 0, d: 4, p: 4 },
    { t: 4, d: 1, p: 2 },
  ]);
  assert.deepEqual(marks, [
    { t: 0, d: 3 },
    { t: 3, d: 1 },
    { t: 4, d: 1 },
  ]);
});

test('triplets and trills', () => {
  const { notes } = score("| (3'2'1') 5~ |");
  assert.deepEqual(notes.map((n) => n.t), [0, 0.3333, 0.6667, 1]);
  assert.deepEqual([notes[3].p, notes[3].trill], [-5, -3]); // 5 below 1, trilling with the 6 above it
});

test('chords: evenly spread, dotted beats, bar ends and pickups', () => {
  const { chords } = score('| 1 | 1 2 3 4 | 1 2 3 4 |', '| | 2- 5D | 1 . . 6- |');
  assert.deepEqual(
    chords.map(({ t, d, root }) => ({ t, d, root })),
    [
      { t: 1, d: 2, root: 2 },
      { t: 3, d: 2, root: 7 },
      { t: 5, d: 3, root: 0 },
      { t: 8, d: 1, root: 9 },
    ],
  );
});

test('note events are numbered in order', () => {
  const melody = parseMelody('Test\n| 1 - 2 = |\n| 3 |');
  buildScore(melody);
  const nums = melody.lines.flatMap((l) => l.bars.flatMap((b) => b.events)).map((e) => e.i);
  assert.deepEqual(nums, [0, undefined, 1, undefined, 2]);
});
