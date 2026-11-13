/** Retro 8-bit sound effects, generated procedurally (no audio files needed). */
(function (Forest) {
  const synth = Forest.Synth;

  Forest.SoundEffects = {
    jump() {
      synth.playTone({ wave: 'square', frequency: 140, endFrequency: 420, duration: 0.12, volume: 0.12 });
    },

    /** Upbeat two-step rising chirp. */
    doubleJump() {
      synth.playTone({ wave: 'square', frequency: 260, endFrequency: 540, duration: 0.08, volume: 0.12 });
      synth.playTone({ wave: 'square', frequency: 540, endFrequency: 840, duration: 0.1, volume: 0.12, delay: 0.06 });
    },

    /** Heavy two-handed sword swoosh with a metallic ring. */
    swordSwing() {
      synth.playNoise({
        duration: 0.14, filterType: 'bandpass', filterFrequency: 1800, endFilterFrequency: 250,
        resonance: 2.5, volume: 0.24, endVolume: 0.01
      });
      synth.playTone({ wave: 'triangle', frequency: 880, endFrequency: 320, duration: 0.12, volume: 0.08, endVolume: 0.001 });
    },

    /** Sword slamming into the ground: low thump plus dirt crunch. */
    slamImpact() {
      synth.playTone({
        wave: 'sine', frequency: 140, endFrequency: 40, sweepDuration: 0.18,
        duration: 0.2, volume: 0.45, endVolume: 0.001
      });
      synth.playNoise({ duration: 0.12, filterType: 'lowpass', filterFrequency: 1400, endFilterFrequency: 200, volume: 0.3 });
    },

    /** Crunchy impact with a high squeak. */
    mushroomHit() {
      synth.playTone({ wave: 'triangle', frequency: 260, endFrequency: 70, duration: 0.15, volume: 0.25 });
      synth.playTone({ wave: 'sawtooth', frequency: 550, endFrequency: 280, duration: 0.1, volume: 0.08 });
    },

    /** Rumbling noise burst with an 8-bit "boom" drop. */
    mushroomExplosion() {
      synth.playNoise({
        duration: 0.6, filterType: 'lowpass', filterFrequency: 3200, endFilterFrequency: 120,
        sweepDuration: 0.55, volume: 0.5
      });
      synth.playTone({ wave: 'square', frequency: 180, endFrequency: 30, duration: 0.35, volume: 0.18, endVolume: 0.001 });
    },

    /** Quick rising C-major arpeggio. */
    mushroomDefeated() {
      const arpeggio = [261.6, 329.6, 392.0, 523.2]; // C4 E4 G4 C5
      arpeggio.forEach((frequency, index) => {
        synth.playTone({ wave: 'sine', frequency, duration: 0.15, volume: 0.12, delay: index * 0.05 });
      });
    },

    playerHurt() {
      synth.playTone({ wave: 'sawtooth', frequency: 210, endFrequency: 90, duration: 0.22, volume: 0.25 });
    }
  };
})(window.Forest);
