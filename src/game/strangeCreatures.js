/**
 * The creatures of the strange worlds, built on the same SkyCreature base as the original five:
 *   - Rainbow Spider: lowers itself on a silk thread instead of crashing down, scuttles about and
 *     pounces, and spits balls of sticky web that slow the boy down (raging, they hurt too)
 *   - Alien Crawler: skitters in quick bursts along the hull, rears up and spits acid
 *   - Octo-Rocker:   an octopus rock star that hops around the stage, shreds music notes at the
 *     boy and, raging, plays power chords that shake the floor
 *
 * They register themselves in Forest.SkyCreatures, so levels, training and bosses can use them by kind.
 */
(function (Forest) {
  const { PIXEL_SCALE } = Forest.Config;
  const { clamp, randomBetween, isBodyTouching } = Forest.MathUtils;
  const { removeMesh } = Forest.Graphics;
  const { CreatureState, SkyCreature } = Forest;
  const Sfx = Forest.SoundEffects;

  const WHITE = 0xffffff;
  const GRAVITY = 22;
  /** Low enough to jump over, like the Thornback. */
  const SMALL_BODY_BOX = { enemyHalfWidthRatio: 0.32, playerHalfWidthRatio: 0.25, topRatio: 0.8 };

  function directionTowards(fromX, toX) {
    return toX >= fromX ? 1 : -1;
  }

  /** Speed to jump from x to targetX with upward speed `jumpSpeed`, capped at maxSpeedX. */
  function leapSpeedX(fromX, targetX, jumpSpeed, maxSpeedX) {
    const airSeconds = (2 * jumpSpeed) / GRAVITY;
    return clamp((targetX - fromX) / airSeconds, -maxSpeedX, maxSpeedX);
  }

  // ==========================================
  // Rainbow Spider
  // ==========================================
  const SPIDER_DESCENT_SPEED = 3.2;
  const SPIDER_WALK_SPEED = 2.0;
  const SPIDER_POUNCE_RANGE = 4.5;
  const SPIDER_CROUCH_SECONDS = 0.45;
  const SPIDER_POUNCE_SPEED_Y = 6.5;
  const SPIDER_POUNCE_MAX_X = 5.5;
  const SPIDER_COOLDOWN_SECONDS = 1.6;
  const SPIDER_FRAME_SECONDS = 0.1;
  const SPIDER_THREAD_TOP = 14;
  /**
   * Every spider spits balls of sticky web at the boy when he's within range: a hit slows him
   * down for a while. Calm spiders spit now and then and their web only slows him; raging
   * ones spit faster and their web hurts too.
   */
  const SPIDER_WEB_INTERVAL = [3.2, 4.6];
  const SPIDER_RAGING_WEB_INTERVAL = 2.4;
  const SPIDER_WEB_RANGE = 9;
  /** Too close to bother spitting: it pounces instead. */
  const SPIDER_WEB_MIN_RANGE = 1.5;
  const SPIDER_WEB_FLIGHT_SECONDS = 0.9;
  const SPIDER_WEB_STICK = { seconds: 2.2, speedFactor: 0.4 };
  const SPIDER_ANGRY_TINT = 0xffb0f0;

  class RainbowSpider extends SkyCreature {
    constructor(world, options) {
      super(world, {
        ...options,
        kind: 'spider',
        spriteScale: 0.85,
        fallFrame: 'hang',
        colors: { main: '#2a1640', accent: '#ff4fd8' }
      });
      this.cooldown = 0.8;
      this.animationTimer = 0;
      this.webTimer = randomBetween(...SPIDER_WEB_INTERVAL);
      this.thread = null;
      if (this.state === CreatureState.FALLING) {
        // Lowers itself on a silk thread instead of crashing down
        this.thread = new THREE.Mesh(
          new THREE.PlaneGeometry(PIXEL_SCALE, 1),
          new THREE.MeshBasicMaterial({ color: 0xf4f0ff, transparent: true, opacity: 0.8, depthWrite: false })
        );
        this.scene.add(this.thread);
        this.syncThread();
      }
    }

    isTouching(player) {
      return isBodyTouching(player, this, SMALL_BODY_BOX);
    }

    updateFalling(deltaSeconds) {
      this.y = Math.max(this.floorY, this.y - SPIDER_DESCENT_SPEED * deltaSeconds);
      // Spins a little on the way down
      this.offsetX = Math.sin(this.y * 2) * 0.06;
      this.syncThread();
      if (this.y <= this.floorY) this.land();
    }

    land() {
      this.setSquash(1.2, 0.8);
      this.particles.burst(this.x, this.floorY + 0.1, 6, '#f4f0ff', 0.9, 0.3);
      Sfx.creatureLand();
      this.removeThread();
      this.showFrame('walk1');
      this.state = CreatureState.WALK;
    }

    syncThread() {
      if (!this.thread) return;
      const top = this.floorY + SPIDER_THREAD_TOP;
      const bottom = this.y + this.height * 0.85;
      const length = Math.max(0.01, top - bottom);
      this.thread.scale.set(1, length, 1);
      this.thread.position.set(this.x + this.offsetX, bottom + length / 2, 0.255);
    }

    removeThread() {
      if (!this.thread) return;
      removeMesh(this.scene, this.thread, { disposeGeometry: true });
      this.thread = null;
    }

    remove() {
      this.removeThread();
      super.remove();
    }

    /** Knocked off its thread by a hit mid-descent. */
    onHurt(knockbackDirection) {
      this.removeThread();
      super.onHurt(knockbackDirection);
    }

    think(deltaSeconds, player) {
      this.applyPhysics(deltaSeconds);
      this.cooldown -= deltaSeconds;

      switch (this.state) {
        case CreatureState.WALK: this.updateWalk(deltaSeconds, player); break;
        case CreatureState.TELEGRAPH: this.updateCrouch(player); break;
        case CreatureState.JUMP: break; // landing is handled in onTouchGround
      }
    }

    updateWalk(deltaSeconds, player) {
      const distance = Math.abs(player.x - this.x);
      this.facing = directionTowards(this.x, this.chaseX);
      if (Math.abs(this.chaseX - this.x) > 0.6) this.moveHorizontally(this.facing * SPIDER_WALK_SPEED * this.speed * deltaSeconds);
      this.animationTimer += deltaSeconds;
      if (this.animationTimer > SPIDER_FRAME_SECONDS) {
        this.animationTimer = 0;
        this.showFrame(this.frameName === 'walk1' ? 'walk2' : 'walk1');
      }

      this.updateWebSpitting(deltaSeconds, player, distance);

      if (this.cooldown <= 0 && this.isOnGround && !player.isDefeated && !this.isPatrolling && distance < SPIDER_POUNCE_RANGE * this.sizeScale) {
        this.state = CreatureState.TELEGRAPH;
        this.stateTimer = SPIDER_CROUCH_SECONDS / Math.sqrt(this.speed);
        this.showFrame('crouch');
        Sfx.beetleGrowl();
      }
    }

    /** Spits a ball of sticky web at the boy every few seconds while he's in range (see SPIDER_WEB_INTERVAL). */
    updateWebSpitting(deltaSeconds, player, distance) {
      if (player.isDefeated) return;
      this.webTimer -= deltaSeconds;
      const range = SPIDER_WEB_RANGE * Math.sqrt(this.sizeScale || 1);
      if (this.webTimer > 0 || distance > range || distance < SPIDER_WEB_MIN_RANGE) return;
      this.webTimer = this.isRaging ? SPIDER_RAGING_WEB_INTERVAL : randomBetween(...SPIDER_WEB_INTERVAL);
      // Aim at where his body will be, not his feet, so a web ball can't fly under a standing boy
      this.world.projectiles.launchFireball(this.x, this.y + this.height * 0.6, player.x, player.y + 0.4, SPIDER_WEB_FLIGHT_SECONDS,
        this.isRaging ? this.damage : 0,
        { sprite: this.world.sprites.webBall, trail: ['#ffffff', '#cfd8ff'], entangle: SPIDER_WEB_STICK });
      this.setSquash(1.15, 0.85);
      Sfx.fireballLaunch();
    }

    updateCrouch(player) {
      this.offsetX = Math.sin(this.stateTimer * 60) * 0.04;
      this.tint = Math.sin(this.stateTimer * 30) > 0 ? SPIDER_ANGRY_TINT : WHITE;
      if (this.stateTimer > 0) return;
      this.tint = WHITE;
      this.state = CreatureState.JUMP;
      this.showFrame('walk2');
      this.velocityY = SPIDER_POUNCE_SPEED_Y;
      this.velocityX = leapSpeedX(this.x, player.x, SPIDER_POUNCE_SPEED_Y, SPIDER_POUNCE_MAX_X * this.speed);
      this.setSquash(0.8, 1.25);
      Sfx.jump();
    }

    onTouchGround(impactSpeed) {
      super.onTouchGround(impactSpeed);
      if (this.state === CreatureState.JUMP) this.recover();
    }

    recover() {
      this.state = CreatureState.WALK;
      this.tint = WHITE;
      this.showFrame('walk1');
      this.cooldown = SPIDER_COOLDOWN_SECONDS * (this.isRaging ? 0.5 : 1);
    }
  }

  // ==========================================
  // Alien Crawler
  // ==========================================
  const CRAWLER_DASH_SPEED = 4.2;
  const CRAWLER_DASH_SECONDS = [0.35, 0.7];
  const CRAWLER_PAUSE_SECONDS = [0.15, 0.4];
  const CRAWLER_SPIT_RANGE = [2.5, 8];
  const CRAWLER_SPIT_COOLDOWN = 3.0;
  const CRAWLER_REAR_SECONDS = 0.5;
  const CRAWLER_FRAME_SECONDS = 0.06;
  const CRAWLER_ACID_TRAIL = ['#d4ff5a', '#8af03a', '#f4ffc0'];
  const CRAWLER_GLOW_TINT = 0xe0ffb0;

  class AlienCrawler extends SkyCreature {
    constructor(world, options) {
      super(world, {
        ...options,
        kind: 'crawler',
        spriteScale: 0.85,
        fallFrame: 'walk1',
        colors: { main: '#3f7a2a', accent: '#d4ff5a' }
      });
      this.spitCooldown = randomBetween(1, CRAWLER_SPIT_COOLDOWN);
      this.animationTimer = 0;
      this.isDashing = false;
    }

    isTouching(player) {
      return isBodyTouching(player, this, SMALL_BODY_BOX);
    }

    onLanded() {
      this.state = CreatureState.WALK;
      this.startDash(this.target);
    }

    startDash(player) {
      this.isDashing = true;
      this.stateTimer = randomBetween(...CRAWLER_DASH_SECONDS);
      // Mostly skitters towards the boy, sometimes darts the wrong way
      const towards = player ? directionTowards(this.x, this.chaseX) : this.facing;
      this.facing = Math.random() < 0.8 ? towards : -towards;
    }

    think(deltaSeconds, player) {
      this.applyPhysics(deltaSeconds);
      this.spitCooldown -= deltaSeconds;

      if (this.state === CreatureState.WALK) {
        if (this.isDashing) {
          const bumped = this.moveHorizontally(this.facing * CRAWLER_DASH_SPEED * this.speed * deltaSeconds);
          this.animationTimer += deltaSeconds;
          if (this.animationTimer > CRAWLER_FRAME_SECONDS) {
            this.animationTimer = 0;
            this.showFrame(this.frameName === 'walk1' ? 'walk2' : 'walk1');
          }
          if (bumped || this.stateTimer <= 0) {
            this.isDashing = false;
            this.stateTimer = randomBetween(...CRAWLER_PAUSE_SECONDS);
          }
        } else if (this.stateTimer <= 0) {
          const distance = Math.abs(player.x - this.x);
          const canSpit = this.spitCooldown <= 0 && !player.isDefeated && distance > CRAWLER_SPIT_RANGE[0] && distance < CRAWLER_SPIT_RANGE[1];
          if (canSpit) this.rearUp(player);
          else this.startDash(player);
        }
      } else if (this.state === CreatureState.THROW) {
        this.tint = Math.sin(this.stateTimer * 40) > 0 ? CRAWLER_GLOW_TINT : WHITE;
        if (this.stateTimer <= 0) this.spit(player);
      }
    }

    rearUp(player) {
      this.state = CreatureState.THROW;
      this.stateTimer = CRAWLER_REAR_SECONDS / Math.sqrt(this.speed);
      this.facing = directionTowards(this.x, player.x);
      this.showFrame('rear');
      this.setSquash(0.9, 1.15);
      Sfx.beetleGrowl();
    }

    spit(player) {
      const shots = this.isRaging ? 3 : 1;
      for (let i = 0; i < shots; i++) {
        const targetX = player.x + (i - (shots - 1) / 2) * 1.4;
        this.world.projectiles.launchFireball(this.x + this.facing * this.width * 0.4, this.y + this.height * 0.6, targetX, this.floorY + 0.3, 0.85, this.damage,
          { tint: 0xc8ff90, trail: CRAWLER_ACID_TRAIL });
      }
      Sfx.fireballLaunch();
      this.tint = WHITE;
      this.state = CreatureState.WALK;
      this.showFrame('walk1');
      this.spitCooldown = CRAWLER_SPIT_COOLDOWN * (this.isRaging ? 0.5 : 1);
      this.isDashing = false;
      this.stateTimer = 0.3;
    }

    recover() {
      this.state = CreatureState.WALK;
      this.tint = WHITE;
      this.showFrame('walk1');
      this.isDashing = false;
      this.stateTimer = 0.2;
    }
  }

  // ==========================================
  // Octo-Rocker
  // ==========================================
  const OCTO_HOP_SPEED_Y = 7;
  const OCTO_HOP_MAX_X = 3.5;
  const OCTO_REST_SECONDS = [0.6, 1.1];
  const OCTO_SOLO_SECONDS = 0.9;
  const OCTO_NOTES_PER_SOLO = 3;
  const OCTO_STRUM_FRAME_SECONDS = 0.09;
  const OCTO_CHORD_RADIUS = 2.6;
  const OCTO_NOTE_TRAILS = [['#ffe14d', '#fff7b3'], ['#ff4fd8', '#ffc0f0'], ['#4fe8ff', '#c0f8ff'], ['#7dff6a', '#d8ffcc']];

  class OctoRocker extends SkyCreature {
    constructor(world, options) {
      super(world, {
        ...options,
        kind: 'octorocker',
        spriteScale: 0.8,
        fallFrame: 'jump',
        colors: { main: '#d23c8a', accent: '#4fe8ff' }
      });
      this.hopsUntilSolo = 2;
      this.animationTimer = 0;
      this.notesLeft = 0;
    }

    onLanded() {
      this.rest();
      this.cameraController.shake(0.06, 0.12);
    }

    rest() {
      this.state = CreatureState.IDLE;
      this.stateTimer = randomBetween(...OCTO_REST_SECONDS) / this.speed;
      this.showFrame('stand');
    }

    think(deltaSeconds, player) {
      this.applyPhysics(deltaSeconds);
      switch (this.state) {
        case CreatureState.IDLE:
          // Head-banging while it waits
          this.offsetY = Math.abs(Math.sin(this.stateTimer * 12)) * 0.06;
          if (this.stateTimer <= 0 && !player.isDefeated) {
            if (this.hopsUntilSolo <= 0) this.startSolo(player);
            else this.hopAt(player);
          }
          break;
        case CreatureState.THROW:
          this.updateSolo(deltaSeconds, player);
          break;
        case CreatureState.JUMP:
          break; // landing is handled in onTouchGround
      }
    }

    hopAt(player) {
      this.hopsUntilSolo--;
      this.offsetY = 0;
      this.state = CreatureState.JUMP;
      this.showFrame('jump');
      this.velocityY = OCTO_HOP_SPEED_Y;
      const targetX = this.chaseX + randomBetween(-2, 2);
      this.velocityX = leapSpeedX(this.x, targetX, OCTO_HOP_SPEED_Y, OCTO_HOP_MAX_X * this.speed);
      this.facing = directionTowards(this.x, targetX);
      this.setSquash(0.8, 1.2);
      Sfx.jellyBoing();
    }

    startSolo(player) {
      this.state = CreatureState.THROW;
      this.offsetY = 0;
      this.facing = directionTowards(this.x, player.x);
      this.notesLeft = OCTO_NOTES_PER_SOLO + (this.isRaging ? 2 : 0);
      this.stateTimer = OCTO_SOLO_SECONDS / this.notesLeft;
      this.hopsUntilSolo = 2;
    }

    updateSolo(deltaSeconds, player) {
      this.animationTimer += deltaSeconds;
      if (this.animationTimer > OCTO_STRUM_FRAME_SECONDS) {
        this.animationTimer = 0;
        this.showFrame(this.frameName === 'strum' ? 'stand' : 'strum');
      }
      if (this.stateTimer > 0) return;
      // Shred: each note arcs at the boy from a slightly different angle
      const trail = OCTO_NOTE_TRAILS[this.notesLeft % OCTO_NOTE_TRAILS.length];
      const targetX = player.x + randomBetween(-1.5, 1.5);
      this.world.projectiles.launchFireball(this.x, this.y + this.height * 0.55, targetX, this.floorY + 0.3, randomBetween(0.8, 1.2), this.damage,
        { sprite: this.world.sprites.musicNote, trail });
      Sfx.coin();
      this.notesLeft--;
      this.stateTimer = OCTO_SOLO_SECONDS / (OCTO_NOTES_PER_SOLO + 1);
      if (this.notesLeft <= 0) {
        if (this.isRaging) this.powerChord();
        this.rest();
      }
    }

    /** Raging: a power chord that shakes the stage (only hurts if the boy is on the floor nearby). */
    powerChord() {
      const radius = OCTO_CHORD_RADIUS * Math.sqrt(this.sizeScale);
      this.effects.spawnRing({ color: '#ff4fd8', x: this.x, y: this.floorY + 0.15, fromScale: 0.4, toScale: radius * 2, lifetime: 0.3 });
      this.effects.spawnRing({ color: '#4fe8ff', x: this.x, y: this.floorY + 0.15, fromScale: 0.3, toScale: radius * 1.4, lifetime: 0.4 });
      this.cameraController.shake(0.12, 0.25);
      Sfx.golemStep();
      const player = this.target;
      if (player && Math.abs(player.y - this.floorY) < 0.25 && Math.abs(player.x - this.x) < radius) {
        player.takeDamage(this.damage, this.x);
      }
    }

    onTouchGround(impactSpeed) {
      super.onTouchGround(impactSpeed);
      if (this.state === CreatureState.JUMP) {
        this.particles.burst(this.x, this.floorY + 0.1, 6, '#ff4fd8', 1.0, 0.3);
        this.rest();
      }
    }

    recover() {
      this.tint = WHITE;
      this.rest();
    }
  }

  Object.assign(Forest.SkyCreatures, { spider: RainbowSpider, crawler: AlienCrawler, octorocker: OctoRocker });
})(window.Forest);
