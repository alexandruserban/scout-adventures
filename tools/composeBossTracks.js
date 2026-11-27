// Composes a short, snappy boss-fight theme for every world's boss as MIDI files in src/boss-soundtrack.
// Each boss has its own tempo, key, chord loop, lead melody, instruments, bass line and drum groove;
// they all share one arrangement: a 2-bar count-in, the theme, the theme over a racing arpeggio,
// the theme low on a second instrument, then the theme doubled with everything playing.
// The files end exactly on the bar line so they loop without a gap.
// Usage: node tools/composeBossTracks.js && node tools/buildLevelTracks.js
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '..', 'src', 'boss-soundtrack');
const TICKS_PER_BEAT = 480;
const DRUM_CHANNEL = 9;
const BEATS_PER_BAR = 4;
const STEP = 0.25; // one sixteenth note, in beats

// ==========================================
// Notes
// ==========================================
const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'C4' -> 60, 'F#3' -> 54, 'Bb2' -> 46. */
function midi(name) {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!match) throw new Error(`Bad note ${name}`);
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return 12 * (Number(match[3]) + 1) + NOTE_INDEX[match[1]] + accidental;
}

/** A melody from "C5:0.5 -:0.5 E5:1 | ..." (note:beats, '-' rests, '|' marks bars and is ignored). */
function phrase(text, { gate = 0.7, velocity = 100 } = {}) {
  const notes = [];
  let time = 0;
  text.replace(/\|/g, ' ').trim().split(/\s+/).forEach(token => {
    const [name, beats] = token.split(':');
    const duration = Number(beats);
    if (name !== '-') {
      // Staccato for snap; downbeats a touch louder
      const accent = time % 1 === 0 ? 1 : 0.85;
      notes.push({ time, duration: Math.max(0.1, duration * gate), note: midi(name), velocity: Math.round(velocity * accent) });
    }
    time += duration;
  });
  return { notes, length: time };
}

