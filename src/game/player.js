/**
 * The boy: movement, double jump, overhead sword slam, taking damage, and his animation state machine.
 */
(function (Forest) {
  const { PIXEL_SCALE, GROUND_Y, LEVEL_START_X, LEVEL_END_X } = Forest.Config;
  const { createSpriteMesh, setMeshSprite } = Forest.Graphics;
  const { clamp, easeOutQuad } = Forest.MathUtils;
  const { FRAME_SIZE, SLAM_CANVAS_SIZE, SLAM_BODY_ORIGIN } = Forest.BoySprites;
  const Sfx = Forest.SoundEffects;

  const PlayerState = Object.freeze({
    IDLE: 'IDLE',
    WALK: 'WALK',
    JUMP: 'JUMP',
    DOUBLE_JUMP: 'DOUBLE_JUMP',
    FALL: 'FALL',
    LAND: 'LAND',
    ATTACK: 'ATTACK',
    AIR_ATTACK: 'AIR_ATTACK',
    HIT_RECOIL: 'HIT_RECOIL',
    HIT_STAGGER: 'HIT_STAGGER',
    DEFEATED: 'DEFEATED'
  });

  // --- Size ---
  const SPRITE_SCALE = 0.85;
  const UNITS_PER_PIXEL = PIXEL_SCALE * SPRITE_SCALE;
  const MESH_Z = 0.3;

  // --- Health ---
  /** Default hearts; the difficulty level normally decides (see reset). */
  const MAX_HP = 5;
  const INVULNERABLE_SECONDS = 1.2;

  // --- Movement (units per second) ---
  const WALK_SPEED = 5.2;
  const AIR_SPEED = 4.6;
  const IDLE_FRICTION = 0.75;
  const AIR_DRAG = 0.94;
  const LANDING_FRICTION = 0.7;
  const STAGGER_FRICTION = 0.85;
  const DEFEATED_FRICTION = 0.88;

  // --- Jumping ---
  const GRAVITY = 25.0;
  const JUMP_SPEED = 9.2;
  const DOUBLE_JUMP_SPEED = 9.2;
  /** Upward speed kept when jump is released early (variable jump height). */
  const JUMP_CUT_SPEED = 3.5;
  const MAX_JUMPS = 2;
  /** A jump pressed this long before landing still fires on touchdown. */
  const JUMP_BUFFER_SECONDS = 0.12;
  /** Counts as standing on the ground when this close to it. */
  /** Half the width of his feet: he still stands on a ledge with this much of him over the edge. */
  const FOOT_HALF_WIDTH = 0.22;
  /** Just after walking off a ledge, a jump still counts as jumping from the ground. */
  const COYOTE_SECONDS = 0.1;
  /** Respawn points (after falling in a pit) are at least this far from the edge of the ground. */
  const SAFE_EDGE_DISTANCE = 1.0;
  /** Blinking, untouchable time after climbing back out of a pit. */
  const PIT_RESPAWN_INVULNERABLE_SECONDS = 1.6;

  // --- World rules (see the `physics` of each level) ---
  /** On ice he speeds up and slows down gradually: how quickly he reaches the speed he wants. */
  const ICE_ACCELERATION = 2.2;
  /** Speed kept per frame when sliding on ice with no button held. */
  const ICE_FRICTION = 0.985;
  /** Upward speed from landing on a bouncy (marshmallow) platform. */
  const BOUNCE_SPEED = 15;
  /** One full somersault, finishing exactly at the apex of the double jump. */
  const SOMERSAULT_SECONDS = DOUBLE_JUMP_SPEED / GRAVITY;
  const LANDING_SECONDS = 0.09;
  /** Landing at this downward speed (or faster) gives the maximum squash. */
  const HARD_LANDING_SPEED = 12;
  /** Vertical speed thresholds for choosing rise / apex / fall poses. */
  const APEX_SPEED_RANGE = 3;

  // --- Animation timing (seconds per frame) ---
  const IDLE_FRAME_SECONDS = 0.45;
  const WALK_FRAME_SECONDS = 0.08;
  const SQUASH_RECOVERY_RATE = 12;
  /** Turning around on the ground: he only changes profile for this long before walking off. */
  const TURN_PAUSE_SECONDS = 0.12;
  /** Turning around mid-air: shorter, so steering back during a jump still feels responsive. */
  const AIR_TURN_PAUSE_SECONDS = 0.06;

  // --- Getting hit ---
  const HIT_RECOIL_SECONDS = 0.22;
  const HIT_STAGGER_SECONDS = 0.28;
  const RECOIL_FLASH_RATE = 20;
  const INVULNERABLE_BLINK_RATE = 35;

  // --- Slam hit area, relative to the boy ---
  const SLAM_REACH_X = 1.15;
  const SLAM_HEIGHT_RATIO = 0.6;
  const SLAM_HALF_WIDTH = 1.5;
  const SLAM_HALF_HEIGHT = 1.4;

  // --- Air slash hit area: a horizontal band in front of the boy at chest height ---
  const AIR_SLASH_REACH_X = 1.1;
  const AIR_SLASH_HEIGHT_RATIO = 0.55;
  const AIR_SLASH_HALF_WIDTH = 1.2;
  const AIR_SLASH_HALF_HEIGHT = 0.9;

  // --- Particle colours ---
  const GRASS_DUST = '#4fb835';

  /** Index of the frame showing at `elapsed` seconds, or frames.length when the animation is over. */
  function frameIndexAt(frames, elapsed) {
    let remaining = elapsed;
    let index = 0;
    while (index < frames.length && remaining >= frames[index].duration) {
      remaining -= frames[index].duration;
      index++;
    }
    return index;
  }

  class Player {
    /**
     * @param {object} world shared game systems
     * @param {THREE.Scene} world.scene
     * @param {object} world.sprites result of Forest.loadGameSprites()
     * @param {Forest.InputController} world.input
     * @param {Forest.ParticleSystem} world.particles
     * @param {Forest.EffectsSystem} world.effects
     * @param {Forest.CameraController} world.cameraController
     * @param {object} events
     * @param {(hp:number) => void} events.onHealthChanged
     * @param {() => void} events.onDefeated
     * @param {(hitArea:{centerX, centerY, halfWidth, halfHeight}) => void} events.onSlamLanded
     */
    constructor(world, events) {
      this.world = world;
      this.sprites = world.sprites.boy;
      this.input = world.input;
      this.particles = world.particles;
      this.effects = world.effects;
      this.cameraController = world.cameraController;
      this.events = events;

      this.maxHp = MAX_HP;
      this.minX = LEVEL_START_X;
      this.maxX = LEVEL_END_X;
      this.width = this.sprites.idle[0].width * UNITS_PER_PIXEL;
      this.height = this.sprites.idle[0].height * UNITS_PER_PIXEL;

      // Regular 24x24 frames
      this.bodyMesh = createSpriteMesh(this.sprites.idle[0], UNITS_PER_PIXEL);
      world.scene.add(this.bodyMesh);

      // Separate, larger mesh for the overhead slam (the sword reaches well outside the 24x24 box)
      this.slamMesh = createSpriteMesh(this.sprites.slam[0], UNITS_PER_PIXEL);
      this.slamMesh.visible = false;
      world.scene.add(this.slamMesh);

      // Offset from the centre of the body box to the centre of the slam canvas (facing right)
      this.slamMeshOffset = {
        x: (SLAM_CANVAS_SIZE.width / 2 - (SLAM_BODY_ORIGIN.x + FRAME_SIZE / 2)) * UNITS_PER_PIXEL,
        y: -(SLAM_CANVAS_SIZE.height / 2 - (SLAM_BODY_ORIGIN.y + FRAME_SIZE / 2)) * UNITS_PER_PIXEL
      };
    }

    /** Put the boy back at full health (`maxHp` hearts), standing at `x`. */
    reset(x, maxHp = MAX_HP) {
      this.x = x;
      this.y = GROUND_Y;
      this.velocityX = 0;
      this.velocityY = 0;
      this.facing = 1; // 1 = right, -1 = left
      this.isGrounded = true;
      this.coyoteSeconds = 0;
      /** Last spot safely on solid ground, where he comes back after falling in a pit. */
      this.safeX = x;
      this.safeY = GROUND_Y;
      this.turnSeconds = 0;
      this.scaleX = 1; // squash & stretch
      this.scaleY = 1;

      this.maxHp = maxHp;
      this.hp = maxHp;
      this.jumpsRemaining = MAX_JUMPS;
      this.jumpBufferSeconds = 0;
      this.invulnerableSeconds = 0;

      this.state = PlayerState.IDLE;
      this.stateTimer = 0;
      this.animationFrame = 0;
      this.animationTimer = 0;

      this.bodyMesh.rotation.z = 0;
      this.showFrame(this.sprites.idle[0]);
      this.syncMeshes();
    }

    // ==========================================
    // State queries
    // ==========================================
    get isDefeated() {
      return this.state === PlayerState.DEFEATED;
    }

    /** True while knocked back or defeated: the boy ignores jump/attack input. */
    get isIncapacitated() {
      return this.state === PlayerState.DEFEATED
        || this.state === PlayerState.HIT_RECOIL
        || this.state === PlayerState.HIT_STAGGER;
    }

    get isAirborne() {
      return this.state === PlayerState.JUMP
        || this.state === PlayerState.DOUBLE_JUMP
        || this.state === PlayerState.FALL
        || this.state === PlayerState.AIR_ATTACK;
    }

    /** True while either sword attack is playing (the big sword mesh is shown). */
    get isAttacking() {
      return this.state === PlayerState.ATTACK || this.state === PlayerState.AIR_ATTACK;
    }

    get isAboveGround() {
      return this.y > GROUND_Y;
    }

    // ==========================================
    // Actions triggered by input
    // ==========================================
    tryJump() {
      if (this.isIncapacitated) return;

      if (this.isGrounded || this.coyoteSeconds > 0) {
        this.jumpFromGround();
      } else if (this.jumpsRemaining > 0) {
        this.doubleJump();
      } else {
        // Out of jumps: remember the press briefly so it fires on landing
        this.jumpBufferSeconds = JUMP_BUFFER_SECONDS;
      }
    }

    /** Releasing jump early cuts the climb short. */
    releaseJump() {
      const isRising = this.state === PlayerState.JUMP || this.state === PlayerState.DOUBLE_JUMP;
      if (isRising && this.velocityY > JUMP_CUT_SPEED) {
        this.velocityY = JUMP_CUT_SPEED;
      }
    }

    /** Overhead slam on the ground; a quick horizontal slash in the air. */
    startAttack() {
      if (this.isIncapacitated || this.isAttacking) return;

      this.enterState(this.isGrounded ? PlayerState.ATTACK : PlayerState.AIR_ATTACK);
      this.animationFrame = 0;
      this.bodyMesh.rotation.z = 0;
      this.showAttackFrame(0);
      // The swoosh plays on the swing frame, not on the button press
    }

    jumpFromGround() {
      this.velocityY = JUMP_SPEED;
      this.isGrounded = false;
      this.coyoteSeconds = 0;
      this.jumpsRemaining = MAX_JUMPS - 1;
      this.jumpBufferSeconds = 0;
      this.bodyMesh.rotation.z = 0;
      this.state = PlayerState.JUMP;
      this.showFrame(this.sprites.jumpRise);
      this.setSquash(0.82, 1.2); // stretch on take-off
      Sfx.jump();
      this.particles.burst(this.x, this.y + 0.1, 5, GRASS_DUST, 0.6, 0.3);
    }

    doubleJump() {
      this.velocityY = DOUBLE_JUMP_SPEED;
      this.jumpsRemaining = 0;
      this.bodyMesh.rotation.z = 0;
      this.enterState(PlayerState.DOUBLE_JUMP);
      this.showFrame(this.sprites.jumpSpin);
      this.setSquash(0.86, 1.14);
      Sfx.doubleJump();
      this.particles.burst(this.x, this.y + 0.2, 8, '#86d66e', 1.3, 0.35); // leaves
      this.particles.burst(this.x, this.y + 0.2, 6, '#bae6fd', 0.9, 0.25); // air sparks
    }

    /**
     * Lose health and get knocked away from the attacker.
     * Ignored while invulnerable (just hit) or already defeated.
     */
    takeDamage(amount, attackerX) {
      if (this.invulnerableSeconds > 0 || this.isDefeated) return;

      this.hp = Math.max(0, this.hp - amount);
      Sfx.playerHurt();

      const knockbackDirection = this.x < attackerX ? -1 : 1;
      this.facing = -knockbackDirection; // turn to face the attacker in surprise
      this.bodyMesh.rotation.z = 0;

      if (this.hp <= 0) {
        this.enterState(PlayerState.DEFEATED);
        this.velocityX = knockbackDirection * 2.0;
        this.velocityY = 4.0;
        this.showFrame(this.sprites.defeated);
        this.particles.burst(this.x, this.y + 0.8, 12, '#ff595e', 1.2, 0.7);
      } else {
        this.enterState(PlayerState.HIT_RECOIL, HIT_RECOIL_SECONDS);
        this.invulnerableSeconds = INVULNERABLE_SECONDS;
        this.velocityX = knockbackDirection * 4.5;
        this.velocityY = 4.2;
        this.showFrame(this.sprites.hitRecoilFlash);
        this.particles.burst(this.x, this.y + 0.8, 8, '#fcd5b5', 1.0, 0.5);
      }

      this.events.onHealthChanged(this.hp);
      if (this.hp <= 0) this.events.onDefeated();
    }

    /**
     * Fell into a pit: lose a heart and climb back out at the last safe spot, or be defeated.
     */
    fallIntoPit() {
      if (this.isDefeated) return;
      this.hp = Math.max(0, this.hp - 1);
      Sfx.pitFall();
      if (this.hp <= 0) {
        this.enterState(PlayerState.DEFEATED);
        this.velocityX = 0;
        this.events.onHealthChanged(this.hp);
        this.events.onDefeated();
        return;
      }
      this.x = this.safeX;
      this.y = this.safeY;
      this.velocityX = 0;
      this.velocityY = 0;
      this.isGrounded = true;
      this.jumpsRemaining = MAX_JUMPS;
      this.bodyMesh.rotation.z = 0;
      this.enterState(PlayerState.IDLE);
      this.showFrame(this.sprites.idle[0]);
      this.invulnerableSeconds = PIT_RESPAWN_INVULNERABLE_SECONDS;
      this.particles.burst(this.x, this.y + 0.6, 12, '#bae6fd', 1.0, 0.5);
      this.events.onHealthChanged(this.hp);
    }

    /** Horizontal limits he can walk between (the level, or the boss arena once it's locked). */
    setBounds(minX, maxX) {
      this.minX = minX;
      this.maxX = maxX;
    }

    /** Restore health (never above the maximum). Does nothing once defeated. */
    heal(amount) {
      if (this.isDefeated || this.hp >= this.maxHp) return;
      this.hp = Math.min(this.maxHp, this.hp + amount);
      Sfx.heal();
      this.particles.burst(this.x, this.y + this.height * 0.6, 12, '#ff6b6b', 1.0, 0.7);
      this.particles.burst(this.x, this.y + this.height * 0.6, 8, '#86efac', 0.8, 0.6);
      this.events.onHealthChanged(this.hp);
    }

    /** Grant extra heart containers, up to `cap`, and fill them up. */
    raiseMaxHp(amount, cap) {
      if (this.isDefeated) return;
      this.maxHp = Math.min(cap, this.maxHp + amount);
      this.heal(this.maxHp);
    }

    // ==========================================
    // Per-frame update
    // ==========================================
    update(deltaSeconds) {
      const previousY = this.y;
      this.applyGravity(deltaSeconds);
      if (this.jumpBufferSeconds > 0) this.jumpBufferSeconds -= deltaSeconds;
      if (this.coyoteSeconds > 0) this.coyoteSeconds -= deltaSeconds;
      this.resolveGround(previousY);

      this.updateInvulnerability(deltaSeconds);
      this.updateState(deltaSeconds);

      this.x = clamp(this.x, this.minX, this.maxX);
      this.relaxSquash(deltaSeconds);
      this.syncMeshes();
    }

    /** The current level's rules: gravity scale, slippery ground, wind. */
    get physics() {
      return this.world.levelPhysics || {};
    }

    applyGravity(deltaSeconds) {
      this.velocityY -= GRAVITY * (this.physics.gravityScale || 1) * deltaSeconds;
      this.y += this.velocityY * deltaSeconds;
      // Gusts push him about while he's in the air
      if (this.physics.windSpeed && !this.isDefeated && !this.isGrounded) this.x += this.physics.windSpeed * deltaSeconds;
    }

    /**
     * Land on whatever is under his feet (ground or a platform he came down onto), or start
     * falling when he walks off an edge.
     */
    resolveGround(previousY) {
      const terrain = this.world.terrain;
      const surface = terrain
        ? terrain.surfaceBelow(this.x, previousY, FOOT_HALF_WIDTH)
        : { top: GROUND_Y, isGround: true, left: -Infinity, right: Infinity };
      if (surface && this.velocityY <= 0 && this.y <= surface.top) {
        this.touchGround(surface);
        return;
      }
      if (!this.isGrounded) return;
      // Walked off a ledge
      this.isGrounded = false;
      if (this.velocityY <= 0) this.coyoteSeconds = COYOTE_SECONDS;
      if (this.state === PlayerState.IDLE || this.state === PlayerState.WALK || this.state === PlayerState.LAND) {
        this.state = PlayerState.FALL;
        this.showFrame(this.sprites.fall);
      }
    }

    touchGround(surface) {
      const impactSpeed = -this.velocityY;
      this.y = surface.top;
      this.velocityY = 0;
      this.isGrounded = true;
      this.coyoteSeconds = 0;
      const isSafeSpot = surface.isGround
        && this.x - surface.left >= SAFE_EDGE_DISTANCE && surface.right - this.x >= SAFE_EDGE_DISTANCE;
      if (isSafeSpot) {
        this.safeX = this.x;
        this.safeY = surface.top;
      }
      if (surface.isBouncy && !this.isDefeated) {
        this.bounce();
        return;
      }
      this.jumpsRemaining = MAX_JUMPS;
      this.bodyMesh.rotation.z = 0;
      if (this.isAirborne) this.land(impactSpeed);
    }

    /** A marshmallow pad flings him high into the air (and gives his double jump back). */
    bounce() {
      this.velocityY = BOUNCE_SPEED;
      this.isGrounded = false;
      this.jumpsRemaining = MAX_JUMPS - 1;
      this.bodyMesh.rotation.z = 0;
      if (!this.isIncapacitated) {
        this.enterState(PlayerState.JUMP);
        this.showFrame(this.sprites.jumpRise);
      }
      this.setSquash(0.75, 1.3);
      Sfx.bounce();
      this.particles.burst(this.x, this.y + 0.1, 8, '#ffd1e6', 1.0, 0.35);
    }

    /** Brief landing crouch; harder landings squash more and kick up more dust. */
    land(impactSpeed) {
      this.enterState(PlayerState.LAND, LANDING_SECONDS);
      this.showFrame(this.sprites.crouch);

      const hardness = Math.min(1, impactSpeed / HARD_LANDING_SPEED);
      this.setSquash(1 + 0.25 * hardness, 1 - 0.22 * hardness);
      this.particles.burst(this.x, this.y + 0.1, 3 + Math.round(5 * hardness), GRASS_DUST, 0.5 + 0.6 * hardness, 0.25);

      if (this.jumpBufferSeconds > 0) this.tryJump(); // buffered jump fires right away
    }

    /** Blink while invulnerable after being hit. */
    updateInvulnerability(deltaSeconds) {
      if (this.invulnerableSeconds > 0) {
        this.invulnerableSeconds -= deltaSeconds;
        const isBlinkOff = Math.sin(this.invulnerableSeconds * INVULNERABLE_BLINK_RATE) > 0;
        this.bodyMesh.material.opacity = isBlinkOff ? 0.3 : 1.0;
      } else {
        this.bodyMesh.material.opacity = 1.0;
      }
    }

    updateState(deltaSeconds) {
      switch (this.state) {
        case PlayerState.IDLE: this.updateIdle(deltaSeconds); break;
        case PlayerState.WALK: this.updateWalk(deltaSeconds); break;
        case PlayerState.JUMP:
        case PlayerState.DOUBLE_JUMP:
        case PlayerState.FALL: this.updateAirborne(deltaSeconds); break;
        case PlayerState.LAND: this.updateLanding(deltaSeconds); break;
        case PlayerState.ATTACK: this.updateAttack(deltaSeconds); break;
        case PlayerState.AIR_ATTACK: this.updateAirSlash(deltaSeconds); break;
        case PlayerState.HIT_RECOIL: this.updateHitRecoil(deltaSeconds); break;
        case PlayerState.HIT_STAGGER: this.updateHitStagger(deltaSeconds); break;
        case PlayerState.DEFEATED: this.updateDefeated(deltaSeconds); break;
      }
    }

    updateIdle(deltaSeconds) {
      this.slideWithFriction(this.physics.slippery ? ICE_FRICTION : IDLE_FRICTION, deltaSeconds);

      if (this.input.isPressingLeftOrRight()) {
        this.state = PlayerState.WALK;
        return;
      }
      this.advanceLoopingAnimation(this.sprites.idle, IDLE_FRAME_SECONDS, deltaSeconds); // gentle breathing
    }

    updateWalk(deltaSeconds) {
      const direction = this.input.horizontalDirection();
      if (direction === 0) {
        this.state = PlayerState.IDLE;
        this.turnSeconds = 0;
        this.showFrame(this.sprites.idle[0]);
        return;
      }

      // On ice he can't stop dead or turn on the spot: he skids towards the speed he wants
      if (this.physics.slippery) {
        this.facing = direction;
        const blend = Math.min(1, ICE_ACCELERATION * deltaSeconds);
        this.velocityX += (direction * WALK_SPEED - this.velocityX) * blend;
        this.x += this.velocityX * deltaSeconds;
        this.advanceLoopingAnimation(this.sprites.walk, WALK_FRAME_SECONDS, deltaSeconds);
        return;
      }

      // Turning around: flip the profile first and stay put for a moment, so a tap only turns him
      if (direction !== this.facing) {
        this.facing = direction;
        this.turnSeconds = TURN_PAUSE_SECONDS;
        this.velocityX = 0;
        this.showFrame(this.sprites.idle[0]);
      }
      if (this.turnSeconds > 0) {
        this.turnSeconds -= deltaSeconds;
        return;
      }

      this.velocityX = direction * WALK_SPEED;
      this.x += this.velocityX * deltaSeconds;
      this.advanceLoopingAnimation(this.sprites.walk, WALK_FRAME_SECONDS, deltaSeconds);
    }

    /** Steer left/right while in the air. */
    applyAirControl(deltaSeconds, canTurn = true) {
      const direction = this.input.horizontalDirection();
      // Turning around mid-air: flip the profile first and hang in place sideways for a moment
      if (canTurn && direction !== 0 && direction !== this.facing) {
        this.facing = direction;
        this.turnSeconds = AIR_TURN_PAUSE_SECONDS;
        this.velocityX = 0;
      }
      if (this.turnSeconds > 0) {
        this.turnSeconds -= deltaSeconds;
        if (direction === 0) this.turnSeconds = 0;
        return; // gravity still pulls him down; only sideways motion pauses
      }

      if (direction !== 0) {
        if (canTurn) this.facing = direction;
        this.velocityX = direction * AIR_SPEED;
      } else {
        this.velocityX *= AIR_DRAG;
      }
      this.x += this.velocityX * deltaSeconds;
    }

    updateAirborne(deltaSeconds) {
      this.applyAirControl(deltaSeconds);

      if (this.state === PlayerState.DOUBLE_JUMP) {
        this.updateSomersault(deltaSeconds);
        return;
      }

      // Pick the pose from vertical speed: rise -> apex tuck -> fall
      if (this.velocityY > APEX_SPEED_RANGE) {
        this.showFrame(this.sprites.jumpRise);
      } else if (this.velocityY > -APEX_SPEED_RANGE) {
        this.showFrame(this.sprites.jumpApex);
      } else {
        this.showFrame(this.sprites.fall);
      }
      if (this.velocityY < 0 && this.state === PlayerState.JUMP) {
        this.state = PlayerState.FALL;
      }
    }

    /** Exactly one forward somersault in a tucked ball, ending upright at the apex. */
    updateSomersault(deltaSeconds) {
      this.stateTimer += deltaSeconds;
      const progress = Math.min(1, this.stateTimer / SOMERSAULT_SECONDS);
      this.bodyMesh.rotation.z = -this.facing * easeOutQuad(progress) * Math.PI * 2;
      if (progress >= 1) {
        this.bodyMesh.rotation.z = 0;
        this.state = PlayerState.FALL;
      }
    }

    updateLanding(deltaSeconds) {
      this.slideWithFriction(this.physics.slippery ? ICE_FRICTION : LANDING_FRICTION, deltaSeconds);
      this.stateTimer -= deltaSeconds;
      if (this.stateTimer <= 0) {
        this.state = this.input.isPressingLeftOrRight() ? PlayerState.WALK : PlayerState.IDLE;
        this.showFrame(this.sprites.idle[0]);
      }
    }

    /** Overhead slam: snap up -> brief wind-up -> fast downswing -> IMPACT -> recover. */
    updateAttack(deltaSeconds) {
      this.velocityX = 0; // feet stay planted: the sword is heavy
      this.advanceAttackAnimation(deltaSeconds, frame => this.landSlam(frame));
    }

    /** Mid-air slash: keeps the jump's momentum and air steering, but can't turn around mid-swing. */
    updateAirSlash(deltaSeconds) {
      this.applyAirControl(deltaSeconds, false);
      this.advanceAttackAnimation(deltaSeconds, frame => this.landAirSlash(frame));
    }

    /** Step the current attack's frames, firing the swoosh and the hit on their frames. */
    advanceAttackAnimation(deltaSeconds, onImpact) {
      this.stateTimer += deltaSeconds;
      const frames = this.currentAttackFrames();
      const frameIndex = frameIndexAt(frames, this.stateTimer);

      // Fire events for every frame entered this tick (at low frame rates short frames can be skipped)
      const lastEnteredFrame = Math.min(frameIndex, frames.length - 1);
      for (let i = this.animationFrame + 1; i <= lastEnteredFrame; i++) {
        if (frames[i].playsSwoosh) Sfx.swordSwing();
        if (frames[i].isImpact) onImpact(frames[i]);
      }

      if (frameIndex >= frames.length) {
        this.finishAttack();
        return;
      }
      if (frameIndex !== this.animationFrame) {
        this.animationFrame = frameIndex;
        this.showAttackFrame(frameIndex);
      }
    }

    /** The level blade sweeps through the air in front of him. */
    landAirSlash(frame) {
      const tipX = this.x + this.facing * (frame.bladeTip.x - FRAME_SIZE / 2) * UNITS_PER_PIXEL;
      const tipY = this.y + (FRAME_SIZE - frame.bladeTip.y) * UNITS_PER_PIXEL;
      this.particles.burst(tipX, tipY, 5, '#ffeaa7', 0.9, 0.2); // slash sparkle
      this.events.onSlamLanded(this.getAirSlashHitArea());
    }

    getAirSlashHitArea() {
      return {
        centerX: this.x + this.facing * AIR_SLASH_REACH_X,
        centerY: this.y + this.height * AIR_SLASH_HEIGHT_RATIO,
        halfWidth: AIR_SLASH_HALF_WIDTH,
        halfHeight: AIR_SLASH_HALF_HEIGHT
      };
    }

    finishAttack() {
      if (!this.isGrounded) {
        this.state = PlayerState.FALL;
      } else {
        this.state = this.input.isPressingLeftOrRight() ? PlayerState.WALK : PlayerState.IDLE;
      }
      this.showFrame(this.sprites.idle[0]);
    }

    /** The blade hits the ground: dust, shake, thud, then damage whatever is in reach. */
    landSlam(frame) {
      const tipX = this.x + this.facing * (frame.bladeTip.x - FRAME_SIZE / 2) * UNITS_PER_PIXEL;
      const tipY = Math.max(this.y + 0.05, this.y + (FRAME_SIZE - frame.bladeTip.y) * UNITS_PER_PIXEL);

      Sfx.slamImpact();
      this.cameraController.shake(0.07, 0.14);
      this.particles.burst(tipX, tipY, 10, '#8d6849', 1.3, 0.45); // dirt
      this.particles.burst(tipX, tipY, 6, GRASS_DUST, 1.0, 0.35); // grass
      this.effects.spawnRing({ color: '#ffeaa7', x: tipX, y: tipY + 0.1, fromScale: 0.2, toScale: 1.4, lifetime: 0.2 });

      this.events.onSlamLanded(this.getSlamHitArea());
    }

    /** The overhead arc covers the space in front of the boy, from head height down to the grass. */
    getSlamHitArea() {
      return {
        centerX: this.x + this.facing * SLAM_REACH_X,
        centerY: this.y + this.height * SLAM_HEIGHT_RATIO,
        halfWidth: SLAM_HALF_WIDTH,
        halfHeight: SLAM_HALF_HEIGHT
      };
    }

    updateHitRecoil(deltaSeconds) {
      this.x += this.velocityX * deltaSeconds;
      this.stateTimer -= deltaSeconds;

      // Flicker between the white flash and the hurt frame
      const showFlash = Math.floor(this.stateTimer * RECOIL_FLASH_RATE) % 2 === 0;
      this.showFrame(showFlash ? this.sprites.hitRecoilFlash : this.sprites.hitRecoil);

      if (this.stateTimer <= 0) {
        this.enterState(PlayerState.HIT_STAGGER, HIT_STAGGER_SECONDS);
        this.showFrame(this.sprites.hitStagger);
      }
    }

    updateHitStagger(deltaSeconds) {
      this.slideWithFriction(STAGGER_FRICTION, deltaSeconds);
      this.stateTimer -= deltaSeconds;
      if (this.stateTimer <= 0) {
        this.state = this.isGrounded ? PlayerState.IDLE : PlayerState.FALL;
      }
    }

    updateDefeated(deltaSeconds) {
      this.slideWithFriction(DEFEATED_FRICTION, deltaSeconds);
    }

    // ==========================================
    // Helpers
    // ==========================================
    enterState(state, timer = 0) {
      this.state = state;
      this.stateTimer = timer;
    }

    slideWithFriction(friction, deltaSeconds) {
      this.velocityX *= friction;
      this.x += this.velocityX * deltaSeconds;
    }

    advanceLoopingAnimation(frames, secondsPerFrame, deltaSeconds) {
      this.animationTimer += deltaSeconds;
      if (this.animationTimer > secondsPerFrame) {
        this.animationTimer = 0;
        this.animationFrame = (this.animationFrame + 1) % frames.length;
        this.showFrame(frames[this.animationFrame]);
      }
    }

    setSquash(scaleX, scaleY) {
      this.scaleX = scaleX;
      this.scaleY = scaleY;
    }

    /** Squash & stretch eases back to normal. */
    relaxSquash(deltaSeconds) {
      const amount = Math.min(1, SQUASH_RECOVERY_RATE * deltaSeconds);
      this.scaleX += (1 - this.scaleX) * amount;
      this.scaleY += (1 - this.scaleY) * amount;
    }

    showFrame(sprite) {
      setMeshSprite(this.bodyMesh, sprite);
    }

    currentAttackFrames() {
      return this.state === PlayerState.AIR_ATTACK ? this.sprites.airSlash : this.sprites.slam;
    }

    showAttackFrame(index) {
      setMeshSprite(this.slamMesh, this.currentAttackFrames()[index]);
    }

    /** Copy position, facing and squash onto the meshes. Squash scales around the feet. */
    syncMeshes() {
      const isAttacking = this.isAttacking;
      this.bodyMesh.visible = !isAttacking;
      this.slamMesh.visible = isAttacking;

      this.bodyMesh.scale.set(this.facing * this.scaleX, this.scaleY, 1);
      this.bodyMesh.position.set(this.x, this.y + (this.height * this.scaleY) / 2, MESH_Z);

      this.slamMesh.scale.set(this.facing, 1, 1);
      this.slamMesh.position.set(
        this.x + this.slamMeshOffset.x * this.facing,
        this.y + this.height / 2 + this.slamMeshOffset.y,
        MESH_Z
      );
      this.slamMesh.material.opacity = this.bodyMesh.material.opacity;
    }
  }

  Forest.Player = Player;
  Forest.PlayerState = PlayerState;
})(window.Forest);
