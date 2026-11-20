/**
 * Entry point: builds the world, wires the systems together, and runs the game loop.
 *
 * The game starts with the evil mushrooms. Once they're all defeated, endless waves of
 * creatures start falling from the sky (see WaveDirector) until the boy is defeated.
 */
(function (Forest) {
  const { Config, LevelData } = Forest;
  const Sfx = Forest.SoundEffects;
  const { Difficulty } = Forest;

  const BEST_WAVE_STORAGE_KEY = 'forest-pixel-adventure.bestWave';

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
      jump: () => player.tryJump(),
      attack: () => player.startAttack(),
      restart: restartGame,
      toggleSound: Forest.AudioControls.toggleSound,
      toggleMusic: Forest.AudioControls.toggleMusic
    },
    onRelease: {
      jump: () => player.releaseJump()
    }
  });
  Forest.TouchControls.bind(input);

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
    spawnEnemy: enemy => enemies.push(enemy)
  };
  world.projectiles = new Forest.ProjectileSystem(world);

  const player = new Forest.Player(world, {
    onHealthChanged: refreshHealth,
    onDefeated: showGameOver,
    onSlamLanded: hitEnemiesInArea
  });

  /** Mushrooms and sky creatures alike. */
  let enemies = [];
  let mushroomsDefeated = 0;
  let foesDefeated = 0;
  const totalMushrooms = LevelData.mushroomSpawns.length;

  const waves = new Forest.WaveDirector({
    spawnCreature: ({ kind, stats, genome }, x) => {
      const options = { x, stats, onDefeated: onEnemyDefeated };
      enemies.push(genome
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
      enemies.push(new Forest.EvilMushroom(world, spawn, onEnemyDefeated));
    });
  }

  // ==========================================
  // Game rules
  // ==========================================
  function onEnemyDefeated(enemy) {
    foesDefeated++;
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
    hud.showBanner({
      title: `WAVE ${wave.number} CLEARED!`,
      subtitle: `${reward} The sky is rumbling again...`,
      variant: 'cleared',
      seconds: 2.4
    });
  }

  function refreshHealth() {
    hud.showHealth(player.hp, player.maxHp);
  }

  function refreshScore() {
    if (!waves.isActive) {
      hud.showScore(`MUSHROOMS DEFEATED: ${mushroomsDefeated} / ${totalMushrooms}`);
    } else {
      hud.showScore(`WAVE ${waves.waveNumber} &middot; FOES LEFT: ${waves.remainingFoes}`, `TOTAL DEFEATED: ${foesDefeated}`);
    }
  }

  function showGameOver() {
    const previousBest = loadBestWave();
    const isNewBest = waves.waveNumber > previousBest;
    if (isNewBest) saveBestWave(waves.waveNumber);
    hud.showGameOver(restartGame, {
      wave: waves.waveNumber,
      foesDefeated,
      bestWave: Math.max(previousBest, waves.waveNumber),
      isNewBest
    });
  }

  /** Best wave is tracked separately for each difficulty. */
  function bestWaveKey() {
    return `${BEST_WAVE_STORAGE_KEY}.${Difficulty.current.id}`;
  }

  function loadBestWave() {
    try {
      return Number(localStorage.getItem(bestWaveKey())) || 0;
    } catch (error) {
      return 0;
    }
  }

  function saveBestWave(wave) {
    try {
      localStorage.setItem(bestWaveKey(), String(wave));
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
    hitStop.reset();
    cameraController.stopShake();

    enemies.forEach(enemy => enemy.remove());
    enemies = [];
    waves.reset();
    spawnMushrooms();
    mushroomsDefeated = 0;
    foesDefeated = 0;
    refreshHealth();
    refreshScore();
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
    // Gameplay freezes during hit-stop, but the camera keeps shaking
    const gameDeltaSeconds = hitStop.consume(realDeltaSeconds);

    player.update(gameDeltaSeconds);
    if (!player.isDefeated) waves.update(gameDeltaSeconds);
    updateEnemies(gameDeltaSeconds);
    world.projectiles.update(gameDeltaSeconds, player);
    particles.update(gameDeltaSeconds);
    ambientLeaves.update(gameDeltaSeconds);
    effects.update(gameDeltaSeconds);

    cameraController.update(player, realDeltaSeconds);
    background.update(stage.camera.position.x, stage.camera.position.y, realDeltaSeconds);
    hud.showInspector(player, enemies);
    refreshScore();

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
      enemies.push(monster);
      return monster;
    }
  };

  restartGame();
  requestAnimationFrame(runFrame);
})(window.Forest);
