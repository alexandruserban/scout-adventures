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
    },

    /** Gentle chime when a heart is restored. */
    heal() {
      [523.2, 659.3, 784.0].forEach((frequency, index) => {
        synth.playTone({ wave: 'triangle', frequency, duration: 0.18, volume: 0.1, delay: index * 0.07 });
      });
    },

    /** Coin-like double blip for bonus points. */
    bonusPoints() {
      synth.playTone({ wave: 'square', frequency: 988, duration: 0.06, volume: 0.08 });
      synth.playTone({ wave: 'square', frequency: 1319, duration: 0.14, volume: 0.08, delay: 0.06 });
    },

    /** Curious little rising jingle for a new scrapbook entry. */
    newSpecies() {
      [392.0, 523.2, 659.3, 1046.5].forEach((frequency, index) => {
        synth.playTone({ wave: 'square', frequency, duration: 0.1, volume: 0.07, delay: index * 0.08 });
      });
    },

    // ==========================================
    // Waves
    // ==========================================

    /** Ominous minor fanfare announcing a new wave. */
    waveStart() {
      const notes = [220.0, 261.6, 329.6, 311.1]; // A3 C4 E4 Eb4
      notes.forEach((frequency, index) => {
        synth.playTone({ wave: 'square', frequency, duration: 0.2, volume: 0.07, delay: index * 0.13 });
      });
      synth.playTone({ wave: 'triangle', frequency: 110, duration: 0.7, volume: 0.15, delay: 0.39 });
    },

    /** Bright victory arpeggio when a wave is wiped out. */
    waveCleared() {
      const notes = [392.0, 523.2, 659.3, 784.0, 1046.5]; // G4 C5 E5 G5 C6
      notes.forEach((frequency, index) => {
        synth.playTone({ wave: 'square', frequency, duration: 0.14, volume: 0.07, delay: index * 0.07 });
      });
    },

    // ==========================================
    // Sky creatures
    // ==========================================

    /** Falling whistle as something drops out of the sky. */
    skyWhistle() {
      synth.playTone({ wave: 'sine', frequency: 1500, endFrequency: 420, duration: 0.9, volume: 0.035, endVolume: 0.001 });
    },

    /** Generic heavy landing thump. */
    creatureLand() {
      synth.playTone({ wave: 'sine', frequency: 120, endFrequency: 45, duration: 0.16, volume: 0.3, endVolume: 0.001 });
      synth.playNoise({ duration: 0.08, filterType: 'lowpass', filterFrequency: 900, volume: 0.12 });
    },

    creatureHit() {
      synth.playTone({ wave: 'square', frequency: 330, endFrequency: 110, duration: 0.1, volume: 0.13 });
      synth.playNoise({ duration: 0.06, filterType: 'highpass', filterFrequency: 2500, volume: 0.1 });
    },

    /** The acorn shell cracks open. */
    acornCrack() {
      synth.playNoise({ duration: 0.05, filterType: 'highpass', filterFrequency: 3000, volume: 0.16 });
      synth.playTone({ wave: 'square', frequency: 700, endFrequency: 1100, duration: 0.07, volume: 0.06, delay: 0.04 });
    },

    /** Beetle scraping its legs before a charge. */
    beetleGrowl() {
      synth.playTone({ wave: 'sawtooth', frequency: 70, endFrequency: 110, duration: 0.5, volume: 0.12, endVolume: 0.02 });
    },

    beetleCharge() {
      synth.playNoise({ duration: 0.35, filterType: 'bandpass', filterFrequency: 400, endFilterFrequency: 1600, resonance: 3, volume: 0.2 });
    },

    /** Moth unfurls its wings. */
    wingFlutter() {
      synth.playNoise({ duration: 0.18, filterType: 'bandpass', filterFrequency: 2200, resonance: 6, volume: 0.08 });
    },

    /** Moth's shriek as it dives. */
    swoopScreech() {
      synth.playTone({ wave: 'square', frequency: 900, endFrequency: 1700, duration: 0.18, volume: 0.06 });
      synth.playTone({ wave: 'square', frequency: 1700, endFrequency: 700, duration: 0.25, volume: 0.05, delay: 0.16 });
    },

    jellyBoing() {
      synth.playTone({ wave: 'sine', frequency: 180, endFrequency: 520, duration: 0.2, volume: 0.15 });
    },

    /** Lightning crackling along the grass. */
    jellyZap() {
      synth.playNoise({ duration: 0.25, filterType: 'highpass', filterFrequency: 1800, volume: 0.18 });
      synth.playTone({ wave: 'sawtooth', frequency: 1200, endFrequency: 80, duration: 0.25, volume: 0.08 });
    },

    /** Meteor-like impact of the golem. */
    golemLand() {
      synth.playNoise({ duration: 0.9, filterType: 'lowpass', filterFrequency: 2400, endFilterFrequency: 60, volume: 0.55 });
      synth.playTone({ wave: 'sine', frequency: 90, endFrequency: 28, duration: 0.7, volume: 0.5, endVolume: 0.001 });
    },

    golemStep() {
      synth.playTone({ wave: 'sine', frequency: 70, endFrequency: 35, duration: 0.12, volume: 0.22, endVolume: 0.001 });
    },

    golemRoar() {
      synth.playTone({ wave: 'sawtooth', frequency: 95, endFrequency: 55, duration: 0.8, volume: 0.16, endVolume: 0.005 });
      synth.playNoise({ duration: 0.6, filterType: 'bandpass', filterFrequency: 300, resonance: 2, volume: 0.15 });
    },

    fireballLaunch() {
      synth.playNoise({ duration: 0.3, filterType: 'bandpass', filterFrequency: 600, endFilterFrequency: 2400, resonance: 2, volume: 0.18 });
    },

    fireballImpact() {
      synth.playNoise({ duration: 0.25, filterType: 'lowpass', filterFrequency: 1600, endFilterFrequency: 150, volume: 0.22 });
    }
  };
})(window.Forest);
