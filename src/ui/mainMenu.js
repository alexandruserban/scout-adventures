/**
 * The main menu: the title screen when the game first starts, and the pause menu (Esc) during play.
 * Forest.Game shows it, saying what PLAY / RESUME and NEW ADVENTURE do.
 * It also holds the toolbar's buttons (CRT, gallery), since desktops hide the toolbar.
 */
(function (Forest) {
  const { Difficulty, Synth, Music, AudioControls } = Forest;

  const screen = document.getElementById('main-menu');
  const playButton = document.getElementById('menu-play');
  const newGameButton = document.getElementById('menu-new');
  const subtitleElement = document.getElementById('menu-subtitle');
  const crtButton = document.getElementById('menu-crt');
  const galleryButton = document.getElementById('menu-gallery');
  const difficultyButton = document.getElementById('menu-difficulty');
  const scrapbookButton = document.getElementById('menu-scrapbook');
  const musicButton = document.getElementById('menu-music');
  const soundButton = document.getElementById('menu-sound');
  const bestElement = document.getElementById('menu-best');
  const boyCanvas = document.getElementById('menu-boy');

  const DIFFICULTY_ICONS = { EASY: '🌱', NORMAL: '⚔️', HARD: '💀' };
  const PLAY_LABELS = { title: '▶ PLAY', continue: '▶ CONTINUE', resume: '▶ RESUME', restart: '▶ START GAME' };
  const BOY_FRAME_MS = 260;

  let onPlay = null;
  let onNewGame = null;
  let getBestPoints = () => 0;
  let boyTimer = null;
  /** Music is on by default but only starts on the first tap or key press (see AudioControls). */
  let hasInteracted = false;
  ['pointerdown', 'touchend', 'keydown'].forEach(type => window.addEventListener(type, () => { hasInteracted = true; }, true));

  function isOpen() {
    return screen.style.display === 'flex';
  }

  /** The scrapbook or the sprite gallery is open on top of the menu. */
  function isCoveredByOverlay() {
    return ['scrapbook-overlay', 'gallery-overlay'].some(id => document.getElementById(id).style.display === 'flex');
  }

  function refresh() {
    const level = Difficulty.current;
    difficultyButton.textContent = `${DIFFICULTY_ICONS[level.id]} ${level.label} · ${level.startHearts} ♥`;
    difficultyButton.dataset.level = level.id;
    musicButton.textContent = Music.isPlaying || !hasInteracted ? '🎵 MUSIC: ON' : '🎵 MUSIC: OFF';
    soundButton.textContent = Synth.muted ? '🔇 SOUND: OFF' : '🔊 SOUND: ON';
    crtButton.textContent = document.getElementById('btn-crt').textContent;
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
   * @param {'title'|'pause'} [options.mode] the title screen, or the pause menu during a game
   * @param {() => void} options.onPlay starts (or continues) the adventure (title) or carries on playing (pause)
   * @param {string} [options.playAction] title screen: 'continue' when there's a saved adventure (see PLAY_LABELS)
   * @param {string} [options.playDetail] added to the big button's label, e.g. the level a saved adventure is on
   * @param {() => void} [options.onNewGame] start a fresh adventure (pause menu, or the title screen with a saved one)
   * @param {() => number} [options.getBestPoints] high score for the current difficulty
   */
  function show(options) {
    const isPause = options.mode === 'pause';
    onPlay = options.onPlay;
    onNewGame = options.onNewGame || null;
    setPlayAction(isPause ? 'resume' : options.playAction || 'title', options.playDetail);
    subtitleElement.textContent = isPause ? '⏸ PAUSED' : "THE BOY'S QUEST";
    newGameButton.style.display = onNewGame ? '' : 'none';
    if (options.getBestPoints) getBestPoints = options.getBestPoints;
    screen.style.display = 'flex';
    refresh();
    startBoy();
    playButton.focus({ preventScroll: true });
  }

  /** The big button's label: one of PLAY_LABELS, with an optional detail (e.g. "LEVEL 5"). */
  function setPlayAction(action, detail) {
    playButton.textContent = detail ? `${PLAY_LABELS[action]} · ${detail}` : PLAY_LABELS[action];
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
  newGameButton.addEventListener('click', () => {
    newGameButton.blur();
    if (isOpen() && onNewGame) onNewGame();
  });
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
  crtButton.addEventListener('click', () => {
    document.getElementById('btn-crt').click();
    crtButton.blur();
    refresh();
  });
  galleryButton.addEventListener('click', () => {
    galleryButton.blur();
    document.getElementById('btn-gallery').click();
  });

  Difficulty.onChange(() => {
    if (isOpen()) refresh();
  });

  // Enter plays (or resumes); other keys (B, M) may have changed the audio, so the labels follow
  window.addEventListener('keydown', event => {
    if (!isOpen()) return;
    if (event.key === 'Enter' && !isCoveredByOverlay()) {
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
    isCoveredByOverlay,
    /**
     * Pause menu: the big button resumes the game ('resume'), or starts a fresh one ('restart')
     * once a different difficulty has been picked. Title screen: 'continue' or 'title' (PLAY).
     */
    setPlayAction,
    get isOpen() {
      return isOpen();
    }
  };
})(window.Forest);
