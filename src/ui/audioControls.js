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

  Forest.AudioControls = { toggleMusic, toggleSound };
})(window.Forest);
