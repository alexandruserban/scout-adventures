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
      maxHearts: 10,
      /**
       * How many hearts wait in each level, on its heart spots (see Forest.Levels; a level has 12-17).
       * Infinity: every spot.
       */
      placedHearts: Infinity,
      /** Share of the falling lava bombs that come down close to the boy (the rest land clear of him). */
      lavaBombAimedChance: 0.1,
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
      bossMutantReduction: 1,
      /** Added to how many minions each stage of a boss fight brings. */
      bossMinionBonus: -1,
      /** Multiplies the strength of a level's random monsters (fewer abilities and less health in later worlds). */
      monsterPowerScale: 0.7
    }),
    NORMAL: Object.freeze({
      id: 'NORMAL',
      label: 'NORMAL',
      startHearts: 6,
      maxHearts: 8,
      placedHearts: 15,
      lavaBombAimedChance: 0.2,
      heartDropScale: 1.8,
      creatureSpeed: 1,
      creatureHpBonus: 0,
      spawnIntervalScale: 1,
      cycleRamp: 0.5,
      pointsMultiplier: 1.5,
      bossEscortScale: 0.67,
      bossMutantReduction: 1,
      bossMinionBonus: 0,
      monsterPowerScale: 0.8
    }),
    HARD: Object.freeze({
      id: 'HARD',
      label: 'HARD',
      startHearts: 3,
      maxHearts: 6,
      placedHearts: 7,
      lavaBombAimedChance: 0.35,
      heartDropScale: 1,
      creatureSpeed: 1.25,
      creatureHpBonus: 1,
      spawnIntervalScale: 0.8,
      cycleRamp: 1,
      pointsMultiplier: 2,
      bossEscortScale: 1,
      bossMutantReduction: 0,
      bossMinionBonus: 1,
      monsterPowerScale: 1
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
