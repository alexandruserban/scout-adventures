// Main Game Engine for Forest Pixel Adventure
// Three.js 2D Side-Scrolling Adventure with State Machines and Pixel Physics

(function() {
  const PIXEL_SCALE = 1 / 16; // 16 pixels = 1 world unit
  const VIEW_WIDTH_PIXELS = 320; // Retro internal resolution width

  // ==========================================
  // Game Setup & Three.js Init
  // ==========================================
  const container = document.getElementById('game-container');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1a2928');

  // Orthographic camera for pixel-perfect 2D rendering
  const aspect = window.innerWidth / window.innerHeight;
  const viewHeightUnits = (VIEW_WIDTH_PIXELS / aspect) * PIXEL_SCALE;
  const viewWidthUnits = VIEW_WIDTH_PIXELS * PIXEL_SCALE;

  const camera = new THREE.OrthographicCamera(
    -viewWidthUnits / 2,
    viewWidthUnits / 2,
    viewHeightUnits / 2,
    -viewHeightUnits / 2,
    0.1,
    100
  );
  camera.position.set(0, 2.6, 20);
  camera.lookAt(0, 2.6, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(1); // Keep 1:1 pixel rendering
  renderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(renderer.domElement);

  // ==========================================
  // Texture Preloading & Cache
  // ==========================================
  const R = window.PixelRenderer;
  const S = window.SpriteData;
  const P = S.PALETTE;

  const textures = {
    boy: {
      idle: S.BOY.IDLE.map((rows, i) => R.createTexture(rows, P, `b_idle_${i}`)),
      walk: S.BOY.WALK.map((rows, i) => R.createTexture(rows, P, `b_walk_${i}`)),
      jump: R.createTexture(S.BOY.JUMP, P, 'b_jump'),
      fall: R.createTexture(S.BOY.FALL, P, 'b_fall'),
      attack: S.BOY.ATTACK.map((rows, i) => R.createTexture(rows, P, `b_atk_${i}`)),
      hit1: R.createTexture(S.BOY.HIT_1, P, 'b_hit1'),
      hit1Flash: R.createTexture(R.createHitFlashRows(S.BOY.HIT_1, 'X'), P, 'b_hit1_f'),
      hit2: R.createTexture(S.BOY.HIT_2, P, 'b_hit2'),
      defeated: R.createTexture(S.BOY.DEFEATED, P, 'b_def')
    },
    mushroom: {
      walk: S.MUSHROOM.WALK.map((rows, i) => R.createTexture(rows, P, `m_walk_${i}`)),
      aggro: R.createTexture(S.MUSHROOM.AGGRO, P, 'm_aggro'),
      hit1: R.createTexture(S.MUSHROOM.HIT_1, P, 'm_hit1'),
      hit1Flash: R.createTexture(R.createHitFlashRows(S.MUSHROOM.HIT_1, 'X'), P, 'm_hit1_f'),
      hit2: R.createTexture(S.MUSHROOM.HIT_2, P, 'm_hit2'),
      defeated: R.createTexture(S.MUSHROOM.DEFEATED, P, 'm_def')
    },
    tree: (function() {
      const canvas = S.createAncientTreeCanvas();
      const tex = new THREE.CanvasTexture(canvas);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      return { texture: tex, width: canvas.width, height: canvas.height };
    })(),
    grassGround: (function() {
      const canvas = S.createGrassGroundCanvas();
      const tex = new THREE.CanvasTexture(canvas);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      return { texture: tex, width: canvas.width, height: canvas.height };
    })(),
    flowerTuft: (function() {
      const canvas = S.createFlowerTuftCanvas();
      const tex = new THREE.CanvasTexture(canvas);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      return { texture: tex, width: canvas.width, height: canvas.height };
    })()
  };

  // ==========================================
  // World Building (Forest Level)
  // ==========================================
  const LEVEL_START_X = -12;
  const LEVEL_END_X = 48;
  const GROUND_Y = 0;

  // Parallax Sky / Forest Background
  const skyGeometry = new THREE.PlaneGeometry(160, 40);
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 16;
  skyCanvas.height = 32;
  const sCtx = skyCanvas.getContext('2d');
  const grad = sCtx.createLinearGradient(0, 0, 0, 32);
  grad.addColorStop(0, '#1c3130');
  grad.addColorStop(0.5, '#284b42');
  grad.addColorStop(1, '#4b6e58');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 16, 32);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.magFilter = THREE.NearestFilter;
  skyTex.minFilter = THREE.NearestFilter;
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex });
  const skyMesh = new THREE.Mesh(skyGeometry, skyMat);
  skyMesh.position.set(LEVEL_END_X / 2, 8, -15);
  scene.add(skyMesh);

  // Distant Mountain Silhouettes & Deep Trees (Parallax Layer)
  const bgTreeMat = new THREE.MeshBasicMaterial({
    map: textures.tree.texture,
    transparent: true,
    opacity: 0.35,
    color: new THREE.Color('#122b22')
  });

  const distantTrees = [];
  for (let x = LEVEL_START_X - 10; x < LEVEL_END_X + 15; x += 3.5) {
    const scale = 0.9 + Math.sin(x * 2.3) * 0.3;
    const tMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(textures.tree.width * PIXEL_SCALE * scale, textures.tree.height * PIXEL_SCALE * scale),
      bgTreeMat
    );
    tMesh.position.set(x + (Math.sin(x) * 1.2), 3.0 + scale * 1.2, -6.0);
    scene.add(tMesh);
    distantTrees.push(tMesh);
  }

  // Midground Trees Layer
  const midTreeMat = new THREE.MeshBasicMaterial({
    map: textures.tree.texture,
    transparent: true,
    opacity: 0.75,
    color: new THREE.Color('#224430')
  });
  for (let x = LEVEL_START_X - 5; x < LEVEL_END_X + 10; x += 5.2) {
    const scale = 1.1 + Math.cos(x * 1.7) * 0.2;
    const tMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(textures.tree.width * PIXEL_SCALE * scale, textures.tree.height * PIXEL_SCALE * scale),
      midTreeMat
    );
    tMesh.position.set(x, 3.4 + scale * 1.2, -2.5);
    scene.add(tMesh);
  }

  // Foreground Majestic Trees (Static requirement from user)
  const foregroundTrees = [
    { x: -7, scale: 1.35 },
    { x: 3, scale: 1.45 },
    { x: 13, scale: 1.3 },
    { x: 23, scale: 1.5 },
    { x: 34, scale: 1.4 },
    { x: 44, scale: 1.35 }
  ];

  foregroundTrees.forEach(t => {
    const tMesh = R.createSpriteMesh(textures.tree, PIXEL_SCALE * t.scale);
    // Align base of trunk with ground
    const treeH = textures.tree.height * PIXEL_SCALE * t.scale;
    tMesh.position.set(t.x, GROUND_Y + treeH / 2 - 0.2, -0.2);
    scene.add(tMesh);
  });

  // Ground Tiles (Static requirement)
  const groundTileWidth = textures.grassGround.width * PIXEL_SCALE; // 2.0 units
  const groundTileHeight = textures.grassGround.height * PIXEL_SCALE; // 2.0 units
  const numGroundTiles = Math.ceil((LEVEL_END_X - LEVEL_START_X + 20) / groundTileWidth);

  for (let i = 0; i < numGroundTiles; i++) {
    const gx = LEVEL_START_X - 10 + i * groundTileWidth;
    const gMesh = R.createSpriteMesh(textures.grassGround, PIXEL_SCALE);
    gMesh.position.set(gx + groundTileWidth / 2, GROUND_Y - groundTileHeight / 2, 0.1);
    scene.add(gMesh);

    // Decorative static grass tufts & wildflowers along the surface
    if (i % 2 === 0) {
      const fMesh = R.createSpriteMesh(textures.flowerTuft, PIXEL_SCALE * 1.1);
      const fx = gx + (Math.abs(Math.sin(i * 9)) * (groundTileWidth - 0.6)) + 0.3;
      fMesh.position.set(fx, GROUND_Y + (textures.flowerTuft.height * PIXEL_SCALE * 1.1) / 2 - 0.05, 0.15);
      scene.add(fMesh);
    }
  }

  // ==========================================
  // Particle System (Leaves, Hit Sparks, Spores)
  // ==========================================
  const particles = [];
  const particleGeo = new THREE.PlaneGeometry(0.12, 0.12);

  function spawnParticles(x, y, count, colorHex, spread = 1.0, life = 0.5) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true });
      const pMesh = new THREE.Mesh(particleGeo, mat);
      pMesh.position.set(x + (Math.random() - 0.5) * 0.4, y + (Math.random() - 0.5) * 0.4, 0.5);
      scene.add(pMesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = (0.5 + Math.random() * 1.8) * spread;
      particles.push({
        mesh: pMesh,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 0.8,
        gravity: -5.0,
        life: life * (0.8 + Math.random() * 0.4),
        maxLife: life,
        scale: 0.8 + Math.random() * 0.5
      });
    }
  }

  // Ambient Drifting Forest Leaves
  const ambientLeaves = [];
  for (let i = 0; i < 24; i++) {
    const lMat = new THREE.MeshBasicMaterial({
      color: Math.random() > 0.4 ? '#86d66e' : '#ffd166',
      transparent: true,
      opacity: 0.75
    });
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.09), lMat);
    leaf.position.set(
      LEVEL_START_X + Math.random() * (LEVEL_END_X - LEVEL_START_X),
      GROUND_Y + 1.0 + Math.random() * 7.0,
      0.8
    );
    scene.add(leaf);
    ambientLeaves.push({
      mesh: leaf,
      speedX: -(0.4 + Math.random() * 0.6),
      speedY: -(0.2 + Math.random() * 0.3),
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 2.0 + Math.random() * 2.5
    });
  }

  // ==========================================
  // Boy (Player Character)
  // ==========================================
  const BOY_SCALE = 0.85;       // Straighter, more compact and agile
  const MUSHROOM_SCALE = 0.80;  // Straighter, compact evil mushroom

  const boyMesh = R.createSpriteMesh(textures.boy.idle[0], PIXEL_SCALE * BOY_SCALE);
  boyMesh.position.set(0, GROUND_Y + (textures.boy.idle[0].height * PIXEL_SCALE * BOY_SCALE) / 2, 0.3);
  scene.add(boyMesh);

  const boy = {
    mesh: boyMesh,
    x: 0,
    y: GROUND_Y,
    vx: 0,
    vy: 0,
    facing: 1, // 1: Right, -1: Left
    width: textures.boy.idle[0].width * PIXEL_SCALE * BOY_SCALE,
    height: textures.boy.idle[0].height * PIXEL_SCALE * BOY_SCALE,

    // Multiple States:
    // 'IDLE', 'WALK', 'JUMP', 'FALL', 'ATTACK', 'HIT_RECOIL', 'HIT_STAGGER', 'DEFEATED'
    state: 'IDLE',
    stateTimer: 0,
    animFrame: 0,
    animTimer: 0,

    // Combat & Health
    hp: 3,
    maxHp: 3,
    jumpsRemaining: 2, // Double Jump support
    invulnerableTimer: 0,
    attackHitboxActive: false,
    attackHasHit: false,

    setFrame(texInfo) {
      this.mesh.material.map = texInfo.texture;
      this.mesh.material.needsUpdate = true;
    },

    takeDamage(damage, fromX) {
      if (this.invulnerableTimer > 0 || this.state === 'DEFEATED') return;

      this.hp = Math.max(0, this.hp - damage);
      window.SoundEngine.playBoyHurt();
      updateHUD();

      // Knockback direction away from attacker
      const knockDir = this.x < fromX ? -1 : 1;
      this.facing = -knockDir; // Face attacker in surprise

      if (this.hp <= 0) {
        this.state = 'DEFEATED';
        this.stateTimer = 0;
        this.mesh.rotation.z = 0;
        this.vx = knockDir * 2.0;
        this.vy = 4.0;
        this.setFrame(textures.boy.defeated);
        spawnParticles(this.x, this.y + 0.8, 12, '#ff595e', 1.2, 0.7);
        showGameOverOverlay();
      } else {
        // Multiple Hit States:
        // Transition into HIT_RECOIL (Phase 1)
        this.state = 'HIT_RECOIL';
        this.stateTimer = 0.22; // Recoil duration
        this.invulnerableTimer = 1.2; // Immunity period
        this.mesh.rotation.z = 0;
        this.vx = knockDir * 4.5;
        this.vy = 4.2;
        this.setFrame(textures.boy.hit1Flash);
        spawnParticles(this.x, this.y + 0.8, 8, '#fcd5b5', 1.0, 0.5);
      }
    }
  };

  // ==========================================
  // Evil Mushroom Enemies
  // ==========================================
  const mushrooms = [];

  class EvilMushroom {
    constructor(startX, patrolDist = 5.0) {
      this.startX = startX;
      this.patrolDist = patrolDist;
      this.x = startX;
      this.y = GROUND_Y;
      this.vx = 0;
      this.vy = 0;
      this.facing = Math.random() > 0.5 ? 1 : -1;
      this.speed = 1.3;
      this.aggroSpeed = 2.4;

      this.mesh = R.createSpriteMesh(textures.mushroom.walk[0], PIXEL_SCALE * MUSHROOM_SCALE);
      this.width = textures.mushroom.walk[0].width * PIXEL_SCALE * MUSHROOM_SCALE;
      this.height = textures.mushroom.walk[0].height * PIXEL_SCALE * MUSHROOM_SCALE;
      this.mesh.position.set(this.x, this.y + this.height / 2, 0.25);
      scene.add(this.mesh);

      // Multiple States:
      // 'PATROL', 'AGGRO', 'HIT_SQUASH', 'HIT_DAZED', 'DEFEATED'
      this.state = 'PATROL';
      this.stateTimer = 0;
      this.animFrame = 0;
      this.animTimer = 0;
      this.shudderOffset = 0;

      this.hp = 2; // Takes 2 hits to defeat
      this.dead = false;
      this.fadeTimer = 0;
    }

    setFrame(texInfo) {
      this.mesh.material.map = texInfo.texture;
      this.mesh.material.needsUpdate = true;
    }

    takeHit(damage, fromX) {
      if (this.state === 'HIT_SQUASH' || this.state === 'DEFEATED') return;

      this.hp -= damage;
      window.SoundEngine.playMushroomHit();

      const knockDir = this.x >= fromX ? 1 : -1;
      this.facing = -knockDir;

      // Spore burst VFX
      spawnParticles(this.x, this.y + 0.7, 10, '#9d4edd', 1.4, 0.6);
      spawnParticles(this.x, this.y + 0.7, 6, '#ffd166', 1.1, 0.4);

      if (this.hp <= 0) {
        // Defeated State!
        this.state = 'DEFEATED';
        this.stateTimer = 0.8;
        this.vx = knockDir * 2.8;
        this.vy = 4.5;
        this.setFrame(textures.mushroom.defeated);
        window.SoundEngine.playMushroomDefeated();
        mushroomsDefeatedCount++;
        updateHUD();
      } else {
        // Hit State 1: Squash & Impact Flash!
        this.state = 'HIT_SQUASH';
        this.stateTimer = 0.2; // 0.2s of squash flash
        this.vx = knockDir * 4.0;
        this.vy = 3.8;
        this.setFrame(textures.mushroom.hit1Flash);
      }
    }

    update(dt, player) {
      if (this.dead) return;

      // Gravity
      this.vy -= 22 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Ground collision
      if (this.y <= GROUND_Y) {
        this.y = GROUND_Y;
        this.vy = 0;
        this.vx *= 0.82; // Ground friction
      }

      // State Machine for Mushroom
      switch (this.state) {
        case 'PATROL': {
          const distToPlayer = Math.abs(player.x - this.x);
          // If player comes close and alive, enter AGGRO!
          if (distToPlayer < 5.2 && player.state !== 'DEFEATED') {
            this.state = 'AGGRO';
            this.setFrame(textures.mushroom.aggro);
            break;
          }

          // Patrol back and forth
          this.vx = this.facing * this.speed;
          if (this.x > this.startX + this.patrolDist) {
            this.facing = -1;
          } else if (this.x < this.startX - this.patrolDist) {
            this.facing = 1;
          }

          // Waddle animation
          this.animTimer += dt;
          if (this.animTimer > 0.16) {
            this.animTimer = 0;
            this.animFrame = (this.animFrame + 1) % textures.mushroom.walk.length;
            this.setFrame(textures.mushroom.walk[this.animFrame]);
          }
          break;
        }

        case 'AGGRO': {
          const distToPlayer = Math.abs(player.x - this.x);
          if (distToPlayer > 8.0 || player.state === 'DEFEATED') {
            this.state = 'PATROL';
            break;
          }

          // Charge towards player
          this.facing = player.x > this.x ? 1 : -1;
          this.vx = this.facing * this.aggroSpeed;

          // Aggro hop animation
          this.animTimer += dt;
          if (this.animTimer > 0.12) {
            this.animTimer = 0;
            this.animFrame = (this.animFrame + 1) % textures.mushroom.walk.length;
            // Alternate between walk and angry aggro frame
            if (this.animFrame % 2 === 0) {
              this.setFrame(textures.mushroom.aggro);
            } else {
              this.setFrame(textures.mushroom.walk[this.animFrame]);
            }
          }

          // Small menacing hop when close
          if (distToPlayer < 2.0 && this.y === GROUND_Y && Math.random() < 0.03) {
            this.vy = 4.0;
          }
          break;
        }

        // Multiple Hit States in Action:
        case 'HIT_SQUASH': {
          this.stateTimer -= dt;
          if (this.stateTimer <= 0.1) {
            // Flash off, show squashed face
            this.setFrame(textures.mushroom.hit1);
          }
          if (this.stateTimer <= 0) {
            // Transition into HIT_DAZED (Multiple Hit State #2!)
            this.state = 'HIT_DAZED';
            this.stateTimer = 0.55; // Dazed for over half a second
            this.setFrame(textures.mushroom.hit2);
          }
          break;
        }

        case 'HIT_DAZED': {
          this.stateTimer -= dt;
          // Symmetrical horizontal shudder shake - perfectly straight upright without crooked tilt
          const shudder = Math.sin(this.stateTimer * 45) * 0.04;
          this.shudderOffset = shudder;
          this.mesh.rotation.z = 0;

          if (this.stateTimer <= 0) {
            this.shudderOffset = 0;
            this.mesh.rotation.z = 0;
            this.state = 'PATROL';
          }
          break;
        }

        case 'DEFEATED': {
          this.stateTimer -= dt;
          // Shrink and fade
          const alpha = Math.max(0, this.stateTimer / 0.8);
          this.mesh.material.opacity = alpha;
          this.mesh.scale.set(this.facing * alpha, alpha, 1);

          if (this.stateTimer <= 0) {
            this.dead = true;
            scene.remove(this.mesh);
          }
          break;
        }
      }

      // Update Mesh Transform (Keeps sprite perfectly straight)
      if (this.state !== 'DEFEATED') {
        this.mesh.scale.x = this.facing;
      }
      this.mesh.rotation.z = 0;
      const renderX = this.x + (this.shudderOffset || 0);
      this.mesh.position.set(renderX, this.y + this.height / 2, 0.25);

      // Contact damage with player
      if (!this.dead && this.state !== 'HIT_SQUASH' && this.state !== 'HIT_DAZED' && this.state !== 'DEFEATED') {
        const dx = Math.abs(player.x - this.x);
        const dy = Math.abs((player.y + player.height / 2) - (this.y + this.height / 2));
        if (dx < (player.width + this.width) * 0.38 && dy < (player.height + this.height) * 0.45) {
          player.takeDamage(1, this.x);
        }
      }
    }
  }

  // Populate Forest with Evil Mushrooms
  const mushroomSpawns = [
    { x: 5.5, patrol: 3.5 },
    { x: 16.0, patrol: 4.5 },
    { x: 26.5, patrol: 4.0 },
    { x: 38.0, patrol: 5.0 }
  ];

  mushroomSpawns.forEach(s => {
    mushrooms.push(new EvilMushroom(s.x, s.patrol));
  });

  let mushroomsDefeatedCount = 0;

  // ==========================================
  // Controls & Input System
  // ==========================================
  const keys = {
    left: false,
    right: false,
    jump: false,
    attack: false
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    switch (e.code) {
      case 'KeyA':
      case 'ArrowLeft':
        keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        keys.right = true;
        break;
      case 'KeyW':
      case 'ArrowUp':
      case 'Space':
        keys.jump = true;
        handleJumpPress();
        break;
      case 'KeyJ':
      case 'KeyZ':
      case 'KeyK':
      case 'Enter':
        keys.attack = true;
        handleAttackPress();
        break;
      case 'KeyR':
        restartGame();
        break;
      case 'KeyM':
        toggleMute();
        break;
    }
  });

  window.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'KeyA':
      case 'ArrowLeft':
        keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        keys.right = false;
        break;
      case 'KeyW':
      case 'ArrowUp':
      case 'Space':
        keys.jump = false;
        break;
      case 'KeyJ':
      case 'KeyZ':
      case 'KeyK':
      case 'Enter':
        keys.attack = false;
        break;
    }
  });

  // Mouse / Touch Controls
  window.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('#hud')) return;
    handleAttackPress();
  });

  function handleJumpPress() {
    if (boy.state === 'DEFEATED' || boy.state === 'HIT_RECOIL' || boy.state === 'HIT_STAGGER') return;

    // First jump from ground
    if (boy.y <= GROUND_Y + 0.05) {
      boy.vy = 9.2;
      boy.jumpsRemaining = 1;
      boy.mesh.rotation.z = 0;
      boy.state = 'JUMP';
      boy.setFrame(textures.boy.jump);
      window.SoundEngine.playJump();
      spawnParticles(boy.x, boy.y + 0.1, 5, '#4fb835', 0.6, 0.3); // Grass dust
    }
    // Double jump in mid-air!
    else if (boy.jumpsRemaining > 0) {
      boy.vy = 8.6;
      boy.jumpsRemaining = 0;
      boy.mesh.rotation.z = 0;
      boy.state = 'DOUBLE_JUMP';
      boy.setFrame(textures.boy.jump);
      window.SoundEngine.playDoubleJump();

      // Energetic double-jump particle burst (leaves + air spark)
      spawnParticles(boy.x, boy.y + 0.2, 8, '#86d66e', 1.3, 0.35);
      spawnParticles(boy.x, boy.y + 0.2, 6, '#bae6fd', 0.9, 0.25);
    }
  }

  function handleAttackPress() {
    if (boy.state === 'DEFEATED' || boy.state === 'HIT_RECOIL' || boy.state === 'HIT_STAGGER') return;
    if (boy.state === 'ATTACK') return; // Don't interrupt active slash

    boy.state = 'ATTACK';
    boy.stateTimer = 0;
    boy.animFrame = 0;
    boy.attackHitboxActive = false;
    boy.attackHasHit = false;
    boy.setFrame(textures.boy.attack[0]);
    window.SoundEngine.playSlash();
  }

  // ==========================================
  // Game Loop & Update
  // ==========================================
  let lastTime = performance.now();

  function animate(now) {
    requestAnimationFrame(animate);

    const dt = Math.min((now - lastTime) / 1000, 0.05); // Cap delta to prevent tunneling
    lastTime = now;

    updatePlayer(dt);
    updateMushrooms(dt);
    updateParticles(dt);
    updateCamera(dt);
    updateInspectorUI();

    renderer.render(scene, camera);
  }

  function updatePlayer(dt) {
    // Gravity & Vertical Movement
    boy.vy -= 25.0 * dt;
    boy.y += boy.vy * dt;

    if (boy.y <= GROUND_Y) {
      boy.y = GROUND_Y;
      boy.vy = 0;
      boy.jumpsRemaining = 2; // Reset double jump
      boy.mesh.rotation.z = 0;
      if (boy.state === 'JUMP' || boy.state === 'FALL' || boy.state === 'DOUBLE_JUMP') {
        boy.state = 'IDLE';
        spawnParticles(boy.x, boy.y + 0.1, 4, '#4fb835', 0.5, 0.25);
      }
    }

    // Invulnerability Blink
    if (boy.invulnerableTimer > 0) {
      boy.invulnerableTimer -= dt;
      boy.mesh.material.opacity = Math.sin(boy.invulnerableTimer * 35) > 0 ? 0.3 : 1.0;
    } else {
      boy.mesh.material.opacity = 1.0;
    }

    // Player State Machine
    switch (boy.state) {
      case 'IDLE': {
        // Horizontal deceleration
        boy.vx *= 0.75;
        boy.x += boy.vx * dt;

        if (keys.left || keys.right) {
          boy.state = 'WALK';
          break;
        }

        // Idle gentle breathing animation
        boy.animTimer += dt;
        if (boy.animTimer > 0.45) {
          boy.animTimer = 0;
          boy.animFrame = (boy.animFrame + 1) % textures.boy.idle.length;
          boy.setFrame(textures.boy.idle[boy.animFrame]);
        }
        break;
      }

      case 'WALK': {
        const moveDir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        if (moveDir === 0) {
          boy.state = 'IDLE';
          boy.setFrame(textures.boy.idle[0]);
          break;
        }

        boy.facing = moveDir;
        boy.vx = moveDir * 5.2;
        boy.x += boy.vx * dt;

        // Walk cycle animation
        boy.animTimer += dt;
        if (boy.animTimer > 0.12) {
          boy.animTimer = 0;
          boy.animFrame = (boy.animFrame + 1) % textures.boy.walk.length;
          boy.setFrame(textures.boy.walk[boy.animFrame]);
        }
        break;
      }

      case 'DOUBLE_JUMP':
      case 'JUMP':
      case 'FALL': {
        // Air control
        const airDir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        if (airDir !== 0) {
          boy.facing = airDir;
          boy.vx = airDir * 4.6;
        } else {
          boy.vx *= 0.94;
        }
        boy.x += boy.vx * dt;

        // Acrobatic somersault spin while executing the double jump!
        if (boy.state === 'DOUBLE_JUMP') {
          boy.mesh.rotation.z -= boy.facing * 18.0 * dt;
        }

        // Switch to fall frame when velocity is negative
        if (boy.vy < 0) {
          if (boy.state === 'DOUBLE_JUMP' || boy.state === 'JUMP') {
            boy.mesh.rotation.z = 0;
            boy.state = 'FALL';
            boy.setFrame(textures.boy.fall);
          }
        }
        break;
      }

      case 'ATTACK': {
        // Small forward lunge on swing
        boy.x += boy.facing * 1.5 * dt;

        boy.stateTimer += dt;
        if (boy.stateTimer < 0.08) {
          // Windup frame
          boy.setFrame(textures.boy.attack[0]);
          boy.attackHitboxActive = false;
        } else if (boy.stateTimer < 0.22) {
          // ACTIVE SLASH FRAME with trail!
          boy.setFrame(textures.boy.attack[1]);
          boy.attackHitboxActive = true;

          // Perform melee attack check against all evil mushrooms
          if (!boy.attackHasHit) {
            checkMeleeSlashCollisions();
          }
        } else if (boy.stateTimer < 0.32) {
          // Follow through frame
          boy.setFrame(textures.boy.attack[2]);
          boy.attackHitboxActive = false;
        } else {
          // Finished attack
          boy.attackHitboxActive = false;
          boy.state = (boy.y > GROUND_Y) ? 'FALL' : (keys.left || keys.right ? 'WALK' : 'IDLE');
        }
        break;
      }

      // Multiple Hit States for Boy:
      case 'HIT_RECOIL': {
        boy.x += boy.vx * dt;
        boy.stateTimer -= dt;

        // Flash between white hit frame and hurt frame
        if (Math.floor(boy.stateTimer * 20) % 2 === 0) {
          boy.setFrame(textures.boy.hit1Flash);
        } else {
          boy.setFrame(textures.boy.hit1);
        }

        if (boy.stateTimer <= 0) {
          // Transition into HIT_STAGGER (Multiple Hit State #2!)
          boy.state = 'HIT_STAGGER';
          boy.stateTimer = 0.28;
          boy.setFrame(textures.boy.hit2);
        }
        break;
      }

      case 'HIT_STAGGER': {
        boy.vx *= 0.85;
        boy.x += boy.vx * dt;
        boy.stateTimer -= dt;

        if (boy.stateTimer <= 0) {
          boy.state = (boy.y > GROUND_Y) ? 'FALL' : 'IDLE';
        }
        break;
      }

      case 'DEFEATED': {
        boy.vx *= 0.88;
        boy.x += boy.vx * dt;
        break;
      }
    }

    // Clamp Level Boundaries
    boy.x = Math.max(LEVEL_START_X, Math.min(LEVEL_END_X, boy.x));

    // Update Mesh
    boy.mesh.scale.x = boy.facing;
    boy.mesh.position.set(boy.x, boy.y + boy.height / 2, 0.3);
  }

  function checkMeleeSlashCollisions() {
    // Attack hitbox positioned in front of the boy (tuned for smaller straight sprites)
    const attackRangeX = 1.35;
    const attackRangeY = 1.15;
    const slashCenterX = boy.x + boy.facing * 0.75;
    const slashCenterY = boy.y + boy.height * 0.55;

    mushrooms.forEach(m => {
      if (m.dead || m.state === 'DEFEATED') return;
      const dx = Math.abs(slashCenterX - m.x);
      const dy = Math.abs(slashCenterY - (m.y + m.height / 2));

      if (dx < attackRangeX && dy < attackRangeY) {
        m.takeHit(1, boy.x);
        boy.attackHasHit = true;
        // Hit spark slash particles
        spawnParticles(m.x, m.y + 0.6, 8, '#ffeaa7', 1.3, 0.35);
      }
    });
  }

  function updateMushrooms(dt) {
    mushrooms.forEach(m => m.update(dt, boy));
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        scene.remove(p.mesh);
        particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.scale.setScalar((p.life / p.maxLife) * p.scale);
    }

    // Ambient floating forest leaves
    ambientLeaves.forEach(l => {
      l.wobble += l.wobbleSpeed * dt;
      l.mesh.position.x += l.speedX * dt;
      l.mesh.position.y += l.speedY * dt + Math.sin(l.wobble) * 0.008;
      l.mesh.rotation.z = Math.sin(l.wobble) * 0.4;

      // Wrap around forest boundaries
      if (l.mesh.position.x < LEVEL_START_X - 5) {
        l.mesh.position.x = LEVEL_END_X + 5;
        l.mesh.position.y = GROUND_Y + 1.0 + Math.random() * 7.0;
      }
      if (l.mesh.position.y < GROUND_Y) {
        l.mesh.position.y = GROUND_Y + 7.0;
      }
    });
  }

  function updateCamera(dt) {
    // Smooth camera follow with forward lookahead
    const targetX = boy.x + boy.facing * 1.3;
    const targetY = Math.max(2.6, boy.y + 2.0);

    camera.position.x += (targetX - camera.position.x) * 4.5 * dt;
    camera.position.y += (targetY - camera.position.y) * 4.0 * dt;

    // Clamp camera within level bounds
    const minCamX = LEVEL_START_X + viewWidthUnits / 2 - 2;
    const maxCamX = LEVEL_END_X - viewWidthUnits / 2 + 2;
    camera.position.x = Math.max(minCamX, Math.min(maxCamX, camera.position.x));

    // Parallax update
    skyMesh.position.x = camera.position.x * 0.85;
    distantTrees.forEach(t => {
      // Parallax offset
      t.position.x = t.userData.baseX ? t.userData.baseX + (camera.position.x * 0.15) : t.position.x;
    });
  }

  // ==========================================
  // HUD & State Inspector UI
  // ==========================================
  const hudHearts = document.getElementById('hud-hearts');
  const hudScore = document.getElementById('hud-score');
  const inspectorBoy = document.getElementById('inspector-boy-state');
  const inspectorMushroom = document.getElementById('inspector-mushroom-state');

  function updateHUD() {
    let heartsHtml = '';
    for (let i = 0; i < boy.maxHp; i++) {
      if (i < boy.hp) {
        heartsHtml += '<span class="pixel-heart full">&hearts;</span>';
      } else {
        heartsHtml += '<span class="pixel-heart empty">&#9825;</span>';
      }
    }
    hudHearts.innerHTML = heartsHtml;
    hudScore.innerText = `MUSHROOMS DEFEATED: ${mushroomsDefeatedCount} / ${mushroomSpawns.length}`;

    if (mushroomsDefeatedCount >= mushroomSpawns.length) {
      showVictoryOverlay();
    }
  }

  function updateInspectorUI() {
    // Current Boy state display
    inspectorBoy.innerText = boy.state;
    inspectorBoy.className = `state-badge state-${boy.state.toLowerCase()}`;

    // Find closest mushroom to show its active state
    let closest = null;
    let minDist = Infinity;
    mushrooms.forEach(m => {
      const d = Math.abs(m.x - boy.x);
      if (d < minDist) {
        minDist = d;
        closest = m;
      }
    });

    if (closest) {
      inspectorMushroom.innerText = `${closest.state} (HP: ${Math.max(0, closest.hp)})`;
      inspectorMushroom.className = `state-badge state-${closest.state.toLowerCase()}`;
    } else {
      inspectorMushroom.innerText = 'NONE';
      inspectorMushroom.className = 'state-badge';
    }
  }

  function showGameOverOverlay() {
    const overlay = document.getElementById('game-overlay');
    overlay.innerHTML = `
      <div class="overlay-card game-over">
        <h1 class="pixel-title text-red">DEFEATED!</h1>
        <p class="pixel-subtitle">The evil forest mushrooms overwhelmed the boy...</p>
        <button id="btn-restart" class="pixel-btn">PRESS [ R ] TO TRY AGAIN</button>
      </div>
    `;
    overlay.style.display = 'flex';
    document.getElementById('btn-restart').onclick = restartGame;
  }

  function showVictoryOverlay() {
    const overlay = document.getElementById('game-overlay');
    overlay.innerHTML = `
      <div class="overlay-card victory">
        <h1 class="pixel-title text-green">FOREST CLEARED!</h1>
        <p class="pixel-subtitle">All evil mushrooms have been vanquished! The ancient forest is safe!</p>
        <button id="btn-restart" class="pixel-btn">PRESS [ R ] TO PLAY AGAIN</button>
      </div>
    `;
    overlay.style.display = 'flex';
    document.getElementById('btn-restart').onclick = restartGame;
  }

  function restartGame() {
    document.getElementById('game-overlay').style.display = 'none';

    // Reset boy
    boy.hp = boy.maxHp;
    boy.jumpsRemaining = 2;
    boy.x = 0;
    boy.y = GROUND_Y;
    boy.vx = 0;
    boy.vy = 0;
    boy.facing = 1;
    boy.mesh.rotation.z = 0;
    boy.state = 'IDLE';
    boy.invulnerableTimer = 0;
    boy.setFrame(textures.boy.idle[0]);

    // Clear and respawn mushrooms
    mushrooms.forEach(m => {
      scene.remove(m.mesh);
    });
    mushrooms.length = 0;
    mushroomSpawns.forEach(s => {
      mushrooms.push(new EvilMushroom(s.x, s.patrol));
    });

    mushroomsDefeatedCount = 0;
    updateHUD();
  }

  function toggleMute() {
    window.SoundEngine.muted = !window.SoundEngine.muted;
    const btn = document.getElementById('btn-sound');
    if (btn) btn.innerText = window.SoundEngine.muted ? '🔇 SOUND: OFF' : '🔊 SOUND: ON';
  }

  // Handle Window Resize with Crisp Aspect Preservation
  window.addEventListener('resize', () => {
    const newAspect = window.innerWidth / window.innerHeight;
    const newHeightUnits = (VIEW_WIDTH_PIXELS / newAspect) * PIXEL_SCALE;
    const newWidthUnits = VIEW_WIDTH_PIXELS * PIXEL_SCALE;

    camera.left = -newWidthUnits / 2;
    camera.right = newWidthUnits / 2;
    camera.top = newHeightUnits / 2;
    camera.bottom = -newHeightUnits / 2;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Export functions to window for UI buttons
  window.ForestGame = {
    restartGame,
    toggleMute,
    toggleMusic: () => {
      const playing = window.SoundEngine.toggleMusic();
      const btn = document.getElementById('btn-music');
      if (btn) btn.innerText = playing ? '🎵 MUSIC: ON' : '🎵 MUSIC: OFF';
    }
  };

  // Initial HUD update & launch loop
  updateHUD();
  requestAnimationFrame(animate);
})();
