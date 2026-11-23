// Composes the soundtracks of the six strange worlds as MIDI files in src/level-soundtrack:
// a ragtime piano reel for the silent film, eerie synths aboard the mothership, a bright glockenspiel
// tune for the rainbow, ever-rising arpeggios for the world that falls up, a tiptoeing xylophone
// for the giant's kitchen and a rock anthem for the octopus band.
// Usage: node tools/composeStrangeTracks.js && node tools/buildLevelTracks.js
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '..', 'src', 'level-soundtrack');
const TICKS_PER_BEAT = 480;
const DRUM_CHANNEL = 9;

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

/**
 * A melody from a compact string: "C5:1 E5:0.5 -:0.5 G5:2" (note:beats, '-' is a rest).
 * @returns {{notes: Array, length: number}}
 */
function phrase(text, { velocity = 90, start = 0 } = {}) {
  const notes = [];
  let time = start;
  text.trim().split(/\s+/).forEach(token => {
    const [name, beats] = token.split(':');
    const duration = Number(beats);
    if (name !== '-') {
      name.split('+').forEach(single => notes.push({ time, duration: duration * 0.92, note: midi(single), velocity }));
    }
    time += duration;
  });
  return { notes, length: time - start };
}

/** Repeat a list of notes `times` times, `every` beats apart. */
function repeat(notes, times, every) {
  const result = [];
  for (let i = 0; i < times; i++) notes.forEach(note => result.push({ ...note, time: note.time + i * every }));
  return result;
}

function shift(notes, beats) {
  return notes.map(note => ({ ...note, time: note.time + beats }));
}