/** 'E3m' / 'C3M' / 'E35' (power chord) -> { root, tones } */
function chord(spec) {
  const match = /^([A-G][#b]?-?\d)(m|M|5)$/.exec(spec);
  if (!match) throw new Error(`Bad chord ${spec}`);
  // Every chord sits in the same register (C3-B3) whatever octave it's written in; the bass plays it an octave down
  const root = 48 + (midi(match[1]) % 12);
  const tones = { m: [0, 3, 7, 12], M: [0, 4, 7, 12], 5: [0, 7, 12, 19] }[match[2]];
  return { root, tones };
}

// ==========================================
// Grooves
// ==========================================
const _ = null;

/** Bass lines over one bar of sixteenths: semitones above the chord's bass root, or _ for a rest. */
const BASS_LINES = {
  pump: [0, _, 0, _, 0, _, 0, _, 0, _, 0, _, 0, _, 0, _],
  octave: [0, _, 12, _, 0, _, 12, _, 0, _, 12, _, 0, _, 12, _],
  gallop: [0, _, 0, 0, 0, _, 0, 0, 0, _, 0, 0, 0, _, 12, 12],
  synco: [0, _, _, 0, _, _, 0, _, 12, _, _, 0, _, _, 7, _],
  walk: [0, _, 7, _, 12, _, 7, _, 0, _, 12, _, 7, _, 0, _]
};

/** Drum grooves, one bar of sixteenths per instrument (X loud, x soft). */
const GROOVES = {
  rock: { 36: 'X.....x.X.......', 38: '....X.......X...', 42: 'x.x.x.x.x.x.x.x.' },
  four: { 36: 'X...X...X...X...', 38: '....X.......X...', 42: '..x...x...x...x.' },
  break: { 36: 'X.....X...X.....', 38: '....X..x.x..X...', 42: 'x.xxx.x.x.xxx.x.' },
  gallop: { 36: 'X.xxX.xxX.xxX.xx', 38: '....X.......X...', 42: 'x...x...x...x...' },
  blast: { 36: 'XxXxXxXxXxXxXxXx', 38: '....X.......X...', 42: 'x.x.x.x.x.x.x.x.' },
  tribal: { 36: 'X..x..X...X..x..', 45: '..x...x.x...x.x.', 38: '....X.......X...', 42: 'x.x.x.x.x.x.x.x.' },
  tick: { 36: 'X...X...X...X...', 38: '....X.......X...', 76: 'x.x.x.x.x.x.x.x.', 77: '.x.x.x.x.x.x.x.x' },
  swing: { 36: 'X.....x.X.....x.', 38: '....X.......X...', 42: 'x..xx..xx..xx..x' }
};
/** The thinned-out groove under the low-theme section, so the last section hits harder. */
const BREAKDOWN = { 36: 'X.......X.......', 39: '....X.......X...', 42: 'x.x.x.x.x.x.x.x.' };
/** Last beat of a section: a snare and tom roll into the next. */
const FILL = { 38: 'X.x.', 50: '..X.', 47: '...X' };

function drumBar(grid, bar, { skipLastBeat = false, velocity = 110 } = {}) {
  const notes = [];
  Object.entries(grid).forEach(([key, pattern]) => {
    [...pattern].forEach((symbol, step) => {
      if (symbol === '.' || (skipLastBeat && step >= 12)) return;
      notes.push({ time: bar * BEATS_PER_BAR + step * STEP, duration: STEP * 0.5, note: Number(key), velocity: symbol === 'X' ? velocity : Math.round(velocity * 0.65) });
    });
  });
  return notes;
}

function fill(bar, velocity = 110) {
  const notes = [];
  Object.entries(FILL).forEach(([key, pattern]) => {
    [...pattern].forEach((symbol, step) => {
      if (symbol === '.') return;
      notes.push({ time: bar * BEATS_PER_BAR + 3 + step * STEP, duration: STEP * 0.5, note: Number(key), velocity: symbol === 'X' ? velocity : Math.round(velocity * 0.75) });
    });
  });
  notes.push({ time: bar * BEATS_PER_BAR, duration: STEP, note: 36, velocity });
  return notes;
}

/** Short chord hits on an off-kilter rhythm: the "snap" under the theme. */
const STAB_RHYTHM = 'x..x..x...x..x..';

// ==========================================
// Arrangement
// ==========================================
// Bars: 0-1 count-in, 2-5 theme, 6-9 theme + arpeggio, 10-13 theme low (second instrument), 14-17 everything
const SECTIONS = { theme: 2, arp: 6, low: 10, full: 14 };
const TOTAL_BARS = 18;

function arrange(boss) {
  const progression = boss.chords.map(chord);
  const chordOf = bar => (bar < 2 ? progression[bar === 0 ? 0 : 3] : progression[(bar - 2) % 4]);
  const lead = phrase(boss.lead, { gate: boss.gate || 0.7 });
  if (Math.abs(lead.length - 16) > 1e-6) throw new Error(`${boss.file}: lead is ${lead.length} beats, not 16`);
  const at = (notes, bar, { transpose = 0, velocity = 1 } = {}) => notes.map(note => ({
    ...note, time: note.time + bar * BEATS_PER_BAR, note: note.note + transpose, velocity: Math.round(note.velocity * velocity)
  }));

  const leadNotes = [
    // Count-in pickup: a quick run up the first chord into the theme
    ...progression[0].tones.map((tone, i) => ({ time: 1 * BEATS_PER_BAR + 3 + i * STEP, duration: STEP * 0.8, note: progression[0].root + 24 + tone, velocity: 80 + i * 8 })),
    ...at(lead.notes, SECTIONS.theme),
    ...at(lead.notes, SECTIONS.arp),
    ...at(lead.notes, SECTIONS.full)
  ];
  const counterNotes = [
    ...at(lead.notes, SECTIONS.low, { transpose: -12 }),
    ...at(lead.notes, SECTIONS.full, { transpose: -12, velocity: 0.7 })
  ];

  const bass = [];
  const line = BASS_LINES[boss.bass];
  for (let bar = 0; bar < TOTAL_BARS; bar++) {
    const { root } = chordOf(bar);
    line.forEach((offset, step) => {
      if (offset === _) return;
      bass.push({ time: bar * BEATS_PER_BAR + step * STEP, duration: STEP * 1.4, note: root - 12 + offset, velocity: step % 4 === 0 ? 112 : 92 });
    });
  }

  const arp = [];
  const ARP_ORDER = [0, 1, 2, 3, 2, 1, 2, 3];
  for (let bar = SECTIONS.arp; bar < TOTAL_BARS; bar++) {
    const { root, tones } = chordOf(bar);
    for (let step = 0; step < 16; step++) {
      arp.push({ time: bar * BEATS_PER_BAR + step * STEP, duration: STEP * 0.6, note: root + 12 + tones[ARP_ORDER[step % 8]], velocity: step % 4 === 0 ? 78 : 60 });
    }
  }

  const stabs = [];
  const stabBars = [...range(SECTIONS.theme, 4), ...range(SECTIONS.low, 8)];
  stabBars.forEach(bar => {
    const { root, tones } = chordOf(bar);
    [...STAB_RHYTHM].forEach((symbol, step) => {
      if (symbol === '.') return;
      tones.slice(0, 3).forEach(tone => stabs.push({ time: bar * BEATS_PER_BAR + step * STEP, duration: STEP * 0.8, note: root + tone, velocity: step === 0 ? 96 : 80 }));
    });
  });

  const drums = [];
  const groove = GROOVES[boss.drums];
  for (let bar = 0; bar < TOTAL_BARS; bar++) {
    const sectionEnd = bar === 1 || (bar >= 2 && (bar - 2) % 4 === 3);
    const grid = bar >= SECTIONS.low && bar < SECTIONS.full ? BREAKDOWN : groove;
    drums.push(...drumBar(bar === 0 ? { 36: 'X...X...X...X...', 42: 'x.x.x.x.x.x.x.x.' } : grid, bar, { skipLastBeat: sectionEnd }));
    if (sectionEnd) drums.push(...fill(bar));
  }
  [SECTIONS.theme, SECTIONS.arp, SECTIONS.low, SECTIONS.full].forEach(bar => drums.push({ time: bar * BEATS_PER_BAR, duration: 0.5, note: 49, velocity: 115 }));

  return {
    bpm: boss.bpm,
    lengthBeats: TOTAL_BARS * BEATS_PER_BAR,
    parts: [
      { channel: 0, program: boss.leadProgram, volume: 112, notes: leadNotes },
      { channel: 1, program: boss.counterProgram, volume: 100, notes: counterNotes },
      { channel: 2, program: 38, volume: 108, notes: bass },
      { channel: 3, program: boss.arpProgram, volume: 72, notes: arp },
      { channel: 4, program: boss.stabProgram, volume: 80, notes: stabs },
      { channel: DRUM_CHANNEL, volume: 108, notes: drums }
    ]
  };
}

function range(start, count) {
  return Array.from({ length: count }, (_unused, i) => start + i);
}

// ==========================================
// MIDI file writing
// ==========================================
function variableLength(value) {
  const bytes = [value & 0x7f];
  while ((value >>= 7)) bytes.unshift((value & 0x7f) | 0x80);
  return bytes;
}

function chunk(type, data) {
  const length = data.length;
  return [...Buffer.from(type, 'ascii'), (length >>> 24) & 255, (length >>> 16) & 255, (length >>> 8) & 255, length & 255, ...data];
}

function trackChunk(events, endTick) {
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const data = [];
  let lastTick = 0;
  events.forEach(event => {
    data.push(...variableLength(event.tick - lastTick), ...event.bytes);
    lastTick = event.tick;
  });
  data.push(...variableLength(Math.max(0, endTick - lastTick)), 0xff, 0x2f, 0);
  return chunk('MTrk', data);
}

function writeSong(fileName, { bpm, lengthBeats, parts }) {
  const endTick = Math.round(lengthBeats * TICKS_PER_BEAT); // ends on the bar line: a seamless loop
  const microsecondsPerBeat = Math.round(60000000 / bpm);
  const tempoTrack = trackChunk([
    { tick: 0, order: 0, bytes: [0xff, 0x58, 4, 4, 2, 24, 8] },
    { tick: 0, order: 1, bytes: [0xff, 0x51, 3, (microsecondsPerBeat >> 16) & 255, (microsecondsPerBeat >> 8) & 255, microsecondsPerBeat & 255] }
  ], endTick);
  const tracks = parts.map(({ channel, program = 0, volume = 100, notes }) => {
    const events = [
      { tick: 0, order: 0, bytes: [0xc0 | channel, program] },
      { tick: 0, order: 1, bytes: [0xb0 | channel, 7, volume] }
    ];
    notes.forEach(({ time, duration, note, velocity }) => {
      const on = Math.round(time * TICKS_PER_BEAT);
      const off = Math.min(endTick, Math.max(on + 1, Math.round((time + duration) * TICKS_PER_BEAT)));
      events.push({ tick: on, order: 3, bytes: [0x90 | channel, note, Math.max(1, Math.min(127, velocity))] });
      events.push({ tick: off, order: 2, bytes: [0x80 | channel, note, 0] });
    });
    return trackChunk(events, endTick);
  });
  const header = chunk('MThd', [0, 1, 0, tracks.length + 1, (TICKS_PER_BEAT >> 8) & 255, TICKS_PER_BEAT & 255]);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${fileName}.mid`), Buffer.from([...header, ...tempoTrack, ...tracks.flat()]));
  console.log(`Wrote ${fileName}.mid  (${bpm} BPM, ${((lengthBeats * 60) / bpm).toFixed(1)}s loop)`);
}

// ==========================================
// The bosses
// GM programs used: 0 piano, 9 glockenspiel, 12 marimba, 13 xylophone, 30 distortion guitar,
// 48 strings, 52 choir, 61 brass, 62 synth brass, 71 clarinet, 72 piccolo, 73 flute, 80 square lead, 81 saw lead
// ==========================================
const BOSSES = [
  {
    file: '01_King_Thunder_Jelly', bpm: 168, chords: ['E3m', 'C3M', 'D3M', 'B2M'],
    lead: 'E5:0.5 E5:0.25 E5:0.25 G5:0.5 B5:0.5 A5:0.5 G5:0.5 F#5:0.5 G5:0.5 | C6:0.5 B5:0.5 G5:0.5 E5:0.5 G5:1 -:1 | D6:0.5 C6:0.5 B5:0.5 A5:0.5 F#5:0.5 A5:0.5 D6:1 | D#6:0.5 B5:0.5 F#5:0.5 D#5:0.5 B4:1 -:1',
    leadProgram: 80, counterProgram: 81, arpProgram: 9, stabProgram: 62, bass: 'octave', drums: 'rock'
  },
  {
    file: '02_The_Cinder_Golem', bpm: 160, chords: ['D3m', 'Eb3M', 'D3m', 'A2M'],
    lead: 'D5:0.75 D5:0.25 F5:0.5 A5:0.5 G5:0.5 F5:0.5 E5:0.5 D5:0.5 | Eb5:0.75 Eb5:0.25 G5:0.5 Bb5:0.5 G5:1 Eb5:1 | F5:0.5 E5:0.5 D5:0.5 F5:0.5 A5:1 D6:1 | C#6:0.5 A5:0.5 E5:0.5 C#5:0.5 A4:1 -:1',
    leadProgram: 61, counterProgram: 30, arpProgram: 80, stabProgram: 30, bass: 'gallop', drums: 'gallop'
  },
  {
    file: '03_The_Gloomwing_Queen', bpm: 156, chords: ['A3m', 'F3M', 'G3M', 'E3M'],
    lead: 'A5:0.5 C6:0.5 E6:0.5 C6:0.5 B5:0.5 A5:0.5 E5:1 | F5:0.5 A5:0.5 C6:0.5 A5:0.5 G5:0.5 F5:0.5 C5:1 | G5:0.5 B5:0.5 D6:0.5 B5:0.5 A5:0.5 G5:0.5 D5:1 | E5:0.5 G#5:0.5 B5:0.5 E6:0.5 D6:0.5 B5:0.5 G#5:1',
    leadProgram: 73, counterProgram: 48, arpProgram: 9, stabProgram: 52, bass: 'octave', drums: 'break'
  },
  {
    file: '04_The_Dune_Thornback', bpm: 164, chords: ['D3M', 'D3M', 'G3m', 'A2M'],
    lead: 'D5:0.25 Eb5:0.25 F#5:0.5 G5:0.5 A5:0.5 Bb5:0.5 A5:0.5 G5:0.5 F#5:0.5 | A5:0.5 G5:0.5 F#5:0.5 Eb5:0.5 D5:1 -:1 | G5:0.5 A5:0.5 Bb5:0.5 D6:0.5 C6:0.5 Bb5:0.5 A5:0.5 G5:0.5 | A5:0.5 Bb5:0.25 A5:0.25 G5:0.5 F#5:0.5 E5:0.5 C#5:0.5 A4:1',
    leadProgram: 81, counterProgram: 71, arpProgram: 12, stabProgram: 61, bass: 'pump', drums: 'tribal'
  },
  {
    file: '05_The_Frost_Behemoth', bpm: 170, chords: ['B2m', 'G2M', 'A2M', 'F#2M'],
    lead: 'B5:0.5 F#5:0.5 B5:0.5 D6:0.5 C#6:0.5 B5:0.5 A5:0.5 F#5:0.5 | G5:0.5 B5:0.5 D6:1 C#6:0.5 B5:0.5 G5:1 | A5:0.5 C#6:0.5 E6:1 D6:0.5 C#6:0.5 A5:1 | A#5:0.5 C#6:0.5 F#6:0.5 C#6:0.5 A#5:1 F#5:1',
    leadProgram: 80, counterProgram: 48, arpProgram: 9, stabProgram: 48, bass: 'octave', drums: 'four'
  },
  {
    file: '06_The_Magma_Golem', bpm: 176, chords: ['C3m', 'Ab2M', 'Bb2M', 'G2M'],
    lead: 'C5:0.5 C5:0.5 Eb5:0.5 C5:0.25 F5:0.25 -:0.25 G5:0.75 Eb5:0.5 C5:0.5 | Ab5:0.5 G5:0.5 Eb5:0.5 C5:0.5 Ab4:1 C5:1 | Bb4:0.5 D5:0.5 F5:0.5 Bb5:0.5 Ab5:0.5 G5:0.5 F5:0.5 D5:0.5 | G5:0.5 B4:0.5 D5:0.5 G5:0.5 F5:0.5 D5:0.5 B4:1',
    leadProgram: 30, counterProgram: 61, arpProgram: 81, stabProgram: 30, bass: 'gallop', drums: 'blast'
  },
  {
    file: '07_The_Jawbreaker', bpm: 172, chords: ['F3M', 'D3m', 'Bb2M', 'C3M'],
    lead: 'F5:0.5 A5:0.5 C6:0.5 A5:0.25 C6:0.25 F6:0.5 C6:0.5 A5:1 | D6:0.5 C6:0.5 A5:0.5 F5:0.5 D5:1 -:1 | Bb5:0.5 D6:0.5 F6:0.5 D6:0.5 C6:0.5 Bb5:0.5 G5:1 | C6:0.25 D6:0.25 C6:0.5 Bb5:0.5 G5:0.5 E5:1 C5:1',
    leadProgram: 13, counterProgram: 80, arpProgram: 12, stabProgram: 0, bass: 'octave', drums: 'four'
  },
  {
    file: '08_The_Star_Devourer', bpm: 158, chords: ['G2m', 'Eb3M', 'C3m', 'D3M'],
    lead: 'G5:1 Bb5:0.5 D6:0.5 C6:0.5 Bb5:0.5 A5:0.5 Bb5:0.5 | G5:0.5 Eb5:0.5 G5:0.5 Bb5:0.5 Eb6:1 D6:1 | C6:0.5 Bb5:0.5 G5:0.5 Eb5:0.5 C5:0.5 Eb5:0.5 G5:1 | F#5:0.5 A5:0.5 D6:0.5 A5:0.5 F#5:0.5 D5:0.5 A4:1',
    leadProgram: 81, counterProgram: 52, arpProgram: 80, stabProgram: 52, bass: 'synco', drums: 'break'
  },
  {
    file: '09_The_Neon_Wyrm', bpm: 180, chords: ['A2m', 'F2M', 'C3M', 'G2M'],
    lead: 'E5:0.5 A5:0.5 B5:0.5 C6:0.5 B5:0.25 A5:0.25 G5:0.5 A5:1 | F5:0.5 A5:0.5 C6:0.5 F6:0.5 E6:0.5 C6:0.5 A5:1 | G5:0.5 C6:0.5 E6:0.5 G6:0.5 F6:0.5 E6:0.5 C6:1 | D6:0.5 B5:0.5 G5:0.5 D5:0.5 G5:0.5 B5:0.5 D6:1',
    leadProgram: 81, counterProgram: 62, arpProgram: 80, stabProgram: 62, bass: 'octave', drums: 'four'
  },
  {
    file: '10_The_Crystal_Sentinel', bpm: 166, chords: ['E3m', 'A2M', 'C3M', 'B2M'],
    lead: 'B5:0.5 E6:0.5 B5:0.5 G5:0.5 E5:0.5 G5:0.5 B5:1 | C#6:0.5 A5:0.5 E5:0.5 A5:0.5 C#6:0.5 E6:0.5 A5:1 | C6:0.5 G5:0.5 E5:0.5 G5:0.5 C6:0.5 E6:0.5 G6:1 | F#6:0.5 D#6:0.5 B5:0.5 F#5:0.5 D#5:0.5 F#5:0.5 B5:1',
    leadProgram: 9, counterProgram: 80, arpProgram: 13, stabProgram: 48, bass: 'pump', drums: 'break'
  },
  {
    file: '11_The_Brass_Beetle_Titan', bpm: 162, chords: ['D3M', 'B2m', 'G2M', 'A2M'],
    lead: 'D5:0.5 F#5:0.5 A5:0.5 D6:0.5 -:0.5 A5:0.5 D6:1 | B5:0.5 A5:0.5 F#5:0.5 D5:0.5 B4:0.5 D5:0.5 F#5:1 | G5:0.5 B5:0.5 D6:0.5 G6:0.5 F#6:0.5 E6:0.5 D6:1 | C#6:0.5 A5:0.5 E5:0.5 A5:0.5 C#6:0.25 D6:0.25 E6:0.5 A5:1',
    leadProgram: 61, counterProgram: 71, arpProgram: 12, stabProgram: 61, bass: 'walk', drums: 'tick'
  },
  {
    file: '12_The_Abyssal_Megajelly', bpm: 164, chords: ['F#2m', 'D3M', 'E3M', 'C#3M'],
    lead: 'F#5:0.5 A5:0.5 C#6:0.5 F#6:0.5 E6:0.5 C#6:0.5 A5:1 | D6:0.5 C#6:0.5 A5:0.5 F#5:0.5 D5:1 F#5:1 | E5:0.5 G#5:0.5 B5:0.5 E6:0.5 D6:0.5 B5:0.5 G#5:1 | C#6:0.5 F5:0.5 G#5:0.5 C#6:0.5 B5:0.5 G#5:0.5 F5:1',
    leadProgram: 81, counterProgram: 48, arpProgram: 9, stabProgram: 52, bass: 'synco', drums: 'break'
  },
  {
    file: '13_The_Pixie_Moth_Empress', bpm: 174, chords: ['G2M', 'E3m', 'C3M', 'D3M'],
    lead: 'D6:0.5 B5:0.5 G5:0.5 B5:0.5 D6:0.5 G6:0.5 F#6:0.5 D6:0.5 | E6:0.5 B5:0.5 G5:0.5 E5:0.5 G5:1 B5:1 | C6:0.5 E6:0.5 G6:0.5 E6:0.5 C6:0.5 G5:0.5 E5:1 | D6:0.5 F#6:0.5 A6:0.5 F#6:0.5 D6:0.25 C6:0.25 B5:0.5 A5:1',
    leadProgram: 72, counterProgram: 73, arpProgram: 9, stabProgram: 48, bass: 'octave', drums: 'four'
  },
  {
    file: '14_The_Dragon_Mech', bpm: 184, chords: ['E25', 'F25', 'E25', 'D25'],
    lead: 'E5:0.25 E5:0.25 -:0.25 E5:0.25 F5:0.5 E5:0.5 G5:0.5 F5:0.5 E5:0.5 D5:0.5 | F5:0.25 F5:0.25 -:0.25 F5:0.25 A5:0.5 G5:0.5 F5:0.5 E5:0.5 F5:1 | E5:0.5 G5:0.5 B5:0.5 E6:0.5 D6:0.5 B5:0.5 G5:1 | D5:0.5 F#5:0.5 A5:0.5 D6:0.5 C6:0.5 A5:0.5 F#5:1',
    leadProgram: 30, counterProgram: 61, arpProgram: 81, stabProgram: 30, bass: 'gallop', drums: 'blast'
  },
  {
    file: '15_The_Void_Knight', bpm: 170, chords: ['C#3m', 'A2M', 'F#2m', 'G#2M'],
    lead: 'C#5:0.5 G#5:0.5 C#6:0.5 G#5:0.5 E5:0.5 G#5:0.5 C#6:0.5 E6:0.5 | A5:0.5 E5:0.5 C#5:0.5 E5:0.5 A5:1 C#6:1 | F#5:0.5 A5:0.5 C#6:0.5 F#6:0.5 E6:0.5 C#6:0.5 A5:1 | G#5:0.5 C6:0.5 D#6:0.5 G#6:0.5 F#6:0.5 D#6:0.5 C6:1',
    leadProgram: 80, counterProgram: 48, arpProgram: 81, stabProgram: 62, bass: 'synco', drums: 'rock'
  },
  {
    file: '16_The_Cosmic_Archmage', bpm: 176, chords: ['D3m', 'Bb2M', 'F2M', 'C3M'],
    lead: 'A5:0.5 D6:0.5 F6:0.5 E6:0.5 D6:0.5 C6:0.5 A5:1 | Bb5:0.5 D6:0.5 F6:0.5 D6:0.5 Bb5:1 F5:1 | A5:0.5 C6:0.5 F6:0.5 C6:0.5 A5:0.5 F5:0.5 C6:1 | G5:0.5 C6:0.5 E6:0.5 G6:0.5 F6:0.5 E6:0.5 C6:1',
    leadProgram: 81, counterProgram: 52, arpProgram: 9, stabProgram: 52, bass: 'octave', drums: 'four'
  },
  {
    file: '17_The_Ink_Blot_Golem', bpm: 172, chords: ['C3m', 'Ab2M', 'F2m', 'G2M'],
    lead: 'G5:0.5 G5:0.25 G5:0.25 Eb5:0.5 C5:0.5 D5:0.5 Eb5:0.5 G5:1 | Ab5:0.5 C6:0.5 Eb6:0.5 C6:0.5 Ab5:1 -:1 | F5:0.5 Ab5:0.5 C6:0.5 Ab5:0.5 F5:0.5 Ab5:0.5 C6:1 | B5:0.5 G5:0.5 D5:0.5 B4:0.5 D5:0.5 F5:0.5 G5:1',
    leadProgram: 0, counterProgram: 71, arpProgram: 0, stabProgram: 61, bass: 'walk', drums: 'swing'
  },
  {
    file: '18_The_Hive_Queen', bpm: 168, chords: ['B2m', 'C3M', 'B2m', 'A2M'],
    lead: 'B4:0.5 C5:0.5 D5:0.5 F#5:0.5 B5:0.5 F#5:0.5 D5:0.5 C5:0.5 | C5:0.5 E5:0.5 G5:0.5 C6:0.5 B5:0.5 G5:0.5 E5:1 | B5:0.25 A5:0.25 F#5:0.5 D5:0.5 B4:0.5 D5:0.5 F#5:0.5 B5:1 | A5:0.5 C#6:0.5 E6:0.5 C#6:0.5 A5:0.5 E5:0.5 C#5:1',
    leadProgram: 80, counterProgram: 62, arpProgram: 81, stabProgram: 62, bass: 'pump', drums: 'break'
  },
  {
    file: '19_The_Prism_Widow', bpm: 170, chords: ['A2m', 'D3m', 'G2M', 'E3M'],
    lead: 'A5:0.25 B5:0.25 C6:0.5 E6:0.5 C6:0.5 A5:0.25 B5:0.25 C6:0.5 A5:1 | D6:0.25 E6:0.25 F6:0.5 A6:0.5 F6:0.5 D6:0.5 A5:0.5 D6:1 | G5:0.5 B5:0.5 D6:0.5 G6:0.5 F6:0.5 D6:0.5 B5:1 | E6:0.5 D6:0.5 B5:0.5 G#5:0.5 E5:0.5 G#5:0.5 B5:1',
    leadProgram: 13, counterProgram: 81, arpProgram: 9, stabProgram: 48, bass: 'octave', drums: 'gallop'
  },
  {
    file: '20_The_Gravity_Thief', bpm: 178, chords: ['E3M', 'C#3m', 'A2M', 'B2M'],
    lead: 'E5:0.5 G#5:0.5 B5:0.5 E6:0.5 D#6:0.5 B5:0.5 G#5:1 | C#6:0.5 E6:0.5 G#6:0.5 E6:0.5 C#6:1 B5:1 | A5:0.5 C#6:0.5 E6:0.5 A6:0.5 G#6:0.5 F#6:0.5 E6:1 | F#6:0.5 D#6:0.5 B5:0.5 F#5:0.5 A5:0.5 B5:0.5 D#6:1',
    leadProgram: 80, counterProgram: 73, arpProgram: 12, stabProgram: 62, bass: 'octave', drums: 'four'
  },
  {
    file: '21_The_Mighty_Jello', bpm: 168, chords: ['Bb2M', 'G2m', 'Eb3M', 'F2M'],
    lead: 'Bb5:0.5 F5:0.5 D5:0.5 F5:0.5 Bb5:0.5 D6:0.5 C6:0.5 Bb5:0.5 | G5:0.5 Bb5:0.5 D6:0.5 G6:0.5 F6:1 D6:1 | Eb6:0.5 Bb5:0.5 G5:0.5 Eb5:0.5 G5:0.5 Bb5:0.5 Eb6:1 | F6:0.25 Eb6:0.25 D6:0.5 C6:0.5 A5:0.5 F5:0.5 A5:0.5 C6:1',
    leadProgram: 12, counterProgram: 71, arpProgram: 13, stabProgram: 61, bass: 'walk', drums: 'rock'
  },
  {
    file: '22_The_Tentacle_King_Of_Rock', bpm: 180, chords: ['E25', 'G25', 'A25', 'D35'],
    lead: 'E5:0.5 G5:0.5 A5:0.5 B5:0.5 D6:0.5 B5:0.5 A5:0.5 G5:0.5 | G5:0.5 B5:0.5 D6:0.5 G6:0.5 F#6:0.5 D6:0.5 B5:1 | A5:0.5 C6:0.5 E6:0.5 A6:0.5 G6:0.5 E6:0.5 C6:1 | D6:0.5 F#6:0.5 A6:0.5 F#6:0.5 D6:0.25 E6:0.25 F#6:0.5 D6:1',
    leadProgram: 30, counterProgram: 80, arpProgram: 81, stabProgram: 30, bass: 'pump', drums: 'rock'
  }
];

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
BOSSES.forEach(boss => writeSong(boss.file, arrange(boss)));
