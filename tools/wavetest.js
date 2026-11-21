/**
 * How much health enemies start with, by wave and difficulty.
 * Drives the real WaveDirector through waves 1-20 on Easy, Normal and Hard, then builds real
 * creatures from what it spawns. Not loaded by the game.
 *
 * Usage (from the project folder): node tools/wavetest.js
 * Exits with code 1 if any check fails.
 */
const { loadGame, createWorld, createChecker, noop } = require('./testHarness');

const Forest = loadGame();
const { check, finish } = createChecker();
const LEVELS = Forest.Difficulty.LEVELS;
const LEVEL_ORDER = ['EASY', 'NORMAL', 'HARD'];
const WAVE_COUNT = 20;
const KINDS = ['nutling', 'thornback', 'gloomwing', 'jelly', 'golem'];
const WAVE_MAIN_KIND = ['nutling', 'thornback', 'gloomwing', 'jelly', 'golem']; // waves 1-5, then repeats
/** Queue entries of randomly generated Monster Forge monsters. */
const MUTANT = 'mutant';
const Forge = Forest.MonsterForge;

/** Spawn a queue entry the way main.js does. */
function spawn(world, { kind, stats, genome }) {
  return kind === MUTANT
    ? Forge.create(world, { genome, x: 0, stats, onDefeated: noop })
    : new Forest.SkyCreatures[kind](world, { x: 0, stats, onDefeated: noop });
}

/** Switch the game's real difficulty setting (it only cycles forwards). */
function setDifficulty(id) {
  while (Forest.Difficulty.current.id !== id) Forest.Difficulty.cycle();
}

/** All waves 1..count as the real WaveDirector announces them. */
function playWaves(count) {
  const waves = [];
  const director = new Forest.WaveDirector({
    spawnCreature: noop, countLivingCreatures: () => 0, getPlayerX: () => 0, onWaveAnnounced: noop, onWaveCleared: noop
  });
  director.start();
  waves.push(director.currentWave);
  while (waves.length < count) {
    director.announceNextWave();
    waves.push(director.currentWave);
  }
  return waves;
}

/**
 * Health of each hand-made kind in a wave; every creature of the same kind must agree (escorts included).
 * Mutants are left out: each one is random (they get their own checks in section 4).
 */
function healthByKind(wave) {
  const result = {};
  wave.queue.forEach(({ kind, stats }) => {
    if (kind === MUTANT) return;
    if (kind in result && result[kind] !== stats.hp) {
      check(`wave ${wave.number}: every ${kind} has the same health`, false, `${result[kind]} vs ${stats.hp}`);
    }
    result[kind] = stats.hp;
  });
  return result;
}

const results = {}; // results[level][waveNumber] = { kind: hp }
LEVEL_ORDER.forEach(id => {
  setDifficulty(id);
  results[id] = {};
  playWaves(WAVE_COUNT).forEach(wave => { results[id][wave.number] = healthByKind(wave); });
});

// ---------- 1. Exact starting health for the first two cycles (the designed values) ----------
const EXPECTED = {
  //            nutling thornback gloomwing jelly golem
  NORMAL: { 1: [1, 1, 1, 1, 10], 2: [2, 3, 3, 5, 14], 3: [3, 4, 4, 7, 18] },
  EASY: { 1: [1, 1, 1, 1, 7], 2: [2, 2, 2, 4, 11], 3: [3, 3, 3, 6, 15] },
  HARD: { 1: [1, 1, 1, 1, 13], 2: [3, 4, 4, 6, 17], 3: [4, 5, 5, 8, 21] }
};
LEVEL_ORDER.forEach(id => {
  Object.entries(EXPECTED[id]).forEach(([cycleNumber, hps]) => {
    KINDS.forEach((kind, k) => {
      // The wave (1-5 of that cycle) that features this kind as its main creature
      const waveNumber = (cycleNumber - 1) * 5 + WAVE_MAIN_KIND.indexOf(kind) + 1;
      const actual = results[id][waveNumber][kind];
      check(`${id} wave ${waveNumber}: ${kind} starts with ${hps[k]} hp`, actual === hps[k], `got ${actual}`);
    });
  });
});

