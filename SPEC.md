# EarCharts — Text Format Specification

A plain-text format for writing melodies as scale degrees (1–7), with an
optional separate chords file. A script reads both files and renders them as
a printable HTML page.

The format is designed for **ear training**, not for exact conversion to
standard notation:

- Rhythm is approximate and usually simplified (quarter notes whenever
  possible).
- Nothing is validated. Anything that doesn't make sense is silently ignored,
  and mistakes are meant to be spotted in the visualization.
- Pitch direction is shown by vertical position only.

All files are UTF-8 (the format uses `·` and `´`).

---

## 1. Header line (both files)

The first non-empty line of a file is a header if it contains no `|`:

```
Title - Author
```

- Title and author are separated by `-`, and surrounding spaces are trimmed.
- The separator is the last `-` with a space before it. If there's none, it's
  the last `-`. So `Spider-Man - Paul Francis Webster` keeps the hyphen in
  the title.
- A hyphenated title with no author needs a trailing ` -`: `Spider-Man -`.
- The author is optional. A line with no `-` is just a title.
- If both files have a header, the chords file's header wins: the whole line
  replaces the melody's.
- If the first non-empty line contains a `|`, the file has no header.

---

## 2. Melody file

### 2.1 Layout

- `|` separates bars. A `|` at the start or end of a line is optional.
- Each line of the file becomes one line of music in the output.
- A blank line between two music lines starts a new **section**. The output
  adds extra space above the next line, which is handy for showing the form
  (A B A). Several blank lines in a row count as one section break, and blank
  lines before the first music line are ignored.
- Spaces and tabs only matter for beaming (§2.7) and for attaching direction
  accents (§2.3). Otherwise they can be used freely.

### 2.2 Notes

A note is written as:

```
[direction] [accidental] degree [marks]
```

| Part | Syntax | Meaning |
|---|---|---|
| Degree | `1` `2` `3` `4` `5` `6` `7` | Scale degree; 1 is the tonic |
| Accidental | `#` or `b` before the degree | Sharp or flat (`#5`, `b7`) |
| Direction | `` ` `` or `´` before the note | See §2.3 |
| Marks | after the degree, in any order | Length, dot, tie, trill (§2.4–§2.10) |

### 2.3 Direction (pitch)

Each note's pitch is worked out relative to the previous **note**. Rests and
holds are skipped when finding the previous note, and barlines and line breaks
don't interrupt the chain.

| Written | Meaning |
|---|---|
| no accent | The **nearest** note with that degree: 0–3 scale steps up or down. With 7 degrees there is never a tie. |
| `´` | Go **up** to the nearest note with that degree (1–7 steps; the same degree means an octave up) |
| `` ` `` | Go **down** to the nearest note with that degree (1–7 steps; the same degree means an octave down) |
| `´´` / ` `` ` | As above, plus one extra octave (each extra accent adds one more octave) |

- Accidentals don't affect direction. Distances are counted in scale steps, so
  `` 6 ` #5 `` is one step down.
- An accent can be attached to the note (`` `7 ``) or stand alone before it
  (`` 1 ` 7 ``). Either way it applies to the **next** note.
- An accent that matches the default (e.g. `` 1 ` 7 ``) is allowed.
- The first note in the file is the reference point. Its absolute octave
  doesn't matter.

Example: `` 1 7 6 ´ 3 `` → 1, down to 7, down to 6, then up a 5th to 3.

### 2.4 Note lengths

| Written | Length |
|---|---|
| `5` | Quarter note (default) |
| `5'` | Eighth note |
| `5"` | 16th note |
| `5·` | Dotted quarter (length × 1.5) |
| `5·'` or `5'·` | Dotted eighth |
| `5·"` or `5"·` | Dotted 16th |

Half and whole notes don't exist. Use holds (§2.6) or rests (§2.5). If a note
has both `'` and `"`, only the last one counts.

### 2.5 Rests

| Written | Length |
|---|---|
| `-` | Quarter rest |
| `-'` | Eighth rest |
| `-"` | 16th rest |
| `-·`, `-·'`, … | Dotted versions |

### 2.6 Holds

`=` extends the previous note without re-attacking it.

