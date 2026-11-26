/**
 * What defeating things is worth: points, the chance of a heart dropping, and which scrapbook
 * species an enemy belongs to. All the reward tuning lives here.
 */
(function (Forest) {
  const { MonsterSpecies } = Forest;

  /** Points for the hand-made enemies, by kind. */
  const NATIVE_POINTS = {
    mushroom: 50, nutling: 10, thornback: 25, gloomwing: 30, jelly: 40, golem: 300, spider: 25, crawler: 30, octorocker: 60,
    ...Object.fromEntries(Forest.WorldCreatures.species.map(({ kind, points }) => [kind, points]))
  };
  /** The little halves of a split Thunder Jelly. */
  const MINI_JELLY_POINTS = 15;

  // --- Random monsters: points grow with how dangerous they are ---
  const MONSTER_BASE_POINTS = 20;
  const MONSTER_POINTS_PER_POWER = 10;
  const MONSTER_POINTS_PER_ABILITY = 15;
  const MONSTER_POINTS_PER_HP = 5;
  /** Minis from Brood / Splitter are worth this fraction. */
  const MINI_POINTS_SCALE = 1 / 3;

  // --- Other points ---
  const NEW_SPECIES_POINTS = 100;
  const WAVE_CLEARED_POINTS_PER_WAVE = 50;
  /** A heart picked up with full health turns into points instead. */
  const SPARE_HEART_POINTS = 50;

  // --- Heart drops (chance per defeat) ---
  const NATIVE_HEART_CHANCE = {
    mushroom: 0.15, nutling: 0.05, thornback: 0.08, gloomwing: 0.08, jelly: 0.1, golem: 1, spider: 0.08, crawler: 0.08, octorocker: 0.15,
    ...Object.fromEntries(Forest.WorldCreatures.species.map(({ kind, heartChance }) => [kind, heartChance]))
  };
  const MINI_HEART_CHANCE = 0.04;
  const MONSTER_HEART_CHANCE = 0.2;
  const MONSTER_HEART_CHANCE_PER_POWER = 0.03;
  const MONSTER_MAX_HEART_CHANCE = 0.5;

  /** Points are always a multiple of 5. */
  function roundPoints(points) {
    return Math.max(5, Math.round(points / 5) * 5);
  }

  /** @param {object} enemy any foe (mushroom, sky creature or random monster) */
  function pointsFor(enemy) {
    const genome = enemy.genome;
    if (genome) {
      const points = MONSTER_BASE_POINTS
        + MONSTER_POINTS_PER_POWER * genome.power
        + MONSTER_POINTS_PER_ABILITY * genome.abilities.length
        + MONSTER_POINTS_PER_HP * enemy.maxHp;
      return roundPoints(genome.isMini ? points * MINI_POINTS_SCALE : points);
    }
    if (enemy.kind === 'jelly' && enemy.isMini) return MINI_JELLY_POINTS;
    return NATIVE_POINTS[enemy.kind] || 10;
  }

  /** Chance (0..1) that the enemy drops a heart when defeated, raised on easier difficulties. */
  function heartDropChance(enemy) {
    return Math.min(1, baseHeartDropChance(enemy) * Forest.Difficulty.current.heartDropScale);
  }

  function baseHeartDropChance(enemy) {
    const genome = enemy.genome;
    if (genome) {
      if (genome.isMini) return MINI_HEART_CHANCE;
      return Math.min(MONSTER_MAX_HEART_CHANCE, MONSTER_HEART_CHANCE + MONSTER_HEART_CHANCE_PER_POWER * genome.power);
    }
    if (enemy.isMini) return MINI_HEART_CHANCE;
    return NATIVE_HEART_CHANCE[enemy.kind] || 0;
  }

  /** The scrapbook species an enemy belongs to (see Forest.MonsterSpecies). */
  function speciesOf(enemy) {
    return enemy.genome ? MonsterSpecies.forGenome(enemy.genome) : MonsterSpecies.get(enemy.kind);
  }

  Forest.Rewards = Object.freeze({
    NEW_SPECIES_POINTS,
    WAVE_CLEARED_POINTS_PER_WAVE,
    SPARE_HEART_POINTS,
    pointsFor,
    heartDropChance,
    speciesOf
  });
})(window.Forest);
