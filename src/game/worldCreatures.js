/**
 * The hand-made creatures of the worlds that had none of their own: one for each world, from the
 * forest's Mossling to the kitchen's Hot Pepper (art in worldCreatureSprites.js). Each world fills
 * up with its creature (see `natives` in Forest.Levels.themes).
 *
 * They share one class, set up by their entry in SPECIES: how it moves (walks, hops or flies) and
 * how it attacks:
 *   - charge:    growls, then rushes at the boy (rolling, sliding, zooming)
 *   - throw:     lobs things at him (bones, pies, crystal shards, fire, sparkles)
 *   - pounce:    crouches and leaps at him
 *   - blink:     fades out and pops up again right next to him
 *   - swoop:     (flyers) dives through him in a U-shaped arc
 *   - drop:      (flyers) hovers over him and drops a bomb
 *   - shockwave: (hoppers) scorches the floor around where it lands
 * Every attack is shown first (the `attack` pose, a shake and a flash), so it can be dodged.
 *
 * Each entry also carries the creature's scrapbook names, points, heart chance and health, which
 * Forest.MonsterSpecies, Forest.Rewards and Forest.WaveDirector read from here.
 */
(function (Forest) {
  /** Droppers only drop their bomb when the boy is about this close to right below them. */
  const DROP_ATTACK_RANGE = 1.5;
  const { clamp, randomBetween, randomDirection, isBodyTouching } = Forest.MathUtils;
  const { CreatureState, SkyCreature } = Forest;
  const Sfx = Forest.SoundEffects;

  const WHITE = 0xffffff;
  const WARNING_TINT = 0xffb0b0;
  const GRAVITY = 22;
  /** Ground creatures are low enough to jump over. */
  const SMALL_BODY_BOX = { enemyHalfWidthRatio: 0.33, playerHalfWidthRatio: 0.25, topRatio: 0.82 };
  const FLYER_CONTACT_SCALE = 0.75;
  const FRAME_SECONDS = 0.14;
  const FLAP_SECONDS = 0.12;
  /** Ground attacks only start when the boy is no more than this far above or below. */
  const ATTACK_HEIGHT = 2.5;
  const SWOOP_SECONDS = 1.6;
  const SWOOP_BOTTOM = 0.5;

  const FIRE_TRAIL = ['#ff8a2a', '#ffd25e'];

  /**
   * One entry per creature. movement: 'walker' | 'hopper' | 'flyer'. Ground creatures attack when
   * the boy is between attackRange[0] and [1] away; flyers attack every `attackEvery` seconds.
   */
  const SPECIES = [
    {
      kind: 'mossling', world: 'forest', latin: 'Mossus rollypollius', common: 'Mossling',
      note: 'Curls into a ball and rolls downhill, uphill, any hill.',
      points: 20, heartChance: 0.08, hp: 2, damage: 1, hpPerCycle: 1,
      spriteScale: 0.8, colors: { main: '#4f9a3a', accent: '#ff6b9a' },
      movement: 'walker', walkSpeed: 1.5,
      attack: 'charge', attackRange: [1.5, 6], telegraph: 0.5, cooldown: [2.5, 3.5], chargeSpeed: 7, chargeSeconds: 0.8
    },
    {
      kind: 'bonerattler', world: 'dungeon', latin: 'Rattus ossiflingus', common: 'Bone Rattler',
      note: 'Throws its own spare bones. Never runs out, somehow.',
      points: 25, heartChance: 0.08, hp: 2, damage: 1, hpPerCycle: 1,
      spriteScale: 0.8, colors: { main: '#efe8d8', accent: '#ff3b3b' },
      movement: 'walker', walkSpeed: 1.8,
      attack: 'throw', attackRange: [2.5, 9], telegraph: 0.45, cooldown: [2.4, 3.4],
      shots: [0], throwSeconds: 1.0, projectile: { tint: 0xefe8d8, trail: ['#efe8d8', '#c8bea8'] }
    },
    {
      kind: 'puffwing', world: 'treetops', latin: 'Nimbus flappicus', common: 'Puffwing',
      note: 'Mostly cloud, partly bird, entirely rude.',
      points: 30, heartChance: 0.08, hp: 2, damage: 1, hpPerCycle: 1,
      spriteScale: 0.8, colors: { main: '#ffffff', accent: '#9fc8ff' },
      movement: 'flyer', hoverHeight: 2.6, sideDistance: 3, attack: 'swoop', attackEvery: [2.6, 3.8], telegraph: 0.5
    },
    {
      kind: 'tumblecritter', world: 'desert', latin: 'Tumbleweedus bouncii', common: 'Tumblecritter',
      note: 'Goes wherever the wind goes. Mostly at you.',
      points: 15, heartChance: 0.06, hp: 2, damage: 1, hpPerCycle: 1,
      spriteScale: 0.8, colors: { main: '#c8924a', accent: '#ffe0a0' },
      movement: 'hopper', hopSpeedX: 3.2, hopSpeedY: 5, hopRest: [0.25, 0.5], attack: 'none'
    },
    {
      kind: 'penguin', world: 'ice', latin: 'Pinguinus bellyslidus', common: 'Frostbite Penguin',
      note: 'Waddles slowly, slides fast. Wears a scarf for style, not warmth.',
      points: 25, heartChance: 0.08, hp: 2, damage: 1, hpPerCycle: 1,
      spriteScale: 0.8, colors: { main: '#24345a', accent: '#e8344a' },
      movement: 'walker', walkSpeed: 1.3,
      attack: 'charge', attackRange: [1.5, 7], telegraph: 0.45, cooldown: [2.5, 3.5], chargeSpeed: 8, chargeSeconds: 1.0
    },
    {
      kind: 'emberimp', world: 'volcano', latin: 'Impus scorchimus', common: 'Ember Imp',
      note: 'Hovers right over your head and drops hot things. Rude.',
      points: 30, heartChance: 0.08, hp: 2, damage: 1, hpPerCycle: 1,
      spriteScale: 0.8, colors: { main: '#e0401f', accent: '#ffe14d' },
      movement: 'flyer', hoverHeight: 3.2, sideDistance: 0, attack: 'drop', attackEvery: [2.2, 3.2], telegraph: 0.5,
      projectile: { tint: 0xff8a2a, trail: FIRE_TRAIL }
    },
    {
      kind: 'gummy', world: 'candy', latin: 'Ursus gelatinus', common: 'Gummy Bear',
      note: 'Bounces with joy. The joy of squashing you.',
      points: 20, heartChance: 0.1, hp: 2, damage: 1, hpPerCycle: 1,
      spriteScale: 0.8, colors: { main: '#5fd06a', accent: '#c8ffd0' },
      movement: 'hopper', hopSpeedX: 2.6, hopSpeedY: 7, hopRest: [0.5, 0.9], attack: 'none'
    },
    {
      kind: 'craterbunny', world: 'moon', latin: 'Lepus lunaticus', common: 'Crater Bunny',
      note: 'Hops so high in the low gravity it sometimes comes down next week.',
      points: 25, heartChance: 0.08, hp: 2, damage: 1, hpPerCycle: 1,
      spriteScale: 0.75, colors: { main: '#e8e8f4', accent: '#9ff0ff' },
      movement: 'hopper', hopSpeedX: 3, hopSpeedY: 9.5, hopRest: [0.7, 1.2], attack: 'none'
    },
    {
      kind: 'glitchcat', world: 'neon', latin: 'Felis pixelatus', common: 'Glitch Cat',
      note: 'Has nine lives, all of them buggy.',
      points: 25, heartChance: 0.08, hp: 2, damage: 1, hpPerCycle: 1,
      spriteScale: 0.8, colors: { main: '#ff4fd8', accent: '#00f0ff' },
      movement: 'walker', walkSpeed: 2.2,
      attack: 'pounce', attackRange: [1.5, 5], telegraph: 0.4, cooldown: [2, 3], pounceSpeedY: 6.5, pounceMaxX: 6
    },
    {
      kind: 'shardback', world: 'crystal', latin: 'Dasypus crystallinus', common: 'Shardback',
      note: 'Grows crystals on its back and flings them at anyone who stares.',
      points: 40, heartChance: 0.12, hp: 3, damage: 1, hpPerCycle: 2,
      spriteScale: 0.8, colors: { main: '#3a6a74', accent: '#2fd8b8' }, armored: 0.6,
      movement: 'walker', walkSpeed: 1.0,
      attack: 'throw', attackRange: [2, 9], telegraph: 0.6, cooldown: [2.8, 3.8],
      shots: [-1.3, 0, 1.3], throwSeconds: 1.0, projectile: { tint: 0x9ff0ff, trail: ['#2fd8b8', '#c0fff4'] }
    },
    {
      kind: 'windupmouse', world: 'clockwork', latin: 'Mus mechanicus', common: 'Windup Mouse',
      note: 'Winds itself up, then zooms off at top speed. Brakes not included.',
      points: 20, heartChance: 0.08, hp: 2, damage: 1, hpPerCycle: 1,
      spriteScale: 0.8, colors: { main: '#d8a040', accent: '#f4e070' },
      movement: 'walker', walkSpeed: 2.0,
      attack: 'charge', attackRange: [1.5, 8], telegraph: 0.6, cooldown: [2.4, 3.2], chargeSpeed: 9, chargeSeconds: 0.9
    },
    {
      kind: 'jetsquid', world: 'atlantis', latin: 'Loligo turbojetus', common: 'Jet Squid',
      note: 'Squirts water out of its back end to go faster. Please look away.',
      points: 30, heartChance: 0.08, hp: 2, damage: 1, hpPerCycle: 1,
      spriteScale: 0.8, colors: { main: '#2fb8c8', accent: '#9ff8ff' },
      movement: 'flyer', hoverHeight: 2.2, sideDistance: 3.5, attack: 'swoop', attackEvery: [2.2, 3.2], telegraph: 0.45
    },
    {
      kind: 'pixie', world: 'fae', latin: 'Faerius sparklecastus', common: 'Pixie',
      note: 'Throws glitter. It is not as harmless as it sounds.',
      points: 30, heartChance: 0.1, hp: 2, damage: 1, hpPerCycle: 1,
      spriteScale: 0.8, colors: { main: '#b04aff', accent: '#ffe14d' },
      movement: 'flyer', hoverHeight: 3.0, sideDistance: 3, attack: 'throw', attackEvery: [2.4, 3.4], telegraph: 0.45,
      // One sparkly star at a time, thrown like a fireball
      shots: [0], throwSeconds: 0.9, projectile: { sprite: 'star', trail: ['#ffe14d', '#fff7b3', '#e8c0ff'] }
    },
    {
      kind: 'drakeling', world: 'mechKeep', latin: 'Draco clankius', common: 'Drakeling',
      note: 'A baby mech dragon. Its fire still works fine.',
      points: 40, heartChance: 0.12, hp: 3, damage: 1, hpPerCycle: 2,
      spriteScale: 0.8, colors: { main: '#6a7484', accent: '#ff8a2a' },
      movement: 'walker', walkSpeed: 1.5,
      attack: 'throw', attackRange: [2, 7], telegraph: 0.5, cooldown: [2.4, 3.4],
      shots: [0], throwSeconds: 0.7, projectile: { tint: 0xff8a2a, trail: FIRE_TRAIL }
    },
    {
      kind: 'blinkwisp', world: 'rift', latin: 'Quantus peekabooii', common: 'Blinkwisp',
      note: 'Is in two places at once, and both of them are next to you.',
      points: 30, heartChance: 0.08, hp: 2, damage: 1, hpPerCycle: 1,
      spriteScale: 0.8, colors: { main: '#b04aff', accent: '#00f0ff' },
      movement: 'walker', walkSpeed: 1.2,
      attack: 'blink', attackRange: [3, 12], telegraph: 0.5, cooldown: [2.5, 4]
    },
    {
      kind: 'drone', world: 'station', latin: 'Robotus bombardius', common: 'Drone Bot',
      note: 'Station security. Drops a bomb on anyone without a pass.',
      points: 30, heartChance: 0.08, hp: 2, damage: 1, hpPerCycle: 1,
      spriteScale: 0.8, colors: { main: '#c8d0dc', accent: '#ff3b3b' },
      movement: 'flyer', hoverHeight: 3.4, sideDistance: 0, attack: 'drop', attackEvery: [2.0, 3.0], telegraph: 0.5,
      projectile: { tint: 0xff3b3b, trail: ['#ff3b3b', '#ffd25e'] }
    },
    {
      kind: 'piebandit', world: 'noir', latin: 'Villainus custardius', common: 'Pie Bandit',
      note: 'Twirls its moustache, then throws a pie. Every single time.',
      points: 25, heartChance: 0.1, hp: 2, damage: 1, hpPerCycle: 1,
      spriteScale: 0.75, colors: { main: '#4a4a4a', accent: '#ffffff' },
      movement: 'walker', walkSpeed: 1.6,
      attack: 'throw', attackRange: [2.5, 9], telegraph: 0.5, cooldown: [2.4, 3.4],
      shots: [0], throwSeconds: 1.0, projectile: { tint: 0xf0f0d8, trail: ['#ffffff', '#d8d8c0'] }
    },
    {
      kind: 'puffer', world: 'rising', latin: 'Tetraodon balloonicus', common: 'Balloon Puffer',
      note: 'Swallowed so much air it floats. Still prickly.',
      points: 30, heartChance: 0.08, hp: 2, damage: 1, hpPerCycle: 1,
      spriteScale: 0.75, colors: { main: '#ffd06a', accent: '#fff4d0' },
      movement: 'flyer', hoverHeight: 2.4, sideDistance: 3, attack: 'swoop', attackEvery: [2.8, 4], telegraph: 0.5
    },
    {
      kind: 'pepper', world: 'kitchen', latin: 'Capsicum furiosum', common: 'Hot Pepper',
      note: 'So spicy the floor catches fire wherever it lands.',
      points: 30, heartChance: 0.1, hp: 2, damage: 1, hpPerCycle: 1,
      spriteScale: 0.8, colors: { main: '#e8241f', accent: '#ff8a2a' },
      movement: 'hopper', hopSpeedX: 2.8, hopSpeedY: 7.5, hopRest: [0.6, 1.0],
      attack: 'shockwave', cooldown: [2, 3], shockRadius: 1.7
    }
  ];

  function directionTowards(fromX, toX) {
    return toX >= fromX ? 1 : -1;
  }

  /** Speed to jump from x to targetX with upward speed `jumpSpeed`, capped at maxSpeedX. */
  function leapSpeedX(fromX, targetX, jumpSpeed, maxSpeedX) {
    const airSeconds = (2 * jumpSpeed) / GRAVITY;
    return clamp((targetX - fromX) / airSeconds, -maxSpeedX, maxSpeedX);
  }

  class WorldCreature extends SkyCreature {
    constructor(world, options, spec) {
      super(world, { ...options, kind: spec.kind, spriteScale: spec.spriteScale, fallFrame: 'walk1', colors: spec.colors });
      this.spec = spec;
      this.cooldown = randomBetween(1, 2.5);
      this.animationTimer = 0;
      this.time = Math.random() * 10;
      if (spec.armored) this.knockbackResistance = spec.armored;
      if (this.isFlyer) {
        this.contactScale = FLYER_CONTACT_SCALE;
        this.hoverY = this.floorY + spec.hoverHeight + randomBetween(-0.2, 0.4);
        this.side = randomDirection();
      }
    }

    get isFlyer() {
      return this.spec.movement === 'flyer';
    }

    isTouching(player) {
      return this.isFlyer ? super.isTouching(player) : isBodyTouching(player, this, SMALL_BODY_BOX);
    }

    fallStopHeight() {
      return this.isFlyer ? this.hoverY : this.floorY;
    }

    land() {
      if (!this.isFlyer) {
        super.land();
        return;
      }
      // Flyers stop in mid-air and take wing
      this.isFlying = true;
      this.state = CreatureState.HOVER;
      this.stateTimer = randomBetween(...this.spec.attackEvery);
      this.particles.burst(this.x, this.centerY, 8, this.colors.accent, 1.0, 0.5);
      Sfx.wingFlutter();
    }

    onLanded() {
      if (this.spec.movement === 'hopper') this.rest();
      else this.walkOn();
    }

    walkOn() {
      this.state = CreatureState.WALK;
      this.tint = WHITE;
      this.showFrame('walk1');
    }

    rest() {
      this.state = CreatureState.IDLE;
      this.tint = WHITE;
      this.stateTimer = randomBetween(...this.spec.hopRest) / this.speed;
      this.showFrame('walk1');
    }

    think(deltaSeconds, player) {
      this.time += deltaSeconds;
      this.cooldown -= deltaSeconds;
      if (this.isFlyer) {
        this.thinkInTheAir(deltaSeconds, player);
        return;
      }
      this.applyPhysics(deltaSeconds);
      switch (this.state) {
        case CreatureState.WALK: this.walkAbout(deltaSeconds, player); break;
        case CreatureState.IDLE: this.waitToHop(player); break;
        case CreatureState.TELEGRAPH: this.warn(player); break;
        case CreatureState.CHARGE: this.charge(deltaSeconds); break;
        default: break; // JUMP: landing is handled in onTouchGround
      }
    }

    // ==========================================
    // Walking and hopping
    // ==========================================
    walkAbout(deltaSeconds, player) {
      this.facing = directionTowards(this.x, this.chaseX);
      if (Math.abs(this.chaseX - this.x) > 0.5) {
        this.moveHorizontally(this.facing * this.spec.walkSpeed * this.speed * deltaSeconds);
        this.animate(deltaSeconds);
      } else {
        this.showFrame('walk1');
      }
      if (this.canAttack(player)) this.startWarning(player);
    }

    animate(deltaSeconds) {
      this.animationTimer += deltaSeconds;
      if (this.animationTimer < FRAME_SECONDS / this.speed) return;
      this.animationTimer = 0;
      this.showFrame(this.frameName === 'walk1' ? 'walk2' : 'walk1');
    }

    canAttack(player) {
      const { attack, attackRange } = this.spec;
      if (!attackRange || attack === 'none' || this.cooldown > 0 || this.isPatrolling || player.isDefeated || !this.isOnGround) return false;
      const distance = Math.abs(player.x - this.x);
      return distance >= attackRange[0] && distance <= attackRange[1] && Math.abs(player.y - this.floorY) < ATTACK_HEIGHT;
    }

    waitToHop(player) {
      this.offsetY = Math.abs(Math.sin(this.time * 8)) * 0.04;
      if (this.stateTimer > 0 || player.isDefeated) return;
      this.offsetY = 0;
      this.facing = directionTowards(this.x, this.chaseX);
      this.velocityX = this.facing * this.spec.hopSpeedX * this.speed;
      this.velocityY = this.spec.hopSpeedY;
      this.state = CreatureState.JUMP;
      this.showFrame('walk2');
      this.setSquash(0.8, 1.25);
    }

    onTouchGround(impactSpeed) {
      super.onTouchGround(impactSpeed);
      if (this.state !== CreatureState.JUMP) return;
      if (this.spec.movement === 'hopper') {
        if (this.spec.attack === 'shockwave' && this.cooldown <= 0) this.shockwave();
        this.rest();
      } else {
        // Landed from a pounce
        this.cooldown = randomBetween(...this.spec.cooldown) / this.speed;
        this.walkOn();
      }
    }

    // ==========================================
    // Ground attacks: a warning, then the attack
    // ==========================================
    startWarning(player) {
      this.state = CreatureState.TELEGRAPH;
      this.stateTimer = this.spec.telegraph / Math.sqrt(this.speed);
      this.facing = directionTowards(this.x, player.x);
      this.showFrame('attack');
      Sfx.beetleGrowl();
    }

    warn(player) {
      this.offsetX = Math.sin(this.stateTimer * 60) * 0.04;
      this.tint = Math.sin(this.stateTimer * 30) > 0 ? WARNING_TINT : WHITE;
      if (this.stateTimer > 0) return;
      this.tint = WHITE;
      this.offsetX = 0;
      if (player.isDefeated) {
        this.walkOn();
        return;
      }
      const { attack } = this.spec;
      if (attack === 'charge') this.startCharge();
      else if (attack === 'throw') this.throwAt(player);
      else if (attack === 'pounce') this.pounceAt(player);
      else if (attack === 'blink') this.blinkTo(player);
      else this.walkOn();
    }

    startCharge() {
      this.state = CreatureState.CHARGE;
      this.stateTimer = this.spec.chargeSeconds;
      this.showFrame('attack');
      Sfx.beetleCharge();
    }

    charge(deltaSeconds) {
      const bumped = this.moveHorizontally(this.facing * this.spec.chargeSpeed * this.speed * deltaSeconds);
      if (Math.random() < 0.5) this.particles.burst(this.x - this.facing * this.width * 0.4, this.floorY + 0.05, 1, '#c9b08a', 0.6, 0.3);
      if (bumped || this.stateTimer <= 0) this.finishAttack();
    }

    throwAt(player) {
      const { shots, throwSeconds, projectile } = this.spec;
      shots.forEach(offset => this.lobAt(player.x + offset, { ...projectile, seconds: throwSeconds }));
      this.setSquash(1.15, 0.85);
      Sfx.fireballLaunch();
      this.finishAttack();
    }

    pounceAt(player) {
      this.state = CreatureState.JUMP;
      this.velocityY = this.spec.pounceSpeedY;
      this.velocityX = leapSpeedX(this.x, player.x, this.spec.pounceSpeedY, this.spec.pounceMaxX * this.speed);
      this.showFrame('walk2');
      this.setSquash(0.8, 1.25);
      Sfx.jump();
    }

    /** Vanish and pop up again beside the boy (but never off its own stretch of ground). */
    blinkTo(player) {
      this.particles.burst(this.x, this.centerY, 14, this.colors.main, 1.6, 0.4);
      const side = randomDirection();
      this.x = clamp(player.x + side * randomBetween(1.6, 2.4), this.minX, this.maxX);
      this.facing = directionTowards(this.x, player.x);
      this.particles.burst(this.x, this.centerY, 14, this.colors.accent, 1.6, 0.4);
      this.setSquash(1.3, 0.7);
      Sfx.trapWhoosh();
      this.finishAttack();
    }

    /** Lands with a blast that hurts a boy standing on the floor close by. */
    shockwave() {
      const radius = this.spec.shockRadius;
      this.cooldown = randomBetween(...this.spec.cooldown) / this.speed;
      this.effects.spawnRing({ color: this.colors.accent, x: this.x, y: this.floorY + 0.15, fromScale: 0.4, toScale: radius * 2, lifetime: 0.3 });
      this.particles.burst(this.x, this.floorY + 0.15, 12, this.colors.accent, 1.8, 0.4);
      Sfx.golemStep();
      const player = this.target;
      if (player && Math.abs(player.y - this.floorY) < 0.25 && Math.abs(player.x - this.x) < radius) player.takeDamage(this.damage, this.x);
    }

    finishAttack() {
      this.cooldown = randomBetween(...this.spec.cooldown) / this.speed;
      this.walkOn();
    }

    // ==========================================
    // Flying
    // ==========================================
    thinkInTheAir(deltaSeconds, player) {
      if (this.state === CreatureState.SWOOP) {
        this.updateSwoop();
        return;
      }
      if (this.state !== CreatureState.HOVER) return;
      this.flap(deltaSeconds);
      // Patrol its stretch of sky (not hanging beside the boy), bobbing up and down
      this.patrolFlight(deltaSeconds, player);
      const targetY = this.hoverY + Math.sin(this.time * 3) * 0.3;
      this.y += (targetY - this.y) * Math.min(1, 3 * deltaSeconds);
      // Out of range, it holds off (without the warning flash): droppers wait until he's right below
      const range = this.spec.attack === 'drop' ? DROP_ATTACK_RANGE : undefined;
      if (!this.isWithinAttackRange(player, range)) this.stateTimer = Math.max(this.stateTimer, this.spec.telegraph + 0.1);
      // The warning: it flashes just before attacking
      const warning = this.stateTimer < this.spec.telegraph;
      this.tint = warning && Math.sin(this.stateTimer * 30) > 0 ? WARNING_TINT : WHITE;
      if (this.stateTimer > 0 || player.isDefeated) return;
      this.tint = WHITE;
      const { attack } = this.spec;
      if (attack === 'swoop') {
        this.startSwoop(player);
        return;
      }
      if (attack === 'drop') {
        this.lobAt(this.x, { ...this.spec.projectile, fromY: this.y - this.height * 0.3, seconds: 0.7 });
        this.showFrame('attack');
        Sfx.fireballLaunch();
      } else if (attack === 'throw') {
        this.spec.shots.forEach(offset => this.lobAt(player.x + offset, { ...this.spec.projectile, fromY: this.centerY, seconds: this.spec.throwSeconds }));
        this.showFrame('attack');
        Sfx.fireballLaunch();
      }
      this.stateTimer = randomBetween(...this.spec.attackEvery) / this.speed;
    }

    flap(deltaSeconds) {
      this.animationTimer += deltaSeconds;
      if (this.animationTimer < FLAP_SECONDS) return;
      this.animationTimer = 0;
      this.showFrame(this.frameName === 'walk1' ? 'walk2' : 'walk1');
    }

    /** Dive in a U-shaped arc through the boy's position and back up on the other side. */
    startSwoop(player) {
      this.state = CreatureState.SWOOP;
      this.swoopDistanceX = (player.x - this.x) * 2;
      this.swoopSeconds = this.swoopDuration(SWOOP_SECONDS, this.swoopDistanceX);
      this.stateTimer = this.swoopSeconds;
      this.swoopStartX = this.x;
      this.swoopStartY = this.y;
      this.swoopDepth = Math.max(0.5, this.y - (this.floorY + SWOOP_BOTTOM));
      this.showFrame('attack');
      Sfx.swoopScreech();
    }

    updateSwoop() {
      const progress = 1 - this.stateTimer / this.swoopSeconds;
      const finished = progress >= 1;
      if (!finished) {
        this.x = this.swoopStartX + this.swoopDistanceX * progress;
        this.y = this.swoopStartY - this.swoopDepth * Math.sin(Math.PI * progress);
        this.facing = Math.sign(this.swoopDistanceX) || this.facing;
      }
      if (finished || this.keepInsideLevel()) {
        this.state = CreatureState.HOVER;
        this.stateTimer = randomBetween(...this.spec.attackEvery) / this.speed;
        this.side = -this.side;
        this.showFrame('walk1');
      }
    }

    recover() {
      this.tint = WHITE;
      if (this.isFlyer) {
        this.isFlying = true;
        this.state = CreatureState.HOVER;
        this.stateTimer = 1.0;
      } else if (this.spec.movement === 'hopper') {
        this.rest();
      } else {
        this.walkOn();
      }
    }
  }

  // One class per creature, registered by kind like every other hand-made creature
  const classes = Object.fromEntries(SPECIES.map(spec => [spec.kind, class extends WorldCreature {
    constructor(world, options) {
      super(world, options, spec);
    }
  }]));
  Object.assign(Forest.SkyCreatures, classes);

  Forest.WorldCreatures = Object.freeze({
    species: SPECIES,
    /** The creature that belongs to a world (by world id), if it has one here. */
    forWorld: worldId => SPECIES.find(spec => spec.world === worldId) || null
  });
})(window.Forest);
