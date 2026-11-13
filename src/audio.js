// Retro 8-bit Web Audio Synthesizer for Forest Adventure
// Generates authentic retro sound effects procedurally without external audio assets

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmPlaying = false;
    this.bgmInterval = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playJump() {
    if (this.muted) return;
    this.init();
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.12);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  playDoubleJump() {
    if (this.muted) return;
    this.init();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Upbeat dual rising chiptune chirp
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(260, now);
    osc1.frequency.exponentialRampToValueAtTime(540, now + 0.08);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.08);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(540, now + 0.06);
    osc2.frequency.exponentialRampToValueAtTime(840, now + 0.16);
    gain2.gain.setValueAtTime(0.12, now + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.16);
  }

  playSlash() {
    if (this.muted) return;
    this.init();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Filtered noise swoosh of heavy two-handed sword cleave
    const bufferSize = ctx.sampleRate * 0.14;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(250, now + 0.14);
    filter.Q.value = 2.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    // Resonant metallic steel blade ring
    const steelOsc = ctx.createOscillator();
    const steelGain = ctx.createGain();
    steelOsc.type = 'triangle';
    steelOsc.frequency.setValueAtTime(880, now);
    steelOsc.frequency.exponentialRampToValueAtTime(320, now + 0.12);
    steelGain.gain.setValueAtTime(0.08, now);
    steelGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    steelOsc.connect(steelGain);
    steelGain.connect(ctx.destination);
    steelOsc.start(now);
    steelOsc.stop(now + 0.12);
  }

  playMushroomHit() {
    if (this.muted) return;
    this.init();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Crunchy impact (square wave drop + squelch)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.15);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);

    // High squeak layer
    const squeak = ctx.createOscillator();
    const squeakGain = ctx.createGain();
    squeak.type = 'sawtooth';
    squeak.frequency.setValueAtTime(550, now);
    squeak.frequency.exponentialRampToValueAtTime(280, now + 0.1);
    squeakGain.gain.setValueAtTime(0.08, now);
    squeakGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    squeak.connect(squeakGain);
    squeakGain.connect(ctx.destination);
    squeak.start(now);
    squeak.stop(now + 0.1);
  }

  playBoyHurt() {
    if (this.muted) return;
    this.init();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.22);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  // Short white-noise buffer helper
  _noiseBuffer(seconds) {
    const ctx = this.ctx;
    const size = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // Heavy sword slamming down into the ground
  playSlamImpact() {
    if (this.muted) return;
    this.init();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Low body thump
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(140, now);
    thump.frequency.exponentialRampToValueAtTime(40, now + 0.18);
    thumpGain.gain.setValueAtTime(0.45, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    thump.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    thump.start(now);
    thump.stop(now + 0.2);

    // Dirt crunch
    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(0.12);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400, now);
    lp.frequency.exponentialRampToValueAtTime(200, now + 0.12);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.3, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    noise.connect(lp);
    lp.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
  }

  // Mushroom bursting apart
  playExplosion() {
    if (this.muted) return;
    this.init();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Rumbling noise burst with a falling lowpass
    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(0.6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3200, now);
    lp.frequency.exponentialRampToValueAtTime(120, now + 0.55);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.5, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    noise.connect(lp);
    lp.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);

    // 8-bit square "boom" drop
    const boom = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boom.type = 'square';
    boom.frequency.setValueAtTime(180, now);
    boom.frequency.exponentialRampToValueAtTime(30, now + 0.35);
    boomGain.gain.setValueAtTime(0.18, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    boom.connect(boomGain);
    boomGain.connect(ctx.destination);
    boom.start(now);
    boom.stop(now + 0.35);
  }

  playMushroomDefeated() {
    if (this.muted) return;
    this.init();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Victory pop & chime
    [261.6, 329.6, 392.0, 523.2].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.12, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.05 + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.15);
    });
  }

  toggleMusic() {
    this.init();
    if (this.bgmPlaying) {
      this.stopMusic();
      return false;
    } else {
      this.startChiptuneLoop();
      this.bgmPlaying = true;
      return true;
    }
  }

  stopMusic() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    this.bgmPlaying = false;
  }

  startChiptuneLoop() {
    this.stopMusic();
    this.bgmPlaying = true;

    // Driving, tense, energetic 16-bit action chiptune in D minor (150 BPM)
    // 16th note subdivision: ~100ms per step
    const STEP_MS = 100;

    // Fast melodic lead line (crisp square wave with pulse-width feel)
    // 32-step phrase looping with energetic variations
    const D3 = 146.83, F3 = 174.61, G3 = 196.00, A3 = 220.00, Bb3 = 233.08, C4 = 261.63;
    const D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.00, A4 = 440.00, Bb4 = 466.16, C5 = 523.25, D5 = 587.33;

    // Lead melody pattern (32 sixteenth notes) - driving battle theme
    const leadPattern = [
      D4, 0, D4, F4, G4, 0, A4, 0,
      Bb4, A4, G4, F4, G4, A4, F4, E4,
      D4, 0, D4, A4, C5, 0, Bb4, A4,
      G4, F4, E4, F4, D4, 0, D4, 0
    ];

    // Driving syncopated bassline (punchy triangle/saw bass)
    const bassPattern = [
      D3, D3, 0, D3, F3, 0, G3, 0,
      Bb3, 0, A3, 0, G3, F3, E3, C4,
      D3, D3, 0, D3, F3, 0, G3, 0,
      Bb3, A3, G3, F3, E3, F3, D3, 0
    ];

    // Hi-hat / snare rhythm (0 = rest, 1 = closed hat, 2 = snare/noise pop, 3 = kick)
    const drumPattern = [
      3, 1, 1, 1,  2, 1, 3, 1,
      3, 1, 2, 1,  2, 1, 1, 2,
      3, 1, 1, 1,  2, 1, 3, 1,
      3, 1, 2, 2,  3, 2, 1, 2
    ];

    let step = 0;

    this.bgmInterval = setInterval(() => {
      if (this.muted || !this.bgmPlaying) return;
      if (!this.ctx) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const curStep = step % 32;

      // 1. LEAD SYNTH (Square Wave - fast, punchy 8-bit lead)
      const leadNote = leadPattern[curStep];
      if (leadNote > 0) {
        const leadOsc = ctx.createOscillator();
        const leadGain = ctx.createGain();
        leadOsc.type = 'square';
        leadOsc.frequency.setValueAtTime(leadNote, now);

        // Accent certain beats for urgency
        const isAccent = (curStep % 8 === 0) || (curStep % 8 === 4);
        const peakVol = isAccent ? 0.055 : 0.038;

        leadGain.gain.setValueAtTime(peakVol, now);
        leadGain.gain.exponentialRampToValueAtTime(0.001, now + (STEP_MS / 1000) * 0.9);

        leadOsc.connect(leadGain);
        leadGain.connect(ctx.destination);

        leadOsc.start(now);
        leadOsc.stop(now + (STEP_MS / 1000) * 0.9);
      }

      // 2. BASSLINE (Triangle / Low Saw - driving urgent groove)
      const bassNote = bassPattern[curStep];
      if (bassNote > 0) {
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(bassNote, now);

        bassGain.gain.setValueAtTime(0.07, now);
        bassGain.gain.exponentialRampToValueAtTime(0.002, now + (STEP_MS / 1000) * 0.85);

        bassOsc.connect(bassGain);
        bassGain.connect(ctx.destination);

        bassOsc.start(now);
        bassOsc.stop(now + (STEP_MS / 1000) * 0.85);
      }

      // 3. CHIPTUNE PERCUSSION (Kicks, Snare pops, Hi-hat clicks)
      const drum = drumPattern[curStep];
      if (drum === 3) {
        // Chiptune Kick: fast pitch drop sine
        const kickOsc = ctx.createOscillator();
        const kickGain = ctx.createGain();
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(150, now);
        kickOsc.frequency.exponentialRampToValueAtTime(35, now + 0.07);

        kickGain.gain.setValueAtTime(0.12, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

        kickOsc.connect(kickGain);
        kickGain.connect(ctx.destination);
        kickOsc.start(now);
        kickOsc.stop(now + 0.07);
      } else if (drum === 2) {
        // Chiptune Snare / Noise burst
        const noise = ctx.createBufferSource();
        noise.buffer = this._noiseBuffer(0.06);
        const nFilter = ctx.createBiquadFilter();
        nFilter.type = 'highpass';
        nFilter.frequency.setValueAtTime(1200, now);

        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.08, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        noise.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(ctx.destination);
        noise.start(now);
      } else if (drum === 1) {
        // Crisp Hi-hat click
        const hat = ctx.createBufferSource();
        hat.buffer = this._noiseBuffer(0.02);
        const hFilter = ctx.createBiquadFilter();
        hFilter.type = 'highpass';
        hFilter.frequency.setValueAtTime(5000, now);

        const hGain = ctx.createGain();
        hGain.gain.setValueAtTime(0.035, now);
        hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

        hat.connect(hFilter);
        hFilter.connect(hGain);
        hGain.connect(ctx.destination);
        hat.start(now);
      }

      step++;
    }, STEP_MS);
  }
}

window.SoundEngine = new SoundEngine();
