/**
 * Monster Forge, part 3: what each ability does in the game.
 *
 * The ids, costs and labels live in Forest.MonsterGenome.ABILITIES; this file adds the behaviour.
 * Abilities are stateless objects: anything they need to remember is stored on the monster
 * (monster.attackPhase, monster.stateTimer, ...). The monster itself is a Forest.RandomMonster.
 *
 * Attacks run one at a time, with a cooldown in between:
 *   canStart(monster, player)        may it start right now?
 *   start(monster, player)           begin (normally a wind-up with the 'attack' frame as a tell)
 *   update(monster, dt, player)      called every frame; returns true when the attack is over
 *   onTouchGround(monster, impact)   optional; return true to handle a landing
 *   cooldown: [min, max]             seconds before the next attack (divided by the monster's speed)
 *
 * Passives are always on and may implement any of:
 *   setup(monster), update(monster, dt, player),
 *   onHurt(monster) (return true to shrug the hit off), afterRecover(monster), onExploded(monster)
 */
(function (Forest) {
  const { GROUND_Y, LEVEL_START_X, LEVEL_END_X } = Forest.Config;
  const { clamp, randomBetween, randomDirection } = Forest.MathUtils;
  const { CreatureState } = Forest;
  const Sfx = Forest.SoundEffects;

  /** Same gravity as the sky creatures use on the ground (see skyCreatures.js), for aiming jumps. */
  const GRAVITY = 22;
  const WHITE = 0xffffff;
  const ANGRY_TINT = 0xff7070;
  const CHARGE_TINT = 0xffb0b0;
  const GLOW_TINT = 0xffd080;
  const NOVA_TINT = 0xffc0ff;
  const LEVEL_MARGIN = 1;

  function directionTowards(fromX, toX) {
    return toX >= fromX ? 1 : -1;
  }

  function distanceBetweenCentres(monster, player) {
    return Math.hypot(player.x - monster.x, player.y + player.height / 2 - monster.centerY);
  }

  function isStandingOnGrass(player) {
    return player && !player.isDefeated && player.y < GROUND_Y + 0.25;
  }

  /** Shake on the spot, blinking between two tints: the "something is coming" tell. */
  function shudder(monster, tint) {
    monster.offsetX = Math.sin(monster.stateTimer * 70) * 0.05;
    monster.tint = Math.sin(monster.stateTimer * 30) > 0 ? tint : WHITE;
  }

  // ==========================================
  // Attacks
  // ==========================================

  /** Growl and paw the ground, then dash across the grass. */
  const charge = {
    cooldown: [1.4, 2.4],

    canStart(monster, player) {
      return monster.isOnGround && Math.abs(player.x - monster.x) < 6.5;
    },

    start(monster, player) {
      monster.facing = directionTowards(monster.x, player.x);
      monster.state = CreatureState.TELEGRAPH;
      monster.stateTimer = 0.6 / Math.sqrt(monster.speed);
      monster.showFrame('attack');
      Sfx.beetleGrowl();
    },

    update(monster, deltaSeconds) {
      if (monster.state === CreatureState.TELEGRAPH) {
        shudder(monster, ANGRY_TINT);
        if (Math.random() < 0.3) {
          monster.particles.burst(monster.x - monster.facing * monster.width * 0.4, GROUND_Y + 0.05, 1, '#8d6849', 0.6, 0.3);
        }
        if (monster.stateTimer <= 0) {
          monster.state = CreatureState.CHARGE;
          monster.stateTimer = 0.9;
          monster.tint = CHARGE_TINT;
          Sfx.beetleCharge();
        }
        return false;
      }

      const hitEdge = monster.moveHorizontally(monster.facing * 8 * monster.speed * deltaSeconds);
      monster.animate(deltaSeconds, 0.05, 'attack', 'move');
      if (Math.random() < 0.5) {
        monster.particles.burst(monster.x - monster.facing * monster.width * 0.5, GROUND_Y + 0.05, 1, '#8d6849', 0.5, 0.3);
      }
      if (hitEdge) {
        Sfx.creatureLand();
        monster.cameraController.shake(0.08, 0.15);
        monster.setSquash(0.7, 1.2);
      }
      return hitEdge || monster.stateTimer <= 0;
    }
  };

  /** Crouch, leap at the boy and slam into the grass: a shockwave he has to jump over. */
  const leap = {
    cooldown: [1.8, 3.0],

    canStart(monster, player) {
      return monster.isOnGround && Math.abs(player.x - monster.x) < 7;
    },

    start(monster) {
      monster.state = CreatureState.TELEGRAPH;
      monster.stateTimer = 0.4;
      monster.attackPhase = 'windup';
      monster.showFrame('attack');
      monster.setSquash(1.25, 0.75);
    },

    update(monster, deltaSeconds, player) {
      if (monster.attackPhase === 'windup') {
        monster.offsetX = Math.sin(monster.stateTimer * 80) * 0.04;
        monster.setSquash(1.2, 0.8);
        if (monster.stateTimer <= 0) {
          const jumpSpeed = monster.genome.isMini ? 6.5 : 8.5;
          const airSeconds = (2 * jumpSpeed) / GRAVITY;
          const targetX = player.isDefeated ? monster.x + randomBetween(-3, 3) : player.x;
          const maxSpeedX = 5 * monster.speed;
          monster.velocityX = clamp((targetX - monster.x) / airSeconds, -maxSpeedX, maxSpeedX);
          monster.velocityY = jumpSpeed;
          monster.facing = directionTowards(monster.x, targetX);
          monster.state = CreatureState.JUMP;
          // Safety net in case the landing is never detected (e.g. knocked into a wall)
          monster.stateTimer = 3;
          monster.attackPhase = 'airborne';
          monster.setSquash(0.7, 1.35);
          Sfx.jellyBoing();
        }
        return false;
      }
      return monster.attackPhase === 'landed' || monster.stateTimer <= 0;
    },

    onTouchGround(monster) {
      if (monster.attackPhase !== 'airborne') return false;
      monster.attackPhase = 'landed';

      const radius = clamp(monster.width * 1.4, 1.3, 3.2);
      monster.setSquash(1.4, 0.6);
      monster.effects.spawnRing({ color: monster.colors.accent, x: monster.x, y: GROUND_Y + 0.15, fromScale: 0.4, toScale: radius * 2, lifetime: 0.3 });
      monster.effects.spawnRing({ color: '#ffeaa7', x: monster.x, y: GROUND_Y + 0.15, fromScale: 0.3, toScale: radius * 1.4, lifetime: 0.4 });
      monster.particles.burst(monster.x, GROUND_Y + 0.1, 12, '#8d6849', 1.6, 0.5);
      monster.cameraController.shake(0.06 + monster.width * 0.04, 0.18);
      if (monster.width > 1.1) Sfx.golemLand(); else Sfx.creatureLand();

      const player = monster.target;
      if (isStandingOnGrass(player) && Math.abs(player.x - monster.x) < radius) {
        player.takeDamage(monster.damage, monster.x);
      }
      return true;
    }
  };

  /** Puff up with a glowing mouth, then lob fireballs that come down on the boy. */
  const spit = {
    cooldown: [2.2, 3.4],

    canStart(monster, player) {
      const distance = Math.abs(player.x - monster.x);
      return distance > 1.2 && distance < 9 && (monster.isOnGround || monster.isFlying);
    },

    start(monster, player) {
      monster.facing = directionTowards(monster.x, player.x);
      monster.state = CreatureState.THROW;
      monster.stateTimer = 0.55 / Math.sqrt(monster.speed);
      monster.attackPhase = 'windup';
      monster.showFrame('attack');
      monster.setSquash(1.1, 0.92);
    },

    update(monster, deltaSeconds, player) {
      if (monster.attackPhase === 'windup') {
        monster.tint = Math.random() < 0.5 ? GLOW_TINT : WHITE;
        if (Math.random() < 0.4) {
          monster.particles.burst(monster.x + monster.facing * monster.width * 0.2, monster.centerY, 1, '#ffb347', 0.5, 0.3);
        }
        if (monster.stateTimer <= 0) {
          const count = monster.genome.isMini || monster.genome.power < 7 ? 1 : 3;
          const mouthX = monster.x + monster.facing * monster.width * 0.25;
          const mouthY = monster.y + monster.height * 0.5;
          for (let i = 0; i < count; i++) {
            const targetX = player.x + (i - (count - 1) / 2) * 1.5;
            monster.world.projectiles.launchFireball(mouthX, mouthY, targetX, GROUND_Y + 0.3, 1.0, monster.damage);
          }
          Sfx.fireballLaunch();
          monster.setSquash(0.85, 1.15);
          monster.tint = monster.restingTint;
          monster.attackPhase = 'recover';
          monster.stateTimer = 0.35;
        }
        return false;
      }
      return monster.stateTimer <= 0;
    }
  };

  /** Flyers only: dive in a U-shaped arc through the boy's position and back up the other side. */
  const swoop = {
    cooldown: [1.2, 2.2],

    canStart(monster, player) {
      return monster.isFlying && Math.abs(player.x - monster.x) < 6;
    },

    start(monster, player) {
      const duration = 1.0 / monster.speed;
      monster.state = CreatureState.SWOOP;
      monster.stateTimer = duration;
      monster.swoopPath = {
        duration,
        startX: monster.x,
        startY: monster.y,
        distanceX: (player.x - monster.x) * 2,
        depth: Math.max(0.5, monster.y - (GROUND_Y + 0.3))
      };
      monster.tint = NOVA_TINT;
      monster.showFrame('attack');
      Sfx.swoopScreech();
    },

    update(monster) {
      const path = monster.swoopPath;
      const progress = 1 - monster.stateTimer / path.duration; // 0 -> 1
      if (progress >= 1) return true;
      monster.x = path.startX + path.distanceX * progress;
      monster.y = path.startY - path.depth * Math.sin(Math.PI * progress);
      monster.facing = Math.sign(path.distanceX) || monster.facing;
      return monster.keepInsideLevel();
    },

    finish(monster) {
      // Next time, hover on the other side
      monster.side = -monster.side;
    }
  };

  /** Swell up while a ring shows the danger zone, then burst: step outside the ring in time! */
  const nova = {
    cooldown: [2.5, 4.0],

    radius(monster) {
      return clamp(monster.width * 1.1 + 0.9, 1.8, 2.8);
    },

    canStart(monster, player) {
      return distanceBetweenCentres(monster, player) < this.radius(monster) + 0.6;
    },

    start(monster) {
      const windup = 0.8 / Math.sqrt(monster.speed);
      monster.state = CreatureState.TELEGRAPH;
      monster.stateTimer = windup;
      monster.attackPhase = 'windup';
      monster.showFrame('attack');
      monster.effects.spawnRing({
        color: monster.colors.accent, x: monster.x, y: monster.centerY,
        fromScale: 0.3, toScale: this.radius(monster) * 2, lifetime: windup, z: 0.61
      });
      Sfx.beetleGrowl();
    },

    update(monster, deltaSeconds, player) {
      if (monster.attackPhase === 'windup') {
        const swell = 1 + Math.abs(Math.sin(monster.stateTimer * 18)) * 0.12;
        monster.setSquash(swell, swell);
        monster.tint = Math.sin(monster.stateTimer * 30) > 0 ? NOVA_TINT : WHITE;
        if (Math.random() < 0.5) {
          monster.particles.burst(monster.x + randomBetween(-0.5, 0.5) * monster.width, monster.centerY, 1, monster.colors.accent, 0.4, 0.3);
        }
        if (monster.stateTimer <= 0) this.burst(monster, player);
        return false;
      }
      return monster.stateTimer <= 0;
    },

    burst(monster, player) {
      const radius = this.radius(monster);
      const { x, centerY } = monster;
      monster.effects.spawnDisc({ color: '#fff4c2', x, y: centerY, fromScale: 0.5, toScale: radius * 1.2, lifetime: 0.12, z: 0.62 });
      monster.effects.spawnRing({ color: monster.colors.accent, x, y: centerY, fromScale: 0.5, toScale: radius * 2.2, lifetime: 0.3, z: 0.61 });
      monster.particles.burst(x, centerY, 18, monster.colors.accent, 2.4, 0.5);
      monster.particles.burst(x, centerY, 10, monster.colors.main, 1.8, 0.5);
      monster.setSquash(1.3, 0.8);
      monster.tint = monster.restingTint;
      monster.cameraController.shake(0.1, 0.2);
      Sfx.jellyZap();

      if (!player.isDefeated && distanceBetweenCentres(monster, player) < radius) {
        player.takeDamage(monster.damage, x);
      }
      monster.attackPhase = 'recover';
      monster.stateTimer = 0.35;
    }
  };

  /** Shudder and spit out a mini copy of itself (at most two alive at once). */
  const brood = {
    cooldown: [4, 6],
    maxBroodlings: 2,

    canStart(monster) {
      const isSteady = monster.isOnGround || monster.isFlying;
      return isSteady && !monster.genome.isMini && monster.countLivingBroodlings() < this.maxBroodlings;
    },

    start(monster) {
      monster.state = CreatureState.TELEGRAPH;
      monster.stateTimer = 0.6;
      monster.showFrame('attack');
    },

    update(monster) {
      shudder(monster, NOVA_TINT);
      if (monster.stateTimer > 0) return false;

      const direction = randomDirection();
      monster.spawnMini({ velocityX: direction * randomBetween(1.5, 3), velocityY: 6 });
      monster.particles.burst(monster.x, monster.centerY, 10, monster.colors.accent, 1.4, 0.4);
      monster.setSquash(1.3, 0.75);
      Sfx.acornCrack();
      return true;
    }
  };

  // ==========================================
  // Passives
  // ==========================================
  const swift = {}; // all in the stats (see MonsterGenome)

  /** At half health it roars, glows red and speeds up. */
  const enrage = {
    update(monster) {
      if (monster.isEnraged || monster.hp <= 0 || monster.hp > monster.maxHp / 2) return;
      monster.isEnraged = true;
      monster.speed *= 1.4;
      monster.tint = monster.restingTint;
      monster.particles.burst(monster.x, monster.centerY, 16, '#ff5a1f', 1.8, 0.6);
      monster.cameraController.shake(0.1, 0.3);
      Sfx.golemRoar();
    }
  };

  /** Heals one heart every couple of seconds once it hasn't been hit for a while. */
  const regenerate = {
    calmSeconds: 3,
    healEverySeconds: 2.5,

    setup(monster) {
      monster.regenTimer = this.healEverySeconds;
    },

    update(monster, deltaSeconds) {
      if (monster.hp >= monster.maxHp || monster.secondsSinceHit < this.calmSeconds) {
        monster.regenTimer = this.healEverySeconds;
        return;
      }
      monster.regenTimer -= deltaSeconds;
      if (monster.regenTimer > 0) return;
      monster.regenTimer = this.healEverySeconds;
      monster.hp = Math.min(monster.maxHp, monster.hp + 1);
      monster.particles.burst(monster.x, monster.centerY, 8, '#7dff6a', 0.9, 0.5);
      monster.particles.burst(monster.x, monster.y + monster.height, 4, '#ffffff', 0.5, 0.4);
    }
  };

  /** Half the time, it vanishes after being hit and pops up somewhere else near the boy. */
  const blink = {
    afterRecover(monster) {
      const player = monster.target;
      if (!player || player.isDefeated || Math.random() < 0.5) return;

      const puff = (x, y) => {
        monster.effects.spawnDisc({ color: monster.colors.accent, x, y, fromScale: 0.3, toScale: monster.width * 1.8, lifetime: 0.25, opacity: 0.7 });
        monster.particles.burst(x, y, 10, monster.colors.accent, 1.2, 0.35);
      };
      puff(monster.x, monster.centerY);
      const targetX = player.x + randomDirection() * randomBetween(2.5, 4);
      monster.x = clamp(targetX, LEVEL_START_X + LEVEL_MARGIN, LEVEL_END_X - LEVEL_MARGIN);
      monster.facing = directionTowards(monster.x, player.x);
      puff(monster.x, monster.centerY);
      Sfx.wingFlutter();
    }
  };

  /** Super armour: flinches, but is never knocked back or interrupted. */
  const armored = {
    setup(monster) {
      monster.knockbackResistance = 1;
    },

    onHurt(monster) {
      monster.setSquash(1.08, 0.92);
      monster.particles.burst(monster.x, monster.centerY, 5, '#ffffff', 1.0, 0.25);
      return true;
    }
  };

  /** Bursts into two mini copies of itself when defeated. */
  const splitter = {
    onExploded(monster) {
      if (monster.genome.isMini) return;
      [-1, 1].forEach(direction => monster.spawnMini({ velocityX: direction * 3, velocityY: 6 }));
    }
  };

  const behaviours = { charge, leap, spit, swoop, nova, brood, swift, enrage, regenerate, blink, armored, splitter };

  // Every ability in the genome catalogue needs a behaviour here, and vice versa
  Object.keys(Forest.MonsterGenome.ABILITIES).forEach(id => {
    if (!behaviours[id]) throw new Error(`Monster ability "${id}" has no behaviour in monsterAbilities.js`);
  });

  Forest.MonsterAbilities = Object.freeze(behaviours);
})(window.Forest);
