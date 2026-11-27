/**
 * A tiny Standard MIDI File player built on the Web Audio API.
 *
 * `MidiSong.parse(bytes)` turns a .mid file into a flat list of timed notes, and
 * `MidiLoop` plays one on repeat with simple chiptune-style voices (oscillators for
 * instruments, filtered noise for the drum channel). No soundfonts, no dependencies.
 */
(function (Forest) {
  const DRUM_CHANNEL = 9;
  const SCHEDULE_AHEAD_SECONDS = 0.35;
  const SCHEDULER_INTERVAL_MS = 60;
  const RELEASE_SECONDS = 0.06;
  const LOOP_GAP_SECONDS = 0.4;

  // ==========================================
  // Parsing
  // ==========================================

  function readVarLength(bytes, position) {
    let value = 0;
    let byte;
    do {
      byte = bytes[position++];
      value = (value << 7) | (byte & 0x7f);
    } while (byte & 0x80);
    return { value, position };
  }

  function readUint(bytes, position, length) {
    let value = 0;
    for (let i = 0; i < length; i++) value = value * 256 + bytes[position + i];
    return value;
  }

  /** Every raw event from every track, as { tick, order, ... } in file order. */
  function readTrackEvents(bytes, trackCount, firstTrackPosition) {
    const events = [];
    let position = firstTrackPosition;
    let order = 0;

    for (let track = 0; track < trackCount && position + 8 <= bytes.length; track++) {
      const length = readUint(bytes, position + 4, 4);
      let cursor = position + 8;
      const end = Math.min(bytes.length, cursor + length);
      let tick = 0;
      let runningStatus = 0;

      while (cursor < end) {
        const delta = readVarLength(bytes, cursor);
        tick += delta.value;
        cursor = delta.position;
        let status = bytes[cursor];

        if (status === 0xff) {
          const type = bytes[cursor + 1];
          const meta = readVarLength(bytes, cursor + 2);
          if (type === 0x51) events.push({ tick, order: order++, type: 'tempo', microsPerBeat: readUint(bytes, meta.position, 3) });
          if (type === 0x2f) events.push({ tick, order: order++, type: 'end' });
          cursor = meta.position + meta.value;
          continue;
        }
        if (status === 0xf0 || status === 0xf7) {
          const sysex = readVarLength(bytes, cursor + 1);
          cursor = sysex.position + sysex.value;
          continue;
        }

        if (status & 0x80) {
          runningStatus = status;
          cursor++;
        } else {
          status = runningStatus;
        }
        const kind = status & 0xf0;
        const channel = status & 0x0f;
        const data1 = bytes[cursor];
        const data2 = bytes[cursor + 1];

        if (kind === 0xc0 || kind === 0xd0) {
          if (kind === 0xc0) events.push({ tick, order: order++, type: 'program', channel, program: data1 });
          cursor += 1;
        } else {
          if (kind === 0x90 && data2 > 0) events.push({ tick, order: order++, type: 'on', channel, note: data1, velocity: data2 });
          else if (kind === 0x80 || kind === 0x90) events.push({ tick, order: order++, type: 'off', channel, note: data1 });
          else if (kind === 0xb0) events.push({ tick, order: order++, type: 'control', channel, controller: data1, value: data2 });
          cursor += 2;
        }
      }
      position = position + 8 + length;
    }
    return events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  }

  /**
   * Parse a .mid file into { notes, duration }. Each note is
   * { time, duration, channel, note, velocity, program, volume } with times in seconds.
   */
  function parse(bytes) {
    if (readUint(bytes, 0, 4) !== 0x4d546864) throw new Error('Not a MIDI file');
    const headerLength = readUint(bytes, 4, 4);
    const trackCount = readUint(bytes, 10, 2);
    const division = readUint(bytes, 12, 2);
    if (division & 0x8000) throw new Error('SMPTE-timed MIDI files are not supported');

    const events = readTrackEvents(bytes, trackCount, 8 + headerLength);

    let microsPerBeat = 500000;
    let lastTick = 0;
    let lastSeconds = 0;
    const toSeconds = tick => lastSeconds + ((tick - lastTick) * microsPerBeat) / division / 1e6;

    const programs = new Array(16).fill(0);
    const volumes = new Array(16).fill(100 / 127);
    const expressions = new Array(16).fill(1);
    const sounding = new Map();
    const notes = [];
    let endSeconds = 0;

    for (const event of events) {
      const seconds = toSeconds(event.tick);
      endSeconds = Math.max(endSeconds, seconds);

      switch (event.type) {
        case 'tempo':
          lastSeconds = seconds;
          lastTick = event.tick;
          microsPerBeat = event.microsPerBeat;
          break;
        case 'program':
          programs[event.channel] = event.program;
          break;
        case 'control':
          if (event.controller === 7) volumes[event.channel] = event.value / 127;
          if (event.controller === 11) expressions[event.channel] = event.value / 127;
          break;
        case 'on': {
          const key = event.channel * 128 + event.note;
          const note = {
            time: seconds, duration: 0, channel: event.channel, note: event.note,
            velocity: event.velocity / 127, program: programs[event.channel],
            volume: volumes[event.channel] * expressions[event.channel]
          };
          if (!sounding.has(key)) sounding.set(key, []);
          sounding.get(key).push(note);
          notes.push(note);
          break;
        }
        case 'off': {
          const stack = sounding.get(event.channel * 128 + event.note);
          const note = stack && stack.shift();
          if (note) note.duration = seconds - note.time;
          break;
        }
      }
    }

    // Notes that never got a note-off ring until the end of the song
    for (const stack of sounding.values()) {
      for (const note of stack) if (!note.duration) note.duration = Math.max(0.1, endSeconds - note.time);
    }
    for (const note of notes) endSeconds = Math.max(endSeconds, note.time + note.duration);

    return { notes, duration: endSeconds };
  }

  /** Decode a base64 string (how the bundled level tracks are stored) into bytes. */
  function bytesFromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  // ==========================================
  // Voices
  // ==========================================

  /** A chiptune-flavoured stand-in for each General MIDI instrument family. */
  function voiceForProgram(program) {
    const family = Math.floor(program / 8);
    switch (family) {
      case 0: return { wave: 'triangle', gain: 0.5, decay: 1.2 };   // pianos
      case 1: return { wave: 'sine', gain: 0.55, decay: 0.5 };      // bells, glockenspiel, marimba
      case 2: return { wave: 'square', gain: 0.22, decay: 0 };      // organs
      case 3: return { wave: 'triangle', gain: 0.45, decay: 0.9 };  // guitars
      case 4: return { wave: 'triangle', gain: 0.7, decay: 0 };     // basses
      case 5: case 6: return { wave: 'sawtooth', gain: 0.18, decay: 0 }; // strings and choirs
      case 7: return { wave: 'sawtooth', gain: 0.2, decay: 0 };     // brass
      case 8: case 9: return { wave: 'square', gain: 0.2, decay: 0 }; // reeds and pipes
      case 10: return { wave: 'square', gain: 0.22, decay: 0 };     // synth leads
      case 11: return { wave: 'triangle', gain: 0.4, decay: 0 };    // synth pads
      default: return { wave: 'triangle', gain: 0.4, decay: 0.6 };
    }
  }

  function frequencyOf(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  // ==========================================
  // Looping playback
  // ==========================================

  class MidiLoop {
    /**
     * @param {AudioContext} context
     * @param {{notes: Array, duration: number}} song  from `parse`
     * @param {number} volume  master volume (0..1)
     * @param {{loopGap?: number}} options  silence between repeats (seconds); 0 for tracks written to loop seamlessly
     */
    constructor(context, song, volume, { loopGap = LOOP_GAP_SECONDS } = {}) {
      this.context = context;
      this.song = song;
      this.loopLength = song.duration + loopGap;
      this.timer = null;
      this.activeSources = new Set();

      this.master = context.createGain();
      this.master.gain.value = volume;
      const tone = context.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 5200; // takes the fizz off the sawtooth and square voices
      this.master.connect(tone);
      tone.connect(context.destination);

      this.noiseBuffer = this.createNoiseBuffer();
    }

    start() {
      this.stop();
      this.loopStart = this.context.currentTime + 0.08;
      this.nextNote = 0;
      this.timer = setInterval(() => this.schedule(), SCHEDULER_INTERVAL_MS);
      this.schedule();
    }

    stop() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      const now = this.context.currentTime;
      for (const source of this.activeSources) {
        try { source.stop(now); } catch (error) { /* already stopped */ }
      }
      this.activeSources.clear();
    }

    /** Stop for good and unhook from the speakers (a new loop is made for the next song). */
    dispose() {
      this.stop();
      this.master.disconnect();
    }

    setMuted(muted, volume) {
      this.master.gain.setTargetAtTime(muted ? 0 : volume, this.context.currentTime, 0.02);
    }

    /** Queue every note that starts within the look-ahead window, wrapping around at the song's end. */
    schedule() {
      const { notes } = this.song;
      if (!notes.length) return;
      const horizon = this.context.currentTime + SCHEDULE_AHEAD_SECONDS;

      while (true) {
        if (this.nextNote >= notes.length) {
          this.nextNote = 0;
          this.loopStart += this.loopLength;
        }
        const note = notes[this.nextNote];
        const startTime = this.loopStart + note.time;
        if (startTime > horizon) break;
        // A note we fell behind on (e.g. the tab was in the background) is skipped, not crammed in late
        if (startTime >= this.context.currentTime - 0.05) this.playNote(note, Math.max(startTime, this.context.currentTime));
        this.nextNote++;
      }
    }

    playNote(note, startTime) {
      if (note.channel === DRUM_CHANNEL) {
        this.playDrum(note, startTime);
        return;
      }
      const ctx = this.context;
      const voice = voiceForProgram(note.program);
      const peak = voice.gain * note.velocity * note.volume * 0.3;
      if (peak <= 0) return;

      const oscillator = ctx.createOscillator();
      oscillator.type = voice.wave;
      oscillator.frequency.value = frequencyOf(note.note);

      const gain = ctx.createGain();
      const releaseAt = startTime + Math.max(0.03, note.duration);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(peak, startTime + 0.008);
      if (voice.decay > 0) {
        // Plucked and struck sounds fade on their own while held
        gain.gain.setTargetAtTime(peak * 0.25, startTime + 0.01, voice.decay / 3);
      }
      gain.gain.setTargetAtTime(0, releaseAt, RELEASE_SECONDS / 3);

      oscillator.connect(gain);
      gain.connect(this.master);
      this.track(oscillator);
      oscillator.start(startTime);
      oscillator.stop(releaseAt + RELEASE_SECONDS * 2);
    }

    playDrum(note, startTime) {
      const ctx = this.context;
      const level = note.velocity * note.volume * 0.35;
      const key = note.note;

      if (key === 35 || key === 36) { // kick
        const oscillator = ctx.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(150, startTime);
        oscillator.frequency.exponentialRampToValueAtTime(40, startTime + 0.09);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(level * 1.4, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.14);
        oscillator.connect(gain);
        gain.connect(this.master);
        this.track(oscillator);
        oscillator.start(startTime);
        oscillator.stop(startTime + 0.16);
        return;
      }

      const isHat = key === 42 || key === 44 || key === 46;
      const isCymbal = key === 49 || key === 51 || key === 52 || key === 55 || key === 57 || key === 59;
      const isSnare = key === 37 || key === 38 || key === 39 || key === 40;
      let filterType = 'bandpass';
      let frequency = 300 + (key - 41) * 40; // toms and percussion: pitch follows the key
      let length = 0.12;
      let loudness = level;
      if (isHat) { filterType = 'highpass'; frequency = 7000; length = key === 46 ? 0.18 : 0.04; loudness = level * 0.5; }
      else if (isCymbal) { filterType = 'highpass'; frequency = 5000; length = 0.45; loudness = level * 0.45; }
      else if (isSnare) { filterType = 'highpass'; frequency = 1500; length = 0.11; }

      const source = ctx.createBufferSource();
      source.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = Math.max(80, frequency);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(loudness, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + length);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      this.track(source);
      source.start(startTime);
      source.stop(startTime + length + 0.02);
    }

    track(source) {
      this.activeSources.add(source);
      source.onended = () => this.activeSources.delete(source);
    }

    createNoiseBuffer() {
      const ctx = this.context;
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      return buffer;
    }
  }

  Forest.Midi = Object.freeze({ parse, bytesFromBase64, MidiLoop });
})(window.Forest);