// ---------- 2. Rules that must hold for every wave ----------
LEVEL_ORDER.forEach(id => {
  for (let n = 1; n <= WAVE_COUNT; n++) {
    Object.entries(results[id][n]).forEach(([kind, hp]) => {
      check(`${id} wave ${n}: ${kind} has at least 1 hp`, hp >= 1, `got ${hp}`);
      // Same kind in a later wave is never weaker
      for (let later = n + 1; later <= WAVE_COUNT; later++) {
        const laterHp = results[id][later][kind];
        if (laterHp !== undefined) check(`${id}: ${kind} never gets weaker (wave ${n} -> ${later})`, laterHp >= hp, `${hp} -> ${laterHp}`);
      }
    });
  }
});

for (let n = 1; n <= WAVE_COUNT; n++) {
  KINDS.forEach(kind => {
    const [easy, normal, hard] = LEVEL_ORDER.map(id => results[id][n][kind]);
    if (easy === undefined || normal === undefined || hard === undefined) return;
    check(`wave ${n}: ${kind} health Easy <= Normal <= Hard`, easy <= normal && normal <= hard, `${easy} / ${normal} / ${hard}`);
  });
}

// Every new cycle (waves 6, 11, 16) adds health to the featured creature
LEVEL_ORDER.forEach(id => {
  for (let n = 6; n <= WAVE_COUNT; n++) {
    const kind = WAVE_MAIN_KIND[(n - 1) % 5];
    const before = results[id][n - 5][kind];
    const now = results[id][n][kind];
    check(`${id} wave ${n}: ${kind} tougher than in wave ${n - 5}`, now > before, `${before} -> ${now}`);
  }
});

// ---------- 3. Real creatures start with the health the wave gave them ----------
setDifficulty('NORMAL');
const world = createWorld();
playWaves(WAVE_COUNT).forEach(wave => {
  wave.queue.forEach(entry => {
    const { kind, stats } = entry;
    const creature = spawn(world, entry);
    check(`wave ${wave.number}: spawned ${kind} starts with full health`, creature.hp === stats.hp && creature.maxHp === stats.hp, `hp ${creature.hp}, max ${creature.maxHp}, wave says ${stats.hp}`);
  });
});

// A big jelly splits into two small ones with a third of its health (at least 1)
[3, 5, 7, 4, 1].forEach(parentHp => {
  world.spawned.length = 0;
  const jelly = new Forest.SkyCreatures.jelly(world, { x: 0, stats: { hp: parentHp, speed: 1, damage: 1 }, onDefeated: noop });
  jelly.onExploded();
  const expected = Math.max(1, Math.ceil(parentHp / 3));
  check(`big jelly (${parentHp} hp) splits into 2 small jellies`, world.spawned.length === 2 && world.spawned.every(j => j.isMini), `spawned ${world.spawned.length}`);
  world.spawned.forEach(mini => check(`small jelly from a ${parentHp} hp jelly starts with ${expected} hp`, mini.hp === expected, `got ${mini.hp}`));
  // Small jellies don't split again
  const before = world.spawned.length;
  world.spawned[0].onExploded();
  check('small jellies do not split again', world.spawned.length === before);
});

// Mushrooms (before the waves) fall to one blow, on every difficulty
LEVEL_ORDER.forEach(id => {
  setDifficulty(id);
  const mushroom = new Forest.EvilMushroom(createWorld(), { x: 0, patrolDistance: 2 }, noop);
  check(`${id}: mushrooms start with 1 hp`, mushroom.hp === 1, `got ${mushroom.hp}`);
});

// ---------- 4. Mutants (randomly generated Monster Forge monsters) ----------
// How many join each wave: none in wave 1, one from wave 2, one more every 3 waves, at most 4
const EXPECTED_MUTANTS = { 1: 0, 2: 1, 4: 1, 5: 2, 7: 2, 8: 3, 10: 3, 11: 4, 15: 4, 20: 4 };
const mutantWaves = {};
LEVEL_ORDER.forEach(id => {
  setDifficulty(id);
  mutantWaves[id] = playWaves(WAVE_COUNT);
});
Object.entries(EXPECTED_MUTANTS).forEach(([n, count]) => {
  LEVEL_ORDER.forEach(id => {
    const mutants = mutantWaves[id][n - 1].queue.filter(entry => entry.kind === MUTANT);
    check(`${id} wave ${n}: ${count} mutant(s)`, mutants.length === count, `got ${mutants.length}`);
  });
});

