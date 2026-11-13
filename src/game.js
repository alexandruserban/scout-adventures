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

  // Wrap a pre-drawn canvas as a crisp pixel texture
  function texFromCanvas(canvas) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return { texture: tex, canvas, width: canvas.width, height: canvas.height };
  }

  // Small pixel-art disc / ring textures for explosion flashes and shockwaves
  function makeRoundTexture(ring) {
    const size = 24;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2);
        if (ring ? d > 9.5 && d < 11.5 : d < 11.5) ctx.fillRect(x, y, 1, 1);
      }
    }
    return texFromCanvas(c).texture;
  }

  const BA = window.BoyAnimation;

const textures = {
    boy: {
      idle: BA.IDLE.map(texFromCanvas),
      walk: BA.WALK.map(texFromCanvas),
      crouch: texFromCanvas(BA.JUMP_CROUCH),
      rise: texFromCanvas(BA.JUMP_RISE),
      apex: texFromCanvas(BA.JUMP_APEX),
      fall: texFromCanvas(BA.FALL),
      spin: texFromCanvas(BA.JUMP_SPIN),
      attack: BA.ATTACK.map(f => Object.assign(texFromCanvas(f.canvas), { meta: f })),
      hit1: texFromCanvas(BA.HIT_1),
      hit1Flash: texFromCanvas(BA.HIT_1_FLASH),
      hit2: texFromCanvas(BA.HIT_2),
      defeated: texFromCanvas(BA.DEFEATED)
    },
    mushroom: {
      walk: S.MUSHROOM.WALK.map((rows, i) => R.createTexture(rows, P, `m_walk_${i}`)),
      aggro: R.createTexture(S.MUSHROOM.AGGRO, P, 'm_aggro'),
      hit1: R.createTexture(S.MUSHROOM.HIT_1, P, 'm_hit1'),
      hit1Flash: R.createTexture(R.createHitFlashRows(S.MUSHROOM.HIT_1, 'X'), P, 'm_hit1_f'),
      hit2: R.createTexture(S.MUSHROOM.HIT_2, P, 'm_hit2')
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

  // Layered parallax background (sky, sun, clouds, mountains, pines, mist, forest, rays, fireflies)
  const background = window.ForestBackground.create(scene, {
    pixelScale: PIXEL_SCALE,
    viewWidthUnits,
    cameraBaseY: camera.position.y
  });
  scene.background = new THREE.Color(background.topColor);

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

  // Deep soil below the ground tiles so tall screens never show sky under the floor
  {
    const soilCanvas = document.createElement('canvas');
    soilCanvas.width = soilCanvas.height = 1;
    const sc = soilCanvas.getContext('2d');
    sc.fillStyle = '#290f02';
    sc.fillRect(0, 0, 1, 1);
    const soilW = LEVEL_END_X - LEVEL_START_X + 40;
    const soil = new THREE.Mesh(
      new THREE.PlaneGeometry(soilW, 30),
      new THREE.MeshBasicMaterial({ map: texFromCanvas(soilCanvas).texture })
    );
    soil.position.set((LEVEL_START_X + LEVEL_END_X) / 2, GROUND_Y - groundTileHeight - 15 + PIXEL_SCALE, 0.05);
    scene.add(soil);
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

  // ==========================================
  // Impact Feel: Hit-Stop, Screen Shake, Explosions
  // ==========================================
  let hitStop = 0;      // seconds of frozen gameplay after a heavy hit
  let shakeTime = 0;
  let shakeMag = 0;

  function shakeCamera(mag, time) {
    shakeMag = Math.max(shakeMag, mag);
    shakeTime = Math.max(shakeTime, time);
  }

  const discTex = makeRoundTexture(false);
  const ringTex = makeRoundTexture(true);
  const effects = []; // expanding flashes, shockwaves, smoke puffs
  const debris = [];  // physical pixel chunks

  function spawnEffect(tex, color, x, y, fromScale, toScale, life, opts = {}) {
    const mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, alphaTest: 0.05, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.position.set(x, y, opts.z || 0.6);
    mesh.scale.setScalar(fromScale);
    scene.add(mesh);
    effects.push({ mesh, life, maxLife: life, fromScale, toScale, vy: opts.vy || 0, startOpacity: opts.opacity || 1 });
  }

  const debrisGeo = new THREE.PlaneGeometry(1, 1);

  // Break the mushroom sprite into its own pixels and blow them outward
  function explodeMushroom(m) {
    const rows = S.MUSHROOM.HIT_1;
    const ps = PIXEL_SCALE * MUSHROOM_SCALE;
    const w = rows[0].length, h = rows.length;
    const cx = m.x, cy = m.y + m.height / 2;
    const CHUNK = 2;

    for (let y = 0; y < h; y += CHUNK) {
      for (let x = 0; x < w; x += CHUNK) {
        let color = null;
        for (let yy = y; yy < y + CHUNK && !color; yy++) {
          for (let xx = x; xx < x + CHUNK && !color; xx++) {
            const c = P[(rows[yy] || '')[xx]];
            if (c && c !== 'transparent') color = c;
          }
        }
        if (!color) continue;

        const wx = cx + (x + CHUNK / 2 - w / 2) * ps;
        const wy = cy + (h / 2 - y - CHUNK / 2) * ps;
        const dx = wx - cx, dy = wy - cy;
        const len = Math.hypot(dx, dy) || 1;
        const power = 3.5 + Math.random() * 4.5;
        const size = ps * CHUNK * (0.8 + Math.random() * 0.5);

        const mesh = new THREE.Mesh(debrisGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
        mesh.scale.set(size, size, 1);
        mesh.position.set(wx, wy, 0.55);
        scene.add(mesh);
        debris.push({
          mesh, size,
          vx: (dx / len) * power + (Math.random() - 0.5) * 1.5,
          vy: (dy / len) * power * 0.6 + 3.5 + Math.random() * 3.5,
          spin: (Math.random() - 0.5) * 20,
          life: 1.1 + Math.random() * 0.9
        });
      }
    }

    // Bright flash, double shockwave, lingering poison smoke
    spawnEffect(discTex, '#fff4c2', cx, cy, 0.6, 2.4, 0.12, { z: 0.62 });
    spawnEffect(ringTex, '#ffd166', cx, cy, 0.4, 3.6, 0.32, { z: 0.61 });
    spawnEffect(ringTex, '#9d4edd', cx, cy, 0.3, 2.6, 0.5, { z: 0.6 });
    for (let i = 0; i < 6; i++) {
      spawnEffect(discTex, i % 2 ? '#4a2d55' : '#6b4a72',
        cx + (Math.random() - 0.5) * 1.2, cy + (Math.random() - 0.3) * 0.8,
        0.3, 1.0 + Math.random() * 0.6, 0.7 + Math.random() * 0.4,
        { z: 0.4, vy: 0.6 + Math.random() * 0.6, opacity: 0.55 });
    }
    spawnParticles(cx, cy, 16, '#9d4edd', 2.2, 0.8);
    spawnParticles(cx, cy, 10, '#ffd166', 1.8, 0.6);

    window.SoundEngine.playExplosion();
    window.SoundEngine.playMushroomDefeated();
    shakeCamera(0.16, 0.3);
  }

  function updateEffects(dt) {
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.life -= dt;
      if (e.life <= 0) {
        scene.remove(e.mesh);
        e.mesh.material.dispose();
        e.mesh.geometry.dispose();
        effects.splice(i, 1);
        continue;
      }
      const t = 1 - e.life / e.maxLife; // 0 -> 1
      const eased = 1 - Math.pow(1 - t, 3);
      e.mesh.scale.setScalar(e.fromScale + (e.toScale - e.fromScale) * eased);
      e.mesh.position.y += e.vy * dt;
      e.mesh.material.opacity = e.startOpacity * (1 - t);
    }

    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.life -= dt;
      if (d.life <= 0) {
        scene.remove(d.mesh);
        d.mesh.material.dispose();
        debris.splice(i, 1);
        continue;
      }
      d.vy -= 20 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.rotation.z += d.spin * dt;

      // Bounce and skid on the grass
      const floor = GROUND_Y + d.size / 2;
      if (d.mesh.position.y < floor) {
        d.mesh.position.y = floor;
        d.vy = Math.abs(d.vy) > 1 ? -d.vy * 0.35 : 0;
        d.vx *= 0.6;
        d.spin *= 0.5;
      }
      if (d.life < 0.4) d.mesh.material.opacity = d.life / 0.4;
    }
  }

  function clearEffects() {
    effects.forEach(e => scene.remove(e.mesh));
    debris.forEach(d => scene.remove(d.mesh));
    effects.length = 0;
    debris.length = 0;
    hitStop = 0;
    shakeTime = 0;
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

  // Separate, larger sprite for the overhead slam (sword reaches well outside the 24x24 box)
  const BOY_PX = PIXEL_SCALE * BOY_SCALE;
  const boyAttackMesh = R.createSpriteMesh(textures.boy.attack[0], BOY_PX);
  boyAttackMesh.visible = false;
  scene.add(boyAttackMesh);
  // Offset from the 24x24 body centre to the attack canvas centre (world units, facing right)
  const ATTACK_OFFSET = {
    x: (BA.ATTACK_SIZE.w / 2 - (BA.ATTACK_ORIGIN.x + 12)) * BOY_PX,
    y: -(BA.ATTACK_SIZE.h / 2 - (BA.ATTACK_ORIGIN.y + 12)) * BOY_PX
  };

  const boy = {
    mesh: boyMesh,
    attackMesh: boyAttackMesh,
    sx: 1, // squash & stretch
    sy: 1,
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
    jumpBuffer: 0,     // jump pressed just before landing still counts
    invulnerableTimer: 0,
    attackHitboxActive: false,
    attackHasHit: false,

    setFrame(texInfo) {
      this.mesh.material.map = texInfo.texture;
      this.mesh.material.needsUpdate = true;
    },

    setAttackFrame(i) {
      this.attackMesh.material.map = textures.boy.attack[i].texture;
      this.attackMesh.material.needsUpdate = true;
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
        // Defeated: flash white for a moment, then burst apart (see DEFEATED in update)
        this.state = 'DEFEATED';
        this.stateTimer = 0.08;
        this.vx = 0;
        this.vy = 0;
        this.setFrame(textures.mushroom.hit1Flash);
        hitStop = Math.max(hitStop, 0.11);
        shakeCamera(0.12, 0.25);
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
          // Swell slightly while flashing, then explode
          const swell = 1 + (0.08 - Math.max(0, this.stateTimer)) * 3;
          this.mesh.scale.set(this.facing * swell, swell, 1);

          if (this.stateTimer <= 0) {
            this.dead = true;
            scene.remove(this.mesh);
            explodeMushroom(this);
            return;
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
      case 'KeyB':
        window.ForestGame.toggleMusic();
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
        // Variable jump height: letting go early cuts the climb short
        if ((boy.state === 'JUMP' || boy.state === 'DOUBLE_JUMP') && boy.vy > JUMP_CUT_VY) {
          boy.vy = JUMP_CUT_VY;
        }
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

  const JUMP_VY = 9.2;
  const DOUBLE_JUMP_VY = 8.6;
  const JUMP_CUT_VY = 3.5;          // upward speed kept when the button is released early
  const GRAVITY = 25.0;
  const SPIN_TIME = DOUBLE_JUMP_VY / GRAVITY; // one full somersault, finishing at the apex
  const LAND_TIME = 0.09;

  function handleJumpPress() {
    if (boy.state === 'DEFEATED' || boy.state === 'HIT_RECOIL' || boy.state === 'HIT_STAGGER') return;

    // First jump from ground
    if (boy.y <= GROUND_Y + 0.05) {
      boy.vy = JUMP_VY;
      boy.jumpsRemaining = 1;
      boy.jumpBuffer = 0;
      boy.mesh.rotation.z = 0;
      boy.state = 'JUMP';
      boy.setFrame(textures.boy.rise);
      boy.sx = 0.82; // stretch on take-off
      boy.sy = 1.2;
      window.SoundEngine.playJump();
      spawnParticles(boy.x, boy.y + 0.1, 5, '#4fb835', 0.6, 0.3); // Grass dust
    }
    // Double jump in mid-air!
    else if (boy.jumpsRemaining > 0) {
      boy.vy = DOUBLE_JUMP_VY;
      boy.jumpsRemaining = 0;
      boy.mesh.rotation.z = 0;
      boy.state = 'DOUBLE_JUMP';
      boy.stateTimer = 0;
      boy.setFrame(textures.boy.spin);
      boy.sx = 0.86;
      boy.sy = 1.14;
      window.SoundEngine.playDoubleJump();

      // Energetic double-jump particle burst (leaves + air spark)
      spawnParticles(boy.x, boy.y + 0.2, 8, '#86d66e', 1.3, 0.35);
      spawnParticles(boy.x, boy.y + 0.2, 6, '#bae6fd', 0.9, 0.25);
    }
    // Out of jumps: remember the press briefly so it fires on landing
    else {
      boy.jumpBuffer = 0.12;
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
    boy.mesh.rotation.z = 0;
    boy.setAttackFrame(0);
    // The swoosh plays on the downswing frame, not on the button press
  }

  // ==========================================
  // Game Loop & Update
  // ==========================================
  let lastTime = performance.now();

  function animate(now) {
    requestAnimationFrame(animate);

    const rawDt = Math.min((now - lastTime) / 1000, 0.05); // Cap delta to prevent tunneling
    lastTime = now;

    // Hit-stop: freeze gameplay for a few frames on heavy impacts (camera keeps shaking)
    let dt = rawDt;
    if (hitStop > 0) {
      hitStop -= rawDt;
      dt = 0;
    }

    updatePlayer(dt);
    updateMushrooms(dt);
    updateParticles(dt);
    updateEffects(dt);
    updateCamera(rawDt);
    updateInspectorUI();

    renderer.render(scene, camera);
  }

  function updatePlayer(dt) {
    // Gravity & Vertical Movement
    boy.vy -= GRAVITY * dt;
    boy.y += boy.vy * dt;
    if (boy.jumpBuffer > 0) boy.jumpBuffer -= dt;

    if (boy.y <= GROUND_Y) {
      const impactSpeed = -boy.vy;
      boy.y = GROUND_Y;
      boy.vy = 0;
      boy.jumpsRemaining = 2; // Reset double jump
      boy.mesh.rotation.z = 0;
      if (boy.state === 'JUMP' || boy.state === 'FALL' || boy.state === 'DOUBLE_JUMP') {
        // Brief landing crouch; harder landings squash more
        boy.state = 'LAND';
        boy.stateTimer = LAND_TIME;
        boy.setFrame(textures.boy.crouch);
        const k = Math.min(1, impactSpeed / 12);
        boy.sx = 1 + 0.25 * k;
        boy.sy = 1 - 0.22 * k;
        spawnParticles(boy.x, boy.y + 0.1, 3 + Math.round(5 * k), '#4fb835', 0.5 + 0.6 * k, 0.25);
        if (boy.jumpBuffer > 0) handleJumpPress(); // buffered jump fires right away
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

        // 8-frame walk cycle (~0.64 s per full stride)
        boy.animTimer += dt;
        if (boy.animTimer > 0.08) {
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

        if (boy.state === 'DOUBLE_JUMP') {
          // Exactly one forward somersault in a tucked ball, landing upright at the apex
          boy.stateTimer += dt;
          const t = Math.min(1, boy.stateTimer / SPIN_TIME);
          const eased = 1 - Math.pow(1 - t, 2); // fast start, settles at the end
          boy.mesh.rotation.z = -boy.facing * eased * Math.PI * 2;
          if (t >= 1) {
            boy.mesh.rotation.z = 0;
            boy.state = 'FALL';
          }
          break;
        }

        // Pick the pose from vertical speed: rise -> apex tuck -> fall
        if (boy.vy > 3) {
          boy.setFrame(textures.boy.rise);
        } else if (boy.vy > -3) {
          boy.setFrame(textures.boy.apex);
        } else {
          boy.setFrame(textures.boy.fall);
        }
        if (boy.vy < 0 && boy.state === 'JUMP') boy.state = 'FALL';
        break;
      }

      case 'LAND': {
        boy.vx *= 0.7;
        boy.x += boy.vx * dt;
        boy.stateTimer -= dt;
        if (boy.stateTimer <= 0) {
          boy.state = (keys.left || keys.right) ? 'WALK' : 'IDLE';
          boy.setFrame(textures.boy.idle[0]);
        }
        break;
      }

      case 'ATTACK': {
        // Feet do NOT move during attack: Braced solid stance because the sword is heavy
        boy.vx = 0;

        // Overhead slam: lift -> raise -> wind-up hold -> fast downswing -> IMPACT -> recover
        boy.stateTimer += dt;
        const frames = textures.boy.attack;
        let t = boy.stateTimer;
        let idx = 0;
        while (idx < frames.length && t >= frames[idx].meta.dur) {
          t -= frames[idx].meta.dur;
          idx++;
        }

        // Fire events for every frame we entered this tick (short frames can be skipped)
        for (let f = boy.animFrame + 1; f <= Math.min(idx, frames.length - 1); f++) {
          const meta = frames[f].meta;
          if (meta.swing) window.SoundEngine.playSlash();
          if (meta.hit) onSlamImpact(meta);
        }

        if (idx >= frames.length) {
          // Attack finished, return to normal
          boy.attackHitboxActive = false;
          boy.attackHasHit = false;
          boy.state = (boy.y > GROUND_Y) ? 'FALL' : (keys.left || keys.right ? 'WALK' : 'IDLE');
          boy.setFrame(textures.boy.idle[0]);
          break;
        }

        if (idx !== boy.animFrame) {
          boy.animFrame = idx;
          boy.setAttackFrame(idx);
        }
        boy.attackHitboxActive = frames[idx].meta.hit;
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

    // Squash & stretch eases back to normal
    const ease = Math.min(1, 12 * dt);
    boy.sx += (1 - boy.sx) * ease;
    boy.sy += (1 - boy.sy) * ease;

    // Update Mesh (scale around the feet so squash never lifts him off the ground)
    const attacking = boy.state === 'ATTACK';
    boy.mesh.visible = !attacking;
    boy.attackMesh.visible = attacking;
    boy.mesh.scale.set(boy.facing * boy.sx, boy.sy, 1);
    boy.mesh.position.set(boy.x, boy.y + (boy.height * boy.sy) / 2, 0.3);
    boy.attackMesh.scale.set(boy.facing, 1, 1);
    boy.attackMesh.position.set(
      boy.x + ATTACK_OFFSET.x * boy.facing,
      boy.y + boy.height / 2 + ATTACK_OFFSET.y,
      0.3
    );
    boy.attackMesh.material.opacity = boy.mesh.material.opacity;
  }

  // The blade hits the ground: dust, shake, thud, then damage
  function onSlamImpact(meta) {
    const tipX = boy.x + boy.facing * (meta.tip.x - 12) * BOY_PX;
    const tipY = Math.max(GROUND_Y + 0.05, boy.y + (24 - meta.tip.y) * BOY_PX);

    window.SoundEngine.playSlamImpact();
    shakeCamera(0.07, 0.14);
    spawnParticles(tipX, tipY, 10, '#8d6849', 1.3, 0.45); // dirt
    spawnParticles(tipX, tipY, 6, '#4fb835', 1.0, 0.35);  // grass
    spawnEffect(ringTex, '#ffeaa7', tipX, tipY + 0.1, 0.2, 1.4, 0.2, { z: 0.6 });

    checkMeleeSlashCollisions();
  }

  function checkMeleeSlashCollisions() {
    // The overhead arc covers the space in front of the boy, from head height down to the grass
    const attackRangeX = 1.5;
    const attackRangeY = 1.4;
    const slashCenterX = boy.x + boy.facing * 1.15;
    const slashCenterY = boy.y + boy.height * 0.6;

    mushrooms.forEach(m => {
      if (m.dead || m.state === 'DEFEATED') return;
      const dx = Math.abs(slashCenterX - m.x);
      const dy = Math.abs(slashCenterY - (m.y + m.height / 2));

      if (dx < attackRangeX && dy < attackRangeY) {
        m.takeHit(1, boy.x);
        boy.attackHasHit = true;
        hitStop = Math.max(hitStop, 0.06);
        // Metallic hit spark & slash particles
        spawnParticles(m.x, m.y + 0.6, 9, '#ffeaa7', 1.4, 0.38);
        spawnParticles(m.x, m.y + 0.6, 5, '#ffffff', 1.0, 0.25);
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

  const camBase = { x: camera.position.x, y: camera.position.y };

  function updateCamera(dt) {
    // Smooth camera follow with forward lookahead
    const targetX = boy.x + boy.facing * 1.3;
    const targetY = Math.max(2.6, boy.y + 2.0);

    camBase.x += (targetX - camBase.x) * 4.5 * dt;
    camBase.y += (targetY - camBase.y) * 4.0 * dt;

    // Clamp camera within level bounds
    const minCamX = LEVEL_START_X + viewWidthUnits / 2 - 2;
    const maxCamX = LEVEL_END_X - viewWidthUnits / 2 + 2;
    camBase.x = Math.max(minCamX, Math.min(maxCamX, camBase.x));

    // Screen shake, snapped to the pixel grid so sprites stay crisp
    let ox = 0, oy = 0;
    if (shakeTime > 0) {
      shakeTime -= dt;
      const m = shakeMag * Math.max(0, Math.min(1, shakeTime / 0.15));
      ox = Math.round(((Math.random() * 2 - 1) * m) / PIXEL_SCALE) * PIXEL_SCALE;
      oy = Math.round(((Math.random() * 2 - 1) * m) / PIXEL_SCALE) * PIXEL_SCALE;
      if (shakeTime <= 0) shakeMag = 0;
    }
    camera.position.x = camBase.x + ox;
    camera.position.y = camBase.y + oy;

    // Parallax update
    background.update(camera.position.x, camera.position.y, dt);
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
    boy.sx = 1;
    boy.sy = 1;
    boy.setFrame(textures.boy.idle[0]);
    clearEffects();

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
    window.SoundEngine.setMuted(!window.SoundEngine.muted);
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
