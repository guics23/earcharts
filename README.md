# EarCharts

Turns melodies written as scale degrees (1–7) in a plain text file, plus an
optional chords file, into a printable HTML page. The format is described in
[SPEC.md](SPEC.md).

## Usage

```
node render.js melody.txt [chords.txt]
```

This writes `melody.html` next to the melody file. Open it in a browser and
print it, or save it as a PDF.

## Playing a chart

Each page has a small player at the bottom (it isn't printed), for checking a
transcription by ear:

- ▶ (or the space bar) plays from the start. Click any note to play from there.
- **1 =** sets the pitch of degree 1, and the tempo is in beats per minute.
  Minor tunes are written in their relative major (Summertime's `6-`), so for
  a tune in A minor, set 1 = C.
- **Melody** and **Chords** switch each part on or off. They only appear
  when there's a chords file. With the melody off, the notes are still
  highlighted, so you can practise singing the melody over the chords.
- The note being played is highlighted, and the page scrolls to follow it.

The page remembers your settings. The defaults can be set when rendering:

```
node render.js melody.txt [chords.txt] --root Bb3 --tempo 90
```

The defaults are C4 and 100 bpm.

## Re-rendering everything

```
npm run build
```

This re-renders every melody in `charts/` and `examples/` (each with its
`-chords.txt` file, if there is one) with the default root and tempo. Run it
after changing the renderer. The HTML in `charts/` is build output and is not
committed.

To use a bare `earcharts` command, run `npm link` in this folder once.

## Example

```
node render.js examples/fly-me-to-the-moon.txt examples/fly-me-to-the-moon-chords.txt
```

`examples/features.txt` (with `features-chords.txt`) uses every part of the
syntax, which is useful for checking changes to the renderer.

## Charts

Your own charts live in `charts/`: a `.txt` melody file, an optional
`-chords.txt` file, and the generated `.html` page, e.g.

```
node render.js charts/summertime.txt charts/summertime-chords.txt
```

## Code

| File | Purpose |
|---|---|
| `lib/parse.js` | Parses the melody and chords files |
| `lib/render.js` | Lays out and draws each line as SVG, and builds the HTML page |
| `lib/play.js` | Turns the melody and chords into timed pitches, plus the in-page player |
| `render.js` | Command-line wrapper |
| `build.js` | Re-renders all charts and examples |

The modules in `lib/` don't use any Node-specific APIs, so they can also run
in a browser (e.g. for a live editor page later).

## Tests

```
npm test
```
