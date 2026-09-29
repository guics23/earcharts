#!/usr/bin/env node
// Usage: earcharts melody.txt [chords.txt] [--root C4] [--tempo 100]
// Writes melody.html next to the melody file. --root is the pitch of degree 1
// and --tempo the beats per minute; both are only the player's defaults.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderPage } from './lib/render.js';
import { parseNoteName } from './lib/play.js';

const USAGE = 'Usage: earcharts melody.txt [chords.txt] [--root C4] [--tempo 100]';
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

const files = [];
const opts = { root: 'C4', tempo: '100' };
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const m = args[i].match(/^--(root|tempo)(?:=(.*))?$/);
  if (m) opts[m[1]] = m[2] ?? args[++i];
  else if (args[i].startsWith('--')) fail(USAGE);
  else files.push(args[i]);
}
const [melodyPath, chordsPath] = files;
if (!melodyPath || files.length > 2) fail(USAGE);
const root = parseNoteName(opts.root ?? '');
if (root === null) fail(`--root: expected a note name like C4, Bb3 or F#, got "${opts.root}"`);
const tempo = Number(opts.tempo);
if (!(tempo >= 30 && tempo <= 300)) fail(`--tempo: expected a number from 30 to 300, got "${opts.tempo}"`);

const name = path.basename(melodyPath, path.extname(melodyPath));
const html = renderPage({
  melodyText: readFileSync(melodyPath, 'utf8'),
  chordsText: chordsPath ? readFileSync(chordsPath, 'utf8') : null,
  fallbackTitle: name,
  root,
  tempo,
});

const outPath = path.join(path.dirname(melodyPath), `${name}.html`);
writeFileSync(outPath, html);
console.log(`Wrote ${outPath}`);
