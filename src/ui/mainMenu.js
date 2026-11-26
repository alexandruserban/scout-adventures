/**
 * The title screen shown when the game first starts: play, difficulty, scrapbook and audio.
 * Forest.Game shows it (with what PLAY does) once everything has loaded.
 */
(function (Forest) {
  const { Difficulty, Synth, Music, AudioControls } = Forest;

  const screen = document.getElementById('main-menu');
  const playButton = document.getElementById('menu-play');
  const difficultyButton = document.getElementById('menu-difficulty');
  const scrapbookButton = document.getElementById('menu-scrapbook');
  const musicButton = document.getElementById('menu-music');
  const soundButton = document.getElementById('menu-sound');
  const bestElement = document.getElementById('menu-best');
  const boyCanvas = document.getElementById('menu-boy');

  const DIFFICULTY_ICONS = { EASY: '🌱', NORMAL: '⚔️', HARD: '💀' };
  const BOY_FRAME_MS = 260;

  let onPlay = null;
  let getBestPoints = () => 0;
  let boyTimer = null;
  /** Music is on by default but only starts on the first tap or key press (see AudioControls). */
  let hasInteracted = false;
  ['pointerdown', 'touchend', 'keydown'].forEach(type => window.addEventListener(type, () => { hasInteracted = true; }, true));

  function isOpen() {
    return screen.style.display === 'flex';
  }

  function refresh() {
    const level = Difficulty.current;
    difficultyButton.textContent = `${DIFFICULTY_ICONS[level.id]} ${level.label} · ${level.startHearts} ♥`;
    difficultyButton.dataset.level = level.id;
    musicButton.textContent = Music.isPlaying || !hasInteracted ? '🎵 MUSIC: ON' : '🎵 MUSIC: OFF';
    soundButton.textContent = Synth.muted ? '🔇 SOUND: OFF' : '🔊 SOUND: ON';
    const best = getBestPoints();
    bestElement.textContent = best > 0 ? `HIGH SCORE (${level.label}): ${best.toLocaleString()}` : '';
  }

  /** The boy idles (breathes) next to the title. */
  function startBoy() {
    stopBoy();
    const frames = Forest.BoySprites && Forest.BoySprites.idle;
    if (!frames || !frames.length || !boyCanvas) return;
    const context = boyCanvas.getContext('2d');
    boyCanvas.width = frames[0].width;
    boyCanvas.height = frames[0].height;
    let frame = 0;
    const draw = () => {
      context.clearRect(0, 0, boyCanvas.width, boyCanvas.height);
      context.drawImage(frames[frame % frames.length], 0, 0);
      frame++;
    };
    draw();
    boyTimer = setInterval(draw, BOY_FRAME_MS);
  }

  function stopBoy() {
    if (boyTimer) clearInterval(boyTimer);
    boyTimer = null;
  }

  /**
   * @param {object} options
   * @param {() => void} options.onPlay starts the adventure
   * @param {() => number} [options.getBestPoints] high score for the current difficulty
   */
  function show(options) {
    onPlay = options.onPlay;
    if (options.getBestPoints) getBestPoints = options.getBestPoints;
    screen.style.display = 'flex';
    refresh();
    startBoy();
    playButton.focus({ preventScroll: true });
  }

  function hide() {
    screen.style.display = 'none';
    stopBoy();
  }

  function play() {
    if (!isOpen() || !onPlay) return;
    playButton.blur();
    onPlay();
  }

  playButton.addEventListener('click', play);
  difficultyButton.addEventListener('click', () => {
    Difficulty.cycle();
    difficultyButton.blur();
  });
  scrapbookButton.addEventListener('click', () => {
    scrapbookButton.blur();
    document.getElementById('btn-scrapbook').click();
  });
  musicButton.addEventListener('click', () => {
    AudioControls.toggleMusic();
    musicButton.blur();
    refresh();
  });
  soundButton.addEventListener('click', () => {
    AudioControls.toggleSound();
    soundButton.blur();
    refresh();
  });

  Difficulty.onChange(() => {
    if (isOpen()) refresh();
  });

  // Enter starts the game; other keys (B, M) may have changed the audio, so the labels follow
  window.addEventListener('keydown', event => {
    if (!isOpen()) return;
    const scrapbookOpen = document.getElementById('scrapbook-overlay').style.display === 'flex';
    if (event.key === 'Enter' && !scrapbookOpen) {
      event.preventDefault();
      play();
    }
  });
  window.addEventListener('keyup', () => {
    if (isOpen()) refresh();
  });
  // The music starts on the first tap anywhere (see AudioControls), so refresh after it
  window.addEventListener('pointerup', () => {
    if (isOpen()) setTimeout(refresh, 0);
  });

  Forest.MainMenu = {
    show,
    hide,
    get isOpen() {
      return isOpen();
    }
  };
})(window.Forest);
