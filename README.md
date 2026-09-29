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
| `render.js` | Command-line wrapper |

The modules in `lib/` don't use any Node-specific APIs, so they can also run
in a browser (e.g. for a live editor page later).

## Tests

```
npm test
```
