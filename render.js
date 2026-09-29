#!/usr/bin/env node
// Usage: earcharts melody.txt [chords.txt]
// Writes melody.html next to the melody file.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderPage } from './lib/render.js';

const [melodyPath, chordsPath] = process.argv.slice(2);
if (!melodyPath) {
  console.error('Usage: earcharts melody.txt [chords.txt]');
  process.exit(1);
}

const name = path.basename(melodyPath, path.extname(melodyPath));
const html = renderPage({
  melodyText: readFileSync(melodyPath, 'utf8'),
  chordsText: chordsPath ? readFileSync(chordsPath, 'utf8') : null,
  fallbackTitle: name,
});

const outPath = path.join(path.dirname(melodyPath), `${name}.html`);
writeFileSync(outPath, html);
console.log(`Wrote ${outPath}`);
