/**
 * Entry point: builds the world, wires the systems together, and runs the game loop.
 */
(function (Forest) {
  const { Config, LevelData } = Forest;

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
  const world = { scene: stage.scene, sprites, input, particles, effects, hitStop, cameraController };

  const player = new Forest.Player(world, {
    onHealthChanged: refreshHud,
    onDefeated: () => hud.showGameOver(restartGame),
    onSlamLanded: hitMushroomsInArea
  });

  let mushrooms = [];
  let mushroomsDefeated = 0;
  const totalMushrooms = LevelData.mushroomSpawns.length;

  function spawnMushrooms() {
    mushrooms = LevelData.mushroomSpawns.map(spawn => new Forest.EvilMushroom(world, spawn, onMushroomDefeated));
  }

  // ==========================================
  // Game rules
  // ==========================================
  function onMushroomDefeated() {
    mushroomsDefeated++;
    refreshHud();
  }

  function refreshHud() {
    hud.showHealth(player.hp, player.maxHp);
    hud.showScore(mushroomsDefeated, totalMushrooms);
    if (mushroomsDefeated >= totalMushrooms) {
      hud.showVictory(restartGame);
    }
  }

  /** The sword slam damages every mushroom inside its hit area. */
  function hitMushroomsInArea(hitArea) {
    mushrooms.forEach(mushroom => {
      if (!mushroom.isHittable || !mushroom.isInsideArea(hitArea)) return;

      mushroom.takeHit(1, player.x);
      hitStop.trigger(0.06);
      // Metallic hit sparks
      particles.burst(mushroom.x, mushroom.y + 0.6, 9, '#ffeaa7', 1.4, 0.38);
      particles.burst(mushroom.x, mushroom.y + 0.6, 5, '#ffffff', 1.0, 0.25);
    });
  }

  function updateMushrooms(deltaSeconds) {
    mushrooms.forEach(mushroom => {
      mushroom.update(deltaSeconds, player);
      if (mushroom.canHurtPlayer && mushroom.isTouching(player)) {
        player.takeDamage(1, mushroom.x);
      }
    });
  }

  function restartGame() {
    hud.hideOverlay();
    player.reset(LevelData.playerStartX);
    effects.clear();
    hitStop.reset();
    cameraController.stopShake();

    mushrooms.forEach(mushroom => mushroom.remove());
    spawnMushrooms();
    mushroomsDefeated = 0;
    refreshHud();
  }

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
    updateMushrooms(gameDeltaSeconds);
    particles.update(gameDeltaSeconds);
    ambientLeaves.update(gameDeltaSeconds);
    effects.update(gameDeltaSeconds);

    cameraController.update(player, realDeltaSeconds);
    background.update(stage.camera.position.x, stage.camera.position.y, realDeltaSeconds);
    hud.showInspector(player, mushrooms);

    stage.render();
  }

  restartGame();
  requestAnimationFrame(runFrame);
})(window.Forest);
