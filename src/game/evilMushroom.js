/**
 * Evil mushroom enemy: patrols, charges the player when close, reels when hit,
 * and bursts into pixel debris when defeated.
 */
(function (Forest) {
  const { PIXEL_SCALE, GROUND_Y } = Forest.Config;
  const { createSpriteMesh, setMeshSprite } = Forest.Graphics;
  const { randomDirection, randomBetween } = Forest.MathUtils;
  const MushroomArt = Forest.MushroomSprites;
  const Sfx = Forest.SoundEffects;

  /** State names double as CSS classes in the state inspector (e.g. "state-hit_dazed"). */
  const MushroomState = Object.freeze({
    PATROL: 'PATROL',
    AGGRO: 'AGGRO',
    HIT_SQUASH: 'HIT_SQUASH',
    HIT_DAZED: 'HIT_DAZED',
    DEFEATED: 'DEFEATED'
  });

  // --- Size ---
  const SPRITE_SCALE = 0.8;
  const UNITS_PER_PIXEL = PIXEL_SCALE * SPRITE_SCALE;
  const MESH_Z = 0.25;

  // --- Physics ---
  const GRAVITY = 22;
  const GROUND_FRICTION = 0.82;

  // --- Behaviour ---
  const START_HP = 2;
  const PATROL_SPEED = 1.3;
  const CHASE_SPEED = 2.4;
  /** Starts chasing when the player comes this close... */
  const AGGRO_RANGE = 5.2;
  /** ...and gives up once the player is this far away. */
  const GIVE_UP_RANGE = 8.0;
  /** While chasing and this close, occasionally does a menacing hop. */
  const HOP_RANGE = 2.0;
  const HOP_CHANCE_PER_FRAME = 0.03;
  const HOP_SPEED = 4.0;

  // --- Animation timing ---
  const PATROL_FRAME_SECONDS = 0.16;
  const CHASE_FRAME_SECONDS = 0.12;

  // --- Getting hit ---
  const KNOCKBACK_SPEED = 4.0;
  const KNOCKBACK_LIFT = 3.8;
  const SQUASH_SECONDS = 0.2;
  /** The white flash shows until this much squash time is left. */
  const SQUASH_FLASH_ENDS_AT = 0.1;
  const DAZED_SECONDS = 0.55;
  const DAZED_SHUDDER_SPEED = 45;
  const DAZED_SHUDDER_AMOUNT = 0.04;
  /** Flash white this long before exploding. */
  const DEATH_FLASH_SECONDS = 0.08;
  const DEATH_SWELL_RATE = 3;

  // --- Collision with the player (fractions of the combined sizes) ---
  const CONTACT_WIDTH_RATIO = 0.38;
  const CONTACT_HEIGHT_RATIO = 0.45;

  // --- Colours ---
  const SPORE_PURPLE = '#9d4edd';
  const POISON_YELLOW = '#ffd166';

  class EvilMushroom {
    /**
     * @param {object} world shared game systems (scene, sprites, particles, effects, hitStop, cameraController)
     * @param {{x:number, patrolDistance:number}} spawn
     * @param {(mushroom: EvilMushroom) => void} onDefeated called the moment its health hits zero
     */
    constructor(world, spawn, onDefeated) {
      this.scene = world.scene;
      this.sprites = world.sprites.mushroom;
      this.particles = world.particles;
      this.effects = world.effects;
      this.hitStop = world.hitStop;
      this.cameraController = world.cameraController;
      this.onDefeated = onDefeated;

      this.spawnX = spawn.x;
      this.patrolDistance = spawn.patrolDistance;
      this.x = spawn.x;
      this.y = GROUND_Y;
      this.velocityX = 0;
      this.velocityY = 0;
      this.facing = randomDirection();

      this.width = this.sprites.walk[0].width * UNITS_PER_PIXEL;
      this.height = this.sprites.walk[0].height * UNITS_PER_PIXEL;
      this.mesh = createSpriteMesh(this.sprites.walk[0], UNITS_PER_PIXEL);
      this.mesh.position.set(this.x, this.y + this.height / 2, MESH_Z);
      this.scene.add(this.mesh);

      this.state = MushroomState.PATROL;
      this.stateTimer = 0;
      this.animationFrame = 0;
      this.animationTimer = 0;
      this.shudderOffset = 0;

      this.hp = START_HP;
      /** True once it has exploded and left the scene. */
      this.isGone = false;
    }

    // ==========================================
    // Queries used by the game for collisions
    // ==========================================

    /** Can still be hit by the sword. */
    get isHittable() {
      return !this.isGone && this.state !== MushroomState.DEFEATED;
    }

    /** Only hurts the player while walking around, not while reeling from a hit. */
    get canHurtPlayer() {
      return !this.isGone && (this.state === MushroomState.PATROL || this.state === MushroomState.AGGRO);
    }

    get centerY() {
      return this.y + this.height / 2;
    }

    isTouching(player) {
      const dx = Math.abs(player.x - this.x);
      const dy = Math.abs((player.y + player.height / 2) - this.centerY);
      return dx < (player.width + this.width) * CONTACT_WIDTH_RATIO
        && dy < (player.height + this.height) * CONTACT_HEIGHT_RATIO;
    }

    isInsideArea({ centerX, centerY, halfWidth, halfHeight }) {
      return Math.abs(centerX - this.x) < halfWidth && Math.abs(centerY - this.centerY) < halfHeight;
    }

    // ==========================================
    // Taking damage
    // ==========================================
    takeHit(damage, attackerX) {
      if (this.state === MushroomState.HIT_SQUASH || this.state === MushroomState.DEFEATED) return;

      this.hp -= damage;
      Sfx.mushroomHit();

      const knockbackDirection = this.x >= attackerX ? 1 : -1;
      this.facing = -knockbackDirection;

      // Spore burst
      this.particles.burst(this.x, this.y + 0.7, 10, SPORE_PURPLE, 1.4, 0.6);
      this.particles.burst(this.x, this.y + 0.7, 6, POISON_YELLOW, 1.1, 0.4);

      if (this.hp <= 0) {
        // Flash white for a moment, then burst apart (see updateDefeated)
        this.enterState(MushroomState.DEFEATED, DEATH_FLASH_SECONDS);
        this.velocityX = 0;
        this.velocityY = 0;
        this.showFrame(this.sprites.squashFlash);
        this.hitStop.trigger(0.11);
        this.cameraController.shake(0.12, 0.25);
        this.onDefeated(this);
      } else {
        this.enterState(MushroomState.HIT_SQUASH, SQUASH_SECONDS);
        this.velocityX = knockbackDirection * KNOCKBACK_SPEED;
        this.velocityY = KNOCKBACK_LIFT;
        this.showFrame(this.sprites.squashFlash);
      }
    }

    // ==========================================
    // Per-frame update
    // ==========================================
    update(deltaSeconds, player) {
      if (this.isGone) return;

      this.applyPhysics(deltaSeconds);

      switch (this.state) {
        case MushroomState.PATROL: this.updatePatrol(deltaSeconds, player); break;
        case MushroomState.AGGRO: this.updateChase(deltaSeconds, player); break;
        case MushroomState.HIT_SQUASH: this.updateSquash(deltaSeconds); break;
        case MushroomState.HIT_DAZED: this.updateDazed(deltaSeconds); break;
        case MushroomState.DEFEATED: this.updateDefeated(deltaSeconds); break;
      }

      if (!this.isGone) this.syncMesh();
    }

    applyPhysics(deltaSeconds) {
      this.velocityY -= GRAVITY * deltaSeconds;
      this.x += this.velocityX * deltaSeconds;
      this.y += this.velocityY * deltaSeconds;

      if (this.y <= GROUND_Y) {
        this.y = GROUND_Y;
        this.velocityY = 0;
        this.velocityX *= GROUND_FRICTION;
      }
    }

    updatePatrol(deltaSeconds, player) {
      if (Math.abs(player.x - this.x) < AGGRO_RANGE && !player.isDefeated) {
        this.state = MushroomState.AGGRO;
        this.showFrame(this.sprites.aggro);
        return;
      }

      // Walk back and forth around the spawn point
      this.velocityX = this.facing * PATROL_SPEED;
      if (this.x > this.spawnX + this.patrolDistance) {
        this.facing = -1;
      } else if (this.x < this.spawnX - this.patrolDistance) {
        this.facing = 1;
      }

      // Waddle animation
      this.animationTimer += deltaSeconds;
      if (this.animationTimer > PATROL_FRAME_SECONDS) {
        this.animationTimer = 0;
        this.animationFrame = (this.animationFrame + 1) % this.sprites.walk.length;
        this.showFrame(this.sprites.walk[this.animationFrame]);
      }
    }

    updateChase(deltaSeconds, player) {
      const distanceToPlayer = Math.abs(player.x - this.x);
      if (distanceToPlayer > GIVE_UP_RANGE || player.isDefeated) {
        this.state = MushroomState.PATROL;
        return;
      }

      this.facing = player.x > this.x ? 1 : -1;
      this.velocityX = this.facing * CHASE_SPEED;

      // Hopping animation that alternates with the angry face
      this.animationTimer += deltaSeconds;
      if (this.animationTimer > CHASE_FRAME_SECONDS) {
        this.animationTimer = 0;
        this.animationFrame = (this.animationFrame + 1) % this.sprites.walk.length;
        const isAngryFrame = this.animationFrame % 2 === 0;
        this.showFrame(isAngryFrame ? this.sprites.aggro : this.sprites.walk[this.animationFrame]);
      }

      const isOnGround = this.y === GROUND_Y;
      if (distanceToPlayer < HOP_RANGE && isOnGround && Math.random() < HOP_CHANCE_PER_FRAME) {
        this.velocityY = HOP_SPEED;
      }
    }

    /** First hit reaction: squashed flat with an impact flash. */
    updateSquash(deltaSeconds) {
      this.stateTimer -= deltaSeconds;
      if (this.stateTimer <= SQUASH_FLASH_ENDS_AT) {
        this.showFrame(this.sprites.squash);
      }
      if (this.stateTimer <= 0) {
        this.enterState(MushroomState.HIT_DAZED, DAZED_SECONDS);
        this.showFrame(this.sprites.dazed);
      }
    }

    /** Second hit reaction: dizzy, shuddering side to side (staying upright). */
    updateDazed(deltaSeconds) {
      this.stateTimer -= deltaSeconds;
      this.shudderOffset = Math.sin(this.stateTimer * DAZED_SHUDDER_SPEED) * DAZED_SHUDDER_AMOUNT;

      if (this.stateTimer <= 0) {
        this.shudderOffset = 0;
        this.state = MushroomState.PATROL;
      }
    }

    /** Swell slightly while flashing white, then explode. */
    updateDefeated(deltaSeconds) {
      this.stateTimer -= deltaSeconds;
      const swell = 1 + (DEATH_FLASH_SECONDS - Math.max(0, this.stateTimer)) * DEATH_SWELL_RATE;
      this.mesh.scale.set(this.facing * swell, swell, 1);

      if (this.stateTimer <= 0) {
        this.explode();
      }
    }

    /** Shatter into pixel debris with a flash, shockwaves and lingering poison smoke. */
    explode() {
      this.isGone = true;
      this.scene.remove(this.mesh);

      const centerX = this.x;
      const centerY = this.centerY;

      this.effects.shatterSprite(MushroomArt.squash, centerX, centerY, UNITS_PER_PIXEL);
      this.effects.spawnDisc({ color: '#fff4c2', x: centerX, y: centerY, fromScale: 0.6, toScale: 2.4, lifetime: 0.12, z: 0.62 });
      this.effects.spawnRing({ color: '#ffd166', x: centerX, y: centerY, fromScale: 0.4, toScale: 3.6, lifetime: 0.32, z: 0.61 });
      this.effects.spawnRing({ color: SPORE_PURPLE, x: centerX, y: centerY, fromScale: 0.3, toScale: 2.6, lifetime: 0.5, z: 0.6 });

      for (let i = 0; i < 6; i++) {
        this.effects.spawnDisc({
          color: i % 2 ? '#4a2d55' : '#6b4a72',
          x: centerX + (Math.random() - 0.5) * 1.2,
          y: centerY + (Math.random() - 0.3) * 0.8,
          fromScale: 0.3,
          toScale: randomBetween(1.0, 1.6),
          lifetime: randomBetween(0.7, 1.1),
          z: 0.4,
          riseSpeed: randomBetween(0.6, 1.2),
          opacity: 0.55
        });
      }

      this.particles.burst(centerX, centerY, 16, SPORE_PURPLE, 2.2, 0.8);
      this.particles.burst(centerX, centerY, 10, POISON_YELLOW, 1.8, 0.6);

      Sfx.mushroomExplosion();
      Sfx.mushroomDefeated();
      this.cameraController.shake(0.16, 0.3);
    }

    /** Remove from the scene without any effects (used on restart). */
    remove() {
      this.isGone = true;
      this.scene.remove(this.mesh);
    }

    // ==========================================
    // Helpers
    // ==========================================
    enterState(state, timer = 0) {
      this.state = state;
      this.stateTimer = timer;
    }

    showFrame(sprite) {
      setMeshSprite(this.mesh, sprite);
    }

    syncMesh() {
      // While defeated, updateDefeated controls the scale (swelling)
      if (this.state !== MushroomState.DEFEATED) {
        this.mesh.scale.x = this.facing;
      }
      this.mesh.position.set(this.x + this.shudderOffset, this.centerY, MESH_Z);
    }
  }

  Forest.EvilMushroom = EvilMushroom;
  Forest.MushroomState = MushroomState;
})(window.Forest);
