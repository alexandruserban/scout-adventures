/**
 * Background music: plays soundtrack.mp3 on loop, falling back to a procedural
 * chiptune if the file can't be played.
 */
(function (Forest) {
  const synth = Forest.Synth;

  const SOUNDTRACK_URL = 'soundtrack.mp3';
  const SOUNDTRACK_VOLUME = 0.55;

  // ==========================================
  // Fallback chiptune: driving battle theme in D minor, 150 BPM, 16th-note steps
  // ==========================================
  const STEP_MS = 100;
  const STEP_SECONDS = STEP_MS / 1000;

  const NOTE = {
    D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, Bb3: 233.08, C4: 261.63,
    D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, Bb4: 466.16, C5: 523.25
  };
  const REST = 0;

  const { D3, E3, F3, G3, A3, Bb3, C4, D4, E4, F4, G4, A4, Bb4, C5 } = NOTE;
  const _ = REST;

  const LEAD_MELODY = [
    D4, _, D4, F4, G4, _, A4, _,
    Bb4, A4, G4, F4, G4, A4, F4, E4,
    D4, _, D4, A4, C5, _, Bb4, A4,
    G4, F4, E4, F4, D4, _, D4, _
  ];

  const BASSLINE = [
    D3, D3, _, D3, F3, _, G3, _,
    Bb3, _, A3, _, G3, F3, E3, C4,
    D3, D3, _, D3, F3, _, G3, _,
    Bb3, A3, G3, F3, E3, F3, D3, _
  ];

  const DRUM = { REST: 0, HAT: 1, SNARE: 2, KICK: 3 };
  const { HAT: H, SNARE: S, KICK: K } = DRUM;

  const DRUM_PATTERN = [
    K, H, H, H, S, H, K, H,
    K, H, S, H, S, H, H, S,
    K, H, H, H, S, H, K, H,
    K, H, S, S, K, S, H, S
  ];

  const STEPS_PER_LOOP = LEAD_MELODY.length;

  function playChiptuneStep(step) {
    const position = step % STEPS_PER_LOOP;

    const leadNote = LEAD_MELODY[position];
    if (leadNote !== REST) {
      const isAccent = position % 4 === 0; // accent the downbeats for urgency
      synth.playTone({
        wave: 'square', frequency: leadNote, duration: STEP_SECONDS * 0.9,
        volume: isAccent ? 0.055 : 0.038, endVolume: 0.001
      });
    }

    const bassNote = BASSLINE[position];
    if (bassNote !== REST) {
      synth.playTone({ wave: 'triangle', frequency: bassNote, duration: STEP_SECONDS * 0.85, volume: 0.07, endVolume: 0.002 });
    }

    switch (DRUM_PATTERN[position]) {
      case DRUM.KICK:
        synth.playTone({ wave: 'sine', frequency: 150, endFrequency: 35, duration: 0.07, volume: 0.12, endVolume: 0.001 });
        break;
      case DRUM.SNARE:
        synth.playNoise({ duration: 0.06, filterType: 'highpass', filterFrequency: 1200, volume: 0.08 });
        break;
      case DRUM.HAT:
        synth.playNoise({ duration: 0.02, filterType: 'highpass', filterFrequency: 5000, volume: 0.035 });
        break;
    }
  }

  // ==========================================
  // Music player
  // ==========================================
  class MusicPlayer {
    constructor() {
      this.isPlaying = false;
      this.chiptuneTimer = null;
      this.soundtrack = this.createSoundtrackElement();
    }

    createSoundtrackElement() {
      try {
        const audio = new Audio(SOUNDTRACK_URL);
        audio.loop = true;
        audio.volume = SOUNDTRACK_VOLUME;
        return audio;
      } catch (error) {
        console.warn('HTML5 Audio init failed, will fall back to the procedural chiptune', error);
        return null;
      }
    }

    /** Start or stop the music. Returns true if music is now playing. */
    toggle() {
      synth.resume(); // must happen inside the user's click/keypress to unlock audio
      if (this.isPlaying) {
        this.stop();
      } else {
        this.start();
      }
      return this.isPlaying;
    }

    start() {
      this.stop();
      this.isPlaying = true;

      if (!this.soundtrack) {
        this.soundtrack = this.createSoundtrackElement();
      }
      if (!this.soundtrack) {
        this.startChiptune();
        return;
      }

      this.soundtrack.currentTime = 0;
      this.soundtrack.muted = synth.muted;
      this.soundtrack.volume = SOUNDTRACK_VOLUME;
      const playPromise = this.soundtrack.play();
      if (playPromise) {
        playPromise.catch(error => {
          console.warn('Soundtrack playback failed, falling back to the chiptune loop:', error);
          this.startChiptune();
        });
      }
    }

    stop() {
      if (this.soundtrack) {
        this.soundtrack.pause();
        this.soundtrack.currentTime = 0;
      }
      if (this.chiptuneTimer) {
        clearInterval(this.chiptuneTimer);
        this.chiptuneTimer = null;
      }
      this.isPlaying = false;
    }

    setMuted(muted) {
      if (this.soundtrack) {
        this.soundtrack.muted = muted;
      }
    }

    startChiptune() {
      this.stop();
      this.isPlaying = true;
      let step = 0;
      this.chiptuneTimer = setInterval(() => {
        // While muted the song pauses in place rather than playing silently
        if (synth.muted || !this.isPlaying) return;
        synth.resume();
        playChiptuneStep(step);
        step++;
      }, STEP_MS);
    }
  }

  Forest.Music = new MusicPlayer();
})(window.Forest);
