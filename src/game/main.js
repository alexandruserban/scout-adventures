/**
 * Entry point: builds the world, wires the systems together, and runs the game loop.
 *
 * The adventure visits all sixteen worlds (see Forest.Levels) in a random order, each with a freshly
 * generated course. The boy runs right, jumping pits and climbing platforms, collecting coins and fighting the
 * monsters that drop in as he goes. Each level ends in an arena with a boss; beat it to move on.
 *
 * Training (picked in the scrapbook) instead runs one custom wave on a flat training ground.
 */
(function (Forest) {
  const { Config, Levels } = Forest;
  const Sfx = Forest.SoundEffects;
  const { Difficulty, Rewards, Scrapbook, Training } = Forest;

  /** Training mushrooms patrol this far either side of where they appear. */
  const TRAINING_PATROL_DISTANCE = 3.5;
  /** Mushrooms placed in a level patrol this far either side of where they appear. */
  const LEVEL_PATROL_DISTANCE = 3;
  /** Chance that an enemy with a ledge above its spot lands on the ledge instead of the ground. */
  const LEDGE_LANDING_CHANCE = 0.5;
  /** Share of mutants that come with cybernetic implants in the future-tech worlds (elsewhere it depends on power). */
  const FUTURE_CYBER_CHANCE = 0.6;

  // --- Boss fights ---
  /** Mutant sidekicks that drop in with the boss (one more from this level number on). */
  const BOSS_COMPANIONS = 2;
  const COMPANION_EXTRA_FROM_LEVEL = 8;
  /** Sidekicks are this much stronger than the level's own monsters at its start. */
  const COMPANION_POWER_BONUS = 1;
  /** Sidekicks never land closer to the boy than this. */
  const COMPANION_MIN_DISTANCE = 3.5;
  /** The boss flies into a rage at this share of its health, and this many more sidekicks arrive. */
  const BOSS_RAGE_HEALTH = 0.5;
  const RAGE_REINFORCEMENTS = 2;
  /** Helpers are this much smaller than ordinary mutants, with this share of their health. */
  const HELPER_SIZE = 0.7;
  const HELPER_HP_SHARE = 0.6;
  /** The Monster Forge ability most like each hand-made boss's attack (its helpers won't get it). */
  const NATIVE_BOSS_ABILITIES = {
    golem: ['spit'], // hurls fireballs
    thornback: ['charge'],
    gloomwing: ['swoop'],
    jelly: ['leap', 'splitter'], // jumps down with a shockwave, splits in two
    nutling: ['leap'],
    spider: ['leap'],
    crawler: ['spit', 'charge'],
    octorocker: ['spit', 'leap']
  };
  /**
   * The boy's jump, as in player.js: a double jump peaks this high and he drifts this fast in the
   * air. A ground boss he can't clear with a double jump (see bossIsTooBigToJump) gets footholds.
   */
  const DOUBLE_JUMP_PEAK = 3.39;
  const PLAYER_GRAVITY = 25;
  const PLAYER_AIR_SPEED = 4.6;
  /** Clear the boss's body by at least this much, with this much spare distance across. */
  const JUMP_CLEARANCE_MARGIN = 0.3;
  const JUMP_DISTANCE_MARGIN = 1.2;
  /** Each kind's touch box (see their isTouching): top as a share of its height, half-width of its width. */
  const BOSS_TOUCH_TOP = { jelly: 1.4, golem: 1 };
  const DEFAULT_BOSS_TOUCH_TOP = 0.85;
  const BOSS_TOUCH_HALF_WIDTH = { golem: 0.3 };
  const DEFAULT_BOSS_TOUCH_HALF_WIDTH = 0.35;
  const MUTANT_BOSS_TITLES = ['THE GREAT', 'THE MIGHTY', 'KING', 'QUEEN', 'THE ANCIENT', 'THE COLOSSAL'];

  const BEST_POINTS_STORAGE_KEY = 'forest-pixel-adventure.bestPoints';

  /** Each coin is cashed in for this many points once the level's boss is beaten. */
  const COIN_POINTS = 20;
  /** Pause after the "cleared" fanfare before the coins start turning into points. */
  const COIN_TALLY_DELAY_SECONDS = 2.4;
  /** Seconds between coin-to-points ticks; long hauls cash in several coins per tick. */
  const COIN_TALLY_TICK_SECONDS = 0.05;
  const COIN_TALLY_MAX_TICKS = 60;
  /** Beating a level's boss is worth this many points times the level number. */
  const LEVEL_CLEAR_POINTS = 250;
  /** Falling below this height means the boy dropped into a pit. */
  const PIT_Y = -3.5;
  /**
   * How close (in x) the boy gets before an enemy appears: mushrooms walk in from off-screen,
   * sky creatures drop down where he can see them coming.
   */
  const MUSHROOM_SPAWN_DISTANCE = 14;
  const SKY_SPAWN_DISTANCE = 10;
  /** Enemies left this far behind are quietly removed. */
  const DESPAWN_DISTANCE = 30;
  /** The boss fight starts once the boy is this far into the arena. */
  const ARENA_TRIGGER_INSET = 1.5;
  /** A beaten boss's star shard always lands at least this far inside the arena walls. */
  const SHARD_ARENA_MARGIN = 1.5;
  const NEXT_LEVEL_DELAY_SECONDS = 3.2;
  /** The loading screen stays up at least this long before a new level (and before a retry). */
  const LEVEL_LOADING_SECONDS = 1.6;
  const RETRY_LOADING_SECONDS = 0.8;
  /** How much tougher each later level's creatures are, as a fraction of the difficulty's cycle ramp. */
  const RAMP_PER_LEVEL = 0.16;

  // --- Level hazards ---
  /**
   * Sandstorm (and steam gusts): the wind swings back and forth. Over every WIND_GUST_PERIOD seconds
   * it builds to a strong gust one way, dies down to a calm, then gusts the other way.
   */
  const WIND_BASE_SPEED = 0.3;
  const WIND_GUST_SPEED = 1.7;
  const WIND_GUST_PERIOD = 9;
  /** Lava bombs fall from the sky this often (seconds, random in the range). */
  const LAVA_BOMB_INTERVAL = [1.8, 3.2];
  const LAVA_BOMB_FLIGHT_SECONDS = 1.5;
  /**
   * Walking through a sticky web on the ground (the rainbow) slows the boy to this share of his
   * speed, and he stays stuck this long after getting out of it. Jumping over it is fine.
   */
  const GROUND_WEB_SPEED_FACTOR = 0.35;
  const GROUND_WEB_STUCK_SECONDS = 0.5;

  const THEME_LEAF_COLORS = {
    forest: ['#86d66e', '#ffd166', '#86d66e'],
    dungeon: ['#6b6475', '#8a8294'],
    treetops: ['#86d66e', '#b5e48c', '#ffd166'],
    desert: ['#f6d89a', '#e8be7c', '#fff1c8'],
    ice: ['#ffffff', '#e6f2ff'],
    volcano: ['#6b5b58', '#8a7672', '#ff8a2a'],
    candy: ['#ff6fae', '#7fd6ff', '#ffe066', '#9af08f'],
    moon: [],
    neon: ['#ff4fd8', '#4ff0ff'],
    crystal: ['#7fffd4', '#c79bff'],
    clockwork: ['#f2c96b', '#e8e0d8', '#c8913a'],
    atlantis: ['#bff3ff', '#ffffff'],
    fae: ['#ff9cf0', '#b4ffef', '#9af08f'],
    mechKeep: ['#6b5b58', '#ff6a1f', '#8a92a3'],
    rift: ['#00f0ff', '#c86bff'],
    station: [],
    noir: ['#ffffff', '#9a9a9a'],
    mothership: [],
    rainbow: ['#ff4d4d', '#ffe14d', '#5fe07a', '#4fb6ff', '#9a6bff'],
    rising: [],
    kitchen: ['#f4c27a', '#ffffff'],
    concert: ['#ff4fd8', '#4fe8ff', '#ffe14d', '#7dff6a']
  };

  const ArenaState = Object.freeze({
    /** The boy hasn't reached the arena yet. */
    CLOSED: 'CLOSED',
    FIGHTING: 'FIGHTING',
    /** The boss is beaten; waiting for its leftovers (e.g. jelly halves) to go. */
    BOSS_DOWN: 'BOSS_DOWN',
    /** The boss's star shard is waiting to be picked up; only that wins the level. */
    SHARD: 'SHARD',
    /** Fanfare playing; the coin tally starts soon. */
    CLEARED: 'CLEARED',
    /** The level's coins are being turned into points. */
    COIN_TALLY: 'COIN_TALLY',
    /** All done: the end-of-level story comes up when the timer runs out. */
    ADVANCING: 'ADVANCING',
    /** The end-of-level story page is up; the next level starts when the player moves on. */
    STORY: 'STORY'
  });

  // ==========================================
  // World setup
  // ==========================================
  const stage = new Forest.Stage(document.getElementById('game-container'));
  const sprites = Forest.loadGameSprites();

  const background = new Forest.ParallaxBackground(stage.scene, {
    pixelScale: Config.PIXEL_SCALE,
    viewWidthUnits: stage.viewWidthUnits,
    cameraRestY: Config.CAMERA_REST_Y
  });

  const hud = new Forest.Hud();
  const hitStop = new Forest.HitStop();
  const particles = new Forest.ParticleSystem(stage.scene);
  const ambientLeaves = new Forest.AmbientLeaves(stage.scene);
  const effects = new Forest.EffectsSystem(stage.scene);
  const cameraController = new Forest.CameraController(stage.camera, stage.viewWidthUnits);

  const input = new Forest.InputController({
    onPress: {
      jump: () => { if (!isPaused) player.tryJump(); },
      attack: () => { if (!isPaused) player.startAttack(); },
      restart: restartGame,
      toggleSound: Forest.AudioControls.toggleSound,
      toggleMusic: Forest.AudioControls.toggleMusic
    },
    onRelease: {
      jump: () => player.releaseJump()
    }
  });
  Forest.TouchControls.bind(input);

  /** Gap in CSS pixels kept between the top of the soil and the top of the touch buttons. */
  const TOUCH_BUTTON_SOIL_MARGIN = 8;

  /**
   * On touch screens, keep the camera low enough that the buttons always sit over the soil
   * below the grass, never over the playfield.
   */
  function keepTouchButtonsOverSoil() {
    const coveredPixels = Forest.TouchControls.coveredBottomPixels();
    if (coveredPixels <= 0) {
      cameraController.setMaxY(Infinity);
      return;
    }
    const pixelsPerUnit = window.innerHeight / stage.viewHeightUnits;
    const soilTopY = Config.GROUND_Y - Forest.EnvironmentSprites.GRASS_DEPTH_PIXELS * Config.PIXEL_SCALE;
    // Camera height that puts the soil top exactly the margin above the buttons
    const soilTopScreenPixels = window.innerHeight - coveredPixels - TOUCH_BUTTON_SOIL_MARGIN;
    cameraController.setMaxY(soilTopY - stage.viewHeightUnits / 2 + soilTopScreenPixels / pixelsPerUnit);
  }
  keepTouchButtonsOverSoil();
  window.addEventListener('resize', keepTouchButtonsOverSoil);

  /** Systems that the player and enemies use to affect the world. */
  const world = {
    scene: stage.scene,
    sprites,
    input,
    particles,
    effects,
    hitStop,
    cameraController,
    /** The current level's ground and platforms (see Forest.Terrain). */
    terrain: null,
    /** Adds an enemy created mid-fight (e.g. the halves of a split Thunder Jelly). */
    spawnEnemy: enemy => addEnemy(enemy)
  };
  world.projectiles = new Forest.ProjectileSystem(world);
  const hearts = new Forest.HeartPickups(world, collectHeart);
  const coins = new Forest.Coins(world, collectCoin);
  const floatingText = new Forest.FloatingText(stage.scene);

  const player = new Forest.Player(world, {
    onHealthChanged: refreshHealth,
    onDefeated: showGameOver,
    onSlamLanded: hitEnemiesInArea,
    onEntangled: () => floatingText.spawn('STUCK!', player.x, player.y + player.height + 0.4, '#f4f0ff')
  });

  // ==========================================
  // Run state
  // ==========================================
  /** Every enemy in play. */
  let enemies = [];
  let points = 0;
  /** Coins picked up over the whole adventure (for the victory screen). */
  let coinsCollected = 0;
  /** Coins picked up in this level, not yet turned into points. */
  let levelCoins = 0;
  let coinTally = { timer: 0, perTick: 1, cashed: 0 };
  /** High score for this difficulty, read once per run (not every frame). */
  let bestPointsBeforeRun = 0;
  /** True while a menu (scrapbook, gallery) covers the game. */
  let isPaused = false;
  /** Names of the menus currently pausing the game (see Forest.Game.setPaused). */
  const pauseReasons = new Set();
  /**
   * True while practising against creatures picked in the scrapbook (see Forest.Training)
   * instead of playing the adventure. Training doesn't touch the scrapbook or the high scores.
   */
  let isTraining = false;
  /** How many creatures the current training session started with. */
  let trainingTotal = 0;
  /** True once every level is beaten (the victory screen is up). */
  let hasWon = false;
  /** False while the title screen is up and nothing has been played yet. */
  let hasStarted = false;
  /** The difficulty of the game under the pause menu (picking another one there starts a fresh game). */
  let pausedDifficultyId = null;

  // --- The current level ---
  let level = null;
  /** Position in the adventure (0 = first world visited). */
  let levelIndex = 0;
  /** The worlds of this adventure in the order they are played (indices into Levels.themes). */
  let runOrder = Levels.createRun();
  /** Coins laid out in every level played so far this adventure (for the victory screen). */
  let coinsOffered = 0;
  let scenery = null;
  /** The current level's pop-up spikes (see Forest.SpikeTraps). */
  let spikeTraps = null;
  /** The current world's own special trap (see Forest.WorldTraps). */
  let worldTraps = null;
  /** Enemies not dropped in yet, in the order the boy will reach them. */
  let pendingEnemies = [];
  let boss = null;
  /** The boss's display name (a randomly picked mutant boss is only named once it's generated). */
  let bossName = '';
  let arenaState = ArenaState.CLOSED;
  /** Where the boss fell (its shard appears there), and the shard itself once it's out. */
  let bossFallSpot = null;
  let shard = null;
  let nextLevelTimer = 0;
  /** Seconds since the level started (drives the sandstorm gusts). */
  let levelTime = 0;
  /** Which way the first gust of a windy level blows (-1 = towards the left). */
  let windDirection = -1;
  let lavaBombTimer = 0;
  /** Restored when the level is retried after a defeat. */
  let levelStart = { points: 0, coins: 0, coinsOffered: 0, maxHp: 0 };

  const waves = new Forest.WaveDirector({
    spawnCreature: ({ kind, stats, genome }, x) => {
      if (kind === 'mushroom') {
        addEnemy(new Forest.EvilMushroom(world, { x, patrolDistance: TRAINING_PATROL_DISTANCE, stats }, onEnemyDefeated));
        return;
      }
      const options = { x, stats, onDefeated: onEnemyDefeated };
      addEnemy(genome
        ? Forest.MonsterForge.create(world, { ...options, genome })
        : new Forest.SkyCreatures[kind](world, options));
    },
    countLivingCreatures: () => enemies.filter(enemy => !enemy.isGone).length,
    getPlayerX: () => player.x,
    onWaveAnnounced: announceWave,
    onWaveCleared: rewardWaveCleared
  });

  /** Every enemy enters play through here, so the scrapbook hears about it. */
  function addEnemy(enemy) {
    enemies.push(enemy);
    // Anything appearing once the boss fight starts (the boss, sidekicks, split jellies, broodlings) stays on screen
    if (!isTraining && level && level.boss && arenaState !== ArenaState.CLOSED) confineToArena(enemy);
    if (isTraining) return;
    const { species, isNew } = Scrapbook.recordEncounter(enemy, level.name);
    if (isNew) {
      points += Rewards.NEW_SPECIES_POINTS;
      Sfx.newSpecies();
      hud.showToast(
        '📖 NEW SPECIES FOR THE SCRAPBOOK!',
        `<i>${species.latin}</i><br>${species.common.toUpperCase()} &middot; +${Rewards.NEW_SPECIES_POINTS} POINTS`,
        3.5
      );
    }
  }

  // ==========================================
  // Levels
  // ==========================================
  /** Wipe everything left over from the last level or attempt. */
  function clearWorld() {
    hud.hideOverlay();
    hud.hideBanner();
    hud.hideToast();
    effects.clear();
    world.projectiles.clear();
    hearts.clear();
    coins.clear();
    floatingText.clear();
    hitStop.reset();
    cameraController.stopShake();
    enemies.forEach(enemy => enemy.remove());
    enemies = [];
    waves.reset();
    if (shard) shard.remove();
    shard = null;
    bossFallSpot = null;
  }

  /** Build a level's terrain, scenery and background, and put the boy at its start. */
  function buildLevel(levelData, { hp, maxHp }) {
    clearWorld();
    level = levelData;
    Forest.Music.setLevel(level.theme); // each world has its own soundtrack
    world.terrain = new Forest.Terrain(level);
    world.terrain.onCrumble = ledge => {
      Sfx.crumble();
      particles.burst((ledge.left + ledge.right) / 2, ledge.top - 0.1, 10, '#8a6a4a', 1.4, 0.5);
    };
    world.levelPhysics = { gravityScale: 1, slippery: false, windSpeed: 0, ...(level.physics || {}) };
    levelTime = 0;
    // Each windy level's first gust comes from a random side
    windDirection = Math.random() < 0.5 ? -1 : 1;
    lavaBombTimer = LAVA_BOMB_INTERVAL[1];
    effects.terrain = world.terrain;
    if (scenery) scenery.dispose();
    scenery = new Forest.LevelScenery(stage.scene, sprites, level, world.terrain);
    if (spikeTraps) spikeTraps.dispose();
    spikeTraps = new Forest.SpikeTraps(stage.scene, level.traps);
    if (worldTraps) worldTraps.dispose();
    worldTraps = new Forest.WorldTraps({
      scene: stage.scene,
      particles,
      effects,
      terrain: world.terrain,
      say: (text, x, y, color) => floatingText.spawn(text, x, y, color),
      snapCamera: () => cameraController.snapTo(player)
    }, level.trap, level.specialTraps);
    background.setTheme(level.theme);
    stage.scene.background = new THREE.Color(background.topColor);
    // The silent film turns the whole picture black and white, with flickering old-film grain
    document.body.classList.toggle('screen-noir', level.screen === 'noir');
    ambientLeaves.setColors(THEME_LEAF_COLORS[level.theme]);
    ambientLeaves.setWind(0);
    background.setWind(0);
    coins.place(level.coins);

    pendingEnemies = level.enemies
      .map(entry => ({ ...entry, triggerX: entry.x - spawnDistanceFor(entry) }))
      .sort((a, b) => a.triggerX - b.triggerX);
    boss = null;
    arenaState = ArenaState.CLOSED;
    nextLevelTimer = 0;

    player.reset(level.playerStartX, maxHp);
    player.hp = Math.min(hp, maxHp);
    player.setBounds(0, level.arena.end);
    cameraController.setBounds(0, level.arena.end);
    cameraController.snapTo(player);
    refreshHealth();
  }

  /**
   * Start the adventure's level `index` (0-based) with the boy's current health carried over.
   * Its world comes from the shuffled run order and gets a freshly rolled course, unless
   * `course` (an already generated level, e.g. on a retry) is given.
   */
  function startLevel(index, hp, maxHp, course = null, note = '') {
    isTraining = false;
    hasWon = false;
    levelIndex = index;
    if (!course) levelStart = { points, coins: coinsCollected, coinsOffered, maxHp };
    levelCoins = 0;
    const worldTheme = course || Levels.themes[runOrder[index]];
    // A new level opens with its part of the story (a retry goes straight back in)
    const story = course ? null : Forest.Story.levelStart({
      position: index,
      total: runOrder.length,
      worldId: worldTheme.id,
      previousWorldId: index > 0 ? Levels.themes[runOrder[index - 1]].id : null
    });
    loadBehindScreen({
      icon: worldTheme.icon,
      heading: course ? `LEVEL ${index + 1} · TRY AGAIN!` : `LEVEL ${index + 1} OF ${runOrder.length}`,
      title: worldTheme.name,
      subtitle: worldTheme.flavor,
      story,
      // Every world warns about its own trap
      note: [note, worldTheme.trapHint ? `⚠ ${worldTheme.trapHint}` : ''].filter(Boolean).join('<br>'),
      minSeconds: course ? RETRY_LOADING_SECONDS : LEVEL_LOADING_SECONDS,
      build: () => {
        const levelData = course || Levels.generate(worldTheme, { position: index });
        buildLevel(levelData, { hp, maxHp });
        coinsOffered = levelStart.coinsOffered + level.coins.length;
        refreshScore();
        refreshPoints();
      },
      onReady: () => {
        Sfx.waveStart();
        hud.showBanner({ title: `LEVEL ${level.number}: ${level.name}`, subtitle: level.flavor, variant: 'wave', seconds: 3.4 });
      }
    });
  }

  /**
   * Build a level (or training ground) behind the loading screen, with the game paused until it's
   * ready. `onReady` runs as the screen fades out.
   */
  function loadBehindScreen({ build, onReady, ...screen }) {
    Forest.Game.setPaused(true, 'loading');
    Forest.LoadingScreen.run({
      ...screen,
      build,
      onReady: () => {
        Forest.Game.setPaused(false, 'loading');
        if (onReady) onReady();
      }
    });
  }

  /**
   * A brand new adventure: every world once, in a new random order, each with a new course.
   * @param {string} [note] an extra line for the loading screen
   */
  function startAdventure(note = '') {
    points = 0;
    coinsCollected = 0;
    coinsOffered = 0;
    runOrder = Levels.createRun();
    bestPointsBeforeRun = loadBest(BEST_POINTS_STORAGE_KEY);
    const { startHearts } = Difficulty.current;
    startLevel(0, startHearts, startHearts, null, note);
  }

  /** Take the main menu away (PLAY, RESUME or Esc) and let the game run again. */
  function closeMainMenu() {
    hasStarted = true;
    Forest.MainMenu.hide();
    Forest.Game.setPaused(false, 'main-menu');
    Forest.Music.setPaused(false);
  }

  /** The note on the loading screen when a game starts over at a new difficulty. */
  function difficultyNote() {
    const { label, startHearts } = Difficulty.current;
    return `DIFFICULTY: ${label} · ${startHearts} HEARTS`;
  }

  /**
   * The pause menu's big button (or Esc): back to the game, or, if a different difficulty was
   * picked meanwhile, a fresh game at that difficulty.
   */
  function playFromPauseMenu() {
    if (Difficulty.current.id !== pausedDifficultyId) {
      if (isTraining) startTrainingSession(difficultyNote());
      else startAdventure(difficultyNote());
    }
    closeMainMenu();
  }

  /** Esc (or ☰ on phones) during a game: pause, stop the music and bring up the main menu. */
  function openPauseMenu() {
    if (!hasStarted || Forest.LoadingScreen.isBusy || Forest.MainMenu.isOpen) return;
    Forest.Game.setPaused(true, 'main-menu');
    Forest.Music.setPaused(true); // the music waits for RESUME
    pausedDifficultyId = Difficulty.current.id;
    Forest.MainMenu.show({
      mode: 'pause',
      onPlay: playFromPauseMenu,
      onNewGame: () => {
        if (isTraining) Forest.Game.endTraining();
        else startAdventure(); // pauses for its loading screen before the menu lets go
        closeMainMenu();
      },
      getBestPoints: () => loadBest(BEST_POINTS_STORAGE_KEY)
    });
  }

  // Esc opens the pause menu, and closes it again. (The scrapbook and the gallery close
  // themselves on Esc, so it's left to them while one of them is open.)
  window.addEventListener('keydown', event => {
    if (event.code !== 'Escape' || event.repeat || Forest.MainMenu.isCoveredByOverlay()) return;
    if (!Forest.MainMenu.isOpen) openPauseMenu();
    else if (hasStarted) playFromPauseMenu();
  }, true);

  /** Try the current level again from its start, with full health (same course as before). */
  function retryLevel() {
    points = levelStart.points;
    coinsCollected = levelStart.coins;
    bestPointsBeforeRun = loadBest(BEST_POINTS_STORAGE_KEY);
    startLevel(levelIndex, levelStart.maxHp, levelStart.maxHp, level);
  }

  function spawnDistanceFor(entry) {
    return entry.kind === 'mushroom' ? MUSHROOM_SPAWN_DISTANCE : SKY_SPAWN_DISTANCE;
  }

  /** Drop in every enemy the boy has come close enough to. */
  function spawnApproachingEnemies() {
    while (pendingEnemies.length > 0 && player.x >= pendingEnemies[0].triggerX) {
      spawnLevelEnemy(pendingEnemies.shift());
    }
  }

  function spawnLevelEnemy(entry) {
    const difficulty = Difficulty.current;
    // About half of them may come down on a ledge above, the rest land on the ground
    // The level may say where it lands (on a sky island, or under one); otherwise it's a coin toss
    const allowLedges = entry.allowLedges !== undefined ? entry.allowLedges : Math.random() < LEDGE_LANDING_CHANCE;
    if (entry.kind === 'mushroom') {
      addEnemy(new Forest.EvilMushroom(world, { x: entry.x, patrolDistance: LEVEL_PATROL_DISTANCE, allowLedges }, onEnemyDefeated));
      return;
    }
    const options = { x: entry.x, onDefeated: onEnemyDefeated, allowLedges };
    if (entry.kind === 'mutant') {
      // A new random monster every time, so the scrapbook keeps filling up, except the level's
      // featured species (a fixed seed). The future-tech worlds are crawling with cybernetic mutants
      const cyber = entry.cyber !== undefined ? entry.cyber : (level.future && Math.random() < FUTURE_CYBER_CHANCE ? true : undefined);
      const genome = Forest.MonsterForge.generate({ power: entry.power, cyber, seed: entry.seed });
      addEnemy(Forest.MonsterForge.create(world, { ...options, genome, stats: Forest.MonsterForge.statsFor(genome, difficulty) }));
      return;
    }
    const ramp = levelIndex * RAMP_PER_LEVEL * difficulty.cycleRamp;
    const stats = Forest.WaveDirector.creatureStats(entry.kind, difficulty, ramp);
    addEnemy(new Forest.SkyCreatures[entry.kind](world, { ...options, stats }));
  }

  /** Enemies left far behind are removed (no reward), so long levels stay light. */
  function despawnDistantEnemies() {
    enemies.forEach(enemy => {
      if (enemy !== boss && !enemy.isGone && enemy.x < player.x - DESPAWN_DISTANCE) enemy.remove();
    });
  }

  /** Walking into the arena shuts it behind the boy and brings down the boss. */
  function updateArena(deltaSeconds) {
    if (isTraining || !level.boss) return;

    if (arenaState === ArenaState.CLOSED && player.x >= level.arena.start + ARENA_TRIGGER_INSET && !player.isDefeated) {
      enterArena();
    } else if (arenaState === ArenaState.FIGHTING) {
      updateBossFight();
    } else if (arenaState === ArenaState.BOSS_DOWN && enemies.every(enemy => enemy.isGone)) {
      dropShard();
    } else if (arenaState === ArenaState.SHARD) {
      shard.update(deltaSeconds, player);
    } else if (arenaState === ArenaState.CLEARED) {
      nextLevelTimer -= deltaSeconds;
      if (nextLevelTimer <= 0) startCoinTally();
    } else if (arenaState === ArenaState.COIN_TALLY) {
      updateCoinTally(deltaSeconds);
    } else if (arenaState === ArenaState.ADVANCING) {
      nextLevelTimer -= deltaSeconds;
      if (nextLevelTimer <= 0) showLevelEndStory();
    }
  }

  function enterArena() {
    const { arena, boss: bossData } = level;
    arenaState = ArenaState.FIGHTING;
    player.setBounds(arena.start + 0.5, arena.end - 0.3);
    cameraController.lockTo(arena.start, arena.end);
    // Stragglers outside the arena can't reach the fight any more; the rest stay on screen
    enemies.forEach(enemy => {
      if (enemy.x < arena.start) enemy.remove();
      else confineToArena(enemy);
    });
    pendingEnemies = [];

    const difficulty = Difficulty.current;
    const stats = {
      hp: Math.max(4, bossData.hp + difficulty.creatureHpBonus * 3),
      damage: 1,
      speed: difficulty.creatureSpeed
    };
    const bossOptions = { x: bossData.x, stats, sizeScale: bossData.sizeScale, onDefeated: onBossDefeated };
    bossName = bossData.name;
    if (bossData.kind === 'mutant') {
      // Seeded by the level, so a retry faces the same monster. Signature bosses keep their exact look;
      // a randomly picked mutant may or may not turn out cybernetic
      const cyber = bossData.name ? Boolean(bossData.cyber) : bossData.cyber;
      const genome = Forest.MonsterForge.generate({ power: bossData.power, movement: bossData.movement, seed: bossData.seed, cyber });
      boss = Forest.MonsterForge.create(world, { ...bossOptions, genome });
      if (!bossName) bossName = mutantBossName(genome);
    } else {
      boss = new Forest.SkyCreatures[bossData.kind](world, bossOptions);
    }
    addEnemy(boss);
    if (bossIsTooBigToJump()) addFootholds();
    summonCompanions(level.number <= COMPANION_EXTRA_FROM_LEVEL ? BOSS_COMPANIONS : BOSS_COMPANIONS + 1);
    Sfx.waveStart();
    hud.showBanner({ title: `BOSS: ${bossName}`, subtitle: `${bossData.flavor} It brought little helpers!`, variant: 'boss', seconds: 3.2 });
  }

  /**
   * True when the boy can't double-jump over the boss from the ground: it's too tall or too wide.
   * Flying bosses don't count, since he can run underneath them.
   */
  function bossIsTooBigToJump() {
    if (boss.isFlyer || boss.kind === 'gloomwing') return false;
    const gravityScale = world.levelPhysics.gravityScale || 1;
    const peak = DOUBLE_JUMP_PEAK / gravityScale;
    const clearHeight = boss.height * (BOSS_TOUCH_TOP[boss.kind] || DEFAULT_BOSS_TOUCH_TOP) + JUMP_CLEARANCE_MARGIN;
    if (clearHeight >= peak) return true;
    // How long a perfect double jump keeps his feet above the body, and how far he drifts meanwhile,
    // against how far it is from touching it on one side to touching it on the other
    const secondsAbove = 2 * Math.sqrt((2 * (peak - clearHeight)) / (PLAYER_GRAVITY * gravityScale));
    const touchSpan = 2 * boss.width * (BOSS_TOUCH_HALF_WIDTH[boss.kind] || DEFAULT_BOSS_TOUCH_HALF_WIDTH) + player.width * 0.5;
    return PLAYER_AIR_SPEED * secondsAbove < touchSpan * JUMP_DISTANCE_MARGIN;
  }

  /**
   * Three ledges in the arena: one low on each side and a higher one in the middle, so the boy can
   * get above a giant boss and jump over it (or strike it from above).
   */
  function addFootholds() {
    const { arena } = level;
    const lift = Math.min(1.4, Math.sqrt(1 / (world.levelPhysics.gravityScale || 1)));
    const center = (arena.start + arena.end) / 2;
    const ledges = [
      { x: arena.start + 3.5, y: 2.0 * lift, width: 3 },
      { x: arena.end - 6.5, y: 2.0 * lift, width: 3 },
      { x: center - 1.75, y: 3.9 * lift, width: 3.5 }
    ];
    ledges.forEach(ledge => {
      const surface = world.terrain.addPlatform(ledge);
      scenery.addPlatform(ledge, surface);
      particles.burst(ledge.x + ledge.width / 2, ledge.y, 10, '#ffffff', 1.2, 0.4);
    });
  }

  /** A title for a randomly picked mutant boss, from its species: e.g. "THE GREAT SPIKY CYBER-BIGHEAD". */
  function mutantBossName(genome) {
    const species = Forest.MonsterSpecies.forGenome(genome);
    return `${MUTANT_BOSS_TITLES[genome.seed % MUTANT_BOSS_TITLES.length]} ${species.common.toUpperCase()}`;
  }

  /** Arena enemies keep their whole body on screen (the arena is exactly one screen wide). */
  function confineToArena(enemy) {
    if (enemy.confineTo) enemy.confineTo(level.arena.start, level.arena.end);
  }

  /**
   * Every trick the boss has, as Monster Forge ability ids, so its helpers can be given different
   * ones: a mutant boss's own abilities plus the weapons its rage unlocks, or for the hand-made
   * bosses the ability closest to their signature attack.
   */
  function bossAbilityIds() {
    if (!boss) return [];
    if (boss.genome) {
      const rageWeapons = boss.genome.appearance.cyber ? ['laser', 'rockets'] : ['spit', 'nova'];
      return [...new Set([...boss.genome.abilities, ...rageWeapons])];
    }
    return NATIVE_BOSS_ABILITIES[boss.kind] || [];
  }

  /**
   * Small helper mutants that drop in to fight beside the boss, landing away from the boy. A mutant
   * boss brings little look-alikes of its own species; the other bosses bring small random mutants
   * (often cybernetic in the future-tech worlds). Helpers never share the boss's abilities.
   */
  function summonCompanions(count) {
    const { arena } = level;
    const power = Math.min(10, 1 + Math.floor((level.number - 1) * 0.55) + COMPANION_POWER_BONUS);
    const bossLook = boss && boss.genome
      ? { movement: boss.genome.movement, shape: boss.genome.appearance.shape, headgear: boss.genome.appearance.headgear, cyber: Boolean(boss.genome.appearance.cyber) }
      : null;
    for (let i = 0; i < count; i++) {
      let x = arena.start + 3 + ((i + Math.random()) / count) * (arena.end - arena.start - 6);
      if (Math.abs(x - player.x) < COMPANION_MIN_DISTANCE) x = player.x + (x >= player.x ? 1 : -1) * COMPANION_MIN_DISTANCE;
      const look = bossLook || { cyber: level.future && Math.random() < FUTURE_CYBER_CHANCE ? true : undefined };
      const genome = Forest.MonsterForge.generate({ power, ...look, excludeAbilities: bossAbilityIds() });
      const stats = Forest.MonsterForge.statsFor(genome, Difficulty.current);
      const companion = Forest.MonsterForge.create(world, {
        genome, x, allowLedges: false, onDefeated: onEnemyDefeated, sizeScale: HELPER_SIZE,
        stats: { ...stats, hp: Math.max(1, Math.ceil(stats.hp * HELPER_HP_SHARE)) }
      });
      companion.isBossCompanion = true;
      addEnemy(companion);
    }
  }

  /** During the fight: the boss flies into a rage at half health and calls for reinforcements. */
  function updateBossFight() {
    if (!boss || boss.isGone || boss.hp <= 0) return;
    if (!boss.isRaging && boss.hp <= boss.maxHp * BOSS_RAGE_HEALTH) {
      boss.enterRage();
      summonCompanions(RAGE_REINFORCEMENTS);
      Sfx.golemRoar();
      cameraController.shake(0.25, 0.5);
      hitStop.trigger(0.12);
      effects.spawnRing({ color: '#ff3b3b', x: boss.x, y: boss.centerY, fromScale: 0.5, toScale: 9, lifetime: 0.5, z: 0.62 });
      particles.burst(boss.x, boss.centerY, 26, '#ff5a1f', 2.6, 0.7);
      hud.showBanner({ title: `${bossName} IS ENRAGED!`, subtitle: 'Faster, meaner... and it called for backup!', variant: 'boss', seconds: 2.6 });
    }
    // Angry red embers rising off it for the rest of the fight
    if (boss.isRaging && Math.random() < 0.35) {
      particles.burst(boss.x + (Math.random() - 0.5) * boss.width, boss.y + Math.random() * boss.height, 1, Math.random() < 0.5 ? '#ff3b3b' : '#ffb347', 0.6, 0.5);
    }
  }

  function onBossDefeated(enemy) {
    onEnemyDefeated(enemy);
    arenaState = ArenaState.BOSS_DOWN;
    bossFallSpot = { x: enemy.x, y: enemy.centerY };
    // With their leader gone, the sidekicks blow up too
    enemies.forEach(other => {
      if (other.isBossCompanion && other.isHittable) other.defeat();
    });
  }

  /**
   * Boss and leftovers gone: the Heart Star shard it guarded appears where it fell (kept inside the
   * arena), and the level is only won once the boy picks it up.
   */
  function dropShard() {
    arenaState = ArenaState.SHARD;
    const { arena } = level;
    const spot = bossFallSpot || { x: (arena.start + arena.end) / 2, y: Config.GROUND_Y + 3 };
    const x = Forest.MathUtils.clamp(spot.x, arena.start + SHARD_ARENA_MARGIN, arena.end - SHARD_ARENA_MARGIN);
    shard = new Forest.StarShard(world, { x, y: Math.max(spot.y, Config.GROUND_Y + 1) }, collectShard);
    Sfx.newSpecies();
    hud.showBanner({
      title: '✨ A STAR SHARD! ✨',
      subtitle: `${bossName} dropped a shard of the Heart Star. Grab it!`,
      variant: 'cleared',
      seconds: 3
    });
  }

  function collectShard() {
    shard = null;
    clearLevel();
  }

  /** The shard is picked up: fanfare, bonus points and an extra heart, then the coins are cashed in. */
  function clearLevel() {
    arenaState = ArenaState.CLEARED;
    nextLevelTimer = COIN_TALLY_DELAY_SECONDS;
    Sfx.levelCleared();
    const bonus = LEVEL_CLEAR_POINTS * level.number;
    points += bonus;
    player.raiseMaxHp(1, Difficulty.current.maxHearts);
    const isLast = levelIndex === runOrder.length - 1;
    hud.showBanner({
      title: `${level.name} CLEARED!`,
      subtitle: `+${bonus} POINTS &middot; FULLY HEALED! ${isLast ? 'The world is saved...' : 'Now to count your coins...'}`,
      variant: 'cleared',
      seconds: COIN_TALLY_DELAY_SECONDS
    });
  }

  /** Turn the level's coins into points, a few at a time, with a ping for each tick. */
  function startCoinTally() {
    arenaState = ArenaState.COIN_TALLY;
    coinTally = { timer: 0, perTick: Math.max(1, Math.ceil(levelCoins / COIN_TALLY_MAX_TICKS)), cashed: 0 };
    if (levelCoins === 0) finishCoinTally();
  }

  function updateCoinTally(deltaSeconds) {
    coinTally.timer -= deltaSeconds;
    if (coinTally.timer > 0) return;
    coinTally.timer = COIN_TALLY_TICK_SECONDS;
    const coinsThisTick = Math.min(coinTally.perTick, levelCoins);
    levelCoins -= coinsThisTick;
    coinTally.cashed += coinsThisTick;
    points += coinsThisTick * COIN_POINTS;
    Sfx.coin();
    particles.burst(player.x, player.y + player.height + 0.3, 3, '#ffd84a', 0.8, 0.3);
    if (levelCoins === 0) finishCoinTally();
  }

  function finishCoinTally() {
    arenaState = ArenaState.ADVANCING;
    nextLevelTimer = NEXT_LEVEL_DELAY_SECONDS;
    const { cashed } = coinTally;
    Sfx.bonusPoints();
    hud.showBanner({
      title: cashed > 0 ? `🪙 ${cashed} COINS = +${(cashed * COIN_POINTS).toLocaleString()} POINTS` : 'NO COINS THIS TIME',
      subtitle: levelIndex === runOrder.length - 1 ? 'What a journey!' : 'Get ready for the next level...',
      variant: 'cleared',
      seconds: NEXT_LEVEL_DELAY_SECONDS - 0.3
    });
  }

  /**
   * The level's part of the story once its shard is won back (after the last level, the finale),
   * on the loading screen with the game paused. Moving on starts the next level, or the victory screen.
   */
  function showLevelEndStory() {
    arenaState = ArenaState.STORY;
    const total = runOrder.length;
    const isLast = levelIndex === total - 1;
    Forest.Game.setPaused(true, 'loading');
    Forest.LoadingScreen.showStory({
      icon: '✨',
      heading: `SHARD ${levelIndex + 1} OF ${total} RECOVERED!`,
      title: level.name,
      story: Forest.Story.levelEnd({ position: levelIndex, total, worldId: level.id, bossName }),
      buttonLabel: isLast ? 'THE END ▶' : 'NEXT WORLD ▶',
      onContinue: () => {
        // The next level's loading takes the screen over (and keeps the game paused)
        if (!isLast) {
          advanceToNextLevel();
          return;
        }
        Forest.LoadingScreen.hide();
        Forest.Game.setPaused(false, 'loading');
        advanceToNextLevel();
      }
    });
  }

  function advanceToNextLevel() {
    if (levelIndex < runOrder.length - 1) {
      startLevel(levelIndex + 1, player.hp, player.maxHp);
      return;
    }
    hasWon = true;
    const totalCoins = coinsOffered;
    const previousBest = loadBest(BEST_POINTS_STORAGE_KEY);
    const isNewBestPoints = points > previousBest;
    if (isNewBestPoints) saveBest(BEST_POINTS_STORAGE_KEY, points);
    hud.showVictory(startAdventure, {
      points,
      coins: coinsCollected,
      totalCoins,
      bestPoints: Math.max(previousBest, points),
      isNewBestPoints
    });
  }

  /** The level's own hazard: sandstorm gusts or lava bombs raining down. */
  function updateHazards(deltaSeconds) {
    levelTime += deltaSeconds;
    if (level.hazard === 'wind') {
      // -1..1: which way it blows and how hard, easing through a calm each time it turns round
      const swing = windDirection * Math.sin((levelTime / WIND_GUST_PERIOD) * Math.PI * 2);
      world.levelPhysics.windSpeed = player.isDefeated ? 0 : WIND_BASE_SPEED * swing + WIND_GUST_SPEED * swing * Math.abs(swing);
      ambientLeaves.setWind(world.levelPhysics.windSpeed);
      background.setWind(world.levelPhysics.windSpeed);
    } else if (level.hazard === 'lavaBombs' && arenaState !== ArenaState.CLEARED && !player.isDefeated) {
      lavaBombTimer -= deltaSeconds;
      if (lavaBombTimer <= 0) {
        lavaBombTimer = Forest.MathUtils.randomBetween(...LAVA_BOMB_INTERVAL);
        const fromX = player.x + Forest.MathUtils.randomBetween(-3, 9);
        const targetX = player.x + Forest.MathUtils.randomBetween(-2.5, 4);
        world.projectiles.launchFireball(fromX, stage.camera.position.y + stage.viewHeightUnits / 2 + 1, targetX, Config.GROUND_Y + 0.3, LAVA_BOMB_FLIGHT_SECONDS, 1, level.bombStyle);
        Sfx.skyWhistle();
      }
    }
  }

  /** Walking (not jumping) through a sticky web on the ground slows the boy down. */
  function checkStickyWebs() {
    if (!scenery || player.isDefeated) return;
    const isInWeb = scenery.stickyWebs.some(web => player.x > web.left && player.x < web.right
      && player.y < web.top - 0.4 && player.y > web.bottom);
    if (isInWeb) player.entangle(GROUND_WEB_STUCK_SECONDS, GROUND_WEB_SPEED_FACTOR);
  }

  /** Dropped into a pit: a heart lost and back to solid ground (or defeat on the last heart). */
  function checkPitFall() {
    if (player.isDefeated || player.y >= PIT_Y) return;
    player.fallIntoPit();
    // Never respawn past the left edge of what he can reach (e.g. the arena wall): use solid ground ahead
    if (!player.isDefeated && player.x < player.minX + 0.5) {
      player.x = world.terrain.safeGroundFrom(player.minX + 0.5);
      player.y = world.terrain.groundTopAt(player.x);
    }
    cameraController.snapTo(player);
  }

  // ==========================================
  // Game rules
  // ==========================================
  /** Points, a possible heart, and a tick in the scrapbook. */
  function onEnemyDefeated(enemy) {
    // Harder difficulties pay more for every foe
    const reward = Math.round(Rewards.pointsFor(enemy) * Difficulty.current.pointsMultiplier);
    points += reward;
    floatingText.spawn(`+${reward}`, enemy.x, enemy.centerY + 0.5);
    if (Math.random() < Rewards.heartDropChance(enemy)) hearts.spawn(enemy.x, enemy.centerY);
    if (isTraining) return;
    Scrapbook.recordDefeat(enemy);
  }

  function collectCoin(coin) {
    // Coins are cashed in for points at the end of the level (see startCoinTally)
    coinsCollected++;
    levelCoins++;
    Sfx.coin();
  }

  function announceWave(wave) {
    Sfx.waveStart();
    hud.showBanner({ title: '🎯 TRAINING', subtitle: wave.flavor, variant: 'cleared', seconds: 3.2 });
  }

  /** Only training uses waves now: its one wave is over. */
  function rewardWaveCleared() {
    Sfx.waveCleared();
    showTrainingResult(true);
  }

  /** A dropped heart heals one heart; with full health it's worth points instead. */
  function collectHeart(heart) {
    if (player.hp < player.maxHp) {
      player.heal(1);
      floatingText.spawn('+1 HEART', heart.x, heart.y + 0.8, '#ff6b6b');
    } else {
      points += Rewards.SPARE_HEART_POINTS;
      Sfx.bonusPoints();
      floatingText.spawn(`+${Rewards.SPARE_HEART_POINTS}`, heart.x, heart.y + 0.8);
    }
  }

  function refreshHealth() {
    hud.showHealth(player.hp, player.maxHp);
  }

  function refreshPoints() {
    hud.showPoints(points, Math.max(points, bestPointsBeforeRun));
  }

  function refreshScore() {
    if (isTraining) {
      hud.showScore(`🎯 TRAINING: ${waves.remainingFoes} LEFT`);
      return;
    }
    // Coins on the main line, so they show even on narrow screens (which hide the detail line)
    hud.showScore(`${level.icon} LEVEL ${level.number} &middot; 🪙 ${levelCoins}`);
  }

  /** End of a training session, won (everything defeated) or lost (the boy fell). */
  function showTrainingResult(won) {
    const defeated = trainingTotal - waves.remainingFoes;
    hud.showTrainingResult({
      won,
      defeated: won ? trainingTotal : defeated,
      total: trainingTotal,
      points,
      onRetry: restartGame,
      onLeave: () => Forest.Game.endTraining()
    });
  }

  function showGameOver() {
    if (isTraining) {
      showTrainingResult(false);
      return;
    }
    const previousBestPoints = loadBest(BEST_POINTS_STORAGE_KEY);
    const isNewBestPoints = points > previousBestPoints;
    if (isNewBestPoints) saveBest(BEST_POINTS_STORAGE_KEY, points);

    hud.showGameOver(retryLevel, {
      levelLabel: `LEVEL ${level.number}: ${level.name}`,
      points,
      bestPoints: Math.max(previousBestPoints, points),
      isNewBestPoints
    });
  }

  /** Bests are tracked separately for each difficulty. */
  function bestKey(baseKey) {
    return `${baseKey}.${Difficulty.current.id}`;
  }

  function loadBest(baseKey) {
    try {
      return Number(localStorage.getItem(bestKey(baseKey))) || 0;
    } catch (error) {
      return 0;
    }
  }

  function saveBest(baseKey, value) {
    try {
      localStorage.setItem(bestKey(baseKey), String(value));
    } catch (error) {
      // Storage unavailable (private mode, blocked): the best score just isn't remembered
    }
  }

  /** The sword slam damages every enemy inside its hit area and swats fireballs out of the air. */
  function hitEnemiesInArea(hitArea) {
    enemies.forEach(enemy => {
      if (!enemy.isHittable || !enemy.isInsideArea(hitArea)) return;

      enemy.takeHit(1, player.x);
      hitStop.trigger(0.06);
      // Metallic hit sparks
      particles.burst(enemy.x, enemy.centerY, 9, '#ffeaa7', 1.4, 0.38);
      particles.burst(enemy.x, enemy.centerY, 5, '#ffffff', 1.0, 0.25);
    });

    if (world.projectiles.destroyInArea(hitArea) > 0) hitStop.trigger(0.05);
  }

  function updateEnemies(deltaSeconds) {
    enemies.forEach(enemy => {
      enemy.update(deltaSeconds, player);
      if (enemy.canHurtPlayer && enemy.isTouching(player)) {
        player.takeDamage(enemy.damage || 1, enemy.x);
      }
    });
    enemies = enemies.filter(enemy => !enemy.isGone);
  }

  /** [R] or a "try again" button: retry the level (or the training, or a new adventure after winning). */
  function restartGame() {
    // Nothing to restart on the title screen, and a level that is still loading can't be retried yet
    if (!hasStarted || Forest.LoadingScreen.isBusy) return;
    if (isTraining) {
      startTrainingSession();
      return;
    }
    if (hasWon) {
      startAdventure();
      return;
    }
    retryLevel();
  }

  function startTrainingSession(note = '') {
    const session = Training.buildSession();
    // Nothing left to train against (e.g. every pick was unticked): back to the adventure
    if (!session) {
      isTraining = false;
      startAdventure();
      return;
    }
    isTraining = true;
    points = 0;
    const { startHearts } = Difficulty.current;
    // The chosen world's look and rules, with fresh random ledges every session
    const themes = Levels.themes;
    const mapId = Training.mapId;
    const theme = mapId === Training.RANDOM_MAP
      ? themes[Math.floor(Math.random() * themes.length)]
      : themes.find(entry => entry.id === mapId) || themes[0];
    trainingTotal = session.total;
    loadBehindScreen({
      icon: '🎯',
      heading: 'TRAINING',
      title: theme.name,
      subtitle: `${session.total} ${session.total === 1 ? 'foe' : 'foes'} to defeat. Training doesn't count towards high scores.`,
      note,
      minSeconds: RETRY_LOADING_SECONDS,
      build: () => {
        buildLevel(Levels.trainingGround(theme), { hp: startHearts, maxHp: startHearts });
        refreshPoints();
      },
      onReady: () => {
        waves.startCustom(session);
        refreshScore();
      }
    });
  }

  // On the title screen a difficulty is just picked. On the pause menu nothing restarts yet: the
  // big button turns into START GAME (and back into RESUME if the game's own difficulty is picked
  // again). Changed anywhere else during a game, a fresh run starts with that many hearts.
  Difficulty.onChange(changedLevel => {
    if (!hasStarted) return;
    if (Forest.MainMenu.isOpen) {
      Forest.MainMenu.setPlayAction(changedLevel.id === pausedDifficultyId ? 'resume' : 'restart');
      return;
    }
    if (isTraining) startTrainingSession(difficultyNote());
    else startAdventure(difficultyNote());
  });

  // ==========================================
  // Game loop
  // ==========================================
  let lastTimestamp = performance.now();

  function runFrame(timestamp) {
    requestAnimationFrame(runFrame);

    // Browsers can hand the first frame a timestamp slightly before the start clock: never step backwards
    const realDeltaSeconds = Math.max(0, Math.min((timestamp - lastTimestamp) / 1000, Config.MAX_FRAME_SECONDS));
    lastTimestamp = timestamp;
    if (isPaused) {
      stage.render();
      return;
    }
    // Gameplay freezes during hit-stop, but the camera keeps shaking
    const gameDeltaSeconds = hitStop.consume(realDeltaSeconds);

    world.terrain.update(gameDeltaSeconds, player);
    scenery.update(gameDeltaSeconds);
    player.update(gameDeltaSeconds);
    spikeTraps.update(gameDeltaSeconds, player);
    worldTraps.update(gameDeltaSeconds, player);
    checkPitFall();
    checkStickyWebs();
    if (!player.isDefeated) {
      if (isTraining) waves.update(gameDeltaSeconds);
      else spawnApproachingEnemies();
    }
    updateEnemies(gameDeltaSeconds);
    if (!isTraining) {
      despawnDistantEnemies();
      updateArena(gameDeltaSeconds);
      updateHazards(gameDeltaSeconds);
    }
    world.projectiles.update(gameDeltaSeconds, player);
    hearts.update(gameDeltaSeconds, player);
    coins.update(gameDeltaSeconds, player);
    floatingText.update(gameDeltaSeconds);
    particles.update(gameDeltaSeconds);
    effects.update(gameDeltaSeconds);

    cameraController.update(player, realDeltaSeconds);
    ambientLeaves.update(gameDeltaSeconds, stage.camera.position.x);
    background.update(stage.camera.position.x, stage.camera.position.y, realDeltaSeconds);
    refreshScore();
    refreshPoints();

    stage.render();
  }

  // ==========================================
  // Hooks for the sprite gallery and the browser console
  // ==========================================
  const SUMMON_DISTANCE = [2.5, 4];
  const modeListeners = [];

  function notifyModeChanged() {
    modeListeners.forEach(listener => listener(isTraining));
  }

  Forest.Game = {
    /**
     * Drop a Monster Forge monster near the boy, e.g. from the browser console:
     *   Forest.Game.summonMonster({ power: 6 })
     *   Forest.Game.summonMonster({ seed: 1234, power: 3, movement: 'flyer' })
     * @param {object} [genomeOrOptions] a ready genome, or options for Forest.MonsterForge.generate
     * @returns {object} the monster (its .genome can be saved and summoned again)
     */
    summonMonster(genomeOrOptions = {}) {
      const { MonsterForge, MathUtils } = Forest;
      const genome = genomeOrOptions.appearance ? genomeOrOptions : MonsterForge.generate(genomeOrOptions);
      const offset = MathUtils.randomDirection() * MathUtils.randomBetween(...SUMMON_DISTANCE);
      const x = MathUtils.clamp(player.x + offset, player.minX + 1, player.maxX - 1);
      const monster = MonsterForge.create(world, { genome, x, onDefeated: onEnemyDefeated });
      addEnemy(monster);
      return monster;
    },

    /**
     * Freeze gameplay while a menu (e.g. the scrapbook) covers the game. Each menu pauses
     * under its own reason, so the game only resumes once every one of them has closed
     * (e.g. closing the scrapbook while the ☰ menu is still open keeps it paused).
     */
    setPaused(paused, reason = 'default') {
      if (paused) pauseReasons.add(reason);
      else pauseReasons.delete(reason);
      isPaused = pauseReasons.size > 0;
      // Don't let a key held when the menu opened stay "held" after it closes
      if (isPaused) ['left', 'right'].forEach(action => input.release(action));
    },

    get isPaused() {
      return isPaused;
    },

    /** Pause the game on the main menu (the ☰ button on phones). Does nothing before the game starts or while loading. */
    openMenu() {
      openPauseMenu();
    },

    /**
     * The app left the screen (true: home button, app switcher, exit) or came back (false).
     * Freezes the game and every sound until it returns. Called by the Flutter app, and by the
     * browser itself when the tab is hidden.
     */
    setBackgrounded(backgrounded) {
      this.setPaused(backgrounded, 'background');
      Forest.Music.setBackgrounded(backgrounded);
      // Coming back finds the game waiting on the pause menu, not already running
      if (backgrounded) openPauseMenu();
    },

    /**
     * Start (or restart) a training session with the creatures picked in the scrapbook.
     * @returns {boolean} false when nothing is picked (the game carries on as before)
     */
    startTraining() {
      if (Training.selectedCreatureCount === 0) return false;
      startTrainingSession();
      // Training can be started from the scrapbook on the main menu
      if (Forest.MainMenu.isOpen) closeMainMenu();
      notifyModeChanged();
      return true;
    },

    /** Leave training and start a fresh adventure. */
    endTraining() {
      isTraining = false;
      startAdventure();
      notifyModeChanged();
    },

    get isTraining() {
      return isTraining;
    },

    /** @param {(isTraining: boolean) => void} listener called when training starts or ends */
    onModeChange(listener) {
      modeListeners.push(listener);
    },

    /**
     * Jump straight to a level of this adventure (1-22), e.g. from the console: Forest.Game.goToLevel(3)
     * @param {number} number
     */
    goToLevel(number) {
      startLevel(Math.max(0, Math.min(runOrder.length - 1, number - 1)), player.maxHp, player.maxHp);
    },

    /**
     * Play a world by id (e.g. 'neon', 'rift') as the current level, with a new course:
     * Forest.Game.goToWorld('fae')
     * @param {string} id
     */
    goToWorld(id) {
      const themeIndex = Levels.themes.findIndex(theme => theme.id === id);
      if (themeIndex < 0) return;
      const swapWith = runOrder.indexOf(themeIndex);
      [runOrder[levelIndex], runOrder[swapWith]] = [runOrder[swapWith], runOrder[levelIndex]];
      startLevel(levelIndex, player.maxHp, player.maxHp);
    },

    /** The current level's ground and platforms (read-only, for the console and tests). */
    get terrain() {
      return world.terrain;
    },

    /** The current level's sticky ground webs, as { left, right, top } (read-only, for the console and tests). */
    get stickyWebs() {
      return scenery ? scenery.stickyWebs : [];
    },

    /** The current level's data (read-only). */
    get level() {
      return level;
    },

    /** The boy (read-only access for the console and tests). */
    get player() {
      return player;
    },

    get points() {
      return points;
    },

    get coins() {
      return coinsCollected;
    },

    get enemies() {
      return enemies;
    }
  };

  // Hidden tab, minimised browser or (on phones) a WebView that reports it: go quiet until it's back
  document.addEventListener('visibilitychange', () => Forest.Game.setBackgrounded(document.hidden));
  window.addEventListener('pagehide', () => Forest.Game.setBackgrounded(true));
  window.addEventListener('pageshow', () => Forest.Game.setBackgrounded(document.hidden));

  // Everything has loaded: the title screen comes up, and the game waits behind it
  Forest.Game.setPaused(true, 'main-menu');
  Forest.LoadingScreen.finishBoot(() => Forest.MainMenu.show({
    onPlay: () => {
      startAdventure(); // pauses for its loading screen before the menu lets go
      closeMainMenu();
    },
    getBestPoints: () => loadBest(BEST_POINTS_STORAGE_KEY)
  }));
  requestAnimationFrame(runFrame);
})(window.Forest);
