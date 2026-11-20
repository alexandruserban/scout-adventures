/**
 * Entry point: builds the world, wires the systems together, and runs the game loop.
 *
 * The game starts with the evil mushrooms. Once they're all defeated, endless waves of
 * creatures start falling from the sky (see WaveDirector) until the boy is defeated.
 */
(function (Forest) {
  const { Config, LevelData } = Forest;
  const Sfx = Forest.SoundEffects;
  const { Difficulty, Rewards, Scrapbook } = Forest;

  const BEST_WAVE_STORAGE_KEY = 'forest-pixel-adventure.bestWave';
  const BEST_POINTS_STORAGE_KEY = 'forest-pixel-adventure.bestPoints';

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
  stage.scene.background = new THREE.Color(background.topColor);
  Forest.buildForestScenery(stage.scene, sprites, LevelData.foregroundTrees);

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
    /** Adds an enemy created mid-fight (e.g. the halves of a split Thunder Jelly). */
    spawnEnemy: enemy => addEnemy(enemy)
  };
  world.projectiles = new Forest.ProjectileSystem(world);
  const hearts = new Forest.HeartPickups(world, collectHeart);
  const floatingText = new Forest.FloatingText(stage.scene);

  const player = new Forest.Player(world, {
    onHealthChanged: refreshHealth,
    onDefeated: showGameOver,
    onSlamLanded: hitEnemiesInArea
  });

  /** Mushrooms and sky creatures alike. */
  let enemies = [];
  let mushroomsDefeated = 0;
  let foesDefeated = 0;
  let points = 0;
  /** High score for this difficulty, read once per run (not every frame). */
  let bestPointsBeforeRun = 0;
  /** True while a menu (scrapbook, gallery) covers the game. */
  let isPaused = false;
  /** Names of the menus currently pausing the game (see Forest.Game.setPaused). */
  const pauseReasons = new Set();
  const totalMushrooms = LevelData.mushroomSpawns.length;

  const waves = new Forest.WaveDirector({
    spawnCreature: ({ kind, stats, genome }, x) => {
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

  function spawnMushrooms() {
    LevelData.mushroomSpawns.forEach(spawn => {
      addEnemy(new Forest.EvilMushroom(world, spawn, onEnemyDefeated));
    });
  }

  /** Every enemy enters play through here, so the scrapbook hears about it. */
  function addEnemy(enemy) {
    enemies.push(enemy);
    const { species, isNew } = Scrapbook.recordEncounter(enemy, waves.waveNumber);
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
  // Game rules
  // ==========================================
  /** Points, a possible heart, and a tick in the scrapbook. */
  function onEnemyDefeated(enemy) {
    foesDefeated++;
    const reward = Rewards.pointsFor(enemy);
    points += reward;
    floatingText.spawn(`+${reward}`, enemy.x, enemy.centerY + 0.5);
    Scrapbook.recordDefeat(enemy);
    if (Math.random() < Rewards.heartDropChance(enemy)) hearts.spawn(enemy.x, enemy.centerY);

    if (enemy instanceof Forest.EvilMushroom) {
      mushroomsDefeated++;
      // The last mushroom angers the sky itself
      if (mushroomsDefeated >= totalMushrooms) waves.start();
    }
  }

  function announceWave(wave) {
    Sfx.waveStart();
    hud.showBanner({
      title: `WAVE ${wave.number}: ${wave.name}`,
      subtitle: wave.flavor,
      variant: wave.isBoss ? 'boss' : 'wave',
      seconds: 3.2
    });
  }

  /** Hearts back after every wave (depending on difficulty); an extra heart container after each boss. */
  function rewardWaveCleared(wave) {
    Sfx.waveCleared();
    const { heartsPerWaveCleared, maxHearts } = Difficulty.current;
    let reward;
    if (wave.isBoss) {
      player.raiseMaxHp(1, maxHearts);
      reward = 'BOSS DOWN - FULLY HEALED!';
    } else if (heartsPerWaveCleared === 0) {
      reward = 'NO HEALING ON HARD!';
    } else {
      reward = player.hp < player.maxHp ? `+${heartsPerWaveCleared} HEART${heartsPerWaveCleared > 1 ? 'S' : ''}` : 'FULL HEALTH!';
      player.heal(heartsPerWaveCleared);
    }
    const bonus = Rewards.WAVE_CLEARED_POINTS_PER_WAVE * wave.number;
    points += bonus;
    hud.showBanner({
      title: `WAVE ${wave.number} CLEARED!`,
      subtitle: `${reward} +${bonus} POINTS. The sky is rumbling again...`,
      variant: 'cleared',
      seconds: 2.4
    });
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
    // No defeated-enemy counts; just the wave number once the sky waves begin
    hud.showScore(waves.isActive ? `WAVE ${waves.waveNumber}` : '');
  }

  function showGameOver() {
    const previousBestWave = loadBest(BEST_WAVE_STORAGE_KEY);
    const isNewBest = waves.waveNumber > previousBestWave;
    if (isNewBest) saveBest(BEST_WAVE_STORAGE_KEY, waves.waveNumber);

    const previousBestPoints = loadBest(BEST_POINTS_STORAGE_KEY);
    const isNewBestPoints = points > previousBestPoints;
    if (isNewBestPoints) saveBest(BEST_POINTS_STORAGE_KEY, points);

    hud.showGameOver(restartGame, {
      wave: waves.waveNumber,
      foesDefeated,
      bestWave: Math.max(previousBestWave, waves.waveNumber),
      isNewBest,
      points,
      bestPoints: Math.max(previousBestPoints, points),
      isNewBestPoints
    });
  }

  /** Bests (wave, points) are tracked separately for each difficulty. */
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

  function restartGame() {
    hud.hideOverlay();
    hud.hideBanner();
    player.reset(LevelData.playerStartX, Difficulty.current.startHearts);
    effects.clear();
    world.projectiles.clear();
    hearts.clear();
    floatingText.clear();
    hitStop.reset();
    cameraController.stopShake();
    hud.hideToast();

    enemies.forEach(enemy => enemy.remove());
    enemies = [];
    waves.reset();
    mushroomsDefeated = 0;
    foesDefeated = 0;
    points = 0;
    bestPointsBeforeRun = loadBest(BEST_POINTS_STORAGE_KEY);
    spawnMushrooms();
    refreshHealth();
    refreshScore();
    refreshPoints();
  }

  // A new difficulty starts a fresh run with that many hearts
  Difficulty.onChange(level => {
    restartGame();
    hud.showBanner({
      title: `DIFFICULTY: ${level.label}`,
      subtitle: `${level.startHearts} hearts. A fresh adventure begins!`,
      variant: level.id === 'HARD' ? 'boss' : 'cleared',
      seconds: 2.2
    });
  });

  // ==========================================
  // Game loop
  // ==========================================
  let lastTimestamp = performance.now();

  function runFrame(timestamp) {
    requestAnimationFrame(runFrame);

    const realDeltaSeconds = Math.min((timestamp - lastTimestamp) / 1000, Config.MAX_FRAME_SECONDS);
    lastTimestamp = timestamp;
    if (isPaused) {
      stage.render();
      return;
    }
    // Gameplay freezes during hit-stop, but the camera keeps shaking
    const gameDeltaSeconds = hitStop.consume(realDeltaSeconds);

    player.update(gameDeltaSeconds);
    if (!player.isDefeated) waves.update(gameDeltaSeconds);
    updateEnemies(gameDeltaSeconds);
    world.projectiles.update(gameDeltaSeconds, player);
    hearts.update(gameDeltaSeconds, player);
    floatingText.update(gameDeltaSeconds);
    particles.update(gameDeltaSeconds);
    ambientLeaves.update(gameDeltaSeconds);
    effects.update(gameDeltaSeconds);

    cameraController.update(player, realDeltaSeconds);
    background.update(stage.camera.position.x, stage.camera.position.y, realDeltaSeconds);
    refreshScore();
    refreshPoints();

    stage.render();
  }

  // ==========================================
  // Hooks for the sprite gallery and the browser console
  // ==========================================
  const SUMMON_DISTANCE = [2.5, 4];

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
      const x = MathUtils.clamp(player.x + offset, Config.LEVEL_START_X + 1, Config.LEVEL_END_X - 1);
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

    /** The boy (read-only access for the console and tests). */
    get player() {
      return player;
    },

    get points() {
      return points;
    }
  };

  restartGame();
  requestAnimationFrame(runFrame);
})(window.Forest);
