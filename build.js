#!/usr/bin/env node
// Re-renders every melody in charts/ and examples/, each with its
// -chords.txt file if there is one. Run it after changing the renderer.

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPage } from './lib/render.js';

const here = path.dirname(fileURLToPath(import.meta.url));
for (const dir of ['charts', 'examples']) {
  const full = path.join(here, dir);
  if (!existsSync(full)) continue;
  for (const file of readdirSync(full)) {
    if (!file.endsWith('.txt') || file.endsWith('-chords.txt')) continue;
    const name = file.slice(0, -4);
    const chordsPath = path.join(full, `${name}-chords.txt`);
    const html = renderPage({
      melodyText: readFileSync(path.join(full, file), 'utf8'),
      chordsText: existsSync(chordsPath) ? readFileSync(chordsPath, 'utf8') : null,
      fallbackTitle: name,
    });
    writeFileSync(path.join(full, `${name}.html`), html);
    console.log(`Wrote ${path.join(dir, `${name}.html`)}`);
  }
}