LEVEL_ORDER.forEach(id => {
  const level = LEVELS[id];
  mutantWaves[id].forEach(wave => {
    wave.queue.filter(entry => entry.kind === MUTANT).forEach(({ genome, stats }) => {
      check(`${id} wave ${wave.number}: mutant is as strong as the wave number`, genome.power === wave.number, `power ${genome.power}`);
      // Difficulty only adds its bonus (no boss-style multiplier), never below 1
      const expected = Math.max(1, genome.stats.hp + level.creatureHpBonus);
      check(`${id} wave ${wave.number}: mutant hp = its own hp ${genome.stats.hp} + difficulty bonus`, stats.hp === expected, `got ${stats.hp}, expected ${expected}`);
    });
  });
});

/** Designed health range of a generated monster: size base + power share + 0-1 random (+ armour). */
const SIZE_HP = { small: [1, 0.3], medium: [2, 0.5], large: [3, 0.8] };
const SEEDS = 300;
const averageHpByPower = [];
for (let power = 1; power <= WAVE_COUNT; power++) {
  let total = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const genome = Forge.generate({ seed, power });
    const [baseHp, hpPerPower] = SIZE_HP[genome.appearance.size];
    const armour = genome.abilities.includes('armored') ? 1 + Math.floor(power / 4) : 0;
    const low = baseHp + Math.floor(power * hpPerPower) + armour;
    const hp = genome.stats.hp;
    check(`power ${power} seed ${seed}: ${genome.appearance.size} monster hp in designed range`, hp >= low && hp <= low + 1, `got ${hp}, expected ${low}-${low + 1}`);
    total += hp;

    // Same seed + power always gives the same monster
    if (seed <= 20) check(`power ${power} seed ${seed}: same seed gives the same hp`, Forge.generate({ seed, power }).stats.hp === hp);

    // The same monster is never tougher on an easier difficulty
    if (seed <= 50) {
      const [easy, normal, hard] = LEVEL_ORDER.map(id => Forge.statsFor(genome, LEVELS[id]).hp);
      check(`power ${power} seed ${seed}: mutant hp Easy <= Normal <= Hard`, easy >= 1 && easy <= normal && normal <= hard, `${easy} / ${normal} / ${hard}`);
    }

    // Brood / Splitter offspring get a third of the health (at least 1)
    if (seed <= 50) {
      const mini = Forge.createMini(genome);
      const expectedMini = Math.max(1, Math.ceil(hp / 3));
      check(`power ${power} seed ${seed}: mini mutant has a third of the health`, mini.stats.hp === expectedMini && mini.isMini, `got ${mini.stats.hp}, expected ${expectedMini}`);
    }
  }
  averageHpByPower.push(total / SEEDS);
}
// On average, later waves bring tougher mutants
for (let power = 2; power <= WAVE_COUNT; power++) {
  const [before, now] = [averageHpByPower[power - 2], averageHpByPower[power - 1]];
  check(`mutants get tougher on average (power ${power - 1} -> ${power})`, now >= before, `${before.toFixed(2)} -> ${now.toFixed(2)}`);
}

// ---------- Report ----------
console.log('Starting health of each wave\'s main creature (Easy / Normal / Hard):\n');
const table = [];
for (let n = 1; n <= 15; n++) {
  const kind = WAVE_MAIN_KIND[(n - 1) % 5];
  table.push({ wave: n, creature: kind, health: LEVEL_ORDER.map(id => results[id][n][kind]).join(' / ') });
}
console.table(table);
console.log('\nAverage starting health of a mutant (Normal), by wave:');
console.log([1, 2, 5, 8, 11, 15, 20].map(p => `wave ${p}: ${averageHpByPower[p - 1].toFixed(1)}`).join('   '));
finish();
