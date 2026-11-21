/**
 * Training sessions picked from the scrapbook: what they contain, and that the real WaveDirector
 * runs one as a single custom wave that ends instead of looping. Not loaded by the game.
 *
 * Usage (from the project folder): node tools/trainingtest.js
 * Exits with code 1 if any check fails.
 */
const { loadGame, createWorld, createChecker, noop } = require('./testHarness');

const Forest = loadGame();
const { check, finish } = createChecker();
const { Training, WaveDirector, Difficulty, MonsterForge } = Forest;
const LEVELS = Difficulty.LEVELS;

const RANDOM_SPECIES = 'hopper-boxy-crest';

// --- Nothing picked ---
check('no session without picks', Training.buildSession() === null);
check('no creatures without picks', Training.selectedCreatureCount === 0);

// --- Picks and their limits ---
Training.setSelected('thornback', true);
Training.setCount('thornback', 4);
Training.setLevel('thornback', 'HARD');
Training.setSelected('mushroom', true);
Training.setCount('mushroom', 99);
Training.setLevel('mushroom', 'EASY');
Training.setSelected(RANDOM_SPECIES, true);
Training.setCount(RANDOM_SPECIES, 0);
Training.setLevel(RANDOM_SPECIES, 'NORMAL');
Training.setLevel('jelly', 'NOT-A-LEVEL');

check('count capped at the maximum', Training.pickFor('mushroom').count === Training.MAX_COUNT);
check('count raised to the minimum', Training.pickFor(RANDOM_SPECIES).count === Training.MIN_COUNT);
check('unknown level ignored', Training.pickFor('jelly').level !== 'NOT-A-LEVEL');
check('unticked species not selected', !Training.pickFor('jelly').selected);
check('three species selected', Training.selectedSpeciesCount === 3, String(Training.selectedSpeciesCount));
check('creature total', Training.selectedCreatureCount === 4 + 10 + 1, String(Training.selectedCreatureCount));

// --- The session ---
const session = Training.buildSession();
const ofKind = kind => session.queue.filter(entry => entry.kind === kind);
check('session size', session.queue.length === 15 && session.total === 15, String(session.queue.length));
check('4 thornbacks', ofKind('thornback').length === 4);
check('10 mushrooms', ofKind('mushroom').length === 10);
check('1 random monster', ofKind('mutant').length === 1);

const hardThornback = WaveDirector.creatureStats('thornback', LEVELS.HARD);
check('thornback uses Hard stats', ofKind('thornback').every(entry =>
  entry.stats.hp === hardThornback.hp && entry.stats.speed === hardThornback.speed), JSON.stringify(ofKind('thornback')[0].stats));
check('Hard thornback tougher than Easy', hardThornback.hp > WaveDirector.creatureStats('thornback', LEVELS.EASY).hp);
check('Easy mushrooms: 1 hp, slower', ofKind('mushroom').every(entry =>
  entry.stats.hp === 1 && entry.stats.speed === LEVELS.EASY.creatureSpeed));

const monster = ofKind('mutant')[0];
check('random monster is the picked species', monster.genome.species === RANDOM_SPECIES, monster.genome.species);
check('random monster stats at Normal', JSON.stringify(monster.stats) === JSON.stringify(MonsterForge.statsFor(monster.genome, LEVELS.NORMAL)));
check('flavor lists the picks', /Thornback \(HARD\)/.test(session.flavor) && /Evil Mushroom \(EASY\)/.test(session.flavor), session.flavor);

// Every species can be rolled for training
const missed = Forest.MonsterSpecies.ALL.filter(species => !species.isNative)
  .filter(species => Forest.MonsterForge.generate && (() => {
    Training.clearSelection();
    Training.setSelected(species.id, true);
    Training.setCount(species.id, 1);
    return Training.buildSession().queue[0].genome.species !== species.id;
  })());
check('every random species can be trained', missed.length === 0, missed.map(species => species.id).join(', '));

// --- Real creatures build from the entries ---
const world = createWorld();
const mushroom = new Forest.EvilMushroom(world, { x: 0, patrolDistance: 3, stats: { hp: 3, speed: 1.25, damage: 1 } }, noop);
check('training mushroom health', mushroom.hp === 3);
check('training mushroom speed scale', mushroom.speedScale === 1.25);
check('normal mushroom unchanged', new Forest.EvilMushroom(world, { x: 0, patrolDistance: 3 }, noop).hp === 2);

// --- The WaveDirector runs it once, then stops ---
Training.clearSelection();
Training.setSelected('nutling', true);
Training.setCount('nutling', 5);
const run = Training.buildSession();

let living = 0;
let spawned = 0;
const announced = [];
let clearedCount = 0;
const director = new WaveDirector({
  spawnCreature: () => { spawned++; living++; },
  countLivingCreatures: () => living,
  getPlayerX: () => 20,
  onWaveAnnounced: wave => announced.push(wave),
  onWaveCleared: () => clearedCount++
});
director.startCustom(run);
check('custom wave announced once', announced.length === 1 && announced[0].name === 'TRAINING');
check('custom wave is active', director.isActive && director.isCustom);

for (let i = 0; i < 2000; i++) {
  director.update(1 / 60);
  if (living > 0 && i % 30 === 0) living--; // the boy defeats one every half second
}
check('all 5 spawned', spawned === 5, String(spawned));
check('cleared exactly once', clearedCount === 1, String(clearedCount));
check('no further waves', announced.length === 1 && director.phase === 'FINISHED', director.phase);
check('nothing left', director.remainingFoes === 0);

director.reset();
check('reset leaves custom mode', !director.isCustom && !director.isActive);

finish();
