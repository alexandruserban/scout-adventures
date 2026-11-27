/**
 * Background music: each world plays its own MIDI soundtrack (src/level-soundtrack) on loop,
 * and switches to its boss's fight theme (src/boss-soundtrack) during the boss fight.
 * Without a level track it plays soundtrack.mp3, and falls back to a procedural chiptune
 * if that file can't be played.
 */
(function (Forest) {
  const synth = Forest.Synth;
  const { Midi, LevelTracks, BossTracks } = Forest;

  const SOUNDTRACK_URL = 'soundtrack.mp3';
  const SOUNDTRACK_VOLUME = 0.55;
  const LEVEL_TRACK_VOLUME = 0.6;

  /** Which file in src/level-soundtrack each world (theme id) plays. */
  const LEVEL_TRACK_BY_THEME = Object.freeze({
    forest: '01_The_Whispering_Forest',
    dungeon: '02_The_Sunken_Dungeon',
    treetops: '03_The_Cloud_Canopy',
    desert: '04_The_Scorching_Dunes',
    ice: '05_The_Frozen_Peaks',
    volcano: '06_The_Molten_Core',
    candy: '07_The_Candy_Kingdom',
    moon: '08_The_Silent_Moon',
    neon: '09_Neon_Spell_City_SciFi',
    crystal: '10_The_Circuit_Crystal_Caves_SciFi',
    clockwork: '11_The_Clockwork_Sky_Citadel_SciFi',
    atlantis: '12_Techno_Atlantis_SciFi',
    fae: '13_The_Holo_Fae_Garden_SciFi',
    mechKeep: '14_The_Mech_Dragon_Keep_SciFi',
    rift: '15_The_Quantum_Rift_SciFi',
    station: '16_The_Starwizard_Station_SciFi',
    noir: '17_The_Silent_Film',
    mothership: '18_The_Alien_Mothership',
    rainbow: '19_The_Rainbow_Of_Webs',
    rising: '20_The_World_That_Falls_Up',
    kitchen: '21_The_Giants_Kitchen',
    concert: '22_The_Octopus_Rock_Concert'
  });

  /** Which file in src/boss-soundtrack each world's boss fights to. */
  const BOSS_TRACK_BY_THEME = Object.freeze({
    forest: '01_King_Thunder_Jelly',
    dungeon: '02_The_Cinder_Golem',
    treetops: '03_The_Gloomwing_Queen',
    desert: '04_The_Dune_Thornback',
    ice: '05_The_Frost_Behemoth',
    volcano: '06_The_Magma_Golem',
    candy: '07_The_Jawbreaker',
    moon: '08_The_Star_Devourer',
    neon: '09_The_Neon_Wyrm',
    crystal: '10_The_Crystal_Sentinel',
    clockwork: '11_The_Brass_Beetle_Titan',
    atlantis: '12_The_Abyssal_Megajelly',
    fae: '13_The_Pixie_Moth_Empress',
    mechKeep: '14_The_Dragon_Mech',
    rift: '15_The_Void_Knight',
    station: '16_The_Cosmic_Archmage',
    noir: '17_The_Ink_Blot_Golem',
    mothership: '18_The_Hive_Queen',
    rainbow: '19_The_Prism_Widow',
    rising: '20_The_Gravity_Thief',
    kitchen: '21_The_Mighty_Jello',
    concert: '22_The_Tentacle_King_Of_Rock'
  });

  const parsedSongs = new Map();

  /** A bundled track parsed once and cached; null if it's missing or can't be read. */
  function parsedSong(tracks, key) {
    if (!key || !tracks || !tracks[key]) return null;
    if (!parsedSongs.has(key)) {
      let song = null;
      try {
        song = Midi.parse(Midi.bytesFromBase64(tracks[key]));
      } catch (error) {
        console.warn(`Track ${key} could not be read`, error);
      }
      parsedSongs.set(key, song);
    }
    return parsedSongs.get(key);
  }

  /** The parsed MIDI song for a world, or null if it has none (or it can't be read). */
  function songForTheme(themeId) {
    return parsedSong(LevelTracks, LEVEL_TRACK_BY_THEME[themeId]);
  }

  /** The parsed fight theme of a world's boss, or null if it has none. */
  function bossSongForTheme(themeId) {
    return parsedSong(BossTracks, BOSS_TRACK_BY_THEME[themeId]);
  }

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
      this.themeId = null;
      /** True during a boss fight: the boss's theme plays instead of the world's. */
      this.bossFight = false;
      this.levelLoop = null;
      /** Why everything is silenced right now ('background', 'pause'); it plays again once none are left. */
      this.quietReasons = new Set();
    }

    /** Switch to a world's soundtrack (theme id); restarts the music if it's playing. */
    setLevel(themeId) {
      if (themeId === this.themeId && !this.bossFight) return;
      this.themeId = themeId;
      this.bossFight = false; // (re)starting a level always begins with the world's own music
      if (this.isPlaying) this.start();
    }

    /** The boss fight starts (true) or ends (false): swap between the boss's theme and the world's. */
    setBossFight(active) {
      if (active === this.bossFight) return;
      this.bossFight = active;
      if (this.isPlaying) this.start();
    }

    /** Play the current world's MIDI track, or its boss's theme in a fight. Returns false if it has none. */
    startLevelTrack() {
      const bossSong = this.bossFight ? bossSongForTheme(this.themeId) : null;
      const song = bossSong || songForTheme(this.themeId);
      if (!song || !song.notes.length) return false;
      try {
        // Boss themes are written to end on the bar line, so they repeat without a pause
        this.levelLoop = new Midi.MidiLoop(synth.resume(), song, LEVEL_TRACK_VOLUME, bossSong ? { loopGap: 0 } : undefined);
        this.levelLoop.setMuted(synth.muted, LEVEL_TRACK_VOLUME);
        this.levelLoop.start();
        return true;
      } catch (error) {
        console.warn('Level track playback failed, using the default soundtrack', error);
        this.levelLoop = null;
        return false;
      }
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

      if (this.startLevelTrack()) return;

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
      if (this.levelLoop) {
        this.levelLoop.dispose();
        this.levelLoop = null;
      }
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
      if (this.levelLoop) {
        this.levelLoop.setMuted(muted, LEVEL_TRACK_VOLUME);
      }
    }

    /** The app went to the background (true) or came back (false): music and sounds freeze meanwhile. */
    setBackgrounded(backgrounded) {
      this.setQuiet('background', backgrounded);
    }

    /** The game is paused (true) on the pause menu, or resumed (false): the music stops meanwhile. */
    setPaused(paused) {
      this.setQuiet('pause', paused);
    }

    /**
     * Silence everything for `reason`, or lift it; the music only plays on once no reason is left
     * (e.g. coming back to the app with the pause menu still open stays quiet). The MIDI tracks and
     * the chiptune run on the synth, which freezes in place; the mp3 soundtrack is paused here.
     */
    setQuiet(reason, quiet) {
      if (quiet) this.quietReasons.add(reason);
      else this.quietReasons.delete(reason);
      const silenced = this.quietReasons.size > 0;
      if (silenced === synth.backgrounded) return;
      synth.setBackgrounded(silenced);
      if (!this.soundtrack || this.levelLoop || this.chiptuneTimer) return;
      if (silenced) {
        this.soundtrack.pause();
      } else if (this.isPlaying) {
        const playPromise = this.soundtrack.play();
        if (playPromise) playPromise.catch(() => {});
      }
    }

    startChiptune() {
      this.stop();
      this.isPlaying = true;
      let step = 0;
      this.chiptuneTimer = setInterval(() => {
        // While muted (or in the background) the song pauses in place rather than playing silently
        if (synth.muted || synth.backgrounded || !this.isPlaying) return;
        synth.resume();
        playChiptuneStep(step);
        step++;
      }, STEP_MS);
    }
  }

  Forest.Music = new MusicPlayer();
})(window.Forest);
