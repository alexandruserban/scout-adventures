/**
 * Waves of sky creatures. The adventure is now made of side-scrolling levels (see levels.js), so
 * waves only run training sessions (startCustom); the endless five-wave cycle below is kept for it.
 *
 * Waves 1-5 each introduce a tougher creature. After wave 5 the cycle repeats with
 * more health, more speed, more creatures and extra random escorts, so it goes on
 * until the boy finally falls.
 *
 * From wave 2, randomly generated mutants (Forest.MonsterForge) join in too, growing
 * stronger and more numerous wave after wave.
 */
(function (Forest) {
  const { LEVEL_START_X, LEVEL_END_X } = Forest.Config;
  const { clamp, randomBetween, randomDirection } = Forest.MathUtils;

  const BASE_STATS = {
    nutling: { hp: 1, damage: 1 },
    thornback: { hp: 2, damage: 1 },
    gloomwing: { hp: 2, damage: 1 },
    jelly: { hp: 3, damage: 1 },
    golem: { hp: 10, damage: 1 },
    spider: { hp: 2, damage: 1 },
    crawler: { hp: 2, damage: 1 },
    octorocker: { hp: 4, damage: 1 },
    ...Object.fromEntries(Forest.WorldCreatures.species.map(({ kind, hp, damage }) => [kind, { hp, damage }]))
  };

  /** Extra health per completed cycle of five waves. */
  const HP_PER_CYCLE = {
    nutling: 1, thornback: 1, gloomwing: 1, jelly: 2, golem: 4, spider: 1, crawler: 1, octorocker: 2,
    ...Object.fromEntries(Forest.WorldCreatures.species.map(({ kind, hpPerCycle }) => [kind, hpPerCycle]))
  };

  /** Kinds that can appear as random escorts in later cycles (the golem is only ever the boss). */
  const ESCORT_KINDS = ['nutling', 'thornback', 'gloomwing', 'jelly'];
  const FLYING_KINDS = ['gloomwing'];

  const BOSS_KIND = 'golem';

  /** Queue entries of this kind carry a `genome` and are built by Forest.MonsterForge. */
  const MUTANT_KIND = 'mutant';
  const FIRST_MUTANT_WAVE = 2;
  const WAVES_PER_EXTRA_MUTANT = 3;
  const MAX_MUTANTS_PER_WAVE = 4;
  /** The boss gets this many times the difficulty's health bonus (e.g. +3 on Hard, -3 on Easy). */
  const BOSS_HP_BONUS_SCALE = 3;

  const WAVES = [
    {
      name: 'NUTLING RAIN',
      flavor: 'Angry acorns are pelting down from the canopy!',
      main: { kind: 'nutling', count: 6 },
      escorts: [],
      spawnInterval: 0.8
    },
    {
      name: 'THORNBACK STAMPEDE',
      flavor: 'Armoured beetles crash down... watch out when they growl!',
      main: { kind: 'thornback', count: 4 },
      escorts: [{ kind: 'nutling', count: 3 }],
      spawnInterval: 1.3
    },
    {
      name: 'GLOOMWING SWARM',
      flavor: 'Spore moths circle overhead. Jump and strike as they dive!',
      main: { kind: 'gloomwing', count: 4 },
      escorts: [{ kind: 'nutling', count: 1 }],
      spawnInterval: 1.8
    },
    {
      name: 'THUNDER JELLY STORM',
      flavor: 'Jump as they land - lightning runs along the grass. They split, too!',
      main: { kind: 'jelly', count: 3 },
      escorts: [{ kind: 'thornback', count: 1 }],
      spawnInterval: 2.2,
      // Jellies send the boy into the air, so nothing flying joins them (no gloomwings, no winged mutants)
      groundOnly: true
    },
    {
      name: 'THE CINDER GOLEM',
      flavor: 'A blazing giant falls from the burning sky! Smash its fireballs!',
      main: { kind: 'golem', count: 1 },
      escorts: [{ kind: 'nutling', count: 3 }, { kind: 'gloomwing', count: 1 }],
      spawnInterval: 2.4,
      isBoss: true
    }
  ];

  const Phase = Object.freeze({
    /** Not started yet (the mushrooms are still around). */
    IDLE: 'IDLE',
    /** The wave's banner is showing; nothing falls yet. */
    INTRO: 'INTRO',
    SPAWNING: 'SPAWNING',
    /** Short breather after a wave is wiped out. */
    CLEARED: 'CLEARED',
    /** A one-off custom wave (e.g. training) is over; nothing more comes. */
    FINISHED: 'FINISHED'
  });

  const INTRO_SECONDS = 2.8;
  const CLEARED_SECONDS = 2.4;
  /** Creatures land this far (at most) to either side of the boy... */
  const SPAWN_SPREAD = 6.5;
  /** ...but never closer than this, so nothing spawns right on top of him. */
  const SPAWN_MIN_DISTANCE = 1.2;
  const SPAWN_EDGE_MARGIN = 1;

  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function repeat(kind, count) {
    return Array.from({ length: count }, () => kind);
  }

  /**
   * Health, damage and speed of a hand-made sky creature at a difficulty level.
   * @param {string} kind a Forest.SkyCreatures kind
   * @param {object} difficulty a Forest.Difficulty level
   * @param {number} [ramp] how far repeated cycles have ramped things up (0 = first cycle)
   */
  function creatureStats(kind, difficulty, ramp = 0) {
    // The minimum grows with the cycles too, so a negative bonus (Easy) can't keep a creature
    // stuck at 1 hp forever.
    const extraHp = Math.round(HP_PER_CYCLE[kind] * ramp);
    const hpBonus = difficulty.creatureHpBonus * (kind === BOSS_KIND ? BOSS_HP_BONUS_SCALE : 1);
    // During the first cycle every creature but the boss falls to a single blow, on any difficulty
    const isOneHit = ramp === 0 && kind !== BOSS_KIND;
    return {
      hp: isOneHit ? 1 : Math.max(1 + extraHp, BASE_STATS[kind].hp + extraHp + hpBonus),
      damage: BASE_STATS[kind].damage,
      speed: Math.min(1.6, 1 + 0.12 * ramp) * difficulty.creatureSpeed
    };
  }

  /**
   * Work out what wave `number` (1, 2, 3, ...) contains at the given difficulty level.
   * @param {number} number
   * @param {object} difficulty a Forest.Difficulty level
   * @returns {{number:number, cycle:number, name:string, flavor:string, isBoss:boolean,
   *   spawnInterval:number, queue:{kind:string, stats:object, genome?:object}[]}}
   */
  function buildWave(number, difficulty) {
    const definition = WAVES[(number - 1) % WAVES.length];
    const cycle = Math.floor((number - 1) / WAVES.length);
    // How far the cycles have ramped things up: slower on easier difficulties
    const ramp = cycle * difficulty.cycleRamp;

    const mainCount = definition.main.count + Math.round(definition.isBoss ? ramp / 2 : ramp);
    const mainKinds = repeat(definition.main.kind, mainCount);

    // Easier difficulties send fewer helpers alongside the boss
    const escortScale = definition.isBoss ? difficulty.bossEscortScale : 1;
    const escortKinds = definition.escorts.flatMap(escort => repeat(escort.kind, Math.round(escort.count * escortScale)));
    const randomEscortKinds = definition.groundOnly
      ? ESCORT_KINDS.filter(kind => !FLYING_KINDS.includes(kind))
      : ESCORT_KINDS;
    const randomEscortCount = Math.round(ramp * 2);
    for (let i = 0; i < randomEscortCount; i++) {
      escortKinds.push(randomEscortKinds[Math.floor(Math.random() * randomEscortKinds.length)]);
    }

    const toEntry = kind => ({ kind, stats: creatureStats(kind, difficulty, ramp) });

    const mutants = buildMutants(number, difficulty, Boolean(definition.groundOnly), Boolean(definition.isBoss));

    // The boss always arrives first; otherwise everything falls in a random order
    const mainEntries = mainKinds.map(toEntry);
    const otherEntries = [...escortKinds.map(toEntry), ...mutants];
    const queue = definition.isBoss
      ? [...mainEntries, ...shuffle(otherEntries)]
      : shuffle([...mainEntries, ...otherEntries]);

    const mutantWarning = mutants.length === 0 ? ''
      : mutants.length === 1 ? ' Beware: a wild mutant lurks among them!'
        : ` Beware: ${mutants.length} wild mutants lurk among them!`;

    return {
      number,
      cycle,
      name: cycle > 0 ? `${definition.name} +${cycle}` : definition.name,
      flavor: definition.flavor + mutantWarning,
      isBoss: Boolean(definition.isBoss),
      spawnInterval: definition.spawnInterval * Math.max(0.55, 1 - 0.1 * ramp) * difficulty.spawnIntervalScale,
      queue
    };
  }

  /**
   * Randomly generated monsters (see Forest.MonsterForge) join from wave 2 on: one at first,
   * one more every few waves, each as strong as the wave number during the first cycle; after that
   * their strength (and number) grows only as fast as the difficulty's cycle ramp allows.
   * With `groundOnly`, none of them fly. Boss waves get fewer on easier difficulties.
   */
  function buildMutants(number, difficulty, groundOnly, isBoss) {
    if (number < FIRST_MUTANT_WAVE) return [];
    const power = number <= WAVES.length
      ? number
      : Math.round(WAVES.length + (number - WAVES.length) * difficulty.cycleRamp);
    const fullCount = Math.min(MAX_MUTANTS_PER_WAVE, 1 + Math.floor((power - FIRST_MUTANT_WAVE) / WAVES_PER_EXTRA_MUTANT));
    const count = Math.max(0, fullCount - (isBoss ? difficulty.bossMutantReduction : 0));
    const { WALKER, HOPPER } = Forest.MonsterGenome.Movement;
    return Array.from({ length: count }, () => {
      const movement = groundOnly ? (Math.random() < 0.5 ? WALKER : HOPPER) : undefined;
      const genome = Forest.MonsterForge.generate({ power, movement });
      return { kind: MUTANT_KIND, genome, stats: Forest.MonsterForge.statsFor(genome, difficulty) };
    });
  }

  class WaveDirector {
    /**
     * @param {object} hooks
     * @param {(entry:{kind:string, stats:object, genome?:object}, x:number) => void} hooks.spawnCreature
     *   kind 'mutant' entries carry a Monster Forge genome; the rest name a Forest.SkyCreatures class
     * @param {() => number} hooks.countLivingCreatures creatures still in play (including offspring)
     * @param {() => number} hooks.getPlayerX
     * @param {(wave:object) => void} hooks.onWaveAnnounced
     * @param {(wave:object) => void} hooks.onWaveCleared
     */
    constructor(hooks) {
      this.hooks = hooks;
      this.reset();
    }

    reset() {
      this.phase = Phase.IDLE;
      this.waveNumber = 0;
      this.currentWave = null;
      this.queue = [];
      this.phaseTimer = 0;
      this.spawnTimer = 0;
      /** True while running a one-off custom wave instead of the endless ones. */
      this.isCustom = false;
    }

    get isActive() {
      return this.phase !== Phase.IDLE;
    }

    /** Creatures of the current wave still to fall, plus those still alive. */
    get remainingFoes() {
      return this.queue.length + this.hooks.countLivingCreatures();
    }

    /** Begin the endless waves (called when the mushrooms are gone). */
    start() {
      if (this.isActive) return;
      this.announceNextWave();
    }

    /**
     * Run one custom wave instead of the endless ones (e.g. a training session). It is announced
     * and cleared like any wave, then the director stops.
     * @param {{name:string, flavor:string, spawnInterval:number,
     *   queue:{kind:string, stats:object, genome?:object}[]}} wave
     */
    startCustom(wave) {
      this.reset();
      this.isCustom = true;
      this.currentWave = { number: 0, cycle: 0, isBoss: false, ...wave };
      this.queue = [...wave.queue];
      this.phase = Phase.INTRO;
      this.phaseTimer = INTRO_SECONDS;
      this.hooks.onWaveAnnounced(this.currentWave);
    }

    announceNextWave() {
      this.waveNumber++;
      this.currentWave = buildWave(this.waveNumber, Forest.Difficulty.current);
      this.queue = [...this.currentWave.queue];
      this.phase = Phase.INTRO;
      this.phaseTimer = INTRO_SECONDS;
      this.hooks.onWaveAnnounced(this.currentWave);
    }

    update(deltaSeconds) {
      switch (this.phase) {
        case Phase.INTRO:
          this.phaseTimer -= deltaSeconds;
          if (this.phaseTimer <= 0) {
            this.phase = Phase.SPAWNING;
            this.spawnTimer = 0;
          }
          break;

        case Phase.SPAWNING:
          this.spawnTimer -= deltaSeconds;
          if (this.queue.length > 0 && this.spawnTimer <= 0) {
            this.spawnNext();
            this.spawnTimer = this.currentWave.spawnInterval;
          }
          if (this.queue.length === 0 && this.hooks.countLivingCreatures() === 0) {
            this.phase = Phase.CLEARED;
            this.phaseTimer = CLEARED_SECONDS;
            this.hooks.onWaveCleared(this.currentWave);
          }
          break;

        case Phase.CLEARED:
          this.phaseTimer -= deltaSeconds;
          if (this.phaseTimer > 0) break;
          if (this.isCustom) this.phase = Phase.FINISHED;
          else this.announceNextWave();
          break;
      }
    }

    spawnNext() {
      const entry = this.queue.shift();
      const offset = randomDirection() * randomBetween(SPAWN_MIN_DISTANCE, SPAWN_SPREAD);
      const x = clamp(
        this.hooks.getPlayerX() + offset,
        LEVEL_START_X + SPAWN_EDGE_MARGIN,
        LEVEL_END_X - SPAWN_EDGE_MARGIN
      );
      this.hooks.spawnCreature(entry, x);
    }
  }

  WaveDirector.creatureStats = creatureStats;
  Forest.WaveDirector = WaveDirector;
})(window.Forest);
