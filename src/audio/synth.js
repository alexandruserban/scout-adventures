/**
 * Tiny Web Audio synthesizer: one-shot tones and filtered noise bursts.
 * All game sounds are generated procedurally from these two building blocks.
 */
(function (Forest) {
  class Synth {
    constructor() {
      /** @type {AudioContext|null} created lazily: browsers only allow audio after a user gesture */
      this.context = null;
      this.muted = false;
    }

    /** Create the AudioContext on first use and wake it up if the browser suspended it. */
    resume() {
      if (!this.context) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.context = new AudioContextClass();
      }
      if (this.context.state === 'suspended') {
        this.context.resume();
      }
      return this.context;
    }

    /**
     * Play a single oscillator note with a pitch sweep and a fade-out.
     * @param {object} tone
     * @param {OscillatorType} tone.wave 'square' | 'triangle' | 'sawtooth' | 'sine'
     * @param {number} tone.frequency starting pitch in Hz
     * @param {number} [tone.endFrequency] pitch to sweep to (omit for a steady note)
     * @param {number} tone.duration seconds until the note stops
     * @param {number} [tone.sweepDuration] seconds the pitch sweep takes (defaults to duration)
     * @param {number} tone.volume starting gain
     * @param {number} [tone.endVolume] gain reached at the end of the fade
     * @param {number} [tone.delay] seconds from now before the note starts
     */
    playTone({ wave, frequency, endFrequency, duration, sweepDuration = duration, volume, endVolume = 0.01, delay = 0 }) {
      if (this.muted) return;
      const ctx = this.resume();
      const start = ctx.currentTime + delay;

      const oscillator = ctx.createOscillator();
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(frequency, start);
      if (endFrequency !== undefined) {
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + sweepDuration);
      }

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(endVolume, start + duration);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
    }

    /**
     * Play a burst of white noise through a filter.
     * @param {object} noise
     * @param {number} noise.duration seconds of noise
     * @param {BiquadFilterType} noise.filterType 'lowpass' | 'highpass' | 'bandpass'
     * @param {number} noise.filterFrequency starting cutoff in Hz
     * @param {number} [noise.endFilterFrequency] cutoff to sweep to (omit for a fixed filter)
     * @param {number} [noise.sweepDuration] seconds the cutoff sweep takes (defaults to duration)
     * @param {number} [noise.resonance] filter Q
     * @param {number} noise.volume starting gain
     * @param {number} [noise.endVolume] gain reached at the end of the fade
     */
    playNoise({ duration, filterType, filterFrequency, endFilterFrequency, sweepDuration = duration, resonance, volume, endVolume = 0.001 }) {
      if (this.muted) return;
      const ctx = this.resume();
      const start = ctx.currentTime;

      const source = ctx.createBufferSource();
      source.buffer = this.createNoiseBuffer(duration);

      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(filterFrequency, start);
      if (endFilterFrequency !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(endFilterFrequency, start + sweepDuration);
      }
      if (resonance !== undefined) {
        filter.Q.value = resonance;
      }

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(endVolume, start + duration);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start(start);
    }

    createNoiseBuffer(seconds) {
      const ctx = this.context;
      const sampleCount = Math.floor(ctx.sampleRate * seconds);
      const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < sampleCount; i++) {
        samples[i] = Math.random() * 2 - 1;
      }
      return buffer;
    }
  }

  Forest.Synth = new Synth();
})(window.Forest);
