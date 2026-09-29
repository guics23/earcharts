import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPage } from '../lib/render.js';

const count = (s, re) => (s.match(re) || []).length;

test('one SVG per line of music, title and author on top', () => {
  const html = renderPage({ melodyText: 'Song - Me\n| 1 2 | 3 4 |\n| 5 6 |' });
  assert.equal(count(html, /<svg /g), 2);
  assert.match(html, /<h1>Song<\/h1>/);
  assert.match(html, /<p class="author">Me<\/p>/);
  assert.match(html, /<title>Song – Me<\/title>/);
});

test('the chords header replaces the melody header', () => {
  const html = renderPage({ melodyText: 'Song - Me\n| 1 |', chordsText: 'Other\n| 1 |' });
  assert.match(html, /<h1>Other<\/h1>/);
  assert.doesNotMatch(html, /class="author"/);
});

test('fallback title when there is no header', () => {
  assert.match(renderPage({ melodyText: '| 1 |', fallbackTitle: 'tune' }), /<h1>tune<\/h1>/);
});

test('chords are drawn, prettified, and matched bar by bar across lines', () => {
  const html = renderPage({ melodyText: '| 1 | 2 |\n| 3 |', chordsText: '| 6- | 7-b5 | #4-7b5 | 9 |' });
  assert.equal(count(html, /class="chord"/g), 3); // the extra chord bar is ignored
  assert.match(html, />7-<tspan class="chord-ext" dy="-7">♭5<\/tspan>/);
  assert.match(html, />♯4-<tspan class="chord-ext" dy="-7">7♭5<\/tspan>/);
});

test('text is escaped', () => {
  const html = renderPage({ melodyText: 'A <b> & "c" - D\n| 1 |', chordsText: '| <x> |' });
  assert.match(html, /<h1>A &lt;b&gt; &amp; &quot;c&quot;<\/h1>/);
  assert.match(html, /&lt;x&gt;/);
});

test('beams, flags, stems', () => {
  const svg = (m) => renderPage({ melodyText: `| ${m} |` });
  assert.equal(count(svg("4'3'"), /<rect /g), 1); // one beam
  assert.equal(count(svg('6"5"4"3"'), /<rect /g), 2); // two beams
  assert.equal(count(svg("6·'5\""), /<rect /g), 2); // beam + 16th stub
  assert.equal(count(svg("4' 3'"), /<rect /g), 0); // separated: flags, no beam
});

test('empty input still renders a page', () => {
  const html = renderPage({ melodyText: '' });
  assert.match(html, /<!doctype html>/);
  assert.equal(count(html, /<svg /g), 0);
});

test('section starts get the section class', () => {
  const html = renderPage({ melodyText: '| 1 |\n\n| 2 |' });
  assert.equal(count(html, /<div class="line">/g), 1);
  assert.equal(count(html, /<div class="line section">/g), 1);
});

test('lines without chords get no chord row', () => {
  const heights = (html) => [...html.matchAll(/<svg [^>]*height="(\d+)"/g)].map((m) => +m[1]);
  const [withRow, withoutRow] = heights(renderPage({ melodyText: '| 1 |\n| 1 |', chordsText: '| 6- | |' }));
  assert.ok(withoutRow < withRow);
});

test('theme: toggle button, theme colors, light print', () => {
  const html = renderPage({ melodyText: '| 1 |', chordsText: '| 6- |' });
  assert.match(html, /<button class="theme-toggle"/);
  assert.match(html, /:root\[data-theme="dark"\]/);
  assert.match(html, /\.theme-toggle \{ display: none; \}/); // hidden when printing
  assert.doesNotMatch(html, /#222" stroke-linecap/); // SVG ink comes from the theme
});