/** A drum pattern from a grid: { 36: 'x...x...', 38: '....x...' }, each character one step. */
function drums(grid, { stepBeats = 0.5, bars = 1, beatsPerBar = 4, velocity = 100 } = {}) {
  const notes = [];
  for (let bar = 0; bar < bars; bar++) {
    Object.entries(grid).forEach(([key, pattern]) => {
      [...pattern].forEach((symbol, step) => {
        if (symbol === '.') return;
        notes.push({ time: bar * beatsPerBar + step * stepBeats, duration: stepBeats * 0.5, note: Number(key), velocity: symbol === 'X' ? velocity : Math.round(velocity * 0.7) });
      });
    });
  }
  return notes;
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

function trackChunk(events) {
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const data = [];
  let lastTick = 0;
  events.forEach(event => {
    data.push(...variableLength(event.tick - lastTick), ...event.bytes);
    lastTick = event.tick;
  });
  data.push(0, 0xff, 0x2f, 0);
  return chunk('MTrk', data);
}

/**
 * @param {{bpm:number, parts:Array<{channel:number, program?:number, volume?:number, notes:Array}>}} song
 */
function writeSong(fileName, { bpm, parts }) {
  const microsecondsPerBeat = Math.round(60000000 / bpm);
  const tempoTrack = trackChunk([
    { tick: 0, order: 0, bytes: [0xff, 0x58, 4, 4, 2, 24, 8] },
    { tick: 0, order: 1, bytes: [0xff, 0x51, 3, (microsecondsPerBeat >> 16) & 255, (microsecondsPerBeat >> 8) & 255, microsecondsPerBeat & 255] }
  ]);
  const tracks = parts.map(({ channel, program = 0, volume = 100, notes }) => {
    const events = [
      { tick: 0, order: 0, bytes: [0xc0 | channel, program] },
      { tick: 0, order: 1, bytes: [0xb0 | channel, 7, volume] }
    ];
    notes.forEach(({ time, duration, note, velocity }) => {
      const on = Math.round(time * TICKS_PER_BEAT);
      const off = Math.max(on + 1, Math.round((time + duration) * TICKS_PER_BEAT));
      events.push({ tick: on, order: 3, bytes: [0x90 | channel, note, velocity] });
      events.push({ tick: off, order: 2, bytes: [0x80 | channel, note, 0] });
    });
    return trackChunk(events);
  });
  const header = chunk('MThd', [0, 1, 0, tracks.length + 1, (TICKS_PER_BEAT >> 8) & 255, TICKS_PER_BEAT & 255]);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${fileName}.mid`), Buffer.from([...header, ...tempoTrack, ...tracks.flat()]));
  console.log(`Wrote ${fileName}.mid`);
}

/** Block chords: [['C4+E4+G4', beats], ...] */
function chords(list, velocity = 60) {
  return phrase(list.map(([notes, beats]) => `${notes}:${beats}`).join(' '), { velocity }).notes;
}

// ==========================================
// 17. The Silent Film - ragtime piano, oom-pah bass
// ==========================================
function silentFilm() {
  // Stride left hand: bass note on the beat, chord off the beat
  const stride = progression => progression.flatMap(([bass, chord], bar) => [
    { time: bar * 4, duration: 0.9, note: midi(bass), velocity: 80 },
    ...chord.split('+').map(n => ({ time: bar * 4 + 1, duration: 0.8, note: midi(n), velocity: 60 })),
    { time: bar * 4 + 2, duration: 0.9, note: midi(bass) + 7, velocity: 75 },
    ...chord.split('+').map(n => ({ time: bar * 4 + 3, duration: 0.8, note: midi(n), velocity: 60 }))
  ]);
  const progression = [
    ['C3', 'E4+G4+C5'], ['C3', 'E4+G4+C5'], ['A2', 'E4+A4+C5'], ['A2', 'E4+A4+C5'],
    ['D3', 'F4+A4+D5'], ['G2', 'F4+B4+D5'], ['C3', 'E4+G4+C5'], ['G2', 'F4+B4+D5']
  ];
  const melody = phrase(`
    E5:0.5 G5:0.5 C6:1 B5:0.5 A5:0.5 G5:1  E5:0.5 F5:0.5 G5:0.5 E5:0.5 C5:2
    A5:0.5 C6:0.5 E6:1 D6:0.5 C6:0.5 A5:1  G5:0.5 A5:0.5 G5:0.5 E5:0.5 C5:2
    D5:0.5 F5:0.5 A5:1 G5:0.5 F5:0.5 D5:1  G5:0.5 F#5:0.5 G5:0.5 B5:0.5 D6:2
    C6:0.5 B5:0.5 A5:0.5 G5:0.5 E5:0.5 D5:0.5 C5:1  D5:0.5 E5:0.5 F5:0.5 D5:0.5 G5:2
  `, { velocity: 92 }).notes;
  return {
    bpm: 168,
    parts: [
      { channel: 0, program: 0, volume: 110, notes: repeat(melody, 2, 32) },
      { channel: 1, program: 0, volume: 90, notes: repeat(stride(progression), 2, 32) },
      { channel: DRUM_CHANNEL, volume: 60, notes: drums({ 76: 'x.x.x.x.', 42: '.x.x.x.x' }, { bars: 16, velocity: 60 }) }
    ]
  };
}

// ==========================================
// 18. The Alien Mothership - eerie pads, whole-tone arpeggios, a heartbeat bass
// ==========================================
function mothership() {
  const pads = chords([['D3+F3+A3', 8], ['Bb2+D3+F3', 8], ['G2+Bb2+D3', 8], ['A2+C#3+E3', 8]], 55);
  const arpeggio = (root, bar) => [0, 2, 4, 6, 8, 10, 8, 6].map((step, i) => ({ time: bar * 4 + i * 0.5, duration: 0.4, note: root + step, velocity: 70 }));
  const roots = [62, 62, 58, 58, 55, 55, 57, 57].map(midi => midi + 12);
  const arps = roots.flatMap((root, bar) => arpeggio(root, bar));
  const heartbeat = [50, 50, 46, 46, 43, 43, 45, 45].flatMap((note, bar) => [
    { time: bar * 4, duration: 0.3, note: note - 12, velocity: 100 },
    { time: bar * 4 + 0.5, duration: 0.3, note: note - 12, velocity: 80 }
  ]);
  const lead = phrase(`
    A5:3 G5:1 F5:2 E5:2  D5:6 -:2  F5:3 E5:1 D5:2 C#5:2  D5:8
  `, { velocity: 80 }).notes;
  return {
    bpm: 96,
    parts: [
      { channel: 0, program: 89, volume: 80, notes: repeat(pads, 2, 32) },
      { channel: 1, program: 81, volume: 70, notes: repeat(arps, 2, 32) },
      { channel: 2, program: 38, volume: 110, notes: repeat(heartbeat, 2, 32) },
      { channel: 3, program: 80, volume: 75, notes: shift(lead, 32) },
      { channel: DRUM_CHANNEL, volume: 70, notes: drums({ 36: 'x.......x.......', 42: '..x...x...x...x.', 39: '........x.......' }, { stepBeats: 0.25, bars: 16, velocity: 80 }) }
    ]
  };
}

// ==========================================
// 19. The Rainbow of Webs - sparkling glockenspiel with a sneaky creeping spider motif
// ==========================================
function rainbow() {
  const melody = phrase(`
    G5:1 B5:1 D6:1 B5:1  C6:1 E6:1 D6:2  B5:1 G5:1 A5:1 B5:1  A5:4
    G5:1 B5:1 D6:1 G6:1  F#6:1 E6:1 D6:2  C6:1 B5:1 A5:1 F#5:1  G5:4
    D5:0.5 D#5:0.5 E5:0.5 F5:0.5 F#5:1 -:1  D5:0.5 D#5:0.5 E5:0.5 F5:0.5 F#5:1 -:1
    G5:0.5 A5:0.5 B5:0.5 C6:0.5 D6:1 B5:1  A5:2 D6:2
  `, { velocity: 95 }).notes;
  const pads = chords([
    ['G3+B3+D4', 4], ['C4+E4+G4', 4], ['E3+G3+B3', 4], ['D3+F#3+A3', 4],
    ['G3+B3+D4', 4], ['C4+E4+G4', 4], ['A3+C4+E4', 4], ['D3+F#3+A3', 4],
    ['D3+F#3+A3', 8], ['G3+B3+D4', 4], ['D3+F#3+A3', 4]
  ], 50);
  const bass = phrase(`
    G2:1 D3:1 G2:1 D3:1  C3:1 G3:1 C3:1 G3:1  E2:1 B2:1 E2:1 B2:1  D3:1 A2:1 D3:1 A2:1
    G2:1 D3:1 G2:1 D3:1  C3:1 G3:1 C3:1 G3:1  A2:1 E3:1 A2:1 E3:1  D3:1 A2:1 D3:1 A2:1
    D3:2 D3:2 D3:2 D3:2  G2:1 D3:1 G2:1 D3:1  D3:1 A2:1 D3:1 A2:1
  `, { velocity: 85 }).notes;
  return {
    bpm: 126,
    parts: [
      { channel: 0, program: 9, volume: 110, notes: melody },
      { channel: 1, program: 48, volume: 70, notes: pads },
      { channel: 2, program: 33, volume: 100, notes: bass },
      { channel: DRUM_CHANNEL, volume: 70, notes: drums({ 36: 'x...x...', 38: '..x...x.', 42: 'xxxxxxxx' }, { bars: 12, velocity: 70 }) }
    ]
  };
}

// ==========================================
// 20. The World That Falls Up - every phrase climbs, and never stops climbing
// ==========================================
function risingWorld() {
  // Arpeggios that climb two octaves over each chord, then start again a step higher
  const climb = (root, bar) => [0, 4, 7, 12, 16, 19, 24, 28].map((step, i) => ({ time: bar * 4 + i * 0.5, duration: 0.45, note: root + step, velocity: 60 + i * 5 }));
  const roots = ['E3', 'F#3', 'G#3', 'A3', 'B3', 'C#4', 'D#4', 'E4'].map(midi);
  const arps = roots.flatMap((root, bar) => climb(root, bar));
  const flute = phrase(`
    B4:2 C#5:2  D#5:2 E5:2  F#5:2 G#5:2  A5:2 B5:2
    C#6:2 D#6:2  E6:4  -:4 B5:1 C#6:1 D#6:1 E6:1
  `, { velocity: 85 }).notes;
  const bass = roots.flatMap((root, bar) => [{ time: bar * 4, duration: 3.6, note: root - 12, velocity: 90 }]);
  return {
    bpm: 116,
    parts: [
      { channel: 0, program: 12, volume: 100, notes: repeat(arps, 2, 32) },
      { channel: 1, program: 73, volume: 90, notes: repeat(flute, 2, 32) },
      { channel: 2, program: 33, volume: 90, notes: repeat(bass, 2, 32) },
      { channel: DRUM_CHANNEL, volume: 60, notes: drums({ 36: 'x.......', 42: '..x...x.', 46: '......x.' }, { bars: 16, velocity: 70 }) }
    ]
  };
}

// ==========================================
// 21. The Giant's Kitchen - tiptoeing xylophone and a big clumsy bassoon (the giant)
// ==========================================
function kitchen() {
  const tiptoe = phrase(`
    F5:0.5 -:0.5 A5:0.5 -:0.5 C6:0.5 A5:0.5 F5:1  G5:0.5 -:0.5 Bb5:0.5 -:0.5 D6:0.5 Bb5:0.5 G5:1
    A5:0.5 C6:0.5 F6:0.5 C6:0.5 A5:0.5 F5:0.5 C5:1  E5:0.5 G5:0.5 Bb5:0.5 G5:0.5 E5:0.5 C5:0.5 F5:1
    D5:0.25 E5:0.25 F5:0.25 G5:0.25 A5:1 -:2 Bb5:0.25 A5:0.25 G5:0.25 F5:0.25 E5:1 -:2
    F5:0.5 A5:0.5 C6:0.5 F6:0.5 E6:0.5 C6:0.5 G5:1  F5:2 -:2
  `, { velocity: 95 }).notes;
  // The giant stomping about
  const giant = phrase(`
    F2:1.5 -:0.5 C3:1.5 -:0.5  G2:1.5 -:0.5 D3:1.5 -:0.5  F2:1.5 -:0.5 A2:1.5 -:0.5  C3:1.5 -:0.5 E3:1.5 -:0.5
    Bb2:1.5 -:0.5 F3:1.5 -:0.5  C3:1.5 -:0.5 G2:1.5 -:0.5  F2:1.5 -:0.5 C3:1.5 -:0.5  C3:1 Bb2:1 A2:1 G2:1
  `, { velocity: 100 }).notes;
  return {
    bpm: 132,
    parts: [
      { channel: 0, program: 13, volume: 110, notes: repeat(tiptoe, 2, 32) },
      { channel: 1, program: 70, volume: 95, notes: repeat(giant, 2, 32) },
      { channel: DRUM_CHANNEL, volume: 60, notes: drums({ 76: 'x.x.x.x.', 77: '.x.....x', 36: 'x.......' }, { bars: 16, velocity: 65 }) }
    ]
  };
}

// ==========================================
// 22. The Octopus Rock Concert - power chords, a driving bass and a big rock beat
// ==========================================
function concert() {
  const power = (root, beats) => `${root}+${transpose(root, 7)}+${transpose(root, 12)}:${beats}`;
  const riffText = [
    power('E3', 0.5), power('E3', 0.5), '-:0.5', power('E3', 0.5), power('G3', 0.5), '-:0.5', power('A3', 1),
    power('E3', 0.5), power('E3', 0.5), '-:0.5', power('E3', 0.5), power('D3', 0.5), power('C3', 0.5), power('B2', 1),
    power('E3', 0.5), power('E3', 0.5), '-:0.5', power('E3', 0.5), power('G3', 0.5), '-:0.5', power('A3', 1),
    power('C3', 1), power('D3', 1), power('E3', 2)
  ].join(' ');
  const riff = phrase(riffText, { velocity: 110 }).notes;
  const bass = phrase(`
    E2:0.5 E2:0.5 E2:0.5 E2:0.5 G2:0.5 G2:0.5 A2:1  E2:0.5 E2:0.5 E2:0.5 E2:0.5 D2:0.5 C2:0.5 B1:1
    E2:0.5 E2:0.5 E2:0.5 E2:0.5 G2:0.5 G2:0.5 A2:1  C2:1 D2:1 E2:2
  `, { velocity: 110 }).notes;
  const solo = phrase(`
    E5:0.5 G5:0.5 A5:0.5 B5:1 A5:0.5 G5:1  E5:0.5 D5:0.5 E5:2 -:1
    G5:0.5 A5:0.5 B5:0.5 D6:1 B5:0.5 A5:1  B5:0.5 A5:0.5 G5:0.5 E5:2.5
    E6:0.25 D6:0.25 B5:0.25 A5:0.25 G5:0.25 E5:0.25 D5:0.25 E5:0.25 -:2  A5:0.5 B5:0.5 D6:0.5 E6:2.5
    D6:0.5 B5:0.5 A5:0.5 G5:0.5 E5:1 D5:1  E5:4
  `, { velocity: 100 }).notes;
  const beat = drums({
    36: 'X...x.X.X...x...',
    38: '....X.......X...',
    42: 'x.x.x.x.x.x.x.x.'
  }, { stepBeats: 0.25, bars: 16, velocity: 115 });
  const crashes = [0, 16, 32, 48].map(time => ({ time, duration: 0.5, note: 49, velocity: 110 }));
  return {
    bpm: 140,
    parts: [
      { channel: 0, program: 29, volume: 115, notes: repeat(riff, 4, 16) },
      { channel: 1, program: 33, volume: 110, notes: repeat(bass, 4, 16) },
      { channel: 2, program: 81, volume: 90, notes: shift(solo, 32) },
      { channel: DRUM_CHANNEL, volume: 110, notes: [...beat, ...crashes] }
    ]
  };
}

function transpose(name, semitones) {
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const value = midi(name) + semitones;
  return `${NAMES[value % 12]}${Math.floor(value / 12) - 1}`;
}

writeSong('17_The_Silent_Film', silentFilm());
writeSong('18_The_Alien_Mothership', mothership());
writeSong('19_The_Rainbow_Of_Webs', rainbow());
writeSong('20_The_World_That_Falls_Up', risingWorld());
writeSong('21_The_Giants_Kitchen', kitchen());
writeSong('22_The_Octopus_Rock_Concert', concert());
