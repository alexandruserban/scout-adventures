/**
 * Monster Forge, part 4: random monsters in the game, and the library's public API.
 *
 *   const genome  = Forest.MonsterForge.generate({ power: 4 });     // random (or pass a seed)
 *   const monster = Forest.MonsterForge.create(world, { genome, x: 10, onDefeated });
 *   enemies.push(monster);                                           // then update it like any foe
 *
 * A RandomMonster is a Forest.SkyCreature, so it falls from the sky with a shadow, flashes when hit,
 * shows an HP bar and explodes into pixel debris like the hand-made creatures. On top of that it:
 *   - moves according to genome.movement (walker / hopper / flyer)
 *   - uses its attack abilities one at a time, with a cooldown in between
 *   - lets its passive abilities react to being hurt, recovering and exploding
 */
(function (Forest) {
  const { PIXEL_SCALE, GROUND_Y } = Forest.Config;
  const { createSprite } = Forest.Graphics;
  const { asciiToCanvas, createWhiteSilhouette } = Forest.PixelCanvas;
  const { randomBetween, randomDirection, isBodyTouching } = Forest.MathUtils;
  const { SkyCreature, CreatureState, MonsterGenome, MonsterPainter, MonsterAbilities } = Forest;
  const { Movement, ABILITIES } = MonsterGenome;
  const Sfx = Forest.SoundEffects;

  // --- Size ---
  const SPRITE_SCALE = 0.85;
  const MINI_SPRITE_SCALE = 0.55;

  // --- Moving ---
  const WALK_SPEED = 1.4;
  const WALK_FRAME_SECONDS = 0.16;
  /** Walkers stop shuffling when this close (still inside touching range). */
  const WALK_STOP_DISTANCE = 0.4;
  const HOP_SPEED_X = 2.8;
  const HOP_SPEED_Y = [5, 6.5];
  const HOP_INTERVAL = 0.8;
  const HOVER_HEIGHT = 2.4;
  const HOVER_SIDE_DISTANCE = 2.4;
  const HOVER_FOLLOW_RATE = 2.2;
  const FLAP_SECONDS = 0.12;

  // --- Attacking ---
  const FIRST_ATTACK_DELAY = [1.0, 2.2];
  /** When no attack fits the situation, look again this soon. */
  const ATTACK_RETRY_SECONDS = 0.3;

  // --- Speed caps after difficulty scaling ---
  const MAX_SPEED = 1.9;

  /** Ground monsters are low enough to jump over (see Forest.MathUtils.isBodyTouching). */
  const GROUND_BODY_BOX = { enemyHalfWidthRatio: 0.35, playerHalfWidthRatio: 0.25, topRatio: 0.85 };
  const FLYER_CONTACT_WIDTH_RATIO = 0.36;
  const FLYER_CONTACT_HEIGHT_RATIO = 0.4;

  const WHITE = 0xffffff;
  const ENRAGED_TINT = 0xffa090;

  const MOVEMENT_STATE = {
    [Movement.WALKER]: CreatureState.WALK,
    [Movement.HOPPER]: CreatureState.HOP,
    [Movement.FLYER]: CreatureState.HOVER
  };

  // ==========================================
  // Sprites, shared by every monster with the same look (e.g. a monster and its minis)
  // ==========================================
  const artCache = new Map();

  function artKey(genome) {
    return `${genome.movement}|${JSON.stringify(genome.appearance)}`;
  }

  function acquireArt(genome) {
    const key = artKey(genome);
    let entry = artCache.get(key);
    if (!entry) {
      const art = MonsterPainter.paint(genome);
      const frames = {};
      Object.entries(art.frames).forEach(([frameName, rows]) => {
        const canvas = asciiToCanvas(rows, 1, art.palette);
        frames[frameName] = { normal: createSprite(canvas), flash: createSprite(createWhiteSilhouette(canvas)) };
      });
      entry = { frames, bodyWidthPixels: art.bodyWidthPixels, users: 0 };
      artCache.set(key, entry);
    }
    entry.users++;
    return { key, ...entry };
  }

  /** Free the GPU textures once the last monster with this look is gone. */
  function releaseArt(key) {
    const entry = artCache.get(key);
    if (!entry || --entry.users > 0) return;
    Object.values(entry.frames).forEach(({ normal, flash }) => {
      normal.texture.dispose();
      flash.texture.dispose();
    });
    artCache.delete(key);
  }

  /**
   * Final stats for a genome at a difficulty level (health bonus, speed multiplier).
   * @param {object} genome
   * @param {object} [difficulty] a Forest.Difficulty level; defaults to the current one
   */
  function statsFor(genome, difficulty = Forest.Difficulty.current) {
    return {
      hp: Math.max(1, genome.stats.hp + difficulty.creatureHpBonus),
      damage: genome.stats.damage,
      speed: Math.min(MAX_SPEED, genome.stats.speed * difficulty.creatureSpeed)
    };
  }

  // ==========================================
  // The monster
  // ==========================================
  class RandomMonster extends SkyCreature {
    /**
     * @param {object} world shared game systems (see Forest.SkyCreature)
     * @param {object} options
     * @param {object} options.genome from Forest.MonsterGenome.generate
     * @param {number} options.x where it lands
     * @param {(monster: RandomMonster) => void} options.onDefeated
     * @param {{hp:number, damage:number, speed:number}} [options.stats] defaults to statsFor(genome)
     * @param {{y:number, velocityX:number, velocityY:number}} [options.launch] start mid-air instead of falling
     */
    constructor(world, { genome, x, stats, onDefeated, launch, sizeScale }) {
      const art = acquireArt(genome);
      super(world, {
        kind: 'monster',
        frames: art.frames,
        x,
        stats: stats || statsFor(genome),
        spriteScale: genome.isMini ? MINI_SPRITE_SCALE : SPRITE_SCALE,
        fallFrame: 'idle',
        colors: { main: genome.appearance.palette.b, accent: genome.appearance.palette.s },
        onDefeated,
        launch,
        sizeScale
      });
      this.artKey = art.key;
      this.genome = genome;
      this.displayName = genome.name;
      this.movement = genome.movement;
      this.bodyWidth = art.bodyWidthPixels * this.unitsPerPixel;

      this.attacks = genome.abilities.filter(id => ABILITIES[id].type === 'attack').map(id => MonsterAbilities[id]);
      this.passives = genome.abilities.filter(id => ABILITIES[id].type === 'passive').map(id => MonsterAbilities[id]);
      this.activeAttack = null;
      /** Free-form progress marker for the running attack ('windup', 'airborne', ...). */
      this.attackPhase = null;
      this.attackCooldown = randomBetween(...FIRST_ATTACK_DELAY);

      this.isEnraged = false;
      this.secondsSinceHit = Infinity;
      this.broodlings = [];
      this.animationTimer = 0;
      this.time = Math.random() * 10;
      /** Flyers hover on this side of the boy (1 = right, -1 = left). */
      this.side = randomDirection();
      this.hoverY = GROUND_Y + HOVER_HEIGHT * (genome.isMini ? 0.75 : 1) + randomBetween(-0.2, 0.5);

      this.passives.forEach(passive => passive.setup && passive.setup(this));

      if (launch) {
        // Popped out of another monster: already awake
        this.state = this.movementState;
        this.stateTimer = 0.4;
        if (this.isFlyer) this.isFlying = true;
      }
    }

    get isFlyer() {
      return this.movement === Movement.FLYER;
    }

    get movementState() {
      return MOVEMENT_STATE[this.movement];
    }

    /** The tint to return to after flashes and tells. */
    get restingTint() {
      return this.isEnraged ? ENRAGED_TINT : WHITE;
    }

    isTouching(player) {
      if (!this.isFlyer) return isBodyTouching(player, this, GROUND_BODY_BOX);
      // Flyers: only the body hurts, not the wing tips
      const dx = Math.abs(player.x - this.x);
      const dy = Math.abs((player.y + player.height / 2) - this.centerY);
      return dx < (player.width + this.bodyWidth) * FLYER_CONTACT_WIDTH_RATIO
        && dy < (player.height + this.height) * FLYER_CONTACT_HEIGHT_RATIO;
    }

    // ==========================================
    // Arriving
    // ==========================================
    fallStopHeight() {
      return this.isFlyer ? this.hoverY : GROUND_Y;
    }

    land() {
      if (!this.isFlyer) {
        super.land();
        return;
      }
      // Flyers unfurl their wings and stay up
      this.isFlying = true;
      this.state = CreatureState.HOVER;
      this.particles.burst(this.x, this.centerY, 8, this.colors.accent, 1.0, 0.5);
      Sfx.wingFlutter();
    }

    onLanded() {
      this.state = this.movementState;
      this.stateTimer = randomBetween(0.2, 0.5);
    }

    // ==========================================
    // Thinking
    // ==========================================
    think(deltaSeconds, player) {
      this.time += deltaSeconds;
      this.secondsSinceHit += deltaSeconds;
      this.passives.forEach(passive => passive.update && passive.update(this, deltaSeconds, player));
      if (!this.isFlyer) this.applyPhysics(deltaSeconds);

      if (this.activeAttack) {
        if (this.activeAttack.update(this, deltaSeconds, player)) this.endAttack();
        return;
      }

      switch (this.movement) {
        case Movement.WALKER: this.walk(deltaSeconds, player); break;
        case Movement.HOPPER: this.hop(player); break;
        case Movement.FLYER: this.hover(deltaSeconds, player); break;
      }

      this.attackCooldown -= deltaSeconds;
      if (this.attackCooldown <= 0 && !player.isDefeated) this.tryStartAttack(player);
    }

    walk(deltaSeconds, player) {
      if (!player.isDefeated) this.facing = player.x >= this.x ? 1 : -1;
      const isFarEnough = Math.abs(player.x - this.x) > WALK_STOP_DISTANCE;
      if (isFarEnough || player.isDefeated) {
        if (this.moveHorizontally(this.facing * WALK_SPEED * this.speed * deltaSeconds)) this.facing = -this.facing;
        this.animate(deltaSeconds, WALK_FRAME_SECONDS / this.speed, 'idle', 'move');
      } else {
        this.showFrame('idle');
      }
    }

    hop(player) {
      if (!this.isOnGround) {
        this.showFrame('move');
        return;
      }
      this.showFrame('idle');
      if (this.stateTimer > 0) return;

      this.facing = player.isDefeated ? randomDirection() : (player.x >= this.x ? 1 : -1);
      this.velocityX = this.facing * HOP_SPEED_X * this.speed;
      this.velocityY = randomBetween(...HOP_SPEED_Y) * (this.genome.isMini ? 0.8 : 1);
      this.stateTimer = (HOP_INTERVAL + randomBetween(-0.15, 0.25)) / this.speed;
      this.setSquash(0.8, 1.25);
    }

    /** Drift to one side of the boy, bobbing up and down and flapping. */
    hover(deltaSeconds, player) {
      this.animate(deltaSeconds, FLAP_SECONDS, 'idle', 'move');
      const targetX = player.x + this.side * HOVER_SIDE_DISTANCE;
      const targetY = this.hoverY + Math.sin(this.time * 3) * 0.3;
      this.x += (targetX - this.x) * Math.min(1, HOVER_FOLLOW_RATE * deltaSeconds);
      this.y += (targetY - this.y) * Math.min(1, 3 * deltaSeconds);
      this.facing = player.x >= this.x ? 1 : -1;
      this.keepInsideLevel();
      if (Math.random() < 0.05) this.particles.burst(this.x, this.y, 1, this.colors.accent, 0.3, 0.6);
    }

    tryStartAttack(player) {
      const ready = this.attacks.filter(attack => attack.canStart(this, player));
      if (ready.length === 0) {
        this.attackCooldown = ATTACK_RETRY_SECONDS;
        return;
      }
      this.activeAttack = ready[Math.floor(Math.random() * ready.length)];
      this.attackPhase = null;
      this.activeAttack.start(this, player);
    }

    endAttack() {
      const attack = this.activeAttack;
      this.activeAttack = null;
      this.attackPhase = null;
      this.attackCooldown = randomBetween(...attack.cooldown) / this.speed;
      if (attack.finish) attack.finish(this);
      this.resumeMoving();
    }

    resumeMoving() {
      this.state = this.movementState;
      this.stateTimer = 0.3;
      this.tint = this.restingTint;
      this.offsetX = 0;
      this.showFrame('idle');
      if (this.isFlyer) this.isFlying = true;
    }

    /** Alternate between two frames every `frameSeconds`. */
    animate(deltaSeconds, frameSeconds, frameA, frameB) {
      this.animationTimer += deltaSeconds;
      if (this.frameName !== frameA && this.frameName !== frameB) this.showFrame(frameA);
      if (this.animationTimer > frameSeconds) {
        this.animationTimer = 0;
        this.showFrame(this.frameName === frameA ? frameB : frameA);
      }
    }

    onTouchGround(impactSpeed) {
      if (this.activeAttack && this.activeAttack.onTouchGround && this.activeAttack.onTouchGround(this, impactSpeed)) return;
      if (this.movement === Movement.HOPPER) {
        this.setSquash(1.25, 0.75);
      } else {
        super.onTouchGround(impactSpeed);
      }
    }

    // ==========================================
    // Getting hit
    // ==========================================
    takeHit(damage, attackerX) {
      if (this.isHittable) this.secondsSinceHit = 0;
      super.takeHit(damage, attackerX);
    }

    onHurt(knockbackDirection) {
      const isShruggedOff = this.passives.some(passive => passive.onHurt && passive.onHurt(this));
      if (isShruggedOff) return;

      if (this.activeAttack) {
        // Interrupted: the attack is wasted, but it can try again soon
        this.activeAttack = null;
        this.attackPhase = null;
        this.attackCooldown = randomBetween(0.6, 1.2);
      }
      this.offsetX = 0;
      super.onHurt(knockbackDirection);
    }

    recover() {
      this.resumeMoving();
      this.stateTimer = 0.4;
      this.passives.forEach(passive => passive.afterRecover && passive.afterRecover(this));
    }

    onExploded() {
      this.passives.forEach(passive => passive.onExploded && passive.onExploded(this));
    }

    remove() {
      if (this.isGone) return;
      super.remove();
      releaseArt(this.artKey);
    }

    // ==========================================
    // Offspring (Brood, Splitter)
    // ==========================================
    /** Launch a mini copy of this monster from its body. */
    spawnMini({ velocityX, velocityY }) {
      const mini = new RandomMonster(this.world, {
        genome: MonsterGenome.createMini(this.genome),
        x: this.x + Math.sign(velocityX) * 0.3,
        stats: { hp: Math.max(1, Math.ceil(this.maxHp / 3)), damage: this.damage, speed: this.speed },
        onDefeated: this.onDefeated,
        launch: { y: this.y + this.height * 0.5, velocityX, velocityY }
      });
      this.broodlings.push(mini);
      this.world.spawnEnemy(mini);
      return mini;
    }

    countLivingBroodlings() {
      this.broodlings = this.broodlings.filter(mini => !mini.isGone);
      return this.broodlings.length;
    }
  }

  // ==========================================
  // Public API
  // ==========================================
  /**
   * Paint one frame of a genome to a canvas, enlarged for display (e.g. the sprite gallery).
   * @param {object} genome
   * @param {'idle'|'move'|'attack'} [frameName]
   * @param {number} [zoom]
   */
  function paintPreview(genome, frameName = 'idle', zoom = 3) {
    const art = MonsterPainter.paint(genome);
    return asciiToCanvas(art.frames[frameName], zoom, art.palette);
  }

  /**
   * Put a monster into the world. It falls from the sky (unless `launch` is given).
   * The caller adds it to its enemy list and updates it each frame, like any other foe.
   */
  function create(world, options) {
    return new RandomMonster(world, options);
  }

  Forest.RandomMonster = RandomMonster;
  Forest.MonsterForge = Object.freeze({
    Movement,
    ABILITIES,
    generate: MonsterGenome.generate,
    createMini: MonsterGenome.createMini,
    describe: MonsterGenome.describe,
    paint: MonsterPainter.paint,
    paintPreview,
    statsFor,
    create
  });
})(window.Forest);
