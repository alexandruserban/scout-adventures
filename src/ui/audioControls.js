/** Music and sound toggles, shared by the toolbar buttons and the keyboard shortcuts (B and M). */
(function (Forest) {
  const { Synth, Music } = Forest;
  const musicButton = document.getElementById('btn-music');
  const soundButton = document.getElementById('btn-sound');

  function toggleMusic() {
    const isPlaying = Music.toggle();
    musicButton.textContent = isPlaying ? '🎵 MUSIC: ON' : '🎵 MUSIC: OFF';
  }

  function toggleSound() {
    const muted = !Synth.muted;
    Synth.muted = muted;
    Music.setMuted(muted);
    soundButton.textContent = muted ? '🔇 SOUND: OFF' : '🔊 SOUND: ON';
  }

  musicButton.addEventListener('click', toggleMusic);
  soundButton.addEventListener('click', toggleSound);

  // Music is on by default, but browsers only allow audio after the player's first tap or
  // key press, so it starts then. That first press runs before any click or shortcut handler,
  // so tapping the music button (or pressing B) first still turns the music off as expected.
  const UNLOCK_EVENTS = ['pointerdown', 'touchend', 'keydown'];
  function startMusicOnFirstInput() {
    UNLOCK_EVENTS.forEach(type => window.removeEventListener(type, startMusicOnFirstInput, true));
    if (!Music.isPlaying) {
      Synth.resume();
      Music.start();
    }
  }
  UNLOCK_EVENTS.forEach(type => window.addEventListener(type, startMusicOnFirstInput, true));

  Forest.AudioControls = { toggleMusic, toggleSound };
})(window.Forest);
