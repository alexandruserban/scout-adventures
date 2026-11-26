/**
 * Difficulty levels (Easy / Normal / Hard) and the currently selected one.
 * The choice is remembered in the browser between visits.
 */
(function (Forest) {
  const STORAGE_KEY = 'forest-pixel-adventure.difficulty';

  const LEVELS = Object.freeze({
    EASY: Object.freeze({
      id: 'EASY',
      label: 'EASY',
      startHearts: 10,
      /** Boss rewards can raise the hearts up to this many. */
      maxHearts: 12,
      /** Share of a level's heart spots (see Forest.Levels) that have a heart waiting. */
      placedHeartShare: 1,
      heartsPerWaveCleared: 2,
      /** Multiplies the chance of a defeated foe dropping a heart. */
      heartDropScale: 2,
      /** Multiplies how fast sky creatures move and attack. */
      creatureSpeed: 0.8,
      /** Added to every sky creature's health (never below 1). */
      creatureHpBonus: -1,
      /** Multiplies the time between creatures falling. */
      spawnIntervalScale: 1.3,
      /**
       * How much tougher each repeat of the five waves gets (1 = full ramp). Scales the extra
       * health, speed, numbers and mutant strength that later cycles add.
       */
      cycleRamp: 0.4,
      /** Multiplies the points for every defeated foe. */
      pointsMultiplier: 1,
      /** Multiplies the boss wave's fixed escorts (the nutlings and gloomwing beside the golem). */
      bossEscortScale: 0.34,
      /** This many fewer mutants join each boss wave. */
      bossMutantReduction: 1
    }),
    NORMAL: Object.freeze({
      id: 'NORMAL',
      label: 'NORMAL',
      startHearts: 5,
      maxHearts: 8,
      placedHeartShare: 0.5,
      heartsPerWaveCleared: 1,
      heartDropScale: 1.5,
      creatureSpeed: 1,
      creatureHpBonus: 0,
      spawnIntervalScale: 1,
      cycleRamp: 0.7,
      pointsMultiplier: 1.5,
      bossEscortScale: 0.67,
      bossMutantReduction: 1
    }),
    HARD: Object.freeze({
      id: 'HARD',
      label: 'HARD',
      startHearts: 3,
      maxHearts: 6,
      placedHeartShare: 0.25,
      /** No healing between waves; only beating a boss restores hearts. */
      heartsPerWaveCleared: 0,
      heartDropScale: 1,
      creatureSpeed: 1.25,
      creatureHpBonus: 1,
      spawnIntervalScale: 0.8,
      cycleRamp: 1,
      pointsMultiplier: 2,
      bossEscortScale: 1,
      bossMutantReduction: 0
    })
  });

  const ORDER = [LEVELS.EASY, LEVELS.NORMAL, LEVELS.HARD];

  function loadSavedLevel() {
    try {
      return LEVELS[localStorage.getItem(STORAGE_KEY)] || LEVELS.NORMAL;
    } catch (error) {
      return LEVELS.NORMAL;
    }
  }

  let currentLevel = loadSavedLevel();
  const listeners = [];

  Forest.Difficulty = {
    LEVELS,

    get current() {
      return currentLevel;
    },

    /** Switch to the next level (Easy -> Normal -> Hard -> Easy) and notify listeners. */
    cycle() {
      currentLevel = ORDER[(ORDER.indexOf(currentLevel) + 1) % ORDER.length];
      try {
        localStorage.setItem(STORAGE_KEY, currentLevel.id);
      } catch (error) {
        // Storage unavailable: the choice just isn't remembered next time
      }
      listeners.forEach(listener => listener(currentLevel));
      return currentLevel;
    },

    /** @param {(level: object) => void} listener called after the level changes */
    onChange(listener) {
      listeners.push(listener);
    }
  };
})(window.Forest);
