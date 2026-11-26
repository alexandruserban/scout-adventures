/**
 * The stats page (📊 STATS on the main menu): lifetime stats from Forest.Stats, the scrapbook's
 * progress and the high score at each difficulty. The game is paused while it's open.
 */
(function (Forest) {
  const { Stats, Scrapbook, Difficulty } = Forest;

  const overlay = document.getElementById('stats-overlay');
  const list = document.getElementById('stats-content');
  const openButton = document.getElementById('menu-stats');
  const closeButton = document.getElementById('btn-stats-close');

  /** Same keys main.js keeps the high scores under. */
  const BEST_POINTS_STORAGE_KEY = 'forest-pixel-adventure.bestPoints';
  const DIFFICULTY_ICONS = { EASY: '🌱', NORMAL: '⚔️', HARD: '💀' };

  function isOpen() {
    return overlay.style.display === 'flex';
  }

  function open() {
    Stats.save();
    render();
    overlay.style.display = 'flex';
    if (Forest.Game) Forest.Game.setPaused(true, 'stats');
    closeButton.focus({ preventScroll: true });
  }

  function close() {
    overlay.style.display = 'none';
    if (Forest.Game) Forest.Game.setPaused(false, 'stats');
  }

  /** e.g. "2 h 05 min", "12 min", "40 s". */
  function formatTime(seconds) {
    const total = Math.floor(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
    if (minutes > 0) return `${minutes} min`;
    return `${total} s`;
  }

  function bestPoints(levelId) {
    try {
      return Number(localStorage.getItem(`${BEST_POINTS_STORAGE_KEY}.${levelId}`)) || 0;
    } catch (error) {
      return 0;
    }
  }

  function render() {
    const stats = Stats.all;
    const number = value => Math.floor(value).toLocaleString();
    const rows = [
      ['⏱', 'TIME PLAYED', formatTime(stats.playSeconds)],
      ['🗺', 'ADVENTURES STARTED', number(stats.adventuresStarted)],
      ['🏆', 'ADVENTURES COMPLETED', number(stats.adventuresCompleted)],
      ['✨', 'LEVELS CLEARED', number(stats.levelsCleared)],
      ['🚩', 'FURTHEST LEVEL', stats.furthestLevel ? `${stats.furthestLevel} OF ${Forest.Levels.themes.length}` : '-'],
      ['🌟', 'PERFECT LEVELS', number(stats.perfectLevels)],
      ['👑', 'BOSSES DEFEATED', number(stats.bossesDefeated)],
      ['⚔', 'MONSTERS DEFEATED', number(stats.monstersDefeated)],
      ['🪙', 'COINS COLLECTED', number(stats.coinsCollected)],
      ['💔', 'GAME OVERS', number(stats.gameOvers)],
      ['📖', 'SPECIES DISCOVERED', `${Scrapbook.discoveredCount} OF ${Scrapbook.totalSpecies}`],
      ...Object.keys(Difficulty.LEVELS).map(id => [DIFFICULTY_ICONS[id] || '', `HIGH SCORE (${Difficulty.LEVELS[id].label})`, number(bestPoints(id))])
    ];
    list.replaceChildren(...rows.map(([icon, label, value]) => {
      const row = document.createElement('div');
      row.className = 'stats-row';
      const name = document.createElement('span');
      name.className = 'stats-label';
      name.textContent = `${icon} ${label}`;
      const amount = document.createElement('span');
      amount.className = 'stats-value';
      amount.textContent = value;
      row.append(name, amount);
      return row;
    }));
  }

  openButton.addEventListener('click', () => {
    openButton.blur();
    open();
  });
  closeButton.addEventListener('click', close);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) close();
  });
  window.addEventListener('keydown', event => {
    if (event.code === 'Escape' && isOpen()) close();
  });

  Forest.StatsView = {
    open,
    close,
    get isOpen() {
      return isOpen();
    }
  };
})(window.Forest);
