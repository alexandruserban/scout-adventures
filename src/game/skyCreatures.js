/**
 * Creatures that rain down from the sky once the mushrooms are gone, in five tiers:
 *   1. Nutling       - an acorn that cracks open and hops at the boy
 *   2. Thornback     - an armoured beetle that growls, then charges across the grass
 *   3. Gloomwing     - a spore moth that circles overhead and dive-bombs
 *   4. Thunder Jelly - leaps at the boy; every landing sends lightning along the grass; splits in two
 *   5. Cinder Golem  - crashes down like a meteor, stomps, hurls fireballs, and enrages at half health
 *
 * Every creature falls from high above. A reddish shadow on the grass grows as it gets closer,
 * so the player can see where it will land.
 */
(function (Forest) {
  const { PIXEL_SCALE, GROUND_Y, LEVEL_START_X, LEVEL_END_X } = Forest.Config;
  const { createSpriteMesh, setMeshSprite, removeMesh, createPixelTexture } = Forest.Graphics;
  const { clamp, randomBetween, randomDirection, isBodyTouching } = Forest.MathUtils;
  const { createPixelCanvas } = Forest.PixelCanvas;
  const Sfx = Forest.SoundEffects;

  const CreatureState = Object.freeze({
    FALLING: 'FALLING',
    HOP: 'HOP',
    WALK: 'WALK',
    TELEGRAPH: 'TELEGRAPH',
    CHARGE: 'CHARGE',
    HOVER: 'HOVER',
    SWOOP: 'SWOOP',
    IDLE: 'IDLE',
    JUMP: 'JUMP',
    THROW: 'THROW',
    HURT: 'HURT',
    DEFEATED: 'DEFEATED'
  });

  // --- Falling from the sky ---
  const SPAWN_HEIGHT = 13;
  const FALL_START_SPEED = -1.5;
  /** Lighter than normal gravity, so the player has time to read the shadow. */
  const FALL_GRAVITY = 14;

  // --- Physics ---
  const GRAVITY = 22;
  const GROUND_FRICTION = 0.82;
  /** Flying creatures lose this fraction of their knockback speed per second. */
  const AIR_DAMPING_PER_SECOND = 0.985;
  const LEVEL_MARGIN = 0.6;

  // --- Drawing ---
  const MESH_Z = 0.26;
  const SHADOW_Z = 0.2;
  const HP_BAR_Z = 0.27;
  const SQUASH_RECOVERY_RATE = 10;

  // --- Getting hit ---
  const HURT_SECONDS = 0.28;
  const HIT_FLASH_SECONDS = 0.1;
  const KNOCKBACK_SPEED = 4.5;
  const KNOCKBACK_LIFT = 3.5;
  const DEATH_FLASH_SECONDS = 0.08;
  const DEATH_SWELL_RATE = 3;

  // --- Collision with the player (fractions of the combined sizes) ---
  const CONTACT_WIDTH_RATIO = 0.36;
  const CONTACT_HEIGHT_RATIO = 0.42;
  /** Snug body box for small ground creatures: a normal jump clears them (see isBodyTouching). */
  const SMALL_CREATURE_BODY_BOX = { enemyHalfWidthRatio: 0.35, playerHalfWidthRatio: 0.25, topRatio: 0.85 };

  const WHITE = 0xffffff;

  // ==========================================
  // Shared meshes
  // ==========================================
  const unitPlane = new THREE.PlaneGeometry(1, 1);
  let shadowTexture = null;

  /** Soft pixel ellipse used for every creature's ground shadow. */
  function getShadowTexture() {
    if (shadowTexture) return shadowTexture;
    const width = 16;
    const height = 6;
    const { canvas, ctx } = createPixelCanvas(width, height);
    ctx.fillStyle = '#ffffff';
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (x + 0.5 - width / 2) / (width / 2);
        const dy = (y + 0.5 - height / 2) / (height / 2);
        if (dx * dx + dy * dy <= 1) ctx.fillRect(x, y, 1, 1);
      }
    }
    shadowTexture = createPixelTexture(canvas);
    return shadowTexture;
  }

  function directionTowards(fromX, toX) {
    return toX >= fromX ? 1 : -1;
  }

  // ==========================================
  // Base class: falling, physics, getting hit, exploding
  // ==========================================
  class SkyCreature {
    /**
     * @param {object} world shared game systems (scene, sprites, particles, effects, hitStop,
     *   cameraController, projectiles, spawnEnemy)
     * @param {object} options
     * @param {string} options.kind key into world.sprites.skyCreatures
     * @param {Object<string, {normal: object, flash: object}>} [options.frames]
     *   ready-made frames to use instead of looking `kind` up (e.g. generated monsters)
     * @param {number} options.x where it lands
     * @param {{hp:number, speed:number, damage:number}} options.stats
     * @param {number} options.spriteScale on-screen size relative to the boy's pixel size
     * @param {string} options.fallFrame frame shown while falling
     * @param {{main:string, accent:string}} options.colors used for sparks and explosions
     * @param {(creature: SkyCreature) => void} options.onDefeated called the moment its health hits zero
     * @param {{y:number, velocityX:number, velocityY:number}} [options.launch]
     *   start mid-air with this motion instead of dropping from the sky
     */
    constructor(world, { kind, frames, x, stats, spriteScale, fallFrame, colors, onDefeated, launch }) {
      this.world = world;
      this.scene = world.scene;
      this.particles = world.particles;
      this.effects = world.effects;
      this.hitStop = world.hitStop;
      this.cameraController = world.cameraController;
      this.onDefeated = onDefeated;
      this.colors = colors;

      /** Which creature this is (nutling, thornback, ...); also its species id in the scrapbook. */
      this.kind = kind;
      this.frames = frames || world.sprites.skyCreatures[kind];
      this.unitsPerPixel = PIXEL_SCALE * spriteScale;
      const firstSprite = this.frames[fallFrame].normal;
      this.width = firstSprite.width * this.unitsPerPixel;
      this.height = firstSprite.height * this.unitsPerPixel;

      this.mesh = createSpriteMesh(firstSprite, this.unitsPerPixel);
      this.displayedSprite = firstSprite;
      this.frameName = fallFrame;
      this.scene.add(this.mesh);

      this.shadow = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({
        map: getShadowTexture(), color: 0x000000, transparent: true, opacity: 0, depthWrite: false
      }));
      this.scene.add(this.shadow);

      this.maxHp = stats.hp;
      this.hp = stats.hp;
      this.speed = stats.speed;
      this.damage = stats.damage;
      this.hpBar = this.maxHp >= 3 ? this.createHpBar() : null;

      this.x = clamp(x, LEVEL_START_X + LEVEL_MARGIN, LEVEL_END_X - LEVEL_MARGIN);
      this.facing = randomDirection();
      this.scaleX = 1;
      this.scaleY = 1;
      /** Temporary sway added to the drawn position (shudders, footstep bobbing). */
      this.offsetX = 0;
      this.offsetY = 0;
      this.tint = WHITE;
      this.flashSeconds = 0;
      this.stateTimer = 0;
      this.isFlying = false;
      /** 0 = knocked back and stunned by every hit, 1 = shrugs hits off entirely. */
      this.knockbackResistance = 0;
      /** Shrinks (below 1) the box in which touching it hurts the boy. Hitting it is unaffected. */
      this.contactScale = 1;
      /** The player, remembered from the last update (for landing shockwaves). */
      this.target = null;
      /** True once it has exploded and left the scene. */
      this.isGone = false;

      if (launch) {
        this.y = launch.y;
        this.velocityX = launch.velocityX;
        this.velocityY = launch.velocityY;
        this.state = CreatureState.JUMP;
      } else {
        this.y = GROUND_Y + SPAWN_HEIGHT;
        this.velocityX = 0;
        this.velocityY = FALL_START_SPEED;
        this.state = CreatureState.FALLING;
        Sfx.skyWhistle();
      }
      this.syncMesh();
    }

    // ==========================================
    // Queries used by the game for collisions
    // ==========================================
    get isHittable() {
      return !this.isGone && this.state !== CreatureState.DEFEATED;
    }

    get canHurtPlayer() {
      return !this.isGone && this.state !== CreatureState.DEFEATED && this.state !== CreatureState.HURT;
    }

    get isOnGround() {
      return this.y <= GROUND_Y;
    }

    get centerY() {
      return this.y + this.height / 2;
    }

    isTouching(player) {
      const dx = Math.abs(player.x - this.x);
      const dy = Math.abs((player.y + player.height / 2) - this.centerY);
      return dx < (player.width + this.width) * CONTACT_WIDTH_RATIO * this.contactScale
        && dy < (player.height + this.height) * CONTACT_HEIGHT_RATIO * this.contactScale;
    }

    isInsideArea({ centerX, centerY, halfWidth, halfHeight }) {
      return Math.abs(centerX - this.x) < halfWidth + this.width * 0.3
        && Math.abs(centerY - this.centerY) < halfHeight + this.height * 0.3;
    }

    // ==========================================
    // Taking damage
    // ==========================================
    takeHit(damage, attackerX) {
      if (!this.isHittable) return;

      this.hp -= damage;
      this.flashSeconds = HIT_FLASH_SECONDS;
      this.particles.burst(this.x, this.centerY, 10, this.colors.main, 1.4, 0.5);
      this.particles.burst(this.x, this.centerY, 6, this.colors.accent, 1.1, 0.4);

      if (this.hp <= 0) {
        this.defeat();
        return;
      }
      Sfx.creatureHit();
      this.onHurt(this.x >= attackerX ? 1 : -1);
    }

    /** Default reaction: knocked back and briefly stunned. */
    onHurt(knockbackDirection) {
      const push = 1 - this.knockbackResistance;
      this.state = CreatureState.HURT;
      this.stateTimer = HURT_SECONDS;
      this.velocityX = knockbackDirection * KNOCKBACK_SPEED * push;
      this.velocityY = KNOCKBACK_LIFT * push;
      this.facing = -knockbackDirection;
      this.tint = WHITE;
      this.setSquash(1.25, 0.75);
    }

    /** Called when the stun from a hit wears off. */
    recover() {}

    defeat() {
      this.state = CreatureState.DEFEATED;
      this.stateTimer = DEATH_FLASH_SECONDS;
      this.velocityX = 0;
      this.velocityY = 0;
      this.tint = WHITE;
      this.hitStop.trigger(0.1);
      this.cameraController.shake(0.12, 0.22);
      this.onDefeated(this);
    }

    // ==========================================
    // Per-frame update
    // ==========================================
    update(deltaSeconds, player) {
      if (this.isGone) return;
      this.target = player;

      this.stateTimer -= deltaSeconds;
      this.flashSeconds = Math.max(0, this.flashSeconds - deltaSeconds);
      this.offsetX = 0;

      switch (this.state) {
        case CreatureState.FALLING: this.updateFalling(deltaSeconds); break;
        case CreatureState.HURT: this.updateHurt(deltaSeconds); break;
        case CreatureState.DEFEATED: this.updateDefeated(deltaSeconds); break;
        default: this.think(deltaSeconds, player);
      }

      this.relaxSquash(deltaSeconds);
      if (!this.isGone) this.syncMesh();
    }

    /** Behaviour once it has landed; each creature implements its own. */
    think() {}

    updateFalling(deltaSeconds) {
      this.velocityY -= FALL_GRAVITY * deltaSeconds;
      this.y += this.velocityY * deltaSeconds;
      this.emitFallTrail();

      const stopHeight = this.fallStopHeight();
      if (this.y <= stopHeight) {
        this.y = stopHeight;
        this.velocityY = 0;
        this.land();
      }
    }

    /** Height at which the fall ends (flying creatures stop in mid-air). */
    fallStopHeight() {
      return GROUND_Y;
    }

    emitFallTrail() {
      if (Math.random() < 0.3) {
        this.particles.burst(this.x, this.y + this.height, 1, this.colors.accent, 0.3, 0.3);
      }
    }

    /** Touchdown at the end of the fall from the sky. */
    land() {
      this.setSquash(1.35, 0.65);
      this.particles.burst(this.x, GROUND_Y + 0.1, 8, '#8d6849', 1.2, 0.4);
      this.effects.spawnRing({
        color: '#ffeaa7', x: this.x, y: GROUND_Y + 0.1,
        fromScale: 0.3, toScale: this.width * 1.6, lifetime: 0.25
      });
      Sfx.creatureLand();
      this.onLanded();
    }

    /** Pick the first real state after landing. */
    onLanded() {}

    /** Called by applyPhysics when an airborne creature reaches the grass. */
    onTouchGround(impactSpeed) {
      if (impactSpeed > 3) this.setSquash(1.2, 0.8);
    }

    updateHurt(deltaSeconds) {
      this.applyPhysics(deltaSeconds);
      if (this.stateTimer <= 0) this.recover();
    }

    /** Swell slightly while flashing white, then explode. */
    updateDefeated(deltaSeconds) {
      const swell = 1 + (DEATH_FLASH_SECONDS - Math.max(0, this.stateTimer)) * DEATH_SWELL_RATE;
      this.mesh.scale.set(this.facing * swell, swell, 1);
      if (this.stateTimer <= 0) this.explode();
    }

    /** Gravity, ground contact and level edges, driven by velocityX / velocityY. */
    applyPhysics(deltaSeconds) {
      if (this.isFlying) {
        const damping = Math.pow(1 - AIR_DAMPING_PER_SECOND, deltaSeconds);
        this.velocityX *= damping;
        this.velocityY *= damping;
        this.x += this.velocityX * deltaSeconds;
        this.y = Math.max(GROUND_Y + 0.2, this.y + this.velocityY * deltaSeconds);
      } else {
        const wasAirborne = this.y > GROUND_Y;
        this.velocityY -= GRAVITY * deltaSeconds;
        this.x += this.velocityX * deltaSeconds;
        this.y += this.velocityY * deltaSeconds;

        if (this.y <= GROUND_Y) {
          const impactSpeed = -this.velocityY;
          this.y = GROUND_Y;
          this.velocityY = 0;
          this.velocityX *= GROUND_FRICTION;
          if (wasAirborne) this.onTouchGround(impactSpeed);
        }
      }
      this.keepInsideLevel();
    }

    /** Walk / fly sideways by `distance`. Returns true if it bumped into the edge of the level. */
    moveHorizontally(distance) {
      this.x += distance;
      return this.keepInsideLevel();
    }

    keepInsideLevel() {
      const clampedX = clamp(this.x, LEVEL_START_X + LEVEL_MARGIN, LEVEL_END_X - LEVEL_MARGIN);
      const hitEdge = clampedX !== this.x;
      this.x = clampedX;
      return hitEdge;
    }

    /** Shatter into pixel debris with a flash and shockwaves. */
    explode() {
      const sprite = this.frames[this.frameName].normal;
      const centerX = this.x;
      const centerY = this.centerY;
      this.remove();

      this.effects.shatterCanvas(sprite.canvas, centerX, centerY, this.unitsPerPixel);
      this.effects.spawnDisc({ color: '#fff4c2', x: centerX, y: centerY, fromScale: 0.6, toScale: this.width * 2.2, lifetime: 0.12, z: 0.62 });
      this.effects.spawnRing({ color: this.colors.accent, x: centerX, y: centerY, fromScale: 0.4, toScale: this.width * 3.4, lifetime: 0.32, z: 0.61 });
      this.effects.spawnRing({ color: this.colors.main, x: centerX, y: centerY, fromScale: 0.3, toScale: this.width * 2.4, lifetime: 0.5, z: 0.6 });
      this.particles.burst(centerX, centerY, 14, this.colors.main, 2.0, 0.7);
      this.particles.burst(centerX, centerY, 10, this.colors.accent, 1.8, 0.6);

      Sfx.mushroomExplosion();
      this.cameraController.shake(0.14, 0.28);
      this.onExploded();
    }

    /** Extra effects or offspring after exploding. */
    onExploded() {}

    /** Remove from the scene without any effects (also used on restart). */
    remove() {
      if (this.isGone) return;
      this.isGone = true;
      removeMesh(this.scene, this.mesh, { disposeGeometry: true });
      removeMesh(this.scene, this.shadow);
      if (this.hpBar) {
        removeMesh(this.scene, this.hpBar.back);
        removeMesh(this.scene, this.hpBar.fill);
      }
    }

    // ==========================================
    // Drawing helpers
    // ==========================================
    showFrame(frameName) {
      this.frameName = frameName;
    }

    setSquash(scaleX, scaleY) {
      this.scaleX = scaleX;
      this.scaleY = scaleY;
    }

    relaxSquash(deltaSeconds) {
      const blend = Math.min(1, SQUASH_RECOVERY_RATE * deltaSeconds);
      this.scaleX += (1 - this.scaleX) * blend;
      this.scaleY += (1 - this.scaleY) * blend;
    }

    createHpBar() {
      const back = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({ color: 0x1a0b0b, transparent: true, opacity: 0.85, depthWrite: false }));
      // Also transparent, so it's depth-sorted with (and drawn in front of) the backing
      const fill = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, depthWrite: false }));
      this.scene.add(back);
      this.scene.add(fill);
      return { back, fill };
    }

    syncMesh() {
      const frame = this.frames[this.frameName];
      const isFlashing = this.flashSeconds > 0 || this.state === CreatureState.DEFEATED;
      const sprite = isFlashing ? frame.flash : frame.normal;
      if (sprite !== this.displayedSprite) {
        setMeshSprite(this.mesh, sprite);
        this.displayedSprite = sprite;
      }

      // While defeated, updateDefeated controls the scale (swelling)
      if (this.state !== CreatureState.DEFEATED) {
        this.mesh.scale.set(this.facing * this.scaleX, this.scaleY, 1);
      }
      this.mesh.material.color.setHex(this.tint);
      this.mesh.position.set(this.x + this.offsetX, this.y + (this.height * this.scaleY) / 2 + this.offsetY, MESH_Z);

      this.syncShadow();
      if (this.hpBar) this.syncHpBar();
    }

    /** The shadow grows and darkens as the creature approaches the grass; it glows red while falling. */
    syncShadow() {
      const altitude = Math.max(0, this.y - GROUND_Y);
      const closeness = clamp(1 - altitude / SPAWN_HEIGHT, 0, 1);
      const size = this.width * (0.5 + 0.7 * closeness);
      this.shadow.scale.set(size, size * 0.3, 1);
      this.shadow.position.set(this.x, GROUND_Y + 0.04, SHADOW_Z);
      this.shadow.material.opacity = 0.18 + 0.35 * closeness;
      this.shadow.material.color.setHex(this.state === CreatureState.FALLING ? 0x9a0000 : 0x000000);
    }

    syncHpBar() {
      const barWidth = Math.max(0.8, this.width * 0.75);
      const barY = this.y + this.height * this.scaleY + 0.22 + this.offsetY;
      const ratio = clamp(this.hp / this.maxHp, 0, 1);
      this.hpBar.back.scale.set(barWidth + 0.08, 0.16, 1);
      this.hpBar.back.position.set(this.x, barY, HP_BAR_Z);
      this.hpBar.fill.scale.set(Math.max(0.001, barWidth * ratio), 0.08, 1);
      this.hpBar.fill.position.set(this.x - (barWidth * (1 - ratio)) / 2, barY, HP_BAR_Z + 0.005);
    }
  }

  // ==========================================
  // Tier 1: Nutling
  // ==========================================
  const NUTLING_HOP_SPEED_X = 3.0;
  const NUTLING_HOP_SPEED_Y = [5.5, 7.0];
  const NUTLING_HOP_INTERVAL = 0.75;

  class Nutling extends SkyCreature {
    constructor(world, options) {
      super(world, {
        ...options,
        kind: 'nutling',
        spriteScale: 0.9,
        fallFrame: 'acorn',
        colors: { main: '#c98a3e', accent: '#7bc043' }
      });
    }

    /** Small enough to jump over. */
    isTouching(player) {
      return isBodyTouching(player, this, SMALL_CREATURE_BODY_BOX);
    }

    onLanded() {
      Sfx.acornCrack();
      this.particles.burst(this.x, this.y + 0.5, 6, '#5e3b1c', 1.0, 0.4);
      this.showFrame('hop1');
      this.state = CreatureState.HOP;
      this.stateTimer = randomBetween(0.25, 0.6);
    }

    think(deltaSeconds, player) {
      this.applyPhysics(deltaSeconds);
      if (!this.isOnGround) {
        this.showFrame('hop2');
        return;
      }

      this.showFrame('hop1');
      if (this.stateTimer <= 0) {
        // Hop at the boy (or somewhere random once he's down)
        this.facing = player.isDefeated ? randomDirection() : directionTowards(this.x, player.x);
        this.velocityX = this.facing * NUTLING_HOP_SPEED_X * this.speed;
        this.velocityY = randomBetween(...NUTLING_HOP_SPEED_Y);
        this.stateTimer = (NUTLING_HOP_INTERVAL + randomBetween(-0.15, 0.2)) / this.speed;
        this.setSquash(0.8, 1.25);
      }
    }

    onTouchGround() {
      this.setSquash(1.25, 0.75);
    }

    recover() {
      this.state = CreatureState.HOP;
      this.stateTimer = 0.4;
    }
  }

  // ==========================================
  // Tier 2: Thornback
  // ==========================================
  const BEETLE_WALK_SPEED = 1.5;
  const BEETLE_CHARGE_RANGE = 6.5;
  const BEETLE_TELEGRAPH_SECONDS = 0.65;
  const BEETLE_CHARGE_SPEED = 8.5;
  const BEETLE_CHARGE_SECONDS = 1.0;
  const BEETLE_COOLDOWN_SECONDS = 1.4;
  const BEETLE_WALK_FRAME_SECONDS = 0.14;
  const BEETLE_CHARGE_FRAME_SECONDS = 0.05;
  const BEETLE_ANGRY_TINT = 0xff7070;
  const BEETLE_CHARGE_TINT = 0xffb0b0;

  class Thornback extends SkyCreature {
    constructor(world, options) {
      super(world, {
        ...options,
        kind: 'thornback',
        spriteScale: 0.85,
        fallFrame: 'walk1',
        colors: { main: '#55307a', accent: '#c7f464' }
      });
      this.cooldown = 1.0;
      this.animationTimer = 0;
    }

    /** Low enough to jump over, even mid-charge. */
    isTouching(player) {
      return isBodyTouching(player, this, SMALL_CREATURE_BODY_BOX);
    }

    onLanded() {
      this.state = CreatureState.WALK;
      this.cameraController.shake(0.05, 0.1);
    }

    think(deltaSeconds, player) {
      this.applyPhysics(deltaSeconds);
      this.cooldown -= deltaSeconds;

      switch (this.state) {
        case CreatureState.WALK: this.updateWalk(deltaSeconds, player); break;
        case CreatureState.TELEGRAPH: this.updateTelegraph(); break;
        case CreatureState.CHARGE: this.updateCharge(deltaSeconds); break;
      }
    }

    updateWalk(deltaSeconds, player) {
      const dx = player.x - this.x;
      this.facing = directionTowards(this.x, player.x);
      this.moveHorizontally(this.facing * BEETLE_WALK_SPEED * this.speed * deltaSeconds);
      this.animateLegs(deltaSeconds, BEETLE_WALK_FRAME_SECONDS);

      const canCharge = this.cooldown <= 0 && this.isOnGround && !player.isDefeated;
      if (canCharge && Math.abs(dx) < BEETLE_CHARGE_RANGE) {
        this.state = CreatureState.TELEGRAPH;
        this.stateTimer = BEETLE_TELEGRAPH_SECONDS / Math.sqrt(this.speed);
        Sfx.beetleGrowl();
      }
    }

    /** Shudder, flash red and paw the ground before charging. */
    updateTelegraph() {
      this.offsetX = Math.sin(this.stateTimer * 70) * 0.05;
      this.tint = Math.sin(this.stateTimer * 30) > 0 ? BEETLE_ANGRY_TINT : WHITE;
      if (Math.random() < 0.3) {
        this.particles.burst(this.x - this.facing * this.width * 0.4, GROUND_Y + 0.05, 1, '#8d6849', 0.6, 0.3);
      }
      if (this.stateTimer <= 0) {
        this.state = CreatureState.CHARGE;
        this.stateTimer = BEETLE_CHARGE_SECONDS;
        this.tint = BEETLE_CHARGE_TINT;
        Sfx.beetleCharge();
      }
    }

    updateCharge(deltaSeconds) {
      const hitEdge = this.moveHorizontally(this.facing * BEETLE_CHARGE_SPEED * this.speed * deltaSeconds);
      this.animateLegs(deltaSeconds, BEETLE_CHARGE_FRAME_SECONDS);
      if (Math.random() < 0.5) {
        this.particles.burst(this.x - this.facing * this.width * 0.5, GROUND_Y + 0.05, 1, '#8d6849', 0.5, 0.3);
      }

      if (hitEdge) {
        // Bonk into the edge of the forest
        Sfx.creatureLand();
        this.cameraController.shake(0.08, 0.15);
        this.setSquash(0.7, 1.2);
      }
      if (hitEdge || this.stateTimer <= 0) this.endCharge();
    }

    endCharge() {
      this.state = CreatureState.WALK;
      this.cooldown = BEETLE_COOLDOWN_SECONDS;
      this.tint = WHITE;
    }

    animateLegs(deltaSeconds, frameSeconds) {
      this.animationTimer += deltaSeconds;
      if (this.animationTimer > frameSeconds) {
        this.animationTimer = 0;
        this.showFrame(this.frameName === 'walk1' ? 'walk2' : 'walk1');
      }
    }

    recover() {
      this.state = CreatureState.WALK;
      this.tint = WHITE;
      this.cooldown = Math.max(this.cooldown, 0.6);
    }
  }

  // ==========================================
  // Tier 3: Gloomwing
  // ==========================================
  const MOTH_HOVER_HEIGHT = 2.5;
  const MOTH_SIDE_DISTANCE = 2.6;
  const MOTH_HOVER_SECONDS = [2.2, 3.4];
  const MOTH_SWOOP_SECONDS = 1.3;
  /** Before diving it stops and glows for this long, so the boy can see the dive coming. */
  const MOTH_WARNING_SECONDS = 0.5;
  /** If another moth is already diving, wait this long and check again: only one dives at a time. */
  const MOTH_DIVE_RETRY_SECONDS = 0.6;
  /** Moths that have started a dive (finished ones are filtered out by state). */
  const divingMoths = new Set();
  const MOTH_FLAP_SECONDS = 0.11;
  /** How quickly it drifts towards its hover spot. */
  const MOTH_FOLLOW_RATE = 2.5;
  /** Lowest point of a dive (its feet), just above the grass. */
  const MOTH_DIVE_BOTTOM = 0.3;
  const MOTH_DIVE_TINT = 0xffc0ff;
  /** Its hurt box is this fraction of the usual size: only its body hurts, not its wingtips. */
  const MOTH_CONTACT_SCALE = 0.6;

  class Gloomwing extends SkyCreature {
    constructor(world, options) {
      super(world, {
        ...options,
        kind: 'gloomwing',
        spriteScale: 0.8,
        fallFrame: 'down',
        colors: { main: '#6a35a0', accent: '#ff9de2' }
      });
      this.contactScale = MOTH_CONTACT_SCALE;
      this.hoverY = GROUND_Y + MOTH_HOVER_HEIGHT + randomBetween(-0.2, 0.5);
      this.side = randomDirection();
      this.flapTimer = 0;
      this.time = Math.random() * 10;
    }

    fallStopHeight() {
      return this.hoverY;
    }

    /** No landing: it unfurls its wings and stays in the air. */
    land() {
      this.isFlying = true;
      this.state = CreatureState.HOVER;
      this.stateTimer = randomBetween(...MOTH_HOVER_SECONDS);
      this.particles.burst(this.x, this.centerY, 8, '#ffe066', 1.0, 0.5);
      Sfx.wingFlutter();
    }

    think(deltaSeconds, player) {
      this.time += deltaSeconds;
      if (this.state === CreatureState.HOVER) {
        this.updateHover(deltaSeconds, player);
      } else if (this.state === CreatureState.SWOOP) {
        this.updateSwoop();
      }
    }

    /** Drift to one side of the boy, bobbing up and down. */
    updateHover(deltaSeconds, player) {
      this.flapWings(deltaSeconds);
      this.facing = directionTowards(this.x, player.x);

      // Warning: hold still and glow just before diving
      if (this.stateTimer <= MOTH_WARNING_SECONDS && (this.isWarning || !this.anotherMothIsDiving())) {
        if (!this.isWarning) {
          this.isWarning = true;
          divingMoths.add(this);
          this.tint = MOTH_DIVE_TINT;
        }
        if (this.stateTimer <= 0 && !player.isDefeated) this.startSwoop(player);
        return;
      }

      const targetX = player.x + this.side * MOTH_SIDE_DISTANCE;
      const targetY = this.hoverY + Math.sin(this.time * 3) * 0.3;
      this.x += (targetX - this.x) * Math.min(1, MOTH_FOLLOW_RATE * deltaSeconds);
      this.y += (targetY - this.y) * Math.min(1, 3 * deltaSeconds);
      this.keepInsideLevel();

      // Drifting spores
      if (Math.random() < 0.06) {
        this.particles.burst(this.x, this.y, 1, '#ffe066', 0.3, 0.8);
      }

      // Its turn came while another moth was diving: wait a little and try again
      if (this.stateTimer <= 0) this.stateTimer = MOTH_WARNING_SECONDS + MOTH_DIVE_RETRY_SECONDS;
    }

    anotherMothIsDiving() {
      for (const moth of divingMoths) {
        const stillDiving = !moth.isGone
          && (moth.state === CreatureState.SWOOP || (moth.state === CreatureState.HOVER && moth.isWarning));
        if (!stillDiving) divingMoths.delete(moth);
        else if (moth !== this) return true;
      }
      return false;
    }

    /** Dive in a U-shaped arc through the boy's position and back up on the other side. */
    startSwoop(player) {
      this.state = CreatureState.SWOOP;
      this.isWarning = false;
      divingMoths.add(this);
      this.swoopSeconds = MOTH_SWOOP_SECONDS / this.speed;
      this.stateTimer = this.swoopSeconds;
      this.swoopStartX = this.x;
      this.swoopStartY = this.y;
      this.swoopDistanceX = (player.x - this.x) * 2;
      this.swoopDepth = Math.max(0.5, this.y - (GROUND_Y + MOTH_DIVE_BOTTOM));
      this.tint = MOTH_DIVE_TINT;
      this.showFrame('up');
      Sfx.swoopScreech();
    }

    updateSwoop() {
      const progress = 1 - this.stateTimer / this.swoopSeconds; // 0 -> 1
      if (progress >= 1) {
        this.finishSwoop();
        return;
      }
      this.x = this.swoopStartX + this.swoopDistanceX * progress;
      this.y = this.swoopStartY - this.swoopDepth * Math.sin(Math.PI * progress);
      this.facing = Math.sign(this.swoopDistanceX) || this.facing;
      if (this.keepInsideLevel()) this.finishSwoop();
    }

    finishSwoop() {
      divingMoths.delete(this);
      this.state = CreatureState.HOVER;
      this.stateTimer = randomBetween(...MOTH_HOVER_SECONDS) / this.speed;
      this.side = -this.side;
      this.tint = WHITE;
    }

    flapWings(deltaSeconds) {
      this.flapTimer += deltaSeconds;
      if (this.flapTimer > MOTH_FLAP_SECONDS) {
        this.flapTimer = 0;
        this.showFrame(this.frameName === 'up' ? 'down' : 'up');
      }
    }

    recover() {
      // Also takes off again if it was knocked down before it finished falling
      this.isWarning = false;
      this.isFlying = true;
      this.state = CreatureState.HOVER;
      this.stateTimer = 1.0;
      this.tint = WHITE;
    }
  }

  // ==========================================
  // Tier 4: Thunder Jelly
  // ==========================================
  const JELLY_REST_SECONDS = 1.1;
  const JELLY_WINDUP_SECONDS = 0.3;
  const JELLY_JUMP_SPEED = 8.5;
  const JELLY_MAX_JUMP_SPEED_X = 5;
  /** The lightning hurts a boy standing on the grass this close to the landing spot. */
  const JELLY_SHOCK_RADIUS = 2.3;
  const MINI_JELLY_SCALE = 0.6;
  /**
   * A big jelly's lightning crackles high above its bell: the boy's feet must clear 1.75x its height
   * (~1.84 units). A normal jump peaks at ~1.69, so only a double jump gets over. Small ones are hoppable.
   */
  const BIG_JELLY_BODY_BOX = { enemyHalfWidthRatio: 0.35, playerHalfWidthRatio: 0.25, topRatio: 1.75 };
  /** Chance per frame of a spark flickering in the big jelly's lightning field. */
  const JELLY_FIELD_SPARK_CHANCE = 0.25;

  class ThunderJelly extends SkyCreature {
    /** @param {object} options as for SkyCreature, plus `isMini` for the halves of a split jelly */
    constructor(world, options) {
      const isMini = Boolean(options.isMini);
      super(world, {
        ...options,
        kind: 'jelly',
        spriteScale: isMini ? 0.6 : 1.05,
        fallFrame: 'idle',
        colors: { main: '#35b6d6', accent: '#ffe14d' }
      });
      this.isMini = isMini;
      this.time = Math.random() * 10;
    }

    isTouching(player) {
      return isBodyTouching(player, this, this.isMini ? SMALL_CREATURE_BODY_BOX : BIG_JELLY_BODY_BOX);
    }

    /** Sparks flicker above a big jelly's bell, showing how high its lightning reaches. */
    emitFieldSparks() {
      if (this.isMini || Math.random() > JELLY_FIELD_SPARK_CHANCE) return;
      const sparkX = this.x + randomBetween(-0.35, 0.35) * this.width;
      const sparkY = this.y + this.height * randomBetween(1.0, BIG_JELLY_BODY_BOX.topRatio);
      this.particles.burst(sparkX, sparkY, 1, Math.random() < 0.5 ? '#ffe14d' : '#8ff0ff', 0.3, 0.18);
    }

    /** Smaller jellies have proportionally smaller jumps and shockwaves. */
    get sizeFactor() {
      return this.isMini ? MINI_JELLY_SCALE : 1;
    }

    onLanded() {
      this.shockwave();
      this.rest();
    }

    rest() {
      this.state = CreatureState.IDLE;
      this.stateTimer = (JELLY_REST_SECONDS * (this.isMini ? 0.6 : 1)) / this.speed;
      this.showFrame('idle');
    }

    think(deltaSeconds, player) {
      this.time += deltaSeconds;
      this.applyPhysics(deltaSeconds);
      this.emitFieldSparks();

      switch (this.state) {
        case CreatureState.IDLE:
          // Jiggle while resting
          this.scaleY *= 1 + Math.sin(this.time * 9) * 0.01;
          if (this.stateTimer <= 0) {
            this.state = CreatureState.TELEGRAPH;
            this.stateTimer = JELLY_WINDUP_SECONDS;
            this.showFrame('squash');
            this.particles.burst(this.x, this.centerY, 4, '#ffe14d', 0.8, 0.3);
          }
          break;

        case CreatureState.TELEGRAPH:
          this.offsetX = Math.sin(this.stateTimer * 80) * 0.04;
          if (this.stateTimer <= 0) this.jumpAt(player);
          break;

        case CreatureState.JUMP:
          // Landing is handled in onTouchGround
          break;
      }
    }

    jumpAt(player) {
      this.state = CreatureState.JUMP;
      this.showFrame('idle');
      const jumpSpeed = JELLY_JUMP_SPEED * (this.isMini ? 0.75 : 1);
      const airSeconds = (2 * jumpSpeed) / GRAVITY;
      const targetX = player.isDefeated ? this.x + randomBetween(-3, 3) : player.x;
      const maxSpeedX = JELLY_MAX_JUMP_SPEED_X * this.speed;
      this.velocityX = clamp((targetX - this.x) / airSeconds, -maxSpeedX, maxSpeedX);
      this.velocityY = jumpSpeed;
      this.facing = directionTowards(this.x, targetX);
      this.setSquash(0.7, 1.35);
      Sfx.jellyBoing();
    }

    onTouchGround(impactSpeed) {
      if (this.state === CreatureState.JUMP) {
        this.shockwave();
        this.rest();
      } else {
        super.onTouchGround(impactSpeed);
      }
    }

    /** Lightning crackles along the grass; it only hurts the boy if he's standing on it nearby. */
    shockwave() {
      const radius = JELLY_SHOCK_RADIUS * this.sizeFactor;
      this.setSquash(1.4, 0.6);
      this.effects.spawnRing({ color: '#ffe14d', x: this.x, y: GROUND_Y + 0.15, fromScale: 0.4, toScale: radius * 2, lifetime: 0.3 });
      this.effects.spawnRing({ color: '#8ff0ff', x: this.x, y: GROUND_Y + 0.15, fromScale: 0.3, toScale: radius * 1.4, lifetime: 0.4 });
      for (let i = 0; i < 6; i++) {
        const sparkX = this.x + randomBetween(-radius, radius);
        this.particles.burst(sparkX, GROUND_Y + 0.1, 2, i % 2 ? '#ffe14d' : '#ffffff', 1.0, 0.3);
      }
      Sfx.jellyZap();
      this.cameraController.shake(0.07 * this.sizeFactor, 0.15);

      const player = this.target;
      const playerIsOnGrass = player && player.y < GROUND_Y + 0.25;
      if (playerIsOnGrass && Math.abs(player.x - this.x) < radius) {
        player.takeDamage(this.damage, this.x);
      }
    }

    /** A big jelly splits into two small ones. */
    onExploded() {
      if (this.isMini) return;
      [-1, 1].forEach(direction => {
        this.world.spawnEnemy(new ThunderJelly(this.world, {
          x: this.x + direction * 0.3,
          stats: { hp: Math.max(1, Math.ceil(this.maxHp / 3)), speed: this.speed, damage: this.damage },
          onDefeated: this.onDefeated,
          isMini: true,
          launch: { y: this.y + 0.3, velocityX: direction * 3, velocityY: 6 }
        }));
      });
    }

    recover() {
      this.rest();
    }
  }

  // ==========================================
  // Tier 5: Cinder Golem
  // ==========================================
  const GOLEM_WALK_SPEED = 0.9;
  const GOLEM_STEP_SECONDS = 0.55;
  const GOLEM_THROW_INTERVAL = 2.8;
  const GOLEM_THROW_WINDUP_SECONDS = 0.6;
  const GOLEM_THROW_RECOVER_SECONDS = 0.4;
  /** Its meteor landing hurts a boy standing on the grass this close. */
  const GOLEM_LANDING_RADIUS = 3.6;
  /** Doesn't bother walking when it's already this close (inside its touch range, so it still walks into the boy). */
  const GOLEM_STOP_DISTANCE = 0.6;
  /**
   * Touch box hugging the rock body, as fractions of each one's width. Vertically the boy's feet must
   * clear the top of its head (~1.87 units): a normal jump peaks at ~1.69, so only a double jump gets over.
   */
  const GOLEM_BODY_BOX = { enemyHalfWidthRatio: 0.3, playerHalfWidthRatio: 0.25, topRatio: 1 };
  const GOLEM_ENRAGED_PACE = 1.6;
  const GOLEM_ENRAGED_TINT = 0xffb0a0;
  const GOLEM_GLOW_TINT = 0xffc080;
  const FIREBALL_FLIGHT_SECONDS = 1.05;
  const FIREBALL_SPREAD = 1.6;
  const FLAME_COLORS = ['#ff5a1f', '#ffb347', '#fff3a0'];

  class CinderGolem extends SkyCreature {
    constructor(world, options) {
      super(world, {
        ...options,
        kind: 'golem',
        spriteScale: 1.3,
        fallFrame: 'stand',
        colors: { main: '#5c3d33', accent: '#ff5a1f' }
      });
      this.knockbackResistance = 1;
      this.isEnraged = false;
      this.throwTimer = GOLEM_THROW_INTERVAL;
      this.stepTimer = 0;
      this.hasThrown = false;
    }

    /** Too tall to hop over: touching unless the boy's feet are above its head (a double jump). */
    isTouching(player) {
      return isBodyTouching(player, this, GOLEM_BODY_BOX);
    }

    /** Burns through the sky like a meteor. */
    emitFallTrail() {
      const color = FLAME_COLORS[Math.floor(Math.random() * FLAME_COLORS.length)];
      this.particles.burst(this.x + randomBetween(-0.4, 0.4), this.y + this.height * 0.4, 2, color, 0.5, 0.45);
      if (Math.random() < 0.15) {
        this.effects.spawnDisc({
          color: '#3a2620', x: this.x, y: this.y + this.height,
          fromScale: 0.4, toScale: 1.2, lifetime: 0.6, z: 0.4, riseSpeed: 1.0, opacity: 0.5
        });
      }
    }

    onLanded() {
      this.cameraController.shake(0.3, 0.5);
      this.hitStop.trigger(0.08);
      Sfx.golemLand();
      this.effects.spawnRing({ color: '#ff5a1f', x: this.x, y: GROUND_Y + 0.2, fromScale: 0.5, toScale: GOLEM_LANDING_RADIUS * 2, lifetime: 0.4 });
      this.effects.spawnRing({ color: '#ffb347', x: this.x, y: GROUND_Y + 0.2, fromScale: 0.4, toScale: GOLEM_LANDING_RADIUS * 1.4, lifetime: 0.55 });
      this.particles.burst(this.x, GROUND_Y + 0.2, 18, '#ff5a1f', 2.4, 0.6);
      this.particles.burst(this.x, GROUND_Y + 0.2, 14, '#8d6849', 2.0, 0.6);

      const player = this.target;
      const playerIsOnGrass = player && player.y < GROUND_Y + 0.25;
      if (playerIsOnGrass && Math.abs(player.x - this.x) < GOLEM_LANDING_RADIUS) {
        player.takeDamage(this.damage, this.x);
      }
      this.state = CreatureState.WALK;
    }

    think(deltaSeconds, player) {
      this.applyPhysics(deltaSeconds);
      if (!this.isEnraged && this.hp <= this.maxHp / 2) this.enrage();
      const pace = this.isEnraged ? GOLEM_ENRAGED_PACE : 1;

      if (this.state === CreatureState.WALK) {
        this.updateWalk(deltaSeconds, player, pace);
      } else if (this.state === CreatureState.THROW) {
        this.updateThrow(player, pace);
      }
    }

    updateWalk(deltaSeconds, player, pace) {
      this.facing = directionTowards(this.x, player.x);
      if (Math.abs(player.x - this.x) > GOLEM_STOP_DISTANCE) {
        this.moveHorizontally(this.facing * GOLEM_WALK_SPEED * this.speed * pace * deltaSeconds);
      }

      // Heavy, bobbing footsteps
      this.stepTimer += deltaSeconds * pace;
      this.offsetY = Math.abs(Math.sin((this.stepTimer / GOLEM_STEP_SECONDS) * Math.PI)) * 0.06;
      if (this.stepTimer >= GOLEM_STEP_SECONDS) {
        this.stepTimer -= GOLEM_STEP_SECONDS;
        Sfx.golemStep();
        this.cameraController.shake(0.03, 0.08);
        this.particles.burst(this.x, GROUND_Y + 0.05, 3, '#8d6849', 0.7, 0.3);
      }

      this.throwTimer -= deltaSeconds * pace;
      if (this.throwTimer <= 0 && !player.isDefeated) {
        this.state = CreatureState.THROW;
        this.stateTimer = GOLEM_THROW_WINDUP_SECONDS / pace;
        this.hasThrown = false;
        this.offsetY = 0;
        this.showFrame('throw');
        Sfx.golemRoar();
      }
    }

    /** Raise glowing fists, hurl fireballs, then go back to stomping. */
    updateThrow(player, pace) {
      if (!this.hasThrown) {
        this.tint = Math.random() < 0.5 ? GOLEM_GLOW_TINT : WHITE;
        if (Math.random() < 0.5) {
          const fistX = this.x + randomDirection() * this.width * 0.4;
          this.particles.burst(fistX, this.y + this.height, 1, '#ffb347', 0.6, 0.4);
        }
        if (this.stateTimer <= 0) {
          this.throwFireballs(player);
          this.hasThrown = true;
          this.stateTimer = GOLEM_THROW_RECOVER_SECONDS / pace;
          this.tint = this.restingTint;
        }
      } else if (this.stateTimer <= 0) {
        this.state = CreatureState.WALK;
        this.showFrame('stand');
        this.throwTimer = GOLEM_THROW_INTERVAL;
      }
    }

    throwFireballs(player) {
      const count = this.isEnraged ? 3 : 1;
      const handY = this.y + this.height * 0.95;
      for (let i = 0; i < count; i++) {
        const targetX = player.x + (i - (count - 1) / 2) * FIREBALL_SPREAD;
        this.world.projectiles.launchFireball(this.x, handY, targetX, GROUND_Y + 0.3, FIREBALL_FLIGHT_SECONDS, this.damage);
      }
      Sfx.fireballLaunch();
    }

    get restingTint() {
      return this.isEnraged ? GOLEM_ENRAGED_TINT : WHITE;
    }

    /** At half health its cracks blaze and it moves and throws faster. */
    enrage() {
      this.isEnraged = true;
      this.tint = GOLEM_ENRAGED_TINT;
      Sfx.golemRoar();
      this.cameraController.shake(0.15, 0.4);
      this.particles.burst(this.x, this.centerY, 20, '#ff5a1f', 2.0, 0.7);
    }

    /** Super armour: it flinches but is never knocked back or stunned. */
    onHurt() {
      this.setSquash(1.08, 0.92);
    }

    onExploded() {
      this.cameraController.shake(0.35, 0.6);
      this.effects.spawnRing({ color: '#fff3a0', x: this.x, y: this.centerY, fromScale: 0.5, toScale: 9, lifetime: 0.6, z: 0.62 });
      this.particles.burst(this.x, this.centerY, 24, '#ffb347', 3.0, 0.9);
    }
  }

  // ==========================================
  // Fireballs
  // ==========================================
  const FIREBALL_GRAVITY = 12;
  const FIREBALL_HIT_RADIUS = 0.35;
  const FIREBALL_SPIN_SPEED = 10;
  const FIREBALL_Z = 0.45;

  class ProjectileSystem {
    /** @param {object} world shared game systems (scene, sprites, particles, effects) */
    constructor(world) {
      this.scene = world.scene;
      this.particles = world.particles;
      this.effects = world.effects;
      this.sprite = world.sprites.fireball;
      this.fireballs = [];
    }

    /** Lob a fireball in an arc so it comes down on (toX, toY) after `flightSeconds`. */
    launchFireball(fromX, fromY, toX, toY, flightSeconds, damage) {
      const mesh = createSpriteMesh(this.sprite, PIXEL_SCALE * 1.2);
      mesh.position.set(fromX, fromY, FIREBALL_Z);
      this.scene.add(mesh);
      this.fireballs.push({
        mesh,
        x: fromX,
        y: fromY,
        velocityX: (toX - fromX) / flightSeconds,
        velocityY: (toY - fromY + 0.5 * FIREBALL_GRAVITY * flightSeconds * flightSeconds) / flightSeconds,
        damage
      });
    }

    update(deltaSeconds, player) {
      for (let i = this.fireballs.length - 1; i >= 0; i--) {
        const fireball = this.fireballs[i];
        fireball.velocityY -= FIREBALL_GRAVITY * deltaSeconds;
        fireball.x += fireball.velocityX * deltaSeconds;
        fireball.y += fireball.velocityY * deltaSeconds;
        fireball.mesh.position.set(fireball.x, fireball.y, FIREBALL_Z);
        fireball.mesh.rotation.z += FIREBALL_SPIN_SPEED * deltaSeconds;

        if (Math.random() < 0.6) {
          const color = FLAME_COLORS[Math.floor(Math.random() * FLAME_COLORS.length)];
          this.particles.burst(fireball.x, fireball.y, 1, color, 0.3, 0.25);
        }

        if (this.isHittingPlayer(fireball, player)) {
          player.takeDamage(fireball.damage, fireball.x);
          this.burst(fireball);
          this.removeAt(i);
        } else if (fireball.y <= GROUND_Y + 0.1 || fireball.x < LEVEL_START_X - 2 || fireball.x > LEVEL_END_X + 2) {
          this.burst(fireball);
          this.removeAt(i);
        }
      }
    }

    isHittingPlayer(fireball, player) {
      if (player.isDefeated) return false;
      return Math.abs(player.x - fireball.x) < player.width * 0.3 + FIREBALL_HIT_RADIUS
        && Math.abs(player.y + player.height / 2 - fireball.y) < player.height * 0.45 + FIREBALL_HIT_RADIUS;
    }

    /** The sword slam knocks fireballs out of the air. Returns how many were destroyed. */
    destroyInArea({ centerX, centerY, halfWidth, halfHeight }) {
      let destroyed = 0;
      for (let i = this.fireballs.length - 1; i >= 0; i--) {
        const fireball = this.fireballs[i];
        if (Math.abs(fireball.x - centerX) < halfWidth && Math.abs(fireball.y - centerY) < halfHeight) {
          this.particles.burst(fireball.x, fireball.y, 8, '#ffffff', 1.4, 0.3);
          this.burst(fireball);
          this.removeAt(i);
          destroyed++;
        }
      }
      return destroyed;
    }

    burst(fireball) {
      this.effects.spawnDisc({ color: '#ffb347', x: fireball.x, y: fireball.y, fromScale: 0.3, toScale: 1.1, lifetime: 0.18 });
      this.particles.burst(fireball.x, fireball.y, 8, '#ff5a1f', 1.2, 0.4);
      Sfx.fireballImpact();
    }

    removeAt(index) {
      removeMesh(this.scene, this.fireballs[index].mesh, { disposeGeometry: true });
      this.fireballs.splice(index, 1);
    }

    clear() {
      for (let i = this.fireballs.length - 1; i >= 0; i--) this.removeAt(i);
    }
  }

  Forest.CreatureState = CreatureState;
  /** Base class, also used by the random monsters of the Monster Forge (src/monsters). */
  Forest.SkyCreature = SkyCreature;
  Forest.ProjectileSystem = ProjectileSystem;
  /** Creature classes by kind, in the order the waves introduce them. */
  Forest.SkyCreatures = Object.freeze({
    nutling: Nutling,
    thornback: Thornback,
    gloomwing: Gloomwing,
    jelly: ThunderJelly,
    golem: CinderGolem
  });
})(window.Forest);
