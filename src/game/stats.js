/**
 * Lifetime stats: time played, adventures, levels, monsters, coins and so on, kept in
 * localStorage so they add up across sessions (see Forest.StatsView for the menu page).
 * Training sessions only add to the time played.
 */
(function (Forest) {
  const STORAGE_KEY = 'forest-pixel-adventure.stats';
  const SAVE_VERSION = 1;
  /** Changes are written out at most this often (and whenever the page is hidden). */
  const SAVE_EVERY_MS = 5000;

  const EMPTY = Object.freeze({
    playSeconds: 0,
    adventuresStarted: 0,
    adventuresCompleted: 0,
    levelsCleared: 0,
    furthestLevel: 0,
    bossesDefeated: 0,
    monstersDefeated: 0,
    coinsCollected: 0,
    perfectLevels: 0,
    gameOvers: 0
  });

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.version === SAVE_VERSION && saved.stats) {
        const stats = { ...EMPTY };
        Object.keys(EMPTY).forEach(key => {
          if (Number.isFinite(saved.stats[key]) && saved.stats[key] >= 0) stats[key] = saved.stats[key];
        });
        return stats;
      }
    } catch (error) {
      // Unreadable: start counting afresh
    }
    return { ...EMPTY };
  }

  const stats = load();
  let isDirty = false;

  function save() {
    if (!isDirty) return;
    isDirty = false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SAVE_VERSION, stats }));
    } catch (error) {
      // Storage unavailable: the stats just aren't remembered
    }
  }

  setInterval(save, SAVE_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
  });
  window.addEventListener('pagehide', save);

  Forest.Stats = {
    /** Count one more (or `amount` more) of a stat, e.g. Stats.add('coinsCollected'). */
    add(key, amount = 1) {
      stats[key] += amount;
      isDirty = true;
    },

    /** Raise a stat to `value` if that's higher (e.g. the furthest level reached). */
    raise(key, value) {
      if (value <= stats[key]) return;
      stats[key] = value;
      isDirty = true;
    },

    /** A copy of every stat. */
    get all() {
      return { ...stats };
    },

    /** Write any changes out now. */
    save
  };
})(window.Forest);
