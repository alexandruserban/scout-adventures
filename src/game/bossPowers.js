/**
 * Every world's boss has a signature power of its own on top of how its kind moves and fights:
 * lightning, tidal waves, black holes, laser sweeps... (see POWERS, keyed by the `signature` of
 * each world's boss in Forest.Levels). The power is cast every few seconds during the fight, more
 * often and harder in each of the fight's three stages.
 *
 * Every attack is telegraphed first (a blinking mark where it will strike), so there is always time
 * to get out of the way: onto the arena's ledges, over it with a jump, or simply somewhere else.
 *
 *   const powers = new Forest.BossPowers({ scene, effects, particles, projectiles, cameraController,
 *     sprites, getPhysics, skyY, spawnMinion, say });
 *   powers.start({ signature: 'lightning', arena, boss, player });
 *   powers.setStage(2);
 *   powers.update(deltaSeconds);   // every frame
 *   powers.clear();                // when the boss is beaten, or the level is left
 */
(function (Forest) {
  const { removeMesh } = Forest.Graphics;
  const Sfx = Forest.SoundEffects;
  const { GROUND_Y } = Forest.Config;

  /** Seconds between casts in each stage (a little random either way), and before the first one. */
  const CAST_INTERVAL = [7.5, 5.8, 4.4];
  const CAST_JITTER = 1.0;
  const FIRST_CAST_DELAY = 4.5;
  /** Harder difficulties cast a little more often. */
  const DIFFICULTY_INTERVAL_SCALE = { EASY: 1.25, NORMAL: 1, HARD: 0.85 };
  /** Telegraphs blink this many times a second. */
  const BLINK_RATE = 9;
  const HAZARD_Z = 0.63;
  const MARKER_Z = 0.59;
  /** The arena floor is flat at the grass line. */
  const FLOOR_Y = GROUND_Y;

  const randomBetween = (low, high) => low + Math.random() * (high - low);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

  function hexToNumber(color) {
    return parseInt(color.replace('#', ''), 16);
  }

  // ==========================================
  // The power engine: hazards, telegraphs and helpers shared by every power
  // ==========================================
  class BossPowers {
    /**
     * @param {object} context
     * @param {THREE.Scene} context.scene
     * @param {object} context.effects Forest.EffectsSystem
     * @param {object} context.particles
     * @param {object} context.projectiles Forest.ProjectileSystem
     * @param {object} context.cameraController
     * @param {object} context.sprites the game sprites (stars, notes, web balls)
     * @param {() => object} context.getPhysics the level's physics rules (gravity, slippery), changed for a while by some powers
     * @param {() => number} context.skyY just above the top of the screen
     * @param {(x: number) => boolean} context.spawnMinion drop a helper in at x (false: too many already)
     * @param {(text: string, x: number, y: number, color?: string) => void} context.say floating text
     */
    constructor(context) {
      this.context = context;
      this.hazards = [];
      this.active = false;
      /** Physics changes to undo, as [key, original value]. */
      this.physicsChanges = [];
    }

    /** Begin the fight's powers. */
    start({ signature, arena, boss, player }) {
      this.clear();
      this.power = POWERS[signature] || null;
      this.arena = arena;
      this.boss = boss;
      this.player = player;
      this.stage = 1;
      this.active = Boolean(this.power);
      this.castTimer = FIRST_CAST_DELAY;
    }

    setStage(stage) {
      this.stage = stage;
      // A new stage opens with the power straight away (after a breath for the banner)
      if (this.active) this.castTimer = Math.min(this.castTimer, 2.2);
    }

    /** Stop casting and take every hazard and physics change away. */
    clear() {
      this.active = false;
      this.hazards.forEach(hazard => this.disposeHazard(hazard));
      this.hazards = [];
      this.restorePhysics();
    }

    update(deltaSeconds) {
      // Hazards already out finish what they're doing even after the boss falls
      for (let i = this.hazards.length - 1; i >= 0; i--) {
        const hazard = this.hazards[i];
        hazard.age += deltaSeconds;
        const keep = hazard.update(deltaSeconds, hazard);
        if (keep === false) {
          this.disposeHazard(hazard);
          this.hazards.splice(i, 1);
        }
      }
      if (!this.active) return;
      const { boss, player } = this;
      if (!boss || boss.isGone || boss.hp <= 0) {
        this.active = false;
        return;
      }
      if (player.isDefeated) return;
      this.castTimer -= deltaSeconds;
      if (this.castTimer > 0) return;
      const scale = DIFFICULTY_INTERVAL_SCALE[Forest.Difficulty.current.id] || 1;
      this.castTimer = (CAST_INTERVAL[this.stage - 1] + randomBetween(-CAST_JITTER, CAST_JITTER)) * scale;
      this.cast();
    }

    cast() {
      const { boss } = this;
      this.context.say(this.power.name, boss.x, boss.y + boss.height + 0.6, this.power.color);
      this.power.cast(this, this.stage);
    }

    // ------------------------------------------
    // Where things are
    // ------------------------------------------
    get left() {
      return this.arena.start + 0.6;
    }

    get right() {
      return this.arena.end - 0.6;
    }

    /** A random x inside the arena. */
    randomX(margin = 0.8) {
      return randomBetween(this.arena.start + margin, this.arena.end - margin);
    }

    clampX(x, margin = 0.8) {
      return clamp(x, this.arena.start + margin, this.arena.end - margin);
    }

    /** Spots spread evenly across the arena. */
    slots(count, margin = 1.2) {
      const width = this.arena.end - this.arena.start - 2 * margin;
      return Array.from({ length: count }, (_, i) => this.arena.start + margin + (width * (i + 0.5)) / count);
    }

    /** The boy's body as a box. */
    playerBox() {
      const { player } = this;
      return {
        left: player.x - player.width * 0.28,
        right: player.x + player.width * 0.28,
        bottom: player.y,
        top: player.y + player.height * 0.85
      };
    }

    /** True when the boy's body overlaps the box. */
    playerOverlaps(left, right, bottom, top) {
      const box = this.playerBox();
      return !this.player.isDefeated && box.right > left && box.left < right && box.top > bottom && box.bottom < top;
    }

    hurtPlayer(fromX) {
      this.player.takeDamage(1, fromX);
    }

    /** Push the boy along by `distance`, never past the arena walls. */
    pushPlayer(distance) {
      const { player } = this;
      if (player.isDefeated) return;
      player.x = clamp(player.x + distance, player.minX, player.maxX);
    }

    // ------------------------------------------
    // Meshes
    // ------------------------------------------
    quad(color, opacity = 1, z = HAZARD_Z) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ color: hexToNumber(color), transparent: true, opacity, depthWrite: false })
      );
      mesh.position.z = z;
      this.context.scene.add(mesh);
      return mesh;
    }

    /** Stretch a quad over a box. */
    placeQuad(mesh, left, right, bottom, top) {
      mesh.position.x = (left + right) / 2;
      mesh.position.y = (bottom + top) / 2;
      mesh.scale.set(Math.max(0.01, right - left), Math.max(0.01, top - bottom), 1);
    }

    blink(mesh, age, low = 0.15, high = 0.7) {
      mesh.material.opacity = Math.floor(age * BLINK_RATE) % 2 ? high : low;
    }

    /** Add a hazard: `update(deltaSeconds, hazard)` returns false once it's done. Meshes in `meshes` are removed then. */
    add(hazard) {
      const full = { age: 0, meshes: [], ...hazard };
      this.hazards.push(full);
      return full;
    }

    disposeHazard(hazard) {
      hazard.meshes.forEach(mesh => removeMesh(this.context.scene, mesh, { disposeGeometry: true }));
      hazard.meshes = [];
      if (hazard.onDispose) hazard.onDispose();
    }

    /** Run `action` after `seconds`. */
    later(seconds, action) {
      this.add({ update: (dt, self) => {
        if (self.age < seconds) return true;
        action();
        return false;
      } });
    }

    // ------------------------------------------
    // Hazard kinds
    // ------------------------------------------
    /**
     * A pillar that shoots up out of the floor (or comes down from the sky) after a blinking warning
     * on the ground: lightning bolts, lava geysers, sand spikes.
     */
    pillar({ x, width, height, warn, active = 0.45, color, warnColor = color, sound, onStrike }) {
      const marker = this.quad(warnColor, 0.4, MARKER_Z);
      this.placeQuad(marker, x - width / 2, x + width / 2, FLOOR_Y - 0.02, FLOOR_Y + 0.14);
      const body = this.quad(color, 0);
      let struck = false;
      this.add({
        meshes: [marker, body],
        update: (dt, self) => {
          if (self.age < warn) {
            this.blink(marker, self.age, 0.2, 0.85);
            // A faint ghost of what's coming
            this.placeQuad(body, x - width * 0.2, x + width * 0.2, FLOOR_Y, FLOOR_Y + height);
            body.material.opacity = 0.08 + 0.06 * Math.sin(self.age * 20);
            return true;
          }
          if (!struck) {
            struck = true;
            if (sound) sound();
            this.context.particles.burst(x, FLOOR_Y + 0.3, 10, color, 1.6, 0.5);
            if (onStrike) onStrike();
          }
          const t = (self.age - warn) / active;
          if (t >= 1) return false;
          const grow = Math.min(1, t * 5);
          marker.material.opacity = 0.5 * (1 - t);
          this.placeQuad(body, x - width / 2, x + width / 2, FLOOR_Y, FLOOR_Y + height * grow);
          body.material.opacity = 0.9 * (1 - t * 0.6);
          if (this.playerOverlaps(x - width / 2, x + width / 2, FLOOR_Y - 0.5, FLOOR_Y + height * grow)) this.hurtPlayer(x);
          return true;
        }
      });
    }

    /** A round blast after a blinking ring on the ground: bombs, spell circles, landing slams. */
    blast({ x, radius, height = radius * 1.4, warn, color, sound }) {
      const marker = this.quad(color, 0.4, MARKER_Z);
      this.placeQuad(marker, x - radius, x + radius, FLOOR_Y - 0.02, FLOOR_Y + 0.12);
      let exploded = false;
      this.add({
        meshes: [marker],
        update: (dt, self) => {
          if (self.age < warn) {
            // Blinks faster as it gets close
            const rate = self.age > warn * 0.6 ? 2 : 1;
            marker.material.opacity = Math.floor(self.age * BLINK_RATE * rate) % 2 ? 0.9 : 0.2;
            if (Math.random() < 0.3) this.context.particles.burst(x + randomBetween(-radius, radius), FLOOR_Y + 0.2, 1, color, 0.6, 0.4);
            return true;
          }
          if (!exploded) {
            exploded = true;
            const { effects, particles, cameraController } = this.context;
            effects.spawnDisc({ color: '#fff4c2', x, y: FLOOR_Y + height * 0.4, fromScale: 0.5, toScale: radius * 2.2, lifetime: 0.15, z: 0.62 });
            effects.spawnRing({ color, x, y: FLOOR_Y + height * 0.4, fromScale: 0.4, toScale: radius * 2.8, lifetime: 0.35, z: 0.61 });
            particles.burst(x, FLOOR_Y + 0.5, 16, color, 2.2, 0.6);
            cameraController.shake(0.12, 0.25);
            if (sound) sound();
            else Sfx.fireballImpact();
            if (this.playerOverlaps(x - radius, x + radius, FLOOR_Y - 0.5, FLOOR_Y + height)) this.hurtPlayer(x);
          }
          return false;
        }
      });
    }

    /**
     * A beam across the arena at one height (lasers, flames): a thin blinking line first, then it
     * fires for `active` seconds. `left`/`right` default to the whole arena.
     */
    band({ bottom, top, left = this.arena.start, right = this.arena.end, warn, active, color, coreColor = '#ffffff', sound, grow = 0, fromX }) {
      const warning = this.quad(color, 0.3);
      this.placeQuad(warning, left, right, (bottom + top) / 2 - 0.04, (bottom + top) / 2 + 0.04);
      const body = this.quad(color, 0);
      const core = this.quad(coreColor, 0, HAZARD_Z + 0.005);
      let fired = false;
      this.add({
        meshes: [warning, body, core],
        update: (dt, self) => {
          if (self.age < warn) {
            this.blink(warning, self.age, 0.15, 0.75);
            return true;
          }
          if (!fired) {
            fired = true;
            warning.material.opacity = 0;
            if (sound) sound();
          }
          const t = (self.age - warn) / active;
          if (t >= 1) return false;
          // Flames roll out from the mouth (`fromX`) instead of appearing all at once
          let from = left;
          let to = right;
          if (grow > 0 && fromX !== undefined) {
            const reach = Math.min(1, (self.age - warn) / grow);
            if (fromX <= left + 0.01) to = left + (right - left) * reach;
            else from = right - (right - left) * reach;
          }
          const flicker = 0.85 + Math.random() * 0.15;
          this.placeQuad(body, from, to, bottom, top);
          body.material.opacity = 0.75 * flicker * (1 - t * 0.5);
          const middle = (bottom + top) / 2;
          const half = (top - bottom) * 0.18;
          this.placeQuad(core, from, to, middle - half, middle + half);
          core.material.opacity = 0.9 * (1 - t * 0.5);
          if (Math.random() < 0.5) this.context.particles.burst(randomBetween(from, to), randomBetween(bottom, top), 1, color, 0.8, 0.3);
          if (this.playerOverlaps(from, to, bottom, top)) this.hurtPlayer(fromX !== undefined ? fromX : (from + to) / 2);
          return true;
        }
      });
    }

    /** A wall rolling along the floor (shockwaves, tidal waves): jump over it or get up on a ledge. */
    wave({ x, direction, speed, width, height, color, foam = '#ffffff' }) {
      const body = this.quad(color, 0.8);
      const crest = this.quad(foam, 0.9, HAZARD_Z + 0.005);
      let position = x;
      this.add({
        meshes: [body, crest],
        update: dt => {
          position += direction * speed * dt;
          if (position < this.arena.start - width || position > this.arena.end + width) return false;
          const left = position - width / 2;
          const right = position + width / 2;
          this.placeQuad(body, left, right, FLOOR_Y, FLOOR_Y + height);
          this.placeQuad(crest, left, right, FLOOR_Y + height - 0.12, FLOOR_Y + height);
          if (Math.random() < 0.6) this.context.particles.burst(position, FLOOR_Y + height, 1, foam, 0.9, 0.4);
          if (this.playerOverlaps(left + 0.15, right - 0.15, FLOOR_Y - 0.5, FLOOR_Y + height - 0.1)) this.hurtPlayer(position - direction);
          return true;
        }
      });
    }

    /** A straight beam between two points (prism rays): warning line, then it fires. */
    ray({ fromX, fromY, toX, toY, thickness, warn, active, colors, sound }) {
      const { effects } = this.context;
      const length = Math.hypot(toX - fromX, toY - fromY);
      const angle = Math.atan2(toY - fromY, toX - fromX);
      const warning = this.quad(colors[0], 0.3);
      warning.position.set((fromX + toX) / 2, (fromY + toY) / 2, HAZARD_Z);
      warning.scale.set(length, 0.06, 1);
      warning.rotation.z = angle;
      let fired = false;
      this.add({
        meshes: [warning],
        update: (dt, self) => {
          if (self.age < warn) {
            this.blink(warning, self.age, 0.15, 0.7);
            return true;
          }
          if (!fired) {
            fired = true;
            warning.material.opacity = 0;
            if (sound) sound();
            colors.forEach((color, i) => effects.spawnBeam({
              color, fromX, fromY, toX, toY, thickness: thickness * (1 - i / (colors.length + 1)), lifetime: active, z: 0.62 + i * 0.002
            }));
          }
          if (self.age - warn >= active) return false;
          // Distance from the middle of his body to the beam's line
          const { player } = this;
          if (player.isDefeated) return true;
          const px = player.x;
          const py = player.y + player.height * 0.45;
          const along = clamp(((px - fromX) * (toX - fromX) + (py - fromY) * (toY - fromY)) / (length * length), 0, 1);
          const distance = Math.hypot(px - (fromX + (toX - fromX) * along), py - (fromY + (toY - fromY) * along));
          if (distance < thickness / 2 + player.width * 0.25) this.hurtPlayer(fromX);
          return true;
        }
      });
    }

    /** A pull towards (positive `strength`) or push away from the boss, for `seconds`. */
    force({ seconds, strength, color }) {
      this.add({
        update: (dt, self) => {
          if (self.age >= seconds) return false;
          const { boss, player } = this;
          if (!boss || boss.isGone) return false;
          const direction = boss.x >= player.x ? 1 : -1;
          // Never drags him right into the boss
          if (strength > 0 && Math.abs(boss.x - player.x) < boss.width * 0.6 + 0.6) return true;
          this.pushPlayer(direction * strength * dt);
          if (color && Math.random() < 0.7) {
            const x = this.randomX(0.4);
            this.context.particles.burst(x, randomBetween(0.3, 5), 1, color, 0.5, 0.5);
          }
          return true;
        }
      });
    }

    /** A sticky puddle on the floor that slows him while he walks through it. */
    puddle({ x, width, seconds, color }) {
      const mesh = this.quad(color, 0.85, MARKER_Z);
      this.placeQuad(mesh, x - width / 2, x + width / 2, FLOOR_Y - 0.02, FLOOR_Y + 0.16);
      this.add({
        meshes: [mesh],
        update: (dt, self) => {
          if (self.age >= seconds) return false;
          mesh.material.opacity = 0.85 * Math.min(1, (seconds - self.age) / 0.6);
          const { player } = this;
          if (!player.isDefeated && player.isGrounded && player.y < FLOOR_Y + 0.3 && Math.abs(player.x - x) < width / 2) {
            player.entangle(0.5, 0.4);
          }
          return true;
        }
      });
    }

    /** Change the level's physics for a while (low gravity, slippery floor), then put it back. */
    bendPhysics(changes, seconds) {
      const physics = this.context.getPhysics();
      Object.entries(changes).forEach(([key, value]) => {
        if (!this.physicsChanges.some(([changedKey]) => changedKey === key)) this.physicsChanges.push([key, physics[key]]);
        physics[key] = value;
      });
      this.add({
        update: (dt, self) => {
          if (self.age < seconds) return true;
          this.restorePhysics(Object.keys(changes));
          return false;
        }
      });
    }

    restorePhysics(keys = null) {
      const physics = this.context.getPhysics();
      this.physicsChanges = this.physicsChanges.filter(([key, value]) => {
        if (keys && !keys.includes(key)) return true;
        physics[key] = value;
        return false;
      });
    }

    /** Something thrown from the boss (or the sky) that lands at targetX. */
    lob(targetX, { fromX = this.boss.x, fromY = this.boss.y + this.boss.height * 0.7, seconds = 1.1, damage = 1, ...style } = {}) {
      this.context.projectiles.launchFireball(fromX, fromY, targetX, FLOOR_Y + 0.3, seconds, damage, style);
    }

    /** Something dropped from above the screen onto targetX, with a flashing mark where it lands. */
    drop(targetX, { seconds = 1.4, damage = 1, marker = '#ff3b3b', ...style } = {}) {
      const fromX = targetX + randomBetween(-1.5, 1.5);
      this.context.projectiles.launchFireball(fromX, this.context.skyY(), targetX, FLOOR_Y + 0.3, seconds, damage, { marker, ...style });
    }
  }

  // ==========================================
  // The bosses' powers
  // ==========================================
  /** `cast(p, stage)`: p is the BossPowers engine, stage 1 to 3. */
  const POWERS = {
    /** King Thunder Jelly: lightning bolts strike from the sky, one always where the boy stands. */
    lightning: {
      name: '⚡ LIGHTNING STORM!', color: '#fff36b',
      cast(p, stage) {
        const spots = [p.player.x];
        for (let i = 0; i < stage + 1; i++) spots.push(p.randomX());
        spots.forEach((x, i) => p.later(i * 0.25, () => p.pillar({
          x: p.clampX(x), width: 1.1, height: 14, warn: 1.1, active: 0.35, color: '#fff36b', warnColor: '#ffe14a', sound: () => Sfx.jellyZap()
        })));
      }
    },

    /** The Cinder Golem: a rain of flaming rocks from above. */
    meteorRain: {
      name: '☄ METEOR RAIN!', color: '#ff8a3d',
      cast(p, stage) {
        const count = 2 + stage * 2;
        for (let i = 0; i < count; i++) {
          p.later(i * 0.3, () => {
            p.drop(i === 0 ? p.player.x : p.randomX(), { seconds: 1.4 });
            Sfx.skyWhistle();
          });
        }
      }
    },

    /** The Gloomwing Queen: drowsy dust drifts down and slows the boy, so her dives land. */
    sleepDust: {
      name: '💤 SLEEPY DUST!', color: '#d7b6ff',
      cast(p, stage) {
        const count = 3 + stage * 2;
        for (let i = 0; i < count; i++) {
          p.later(i * 0.25, () => p.drop(i % 2 === 0 ? p.player.x + randomBetween(-1.5, 1.5) : p.randomX(), {
            seconds: 1.9, damage: stage >= 2 ? 1 : 0, marker: '#c58cff', tint: 0xd7b6ff,
            trail: ['#f3e8ff', '#d7b6ff', '#a77bff'], entangle: { seconds: 2.2, speedFactor: 0.4 }
          }));
        }
      }
    },

    /** The Dune Thornback: sand spikes burst up in a line racing from the beetle towards the boy. */
    burrowSpikes: {
      name: '🌵 SAND SPIKES!', color: '#f2c46d',
      cast(p, stage) {
        const lines = stage >= 3 ? [1, -1] : [p.player.x >= p.boss.x ? 1 : -1];
        lines.forEach((direction, lineIndex) => {
          for (let step = 0, x = p.boss.x + direction * 1.4; x > p.left && x < p.right; step++, x += direction * 1.25) {
            const spikeX = x;
            p.later(lineIndex * 0.9 + step * (stage >= 2 ? 0.1 : 0.13), () => p.pillar({
              x: spikeX, width: 0.9, height: 1.3, warn: 0.55, active: 0.4, color: '#e0a64a', warnColor: '#f2c46d', sound: () => Sfx.trapThump()
            }));
          }
        });
      }
    },

    /** The Frost Behemoth: icicles snap off the ceiling; one that hits freezes the boy for a moment. */
    icicles: {
      name: '❄ ICICLE FALL!', color: '#bfefff',
      cast(p, stage) {
        const count = 3 + stage * 2;
        for (let i = 0; i < count; i++) {
          p.later(i * 0.22, () => p.drop(i === 0 ? p.player.x : p.randomX(), {
            seconds: 1.2, marker: '#8fdcff', tint: 0xbfefff, trail: ['#ffffff', '#bfefff', '#7cc8ff'],
            entangle: { seconds: 1.2, speedFactor: 0.45 }
          }));
        }
        Sfx.skyWhistle();
      }
    },

    /** The Magma Golem: lava geysers erupt from every other spot on the floor, then from the rest. */
    eruption: {
      name: '🌋 ERUPTION!', color: '#ff6a2a',
      cast(p, stage) {
        const spots = p.slots(8, 1.2);
        const rounds = stage + 1;
        const first = Math.random() < 0.5 ? 0 : 1;
        for (let round = 0; round < rounds; round++) {
          spots.forEach((x, i) => {
            if ((i + round + first) % 2) return;
            p.later(round * 1.5, () => p.pillar({
              x, width: 1.4, height: 3.6, warn: 1.0, active: 0.5, color: '#ff6a2a', warnColor: '#ffb347', sound: i < 2 ? () => Sfx.trapHiss() : null
            }));
          });
        }
      }
    },

    /** The Jawbreaker: slams the ground so shockwaves roll out both ways. Jump them! */
    shockwave: {
      name: '💥 GROUND POUND!', color: '#ff7ad9',
      cast(p, stage) {
        for (let pulse = 0; pulse < stage; pulse++) {
          p.later(pulse * 0.7, () => {
            const x = p.boss.x;
            p.context.cameraController.shake(0.2, 0.3);
            Sfx.golemLand();
            [-1, 1].forEach(direction => p.wave({ x, direction, speed: 6.5, width: 0.7, height: 0.85, color: '#ff7ad9', foam: '#ffd1f0' }));
          });
        }
      }
    },

    /** The Star Devourer: a black hole drags the boy towards it, while space rocks fly. */
    blackHole: {
      name: '🌀 BLACK HOLE!', color: '#a78bfa',
      cast(p, stage) {
        const seconds = 2.2 + stage * 0.6;
        p.force({ seconds, strength: 2.0 + stage * 0.6, color: '#a78bfa' });
        const { effects } = p.context;
        for (let t = 0; t < seconds; t += 0.4) {
          p.later(t, () => effects.spawnRing({ color: '#7c3aed', x: p.boss.x, y: p.boss.centerY, fromScale: 7, toScale: 0.6, lifetime: 0.5, z: 0.6 }));
        }
        if (stage >= 2) {
          for (let i = 0; i < stage; i++) p.later(0.6 + i * 0.6, () => p.lob(p.player.x, { randomColor: true, seconds: 1.2 }));
        }
      }
    },

    /** The Neon Wyrm: a laser sweeps the arena, low (jump it) or high (stay on the ground). */
    laserSweep: {
      name: '🔫 LASER SWEEP!', color: '#ff2bd6',
      cast(p, stage) {
        const low = { bottom: 0.1, top: 0.75 };
        const high = { bottom: 1.7, top: 2.4 };
        const order = stage >= 3 ? [low, high] : [Math.random() < 0.5 ? low : high];
        order.forEach((height, i) => p.later(i * 1.7, () => {
          Sfx.laserCharge();
          p.band({ ...height, warn: 1.0, active: 0.55, color: '#ff2bd6', coreColor: '#ffe3fb', sound: () => Sfx.laserFire() });
        }));
      }
    },

    /** The Crystal Sentinel: sprays a fan of crystal shards right across the arena. */
    crystalFan: {
      name: '💎 CRYSTAL SPRAY!', color: '#7ff6ff',
      cast(p, stage) {
        const count = 5 + stage * 2;
        p.slots(count, 1).forEach((x, i) => p.later(i * 0.06, () => p.lob(x + randomBetween(-0.4, 0.4), {
          seconds: randomBetween(1.0, 1.4), tint: 0x9ffcff, trail: ['#ffffff', '#7ff6ff', '#3fb8ff'], marker: '#7ff6ff'
        })));
        Sfx.fireballLaunch();
      }
    },

    /** The Brass Beetle Titan: lobs ticking gear bombs that blow up a moment after landing. */
    gearBombs: {
      name: '⚙ GEAR BOMBS!', color: '#e6b35a',
      cast(p, stage) {
        const count = 2 + stage;
        for (let i = 0; i < count; i++) {
          const x = i === 0 ? p.clampX(p.player.x, 1.5) : p.randomX(1.5);
          p.later(i * 0.35, () => {
            p.lob(x, { seconds: 1.0, damage: 0, tint: 0xd9a441, trail: ['#ffe9a8', '#d9a441', '#7a5a22'] });
            p.later(1.0, () => p.blast({ x, radius: 1.5, height: 1.9, warn: 1.1, color: '#e6b35a', sound: () => Sfx.mushroomExplosion() }));
          });
        }
      }
    },

    /** The Abyssal Megajelly: a tidal wave rolls across the floor. Jump it or get up on a ledge. */
    tidalWave: {
      name: '🌊 TIDAL WAVE!', color: '#4fc3f7',
      cast(p, stage) {
        const fromLeft = p.player.x > (p.arena.start + p.arena.end) / 2;
        const waves = stage >= 3 ? [fromLeft, !fromLeft] : [fromLeft];
        waves.forEach((left, i) => p.later(i * 1.8, () => {
          Sfx.trapWhoosh();
          p.wave({
            x: left ? p.arena.start - 0.8 : p.arena.end + 0.8, direction: left ? 1 : -1,
            speed: 4.5 + stage * 0.6, width: 1.6, height: 1.15, color: '#1e88e5', foam: '#e1f5fe'
          });
        }));
      }
    },

    /** The Pixie Moth Empress: stars rain down on almost the whole arena. Find the gap! */
    starfall: {
      name: '✨ STARFALL!', color: '#ffe066',
      cast(p, stage) {
        const spots = p.slots(9, 1.1);
        const safe = Math.floor(Math.random() * spots.length);
        const safeCount = stage >= 3 ? 1 : 2;
        const falling = spots.filter((_, i) => i < safe || i >= safe + safeCount);
        // Fewer stars in the first stage
        const chosen = stage === 1 ? falling.filter((_, i) => i % 2 === 0) : falling;
        chosen.forEach((x, i) => p.later(i * 0.08, () => p.drop(x, {
          seconds: 1.5, marker: '#ffe066', sprite: p.context.sprites.star, trail: ['#fff7c2', '#ffe066', '#ffb703']
        })));
      }
    },

    /** The Dragon Mech: breathes a long roll of fire along the floor. Get up high, or behind it. */
    flameBreath: {
      name: '🔥 FLAME BREATH!', color: '#ff7b00',
      cast(p, stage) {
        const direction = p.player.x >= p.boss.x ? 1 : -1;
        const mouth = p.boss.x + direction * p.boss.width * 0.35;
        const reach = 7 + stage * 3;
        const left = direction > 0 ? mouth : Math.max(p.arena.start, mouth - reach);
        const right = direction > 0 ? Math.min(p.arena.end, mouth + reach) : mouth;
        p.band({
          bottom: 0, top: 1.35, left, right, fromX: direction > 0 ? left : right, grow: 0.45,
          warn: 0.8, active: 1.2 + stage * 0.2, color: '#ff7b00', coreColor: '#ffe066', sound: () => Sfx.fireballLaunch()
        });
      }
    },

    /** The Void Knight: steps through a portal right next to the boy and slams down. */
    voidStep: {
      name: '🕳 VOID STEP!', color: '#c084fc',
      cast(p, stage) {
        const steps = stage >= 3 ? 2 : 1;
        for (let i = 0; i < steps; i++) {
          p.later(i * 1.6, () => {
            const side = Math.random() < 0.5 ? -1 : 1;
            const x = p.clampX(p.player.x + side * 2.6, 1.5);
            const { effects } = p.context;
            effects.spawnRing({ color: '#c084fc', x, y: 1.2, fromScale: 0.4, toScale: 3, lifetime: 0.9, z: 0.6 });
            p.blast({ x, radius: 1.7, height: 2.2, warn: 0.95, color: '#a855f7', sound: () => Sfx.golemLand() });
            p.later(0.95, () => {
              const { boss } = p;
              if (!boss || boss.isGone || boss.hp <= 0) return;
              effects.spawnRing({ color: '#c084fc', x: boss.x, y: boss.centerY, fromScale: boss.width, toScale: 0.2, lifetime: 0.3, z: 0.6 });
              boss.x = x;
              if (boss.keepInsideLevel) boss.keepInsideLevel();
            });
          });
        }
      }
    },

    /** The Cosmic Archmage: magic circles flare up under the boy and around the arena, then explode. */
    spellCircles: {
      name: '🔮 SPELL CIRCLES!', color: '#8f7bff',
      cast(p, stage) {
        const spots = [p.clampX(p.player.x, 1.3)];
        for (let i = 0; i < stage; i++) spots.push(p.randomX(1.3));
        spots.forEach((x, i) => p.later(i * 0.3, () => p.blast({ x, radius: 1.3, height: 2.4, warn: 1.3, color: '#8f7bff', sound: () => Sfx.laserFire() })));
      }
    },

    /** The Ink Blot Golem: flings ink blots that leave sticky puddles on the floor. */
    inkFlood: {
      name: '🖋 INK FLOOD!', color: '#9ca3af',
      cast(p, stage) {
        const count = 2 + stage;
        for (let i = 0; i < count; i++) {
          const x = i === 0 ? p.clampX(p.player.x, 1.2) : p.randomX(1.2);
          p.later(i * 0.3, () => {
            p.lob(x, { seconds: 1.1, tint: 0x222222, trail: ['#555555', '#222222', '#000000'] });
            p.later(1.1, () => p.puddle({ x, width: 2.4, seconds: 5 + stage, color: '#111111' }));
          });
        }
      }
    },

    /** The Hive Queen: lays eggs around the arena that hatch into more minions. */
    broodEggs: {
      name: '🥚 BROOD EGGS!', color: '#a3e635',
      cast(p, stage) {
        const count = stage >= 3 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const x = p.randomX(2);
          p.later(i * 0.4, () => {
            p.lob(x, { seconds: 1.0, tint: 0xb6f36b, trail: ['#ecfccb', '#a3e635', '#4d7c0f'] });
            // The egg wobbles on the floor, then hatches
            p.later(1.0, () => {
              const egg = p.quad('#bef264', 0.95, MARKER_Z + 0.02);
              p.add({
                meshes: [egg],
                update: (dt, self) => {
                  const wobble = Math.sin(self.age * (6 + self.age * 6)) * 0.08;
                  p.placeQuad(egg, x - 0.4 + wobble, x + 0.4 + wobble, FLOOR_Y, FLOOR_Y + 0.75);
                  if (self.age < 2.4) return true;
                  p.context.particles.burst(x, FLOOR_Y + 0.4, 12, '#a3e635', 1.4, 0.5);
                  Sfx.crumble();
                  p.context.spawnMinion(x);
                  return false;
                }
              });
            });
          });
        }
      }
    },

    /** The Prism Widow: rainbow rays slice down across the arena from its corners. */
    prismBeams: {
      name: '🌈 PRISM RAYS!', color: '#f472b6',
      cast(p, stage) {
        const top = p.context.skyY() - 1;
        const { start, end } = p.arena;
        const target = p.player.x;
        const rays = [
          { fromX: start + 0.5, fromY: top, toX: target + 1.5, toY: FLOOR_Y },
          { fromX: end - 0.5, fromY: top, toX: target - 1.5, toY: FLOOR_Y }
        ];
        if (stage >= 3) rays.push({ fromX: target, fromY: top, toX: target, toY: FLOOR_Y });
        const chosen = stage === 1 ? [rays[Math.random() < 0.5 ? 0 : 1]] : rays;
        chosen.forEach((ray, i) => p.later(i * 0.35, () => p.ray({
          ...ray, thickness: 0.7, warn: 1.1, active: 0.4, colors: ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0'], sound: () => Sfx.laserFire()
        })));
      }
    },

    /** The Gravity Thief: steals the gravity (floaty jumps) and hurls rocks while the boy drifts. */
    gravitySteal: {
      name: '🪐 GRAVITY STOLEN!', color: '#67e8f9',
      cast(p, stage) {
        const physics = p.context.getPhysics();
        const seconds = 3.5 + stage;
        p.bendPhysics({ gravityScale: (physics.gravityScale || 1) * 0.45 }, seconds);
        for (let t = 0; t < seconds; t += 0.25) p.later(t, () => p.context.particles.burst(p.randomX(0.3), 0.2, 1, '#67e8f9', 0.4, 1.2));
        for (let i = 0; i < stage + 1; i++) p.later(0.8 + i * 0.9, () => p.lob(p.player.x + randomBetween(-1, 1), { randomColor: true, seconds: 1.1 }));
      }
    },

    /** The Mighty Jello: the whole floor wobbles and zaps. Be in the air (or on a ledge) when it does! */
    jellyQuake: {
      name: '🍮 JELLY QUAKE!', color: '#86efac',
      cast(p, stage) {
        const quakes = stage >= 3 ? 2 : 1;
        for (let i = 0; i < quakes; i++) {
          p.later(i * 1.9, () => {
            const floor = p.quad('#86efac', 0.2, MARKER_Z);
            p.placeQuad(floor, p.arena.start, p.arena.end, FLOOR_Y - 0.02, FLOOR_Y + 0.22);
            const warn = 1.3;
            let struck = false;
            p.add({
              meshes: [floor],
              update: (dt, self) => {
                if (self.age < warn) {
                  p.blink(floor, self.age, 0.15, 0.6);
                  if (Math.random() < 0.15) p.context.cameraController.shake(0.06, 0.1);
                  return true;
                }
                if (!struck) {
                  struck = true;
                  Sfx.jellyZap();
                  p.context.cameraController.shake(0.25, 0.4);
                  p.slots(10, 0.5).forEach(x => p.context.particles.burst(x, FLOOR_Y + 0.2, 3, '#86efac', 1.6, 0.4));
                  const { player } = p;
                  if (player.isGrounded && player.y < FLOOR_Y + 0.3) p.hurtPlayer(p.boss.x);
                }
                floor.material.opacity = Math.max(0, 0.8 - (self.age - warn) * 2);
                return self.age < warn + 0.4;
              }
            });
          });
        }
        // Then the floor stays slick for a while
        if (stage >= 2) p.later(1.4, () => p.bendPhysics({ slippery: true }, 3 + stage));
      }
    },

    /** The Tentacle King of Rock: a power chord blasts the boy away, then a volley of notes. */
    soundBlast: {
      name: '🎸 POWER CHORD!', color: '#f472b6',
      cast(p, stage) {
        const { effects } = p.context;
        Sfx.golemRoar();
        for (let i = 0; i < 3; i++) {
          p.later(i * 0.15, () => effects.spawnRing({ color: '#f472b6', x: p.boss.x, y: p.boss.centerY, fromScale: 1, toScale: 16, lifetime: 0.6, z: 0.6 }));
        }
        p.force({ seconds: 0.7, strength: -(6 + stage) });
        for (let i = 0; i < 2 + stage; i++) {
          p.later(0.8 + i * 0.3, () => p.lob(p.player.x + randomBetween(-1.2, 1.2), {
            seconds: 1.0, sprite: p.context.sprites.musicNote, trail: ['#ffd1f0', '#f472b6', '#9d174d']
          }));
        }
      }
    }
  };

  BossPowers.POWERS = POWERS;
  Forest.BossPowers = BossPowers;
})(window.Forest);
