---
title: Format specification
---

# Format specification

Actually not a rigorous specification.
Just some explanations.

## CBT format

### CBT Header

The top level is a JSON object with two keys `info` and `notes`.

- `info`: a JSON object with three keys `bpm` (number), `delay` (number), and `dir` (string).
  Their values will be referred to as `bpm`, `delay`, and `dir` respectively.
- `notes`: a JSON array of events. See below for the format of an event.

### CBT event

Each event is a JSON array with at least 6 elements.
The first 6 elements are referred to as
`measure`, `track_count`, `subdivision_count`, `track_index`, `subdivision_index`, and `type`.
The rest of the elements are referred to as `args`.

Table of types:

| `type` | Meaning | `args` |
|-|-|-|
| `1` | Music | `[filename: string]` |
| `2` | BPM change | `[bpm]` |
| `3` | Scroll speed | `[speed]` |
| `10` | Circle (tap) | `[]` |
| `20` | Charge (hold) begin | `[group]` |
| `21` | Charge end | `[group]` |
| `22` | Charge middle | `[group]` |
| `30` | Chain (drag) begin | `[group]` |
| `31` | Chain middle | `[group]` |
| `32` | Chain end | `[group]` |
| `40` | Wide circle | `[width]` |
| `50` | Wide charge begin | `[group, width]` |
| `51` | Wide charge end | `[group, width]` |

The total duration of a measure (without BPM change)
is `240 / bpm` seconds.
There is no such thing as a time signature.

`track_count` must be an integer greater than `1` for `type >= 10`.
`track_index` is zero-based, with the leftmost track being `0`.

`width` is a positive number. Having a `width` of `1.0` means the having full width of the gameplay area.

## CWPC format

All integers and floats are stored in little-endian format.

Because this will be very frequently used, define here

```c
typedef struct {
  uint32_t numerator;
  uint32_t denominator; // nonzero
} rational_t;
```

This represents a non-negative rational number.
Define usual comparison and arithmetics for rational numbers.

### Header and metadata

Four bytes of magic numbers `43 57 50 43` (ASCII `CWPC`).

A number `uint8_t version` that must equal `1`.

A null-terminated string, indicating the charter.

A null-terminated string, containing any comments.

A number `float64_t offset` indicating the timestamp of the zeroth beat in seconds.

### BPS (beats per second) list

A number `uint32_t bps_change_count`.

A number `float64_t initial_bps` in the range of (0, +inf).

An array `bps_change_t bps_change_list[bps_change_count]`, where

```c
typedef struct {
  rational_t delta_beat; // non-zero numerator
  float64_t bps; // in range (0, +inf)
} bps_change_t;
```

Notice that the parameter `delta_beat` specifies
how many beats there have been since the last speed change,
instead of since the zeroth beat.

### Speed list

A number `uint32_t speed_change_count`.

A number `float64_t initial_speed` in the range of (-inf, +inf).

An array `speed_change_t speed_change_list[speed_change_count]`, where

```c
typedef struct {
  rational_t delta_beat; // non-zero numerator
  float64_t speed; // in range (-inf, +inf)
} speed_change_t;
```

### Note list

A number `uint32_t note_count`.

An array `note_t note_list[note_count]`, where

```c
typedef struct {
  rational_t delta_beat;
  uint16_t track_count;
  uint16_t track_index;
  uint32_t next;
  float16_t width;
} note_t;
```

None zero `width` means a wide note, and its absolute value is the width.
The sign bit of `width` is used to indicate the type of the note:
positive means tap or hold, and negative means drag.
Therefore, **positive zero and negative zero are different**.

`next` gives the index of the next note
(in order to connect holds and drags)
**relative to the current note**.
When it is zero, it means the note does not have a next note.
Unconnected notes with positive `width` are taps.

## CWPM format

All integers and floats are stored in little-endian format.

Because this will be very frequently used, define here

```c
typedef struct {
  uint64_t offset;
  uint64_t length;
} embedded_file_t;
```

### Header

Four bytes of magic numbers `43 57 50 4d` (ASCII `CWPM`).

A number `uint8_t version` that must equal `1`.

### Music data

Two null-terminated strings, respectively title and artist.

A number `uint8_t categories`, indicating the categories of the music
by a bitwise OR of several flags.
All flags:

| Flag | Meaning |
|-|-|
| `2` | |
| `4` | Instrumental |
| `8` | Vocal |
| `16` | |

A number `int8_t music_type`, indicating how the music is provided,
followed by some data that provide the actual music
(the music data must be in Ogg Vorbis format).
When the type is negative, it indicates that the file is gzipped,
otherwise it is the same as the positive type.
All available positive types and their data format:

| `music_type` | Following data |
|-|-|
| `1` | `embedded_file_t music_file` |
| `2` | null-terminated string of a URL beginning with `http://` or `https://` |
| `3` | null-terminated string of a UNIX relative path |

A number `int8_t preview_type`, indicating how the music preview is provided,
followed by some data that provide the actual preview.
When the type is negative, it indicates that the file is gzipped,
otherwise it is the same as the positive type.
The zero type is special, which reads a segment from the music file to get the preview,
and does not have a negative counterpart.
When provided as a file (instead of a music segment), it must be in Ogg Vorbis format.
All available non-negative types and their data format:

| `preview_type` | Following data |
|-|-|
| `0` | `music_segment_t preview` |
| `1` | `embedded_file_t preview_file` |
| `2` | null-terminated string of a URL beginning with `http://` or `https://` |
| `3` | null-terminated string of a UNIX relative path |

where `music_segment_t` is defined as

```c
typedef struct {
  uint64_t offset;
  uint64_t length;
  uint32_t fade_in_length;
  uint32_t fade_out_length;
} music_segment_t;
```

with all the numbers in the unit of audio frames
(convert to time by dividing by sample rate).

A number `int8_t cover_type`, indicating how the cover art is provided,
followed by some data that provide the actual cover art.
When the type is negative, it indicates that the file is gzipped,
otherwise it is the same as the positive type.
The zero type means that the cover art is not provided.
When provided, must be in PNG format.
All available non-negative types and their data format:

| `cover_type` | Following data |
|-|-|
| `0` | none |
| `1` | `embedded_file_t cover_file` |
| `2` | null-terminated string of a URL beginning with `http://` or `https://` |
| `3` | null-terminated string of a UNIX relative path |

A number `uint8_t keyword_count`,
followed by `keyword_count` null-terminated strings.
(Usually, just repeat the title and the artist.)

A null-terminated strings, containing any additional comments.

### Chart data

A number `uint8_t chart_count`, indicating the number of charts.
Then, for each chart:

A null-terminated string, containing the difficulty name.
Typical examples are `EASY` and `NORMAL`.

Numbers `uint8_t difficulty_color[3]` indicating the accent color in RGB format.
Common values:

| Difficulty name | Color |
|-|-|
| EASY | `00 41 e9` |
| NORMAL | `e9 6e 00` |
| HARD | `e9 00 2e` |
| EXTRA, EXTRA+ | `e9 00 ad` |
| CHAOS, CHAOS+ | `4b 4b 9d` |

A null-terminated string, containing the difficulty text.
Usually the 10-based representation of an integer between 1 and 13.

A number `uint32_t difficulty` indicating the actual difficulty multiplied by 1000.
For example, a difficulty of 12.9 will be stored as `64 32 00 00` (the binary representation of 12900).

A number `int8_t chart_type`, indicating how the chart is provided.
Only possible values are `1` and `-1`, with the latter indicating that the chart is gzipped.

A `embedded_file_t chart_file` pointing to a CWPC file.