| Written | Extends by |
|---|---|
| `=` | A quarter |
| `='` | An eighth |
| `="` | A 16th |
| `=·`, … | Dotted versions |

`3 = = =` is a 3 lasting four beats. A hold that doesn't follow a note (at the
start of the file, or right after a rest) is ignored.

### 2.7 Beaming

Elements written **together, with no whitespace between them**, form a beam
group:

```
4'3'        two beamed eighths
6"5"4"3"    four beamed 16ths
6·'5"       beamed dotted eighth + 16th
7· 6' 5     no beams (separated by spaces)
```

- Consecutive eighth- and 16th-length elements in a group share a beam.
  Consecutive 16ths also share a second beam.
- Rests and holds can be part of a beam group (`4'-'3'`).
- A quarter-length element inside a group is drawn normally and breaks the beam.
- Whitespace always ends a beam group. To keep a beam through a direction
  change, attach the accent to the note: `4'´1'`.
- A tie mark doesn't break a beam group (`4'3'_` is still one group).

No beat counting is involved. What you group is what gets beamed.

### 2.8 Ties

`_` ties a note to the next note, which must be the **same pitch**. A tie is
**not** a slur.

- The `_` can be attached to either note or stand alone, with any spacing.
- Several `_` in a row count as a single tie, even with a barline or line break
  between them.

These are all the same tie:

```
4_ 4      4 _4      4 __ 4      4_|4      4 _|_ 4      4_ | _4
```

- A tie can cross a barline or a line break.
- A tie after a held note connects that note to the next one: `3 = _ 3`.
- A tie between different pitches, or with no following note, is ignored.

### 2.9 Triplets

Parentheses group a triplet: three notes in the time of two of their written
length.

```
(6'5'4')    eighth-note triplet: one beat
(6 5 4)     quarter-note triplet: two beats
```

Inside the parentheses, the normal rules apply (beaming by grouping,
direction, ties). Nested parentheses are ignored.

### 2.10 Trills

`~` after a note marks a trill: `5~`, `5'~`. It stands in for fast
alternations that would otherwise need finer subdivisions.

### 2.11 Summary

| Syntax | Meaning |
|---|---|
| `1`–`7` | Scale degree |
| `#` / `b` | Sharp / flat |
| `` ` `` / `´` (doubled for more than an octave) | Down / up; optional (the default is the nearest note) |
| `5` `5'` `5"` | Quarter, eighth, 16th |
| `·` | Dotted |
| `-` `-'` `-"` | Quarter, eighth, 16th rest |
| `=` `='` `="` | Hold previous note for a quarter, eighth, 16th |
| `4'3'` (no space) | Beamed |
| `( … )` | Triplet |
| `_` (any spacing, repeats collapse) | Tie (same pitch only) |
| `~` | Trill |
| `\|` | Barline |
| new line | New line of music |

---

## 3. Chords file (optional)

A separate file with the same bar structure as the melody. It is merged with
the melody **bar by bar**, in order.

### 3.1 Layout

- The file can start with a header line (§1).
- `|` separates bars, as in the melody file.
- Line breaks in the chords file are ignored when merging. Bar numbering runs
  through the whole file, and the output's lines come from the melody file.
- If the chords file has fewer bars than the melody, the remaining bars get no
  chords. Extra chord bars are ignored.
- An empty bar (`| |`) means no chord in that bar.

### 3.2 Chord symbols

Chord symbols are whitespace-separated tokens, written in the same
scale-degree notation as the melody:

| Example | Meaning |
|---|---|
| `1` | Major chord on degree 1 |
| `6-` | Minor |
| `5D` | Dominant 7th |
| `7-b5` | Half-diminished |
| `b7`, `#4-7b5` | Chords with an altered root |

Symbols are displayed as written. The renderer may prettify them (`b` → ♭,
`#` → ♯, extensions like `b5` in superscript).

### 3.3 Several chords in one bar

- **No `.` in the bar:** the chords are spread evenly across the bar.
  `| 2- 5D |` puts 2- on beat 1 and 5D on beat 3.
- **With `.`:** every token (chord or `.`) takes one beat, so the dots
  position the chords. `| 2- . 5D . |` puts 5D on beat 3, and `| 2- . . 5D |`
  puts it on beat 4.

A chord is placed below the melody element that starts on its beat. If the
melody bar's lengths don't line up with that beat, the chord is placed at the
matching fraction of the bar's width instead.

---

## 4. Output

### 4.1 Script

```
earcharts melody.txt [chords.txt]
```

This writes `melody.html` next to the melody file.

### 4.2 Page

The output is a single self-contained HTML file that works offline with no
external files, and is meant to be printed.

- The title and author appear at the top.
- Each line of music is its own SVG, so page breaks fall between lines and
  never cut through one.
- The print stylesheet uses a white background, sensible margins, and no
  on-screen-only elements.
- On screen, a small button in the top-right corner switches between a light
  and a dark theme (light ink on a dark background). The page follows the
  system setting until the button is used, and then remembers the choice.
  Printing always uses the light theme, and the button isn't printed.

### 4.3 Player

On screen, a player bar at the bottom of the page plays the melody (and,
optionally, the chords) with Web Audio. It is not printed.

- Degree 1 is set by a key and an octave (default C4, or `--root`), and the
  tempo is in beats per minute (default 100, or `--tempo`). Degrees are
  counted in the major scale.
- Holds and ties lengthen a note instead of playing it again. A trill
  alternates with the next scale degree up.
- Each chord plays its triad, plus a 7th for `D`, `M`, `ø`, dim-7 and any
  symbol containing `7`. It lasts until the next chord or the end of its bar.
- The note being played is highlighted. Clicking a note plays from there.
- When there is a chords file, checkboxes turn the melody and the chords on
  or off. With the melody off, its notes are still highlighted.

### 4.4 Drawing

The output follows the style of the hand-written reference chart.

- **Lines:** one line of music per line of the melody file. Bars on the same
  line get equal width, with barlines drawn between them.
- **Sections:** a line that starts a section (§2.1) gets extra space above it.
- **Notes:** each note is drawn as its digit, with the accidental in front
  (`♯5`, `♭7`).
- **Rhythm marks** go above each digit:
  - A quarter note has a plain vertical stem.
  - An eighth has a stem with one flag, and a 16th has two flags.
  - Beamed notes have their stems joined by one beam per flag level.
- **Dots:** a dotted length is shown as a dot after the digit.
- **Ties:** an arc below the two digits. A tie crossing a line break is drawn
  as two half-arcs.
- **Triplets:** a `3` above the group. A triplet that isn't a single beamed
  group, like quarter-note triplets, also gets a bracket.
- **Trills:** a `~` or "tr" above the note.
- **Holds:** only the rhythm mark, at the held note's height, with nothing in
  the digit row (plus a dot for a dotted hold). This is different from a rest,
  which has a dash under its rhythm mark.
- **Rests:** a short dash that doesn't touch the neighbouring notes, drawn at
  a fixed height (the vertical middle of the line), with its rhythm mark above
  it. Rests take part in beams like notes do (`3'-'` gets one beam).
- **Chords:** drawn in grey below each bar, at their beat positions (§3.3).
  A line with no chords at all has no chord row.

### 4.5 Pitch contour

Pitch is shown **only** by vertical position. There are no octave dots.

- **Proportional height:** a note's height is roughly proportional to its
  pitch in scale steps. The same pitch is always at the same height within a
  line, and bigger intervals show bigger jumps.
- **Accidentals:** sharps and flats are drawn at the height of their degree.
- **Line height:** each line of music is made tall enough for its own range.

---

## 5. Example

Melody file:

```
Fly Me to the Moon - Bart Howard

| 1 7 6' 5 4'_   | 4· 5' 6 1  | 7· 6' 5 4'3'_  | 3 = = = |
| 6· 5' 4 3'2'_  | 2' 3· 4 6  | #5· 4' 3 2'1'_ | 1 = = = |
```

Chords file:

```
| 6- | 2- | 5D | 1 |
| 4 | 7-b5 | 3D | 6- |
```

This example needs no direction accents. Every interval is a 4th or smaller,
so the nearest note is always the correct one.
