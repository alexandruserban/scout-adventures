/**
 * Every world's own special trap (see `trap` in Forest.Levels.themes): snapping flytraps in the
 * forest, swinging axes in the dungeon, quicksand in the desert, banana peels in the silent film...
 * The level generator decides where they go (level.specialTraps); this builds and runs them.
 *
 * Each trap is a small class with update(deltaSeconds, player); the base class keeps track of its
 * meshes so the whole lot can be taken away when the level ends. Most work on a clock (`period`,
 * started `phase` of the way through, so neighbours don't fire together) and show a warning first.
 * (The ice world's thin ice is just crumbling platforms over hidden pits, made by the generator.)
 */
(function (Forest) {
  const { PIXEL_SCALE } = Forest.Config;
  const { createSprite, createSpriteMesh } = Forest.Graphics;
  const Sfx = Forest.SoundEffects;

  /** In front of the scenery, behind the characters. */
  const TRAP_Z = 0.2;
  const BEAM_Z = 0.22;
  /** The boy's body, for touching traps. */
  const BODY_HALF_WIDTH = 0.25;
  const BODY_HEIGHT_SHARE = 0.9;
  /** Traps further than this from the boy stay quiet. */
  const HEARING_DISTANCE = 12;

  // ==========================================
  // Helpers
  // ==========================================
  const spriteCache = new Map();
  /** A sprite from rows of palette keys ('.' is see-through), painted once. */
  function pixelSprite(key, rows, palette) {
    if (spriteCache.has(key)) return spriteCache.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(...rows.map(row => row.length));
    canvas.height = rows.length;
    const context = canvas.getContext('2d');
    rows.forEach((row, y) => [...row].forEach((code, x) => {
      if (!palette[code]) return;
      context.fillStyle = palette[code];
      context.fillRect(x, y, 1, 1);
    }));
    const sprite = createSprite(canvas);
    spriteCache.set(key, sprite);
    return sprite;
  }

  /** 0 to 1: how far through its period a clock is. */
  function cycleAt(time, period, phase) {
    return ((time / period + phase) % 1 + 1) % 1;
  }

  function bodyOf(player) {
    return { left: player.x - BODY_HALF_WIDTH, right: player.x + BODY_HALF_WIDTH, bottom: player.y, top: player.y + player.height * BODY_HEIGHT_SHARE };
  }

  /** The boy's body overlaps the box. */
  function touchesBox(player, left, right, bottom, top) {
    if (player.isDefeated) return false;
    const body = bodyOf(player);
    return body.right > left && body.left < right && body.top > bottom && body.bottom < top;
  }

  /** The boy's body overlaps the circle. */
  function touchesCircle(player, x, y, radius) {
    if (player.isDefeated) return false;
    const body = bodyOf(player);
    const nearestX = Math.max(body.left, Math.min(x, body.right));
    const nearestY = Math.max(body.bottom, Math.min(y, body.top));
    return (nearestX - x) ** 2 + (nearestY - y) ** 2 < radius * radius;
  }

  class Trap {
    /**
     * @param {object} context { scene, particles, effects, terrain, say(text, x, y, color), snapCamera() }
     * @param {{x:number, top:number, left:number, right:number, phase:number}} spot where it is: x,
     *   the ground's height there and the ends of that stretch of ground
     */
    constructor(context, spot) {
      this.context = context;
      this.particles = context.particles;
      this.x = spot.x;
      this.top = spot.top;
      this.left = spot.left;
      this.right = spot.right;
      this.phase = spot.phase || 0;
      this.time = 0;
      this.meshes = [];
    }

    /** Put a mesh in the scene (it's removed with the trap). */
    add(mesh, x, y, z = TRAP_Z) {
      mesh.position.set(x, y, z);
      this.context.scene.add(mesh);
      this.meshes.push(mesh);
      return mesh;
    }

    /** A sprite standing with its bottom at y. */
    addSprite(sprite, scale, x, bottomY, z = TRAP_Z) {
      const mesh = createSpriteMesh(sprite, PIXEL_SCALE * scale);
      return this.add(mesh, x, bottomY + (sprite.height * PIXEL_SCALE * scale) / 2, z);
    }

    /** A flat coloured rectangle centred on (x, y). */
    addRect(color, width, height, x, y, opacity = 1, z = BEAM_Z) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity })
      );
      mesh.scale.set(width, height, 1);
      return this.add(mesh, x, y, z);
    }

    hurt(player, fromX = this.x) {
      player.takeDamage(1, fromX);
    }

    /** Play a sound if the boy is near enough to hear it. */
    sound(player, name) {
      if (Math.abs(player.x - this.x) < HEARING_DISTANCE && Sfx[name]) Sfx[name]();
    }

    update(deltaSeconds) {
      this.time += deltaSeconds;
    }

    dispose() {
      this.meshes.forEach(mesh => {
        this.context.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      this.meshes = [];
    }
  }

  // ==========================================
  // Forest: snapping flytrap
  // ==========================================
  const FLYTRAP_PALETTE = { r: '#7a1020', R: '#d8304a', w: '#fff6e0', g: '#2f7a2a', G: '#4fb043', L: '#6fd060' };
  const FLYTRAP_OPEN = [
    '.r..........r.',
    'rRw........wRr',
    'rRRw......wRRr',
    'rRRRw....wRRRr',
    '.rRRRw..wRRRr.',
    '..gRRRwwRRRg..',
    '...gGRRRRGg...',
    '....gGGGGg....',
    '.....gGGg.....',
    '......gG......',
    '..gL..gG..Lg..',
    '.gLLg.gG.gLLg.',
    '..gLgLgGLgLg..',
    '....gLGGLg....'
  ];
  const FLYTRAP_SHUT = [
    '..............',
    '.....wwww.....',
    '....rRwwRr....',
    '...rRRwwRRr...',
    '...rRRRRRRr...',
    '....rRRRRr....',
    '....gRRRRg....',
    '....gGGGGg....',
    '.....gGGg.....',
    '......gG......',
    '..gL..gG..Lg..',
    '.gLLg.gG.gLLg.',
    '..gLgLgGLgLg..',
    '....gLGGLg....'
  ];

  /** A flytrap opens its mouth when the boy is this close (and snaps at him when he's closer still). */
  const FLYTRAP_OPEN_DISTANCE = 3.5;

  class Flytrap extends Trap {
    constructor(context, spot) {
      super(context, spot);
      this.openSprite = pixelSprite('flytrap-open', FLYTRAP_OPEN, FLYTRAP_PALETTE);
      this.shutSprite = pixelSprite('flytrap-shut', FLYTRAP_SHUT, FLYTRAP_PALETTE);
      // Resting with its mouth shut; it only opens wide as the boy comes near
      this.mesh = this.addSprite(this.shutSprite, 1.4, this.x, this.top - 0.05);
      this.restY = this.mesh.position.y;
      this.shutSeconds = 0;
      this.isOpen = false;
    }

    setOpen(open) {
      if (open === this.isOpen) return;
      this.isOpen = open;
      this.mesh.material.map = (open ? this.openSprite : this.shutSprite).texture;
    }

    update(deltaSeconds, player) {
      super.update(deltaSeconds);
      if (this.shutSeconds > 0) {
        this.shutSeconds -= deltaSeconds;
        return;
      }
      const distance = Math.abs(player.x - this.x);
      // Its jaws open and quiver as he comes near (a warning), and close again when he's gone
      const isNear = distance < FLYTRAP_OPEN_DISTANCE && !player.isDefeated;
      this.setOpen(isNear);
      this.mesh.position.x = this.x + (isNear ? Math.sin(this.time * 40) * 0.03 : 0);
      if (distance < 1.1 && player.y < this.top + 1.6 && !player.isDefeated) {
        this.setOpen(false);
        this.mesh.position.x = this.x;
        this.shutSeconds = 1.6;
        this.sound(player, 'acornCrack');
        if (touchesBox(player, this.x - 0.65, this.x + 0.65, this.top, this.top + 1.0)) this.hurt(player);
      }
    }
  }

  // ==========================================
  // Dungeon: swinging axe pendulum
  // ==========================================
  const AXE_PALETTE = { s: '#e8edf2', S: '#b4bcc8', d: '#5e6573', w: '#6a4426' };
  const AXE_ROWS = [
    '.......ww.......',
    '...dSS.ww.SSd...',
    '..dSSSSwwSSSSd..',
    '.dSSSSSwwSSSSSd.',
    'dSSSSSSwwSSSSSSd',
    'dsSSSSSddSSSSSsd',
    'dsSSSSS..SSSSSsd',
    '.dsSSS....SSSsd.',
    '..dss......ssd..',
    '...d........d...'
  ];
  /**
   * High enough that at the bottom of its swing the blade passes over the boy's head (lowest edge
   * about 1.65 up, he's about 1.3 tall): it only gets him if he jumps into it.
   */
  const PENDULUM_PIVOT_HEIGHT = 7.1;
  const PENDULUM_LENGTH = 4.9;
  const PENDULUM_SWING = 1.0;
  const PENDULUM_PERIOD = 2.6;
  const AXE_RADIUS = 0.55;

  class Pendulum extends Trap {
    constructor(context, spot) {
      super(context, spot);
      this.pivotY = this.top + PENDULUM_PIVOT_HEIGHT;
      this.group = new THREE.Group();
      this.group.position.set(this.x, this.pivotY, TRAP_Z);
      const chain = new THREE.Mesh(new THREE.PlaneGeometry(0.08, PENDULUM_LENGTH), new THREE.MeshBasicMaterial({ color: '#8a8f99' }));
      chain.position.set(0, -PENDULUM_LENGTH / 2, 0);
      const axe = createSpriteMesh(pixelSprite('axe', AXE_ROWS, AXE_PALETTE), PIXEL_SCALE * 1.5);
      axe.position.set(0, -PENDULUM_LENGTH, 0.001);
      this.group.add(chain, axe);
      context.scene.add(this.group);
      this.parts = [chain, axe];
      this.add(new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ color: '#3a3f48' })), this.x, this.pivotY + 0.05);
      this.wasLow = false;
    }

    update(deltaSeconds, player) {
      super.update(deltaSeconds);
      const angle = PENDULUM_SWING * Math.sin((this.time / PENDULUM_PERIOD + this.phase) * Math.PI * 2);
      this.group.rotation.z = angle;
      const bladeX = this.x + PENDULUM_LENGTH * Math.sin(angle);
      const bladeY = this.pivotY - PENDULUM_LENGTH * Math.cos(angle);
      const isLow = Math.abs(angle) < 0.15;
      if (isLow && !this.wasLow) this.sound(player, 'swordSwing');
      this.wasLow = isLow;
      if (touchesCircle(player, bladeX, bladeY, AXE_RADIUS)) this.hurt(player, bladeX);
    }

    dispose() {
      this.context.scene.remove(this.group);
      this.parts.forEach(part => { part.geometry.dispose(); part.material.dispose(); });
      super.dispose();
    }
  }

  // ==========================================
  // Columns: lightning (treetops), lava geysers (volcano), laser gates (neon), tractor beams (mothership)
  // ==========================================
  const CLOUD_PALETTE = { d: '#3c4252', D: '#596074', l: '#8a92a8' };
  const CLOUD_ROWS = [
    '.......lll..........',
    '.....lDDDDDl..ll....',
    '...lDDDDDDDDlDDDDl..',
    '..lDDDDDDDDDDDDDDDl.',
    '.lDDDDDDDDDDDDDDDDDl',
    'lDDDDDDDDDDDDDDDDDDd',
    'dDDDDDDDDDDDDDDDDDdd',
    '.ddDDDDDDDDDDDDDDdd.',
    '...ddddddddddddddd..'
  ];
  const VENT_PALETTE = { k: '#2a1612', r: '#5a2a1c', o: '#ff8a2a', y: '#ffd25e' };
  const VENT_ROWS = [
    '...r..........r...',
    '..rkr..oyyo..rkr..',
    '.rkkkr.oyyo.rkkkr.',
    'rkkkkkrooookkkkkkr'
  ];
  const EMITTER_PALETTE = { m: '#2a2340', M: '#4a3d70', p: '#ff4fd8', w: '#ffffff' };
  const EMITTER_ROWS = ['.mMMMMMm.', 'mMMpwpMMm', 'mMMMMMMMm'];
  const UFO_PALETTE = { g: '#7cff6a', G: '#2f9a1a', m: '#9aa4b0', M: '#5a6270', w: '#e8fff0', y: '#ffe14d' };
  const UFO_ROWS = [
    '......wwww......',
    '.....wgggGw.....',
    '....wggggggw....',
    '..mmmmmmmmmmmm..',
    '.mMyMMyMMyMMyMm.',
    'mMMMMMMMMMMMMMMm',
    '..MMMMMMMMMMMM..',
    '....GGGGGGGG....'
  ];

  /**
   * Something blasts up out of the ground, or down from above, every so often after a warning.
   * The column's look and what it does (hurt, or lift him up towards a UFO) come from `style`.
   */
  const COLUMN_STYLES = {
    thundercloud: { period: [3.2, 4.2], warn: 0.9, active: 0.35, width: 0.6, height: 5.2, effect: 'hurt' },
    geyser: { period: [3.0, 3.8], warn: 0.9, active: 1.0, width: 0.9, height: 3.4, effect: 'hurt' },
    laserGate: { period: [2.6, 3.2], warn: 0.6, active: 1.2, width: 0.22, height: 3.4, effect: 'hurt' },
    tractorBeam: { period: [4.6, 5.4], warn: 0.7, active: 2.4, width: 1.6, height: 6.0, effect: 'lift' }
  };
  const LIFT_SPEED = 3.6;
  const BOLT_SEGMENTS = 6;

  class Column extends Trap {
    constructor(context, spot, kind) {
      super(context, spot);
      this.kind = kind;
      this.style = COLUMN_STYLES[kind];
      const [shortest, longest] = this.style.period;
      this.period = shortest + this.phase * (longest - shortest);
      this.state = 'idle';
      const { width, height } = this.style;
      if (kind === 'thundercloud') {
        this.cap = this.addSprite(pixelSprite('cloud', CLOUD_ROWS, CLOUD_PALETTE), 1.6, this.x, this.top + height);
        this.bolt = Array.from({ length: BOLT_SEGMENTS }, () => this.addRect('#fff7a8', 0.12, 1, this.x, this.top, 0));
        this.glow = this.addRect('#fffbe0', width * 2.2, height, this.x, this.top + height / 2, 0, BEAM_Z - 0.005);
      } else if (kind === 'geyser') {
        this.addSprite(pixelSprite('vent', VENT_ROWS, VENT_PALETTE), 1.3, this.x, this.top - 0.12);
        this.beam = this.addRect('#ff6a1f', width, height, this.x, this.top + height / 2, 0);
        this.core = this.addRect('#ffd25e', width * 0.45, height, this.x, this.top + height / 2, 0, BEAM_Z + 0.001);
      } else if (kind === 'laserGate') {
        const emitter = pixelSprite('emitter', EMITTER_ROWS, EMITTER_PALETTE);
        this.addSprite(emitter, 1.4, this.x, this.top - 0.05);
        const capMesh = this.addSprite(emitter, 1.4, this.x, this.top + height);
        capMesh.rotation.z = Math.PI;
        this.beam = this.addRect('#ff4fd8', width * 2.5, height, this.x, this.top + height / 2, 0);
        this.core = this.addRect('#ffffff', width * 0.6, height, this.x, this.top + height / 2, 0, BEAM_Z + 0.001);
      } else {
        this.cap = this.addSprite(pixelSprite('ufo', UFO_ROWS, UFO_PALETTE), 1.6, this.x, this.top + height);
        this.beam = this.addRect('#9aff4a', width, height, this.x, this.top + height / 2, 0);
      }
    }

    update(deltaSeconds, player) {
      super.update(deltaSeconds);
      const { warn, active, width, height, effect } = this.style;
      const elapsed = cycleAt(this.time, this.period, this.phase) * this.period;
      const warnFrom = this.period - warn - active;
      const state = elapsed < warnFrom ? 'idle' : (elapsed < this.period - active ? 'warn' : 'active');
      if (state !== this.state) this.enter(state, player);
      this.state = state;
      const flicker = 0.75 + Math.random() * 0.25;

      if (this.kind === 'thundercloud') {
        this.cap.position.x = this.x + (state === 'warn' ? Math.sin(this.time * 50) * 0.05 : 0);
        this.cap.material.color.setScalar(state === 'warn' && Math.random() < 0.3 ? 1.6 : 1);
        if (state === 'active') this.drawBolt();
        this.bolt.forEach(segment => { segment.material.opacity = state === 'active' ? 1 : 0; });
        this.glow.material.opacity = state === 'active' ? 0.25 * flicker : 0;
      } else if (this.kind === 'tractorBeam') {
        this.cap.position.y = this.top + height + (this.cap.geometry.parameters.height / 2) + Math.sin(this.time * 2) * 0.08;
        this.beam.material.opacity = state === 'active' ? 0.3 * flicker : (state === 'warn' && Math.floor(this.time * 10) % 2 ? 0.12 : 0);
      } else {
        const showing = state === 'active' ? 1 : (state === 'warn' ? 0.25 : 0);
        this.beam.material.opacity = showing * flicker * (this.kind === 'laserGate' ? 0.5 : 0.9);
        this.core.material.opacity = state === 'active' ? flicker : (state === 'warn' && this.kind === 'laserGate' && Math.floor(this.time * 12) % 2 ? 0.6 : 0);
        if (this.kind === 'geyser') {
          // The warning: a few bubbles; the eruption: a column with a churning top
          const columnHeight = state === 'active' ? height : (state === 'warn' ? 0.5 : 0);
          [this.beam, this.core].forEach(mesh => {
            mesh.scale.y = Math.max(0.01, columnHeight);
            mesh.position.y = this.top + columnHeight / 2;
          });
          if (state !== 'idle' && Math.random() < 0.5) {
            this.particles.burst(this.x + (Math.random() - 0.5) * width, this.top + Math.random() * columnHeight, 1, Math.random() < 0.5 ? '#ffd25e' : '#ff6a1f', 1.2, 0.5);
          }
        }
      }

      if (state !== 'active') return;
      const inColumn = touchesBox(player, this.x - width / 2, this.x + width / 2, this.top - 0.2, this.top + height);
      if (!inColumn) return;
      if (effect === 'hurt') {
        this.hurt(player);
      } else {
        // The tractor beam floats him up; reaching the saucer gets him zapped and dropped
        player.velocityY = Math.max(player.velocityY, LIFT_SPEED);
        player.x += (this.x - player.x) * Math.min(1, deltaSeconds * 1.5);
        if (player.y + player.height > this.top + height - 0.2) {
          this.hurt(player);
          player.velocityY = -3;
          this.particles.burst(player.x, player.y + player.height, 10, '#9aff4a', 1.6, 0.5);
        }
      }
    }

    enter(state, player) {
      if (state === 'warn') {
        if (this.kind === 'laserGate') this.sound(player, 'laserCharge');
      } else if (state === 'active') {
        if (this.kind === 'thundercloud') {
          this.sound(player, 'laserFire');
          this.particles.burst(this.x, this.top + 0.1, 14, '#fff7a8', 2.2, 0.4);
        } else if (this.kind === 'geyser') {
          this.sound(player, 'fireballLaunch');
        } else if (this.kind === 'laserGate') {
          this.sound(player, 'laserFire');
        } else {
          this.sound(player, 'shieldUp');
        }
      }
    }

    /** A fresh zig-zag from the cloud down to the ground. */
    drawBolt() {
      const fromY = this.top + this.style.height;
      const points = Array.from({ length: BOLT_SEGMENTS + 1 }, (_, i) => ({
        x: this.x + (i === 0 || i === BOLT_SEGMENTS ? 0 : (Math.random() - 0.5) * 0.6),
        y: fromY - (this.style.height * i) / BOLT_SEGMENTS
      }));
      this.bolt.forEach((segment, i) => {
        const a = points[i];
        const b = points[i + 1];
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        segment.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, BEAM_Z);
        segment.scale.set(0.12, length, 1);
        segment.rotation.z = Math.atan2(-(b.x - a.x), b.y - a.y);
      });
    }
  }

  // ==========================================
  // Desert: quicksand
  // ==========================================
  const QUICKSAND_WIDTH = 3.0;
  const QUICKSAND_SLOW = 0.35;
  /** Stand in it this long and it pulls him under (a heart lost). */
  const QUICKSAND_SECONDS = 2.0;

  class Quicksand extends Trap {
    constructor(context, spot) {
      super(context, spot);
      this.from = this.x;
      this.to = this.x + QUICKSAND_WIDTH;
      const centerX = (this.from + this.to) / 2;
      this.addRect('#8a5426', QUICKSAND_WIDTH, 0.16, centerX, this.top - 0.06, 0.95, 0.116);
      this.addRect('#b9773d', QUICKSAND_WIDTH * 0.8, 0.05, centerX, this.top - 0.03, 0.9, 0.117);
      this.sinkSeconds = 0;
      this.wasIn = false;
    }

    update(deltaSeconds, player) {
      super.update(deltaSeconds);
      if (Math.random() < 0.15) this.particles.burst(this.from + Math.random() * QUICKSAND_WIDTH, this.top + 0.02, 1, '#d9a066', 0.3, 0.6);
      const isIn = !player.isDefeated && player.isGrounded && player.x > this.from && player.x < this.to && Math.abs(player.y - this.top) < 0.05;
      if (!isIn) {
        this.sinkSeconds = Math.max(0, this.sinkSeconds - deltaSeconds * 2);
        this.wasIn = false;
        return;
      }
      if (!this.wasIn) this.context.say('QUICKSAND!', player.x, player.y + player.height + 0.4, '#ffd8a0');
      this.wasIn = true;
      player.entangle(0.12, QUICKSAND_SLOW);
      this.sinkSeconds += deltaSeconds;
      if (Math.random() < 0.4) this.particles.burst(player.x, this.top + 0.05, 1, '#c88a4a', 0.6, 0.4);
      if (this.sinkSeconds >= QUICKSAND_SECONDS) {
        this.sinkSeconds = 0;
        this.hurt(player, player.x);
      }
    }
  }

  // ==========================================
  // Candy: rolling jawbreaker
  // ==========================================
  const JAWBREAKER_PALETTE = { k: '#5a1036', p: '#ff5fb0', w: '#ffffff', b: '#5fd0ff', y: '#ffe14d' };
  const JAWBREAKER_ROWS = [
    '....kkkkk....',
    '..kkpppppkk..',
    '.kppwwbbbppk.',
    '.kpwwbyyybpk.',
    'kppwbyyyybppk',
    'kpbbyypyybbpk',
    'kpbyypppyybpk',
    'kpbbyypyybbpk',
    'kppbbyyybbppk',
    '.kppbbbbbppk.',
    '.kpppppppppk.',
    '..kkpppppkk..',
    '....kkkkk....'
  ];
  const JAWBREAKER_RADIUS = 0.6;
  const JAWBREAKER_SPEED = 3.2;
  const JAWBREAKER_RANGE = 5;

  class Jawbreaker extends Trap {
    constructor(context, spot) {
      super(context, spot);
      this.minX = Math.max(this.left + 0.8, this.x - JAWBREAKER_RANGE);
      this.maxX = Math.min(this.right - 0.8, this.x + JAWBREAKER_RANGE);
      this.ballX = this.minX + (this.maxX - this.minX) * this.phase;
      this.direction = this.phase < 0.5 ? 1 : -1;
      this.mesh = this.addSprite(pixelSprite('jawbreaker', JAWBREAKER_ROWS, JAWBREAKER_PALETTE), 1.48, this.ballX, this.top);
    }

    update(deltaSeconds, player) {
      super.update(deltaSeconds);
      this.ballX += this.direction * JAWBREAKER_SPEED * deltaSeconds;
      if (this.ballX > this.maxX || this.ballX < this.minX) {
        this.ballX = Math.max(this.minX, Math.min(this.maxX, this.ballX));
        this.direction *= -1;
        this.sound(player, 'jellyBoing');
      }
      this.mesh.position.x = this.ballX;
      this.mesh.rotation.z -= (this.direction * JAWBREAKER_SPEED * deltaSeconds) / JAWBREAKER_RADIUS;
      if (touchesCircle(player, this.ballX, this.top + JAWBREAKER_RADIUS, JAWBREAKER_RADIUS - 0.05)) this.hurt(player, this.ballX);
    }
  }

  // ==========================================
  // Moon: meteors
  // ==========================================
  const METEOR_PALETTE = { k: '#3a2a2a', r: '#7a5a4a', R: '#a07a60', o: '#ff8a2a', y: '#ffd25e' };
  const METEOR_ROWS = [
    '..yo.......',
    '.yoyo......',
    '..oyokkk...',
    '...okrRrk..',
    '...krRRRrk.',
    '..krRRrRRk.',
    '..krRrrRrk.',
    '..kkrRRrk..',
    '....kkkk...'
  ];
  const METEOR_DROP_HEIGHT = 10;
  const METEOR_SPEED = 16;
  const METEOR_WARN = 1.3;

  class Meteor extends Trap {
    constructor(context, spot) {
      super(context, spot);
      this.period = 3.4 + this.phase * 1.2;
      this.marker = this.addRect('#ff3b3b', 1.4, 0.08, this.x, this.top + 0.04, 0, 0.117);
      this.rock = this.addSprite(pixelSprite('meteor', METEOR_ROWS, METEOR_PALETTE), 1.6, this.x, this.top + METEOR_DROP_HEIGHT);
      this.rock.visible = false;
      this.landed = true;
    }

    update(deltaSeconds, player) {
      super.update(deltaSeconds);
      const untilImpact = this.period - cycleAt(this.time, this.period, this.phase) * this.period;
      const warning = untilImpact < METEOR_WARN;
      this.marker.material.opacity = warning ? (Math.floor(this.time * 8) % 2 ? 0.9 : 0.4) : 0;
      this.marker.scale.x = warning ? 1.4 * (1 - untilImpact / METEOR_WARN * 0.5) : 1;
      const fallSeconds = METEOR_DROP_HEIGHT / METEOR_SPEED;
      if (untilImpact < fallSeconds) {
        this.landed = false;
        this.rock.visible = true;
        const y = this.top + 0.45 + METEOR_SPEED * untilImpact;
        this.rock.position.set(this.x + untilImpact * 2, y, TRAP_Z);
        if (Math.random() < 0.7) this.particles.burst(this.rock.position.x, y + 0.3, 1, Math.random() < 0.5 ? '#ffd25e' : '#ff8a2a', 0.5, 0.35);
        if (touchesCircle(player, this.rock.position.x, y, 0.45)) this.hurt(player);
      } else if (!this.landed) {
        // Impact: a burst of rock and fire, then it's gone until the next one
        this.landed = true;
        this.rock.visible = false;
        this.particles.burst(this.x, this.top + 0.2, 18, '#ff8a2a', 2.4, 0.5);
        this.particles.burst(this.x, this.top + 0.2, 10, '#a07a60', 1.8, 0.6);
        this.context.effects.spawnRing({ color: '#ffd25e', x: this.x, y: this.top + 0.15, fromScale: 0.4, toScale: 3, lifetime: 0.35 });
        this.sound(player, 'fireballImpact');
        if (touchesBox(player, this.x - 1.0, this.x + 1.0, this.top - 0.2, this.top + 0.9)) this.hurt(player);
      }
    }
  }

  // ==========================================
  // Crystal caves: electric arc between two pylons, at ankle height
  // ==========================================
  const PYLON_PALETTE = { k: '#0b2a30', c: '#2fd8b8', C: '#9ff0ff', w: '#ffffff' };
  const PYLON_ROWS = ['..w...', '..Cw..', '.cCC..', '.cCCk.', '.cCCk.', 'kcCCck', 'kcCCck', 'kccCck', 'kkcckk'];
  const ARC_SPAN = 2.8;
  const ARC_HEIGHT = 0.45;
  const ARC_SEGMENTS = 5;

  class CrystalArc extends Trap {
    constructor(context, spot) {
      super(context, spot);
      this.period = 3.0 + this.phase * 0.6;
      const pylon = pixelSprite('pylon', PYLON_ROWS, PYLON_PALETTE);
      this.addSprite(pylon, 1.5, this.x, this.top - 0.05);
      this.addSprite(pylon, 1.5, this.x + ARC_SPAN, this.top - 0.05);
      this.segments = Array.from({ length: ARC_SEGMENTS }, () => this.addRect('#9ff0ff', 0.1, 1, this.x, this.top, 0));
      this.wasOn = false;
    }

    update(deltaSeconds, player) {
      super.update(deltaSeconds);
      const cycle = cycleAt(this.time, this.period, this.phase);
      const isOn = cycle > 0.6;
      const isWarning = cycle > 0.42 && !isOn;
      if (isOn && !this.wasOn) this.sound(player, 'jellyZap');
      this.wasOn = isOn;
      if (isWarning && Math.random() < 0.4) {
        this.particles.burst(this.x + (Math.random() < 0.5 ? 0 : ARC_SPAN), this.top + 0.75, 1, '#9ff0ff', 0.8, 0.3);
      }
      const y = this.top + ARC_HEIGHT;
      const points = Array.from({ length: ARC_SEGMENTS + 1 }, (_, i) => ({
        x: this.x + 0.1 + ((ARC_SPAN - 0.2) * i) / ARC_SEGMENTS,
        y: y + (i === 0 || i === ARC_SEGMENTS ? 0 : (Math.random() - 0.5) * 0.25)
      }));
      this.segments.forEach((segment, i) => {
        const a = points[i];
        const b = points[i + 1];
        segment.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, BEAM_Z);
        segment.scale.set(Math.hypot(b.x - a.x, b.y - a.y), isOn ? 0.1 : 0.04, 1);
        segment.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
        segment.material.opacity = isOn ? 0.75 + Math.random() * 0.25 : (isWarning && Math.random() < 0.3 ? 0.5 : 0);
      });
      if (isOn && touchesBox(player, this.x, this.x + ARC_SPAN, this.top - 0.2, y + 0.25)) this.hurt(player, this.x + ARC_SPAN / 2);
    }
  }

  // ==========================================
  // Clockwork: piston crusher
  // ==========================================
  const CRUSHER_WIDTH = 1.8;
  const CRUSHER_HEIGHT = 0.7;
  const CRUSHER_RAISED = 4.2;
  /** Parts of its period: resting up, shaking, slamming down, holding, rising again. */
  const CRUSHER_TIMES = { rest: 1.5, shake: 0.45, slam: 0.12, hold: 0.5, rise: 1.0 };

  class Crusher extends Trap {
    constructor(context, spot) {
      super(context, spot);
      this.period = Object.values(CRUSHER_TIMES).reduce((sum, seconds) => sum + seconds, 0);
      this.shaft = this.addRect('#6b4a2a', 0.5, 14, this.x, this.top + CRUSHER_RAISED + 7, 1, TRAP_Z - 0.002);
      this.head = this.addRect('#c8933a', CRUSHER_WIDTH, CRUSHER_HEIGHT, this.x, this.top, 1, TRAP_Z);
      this.band = this.addRect('#7a5422', CRUSHER_WIDTH, 0.14, this.x, this.top, 1, TRAP_Z + 0.001);
      this.teeth = this.addRect('#3a2a18', CRUSHER_WIDTH * 0.92, 0.08, this.x, this.top, 1, TRAP_Z + 0.001);
      this.slammed = false;
    }

    update(deltaSeconds, player) {
      super.update(deltaSeconds);
      const { rest, shake, slam, hold } = CRUSHER_TIMES;
      const elapsed = cycleAt(this.time, this.period, this.phase) * this.period;
      let bottom = this.top + CRUSHER_RAISED;
      let offsetX = 0;
      let dangerous = false;
      if (elapsed < rest) {
        this.slammed = false;
      } else if (elapsed < rest + shake) {
        offsetX = Math.sin(this.time * 60) * 0.05;
      } else if (elapsed < rest + shake + slam) {
        bottom = this.top + CRUSHER_RAISED * (1 - (elapsed - rest - shake) / slam);
        dangerous = true;
      } else if (elapsed < rest + shake + slam + hold) {
        bottom = this.top;
        dangerous = true;
        if (!this.slammed) {
          this.slammed = true;
          this.sound(player, 'golemLand');
          this.particles.burst(this.x - CRUSHER_WIDTH / 2, this.top + 0.1, 6, '#c9b08a', 1.4, 0.4);
          this.particles.burst(this.x + CRUSHER_WIDTH / 2, this.top + 0.1, 6, '#c9b08a', 1.4, 0.4);
        }
      } else {
        const rising = (elapsed - rest - shake - slam - hold) / CRUSHER_TIMES.rise;
        bottom = this.top + CRUSHER_RAISED * rising;
      }
      const centerY = bottom + CRUSHER_HEIGHT / 2;
      this.head.position.set(this.x + offsetX, centerY, TRAP_Z);
      this.band.position.set(this.x + offsetX, centerY + 0.1, TRAP_Z + 0.001);
      this.teeth.position.set(this.x + offsetX, bottom + 0.04, TRAP_Z + 0.001);
      this.shaft.position.set(this.x + offsetX, bottom + CRUSHER_HEIGHT + 7, TRAP_Z - 0.002);
      if (dangerous && touchesBox(player, this.x - CRUSHER_WIDTH / 2, this.x + CRUSHER_WIDTH / 2, bottom, bottom + CRUSHER_HEIGHT)) this.hurt(player);
    }
  }

  // ==========================================
  // Bobbing hazards: sea mines on chains (atlantis), spiders on threads (rainbow)
  // ==========================================
  const MINE_PALETTE = { k: '#1a2a30', m: '#3a5a66', M: '#6a8a96', r: '#ff3b3b', s: '#9aa4b0' };
  const MINE_ROWS = [
    '.....s......',
    '..s.kkk.s...',
    '...kmmmmk...',
    '..kmMMmmmk..',
    'skmMMmmmmmks',
    '.kmmmmrmmmk.',
    '.kmmmmmmmmk.',
    '..kmmmmmmk..',
    '...kmmmmk...',
    '..s.kkk.s...',
    '.....s......'
  ];
  const SPIDER_PALETTE = { k: '#1a1028', p: '#8a3ad8', P: '#c07aff', w: '#ffffff', r: '#ff3b6b' };
  const SPIDER_ROWS = [
    'k..k....k..k',
    '.k..kppk..k.',
    '..kkpPPpkk..',
    'kk.pPPPPp.kk',
    '..kpwrrwpk..',
    '.k.pppppp.k.',
    'k..kppppk..k',
    '..k..kk..k..'
  ];
  const BOBBER_STYLES = {
    seaMine: { sprite: ['mine', MINE_ROWS, MINE_PALETTE], low: 0.5, high: 2.3, period: [2.8, 3.6], radius: 0.45, hangFrom: 'ground', line: '#3a4a50' },
    spider: { sprite: ['spider', SPIDER_ROWS, SPIDER_PALETTE], low: 0.6, high: 4.2, period: [2.6, 3.4], radius: 0.45, hangFrom: 'above', line: '#f4f0ff' }
  };
  const BOBBER_THREAD_TOP = 9;
  const MINE_RESPAWN_SECONDS = 2.5;

  class Bobber extends Trap {
    constructor(context, spot, kind) {
      super(context, spot);
      this.kind = kind;
      this.style = BOBBER_STYLES[kind];
      const [shortest, longest] = this.style.period;
      this.period = shortest + this.phase * (longest - shortest);
      this.line = this.addRect(this.style.line, 0.05, 1, this.x, this.top, kind === 'spider' ? 0.7 : 1, TRAP_Z - 0.001);
      this.mesh = this.addSprite(pixelSprite(...this.style.sprite), 1.4, this.x, this.top);
      this.hiddenSeconds = 0;
    }

    update(deltaSeconds, player) {
      super.update(deltaSeconds);
      const { low, high, radius, hangFrom } = this.style;
      const swing = 0.5 - 0.5 * Math.cos(cycleAt(this.time, this.period, this.phase) * Math.PI * 2);
      const y = this.top + (hangFrom === 'above' ? high - (high - low) * swing : low + (high - low) * swing);
      this.mesh.position.set(this.x, y, TRAP_Z);
      const lineFrom = hangFrom === 'above' ? this.top + BOBBER_THREAD_TOP : this.top;
      this.line.position.set(this.x, (lineFrom + y) / 2, TRAP_Z - 0.001);
      this.line.scale.y = Math.abs(lineFrom - y);
      if (this.hiddenSeconds > 0) {
        this.hiddenSeconds -= deltaSeconds;
        this.mesh.visible = this.hiddenSeconds <= 0;
        return;
      }
      if (!touchesCircle(player, this.x, y, radius)) return;
      this.hurt(player);
      if (this.kind === 'seaMine') {
        // Boom: the mine goes off, and a new one floats up a little later
        this.sound(player, 'mushroomExplosion');
        this.particles.burst(this.x, y, 20, '#ffd25e', 2.4, 0.5);
        this.particles.burst(this.x, y, 10, '#9aa4b0', 1.6, 0.5);
        this.mesh.visible = false;
        this.hiddenSeconds = MINE_RESPAWN_SECONDS;
      }
    }
  }

  // ==========================================
  // Fae garden: spore puffball (left and right get swapped)
  // ==========================================
  const PUFFBALL_PALETTE = { k: '#3a1050', p: '#c07aff', P: '#f0c0ff', w: '#ffffff', s: '#6a3a80' };
  const PUFFBALL_ROWS = [
    '...kkkkkk...',
    '.kkpPPPPpkk.',
    'kpPPwPPPPPpk',
    'kpPPPPPPwPpk',
    'kppPPPPPPppk',
    '.kkppppppkk.',
    '...ksssk....',
    '...ksssk....',
    '..kssssk....'
  ];
  const DIZZY_SECONDS = 3.5;
  const PUFF_COOLDOWN = 4;

  class Puffball extends Trap {
    constructor(context, spot) {
      super(context, spot);
      this.mesh = this.addSprite(pixelSprite('puffball', PUFFBALL_ROWS, PUFFBALL_PALETTE), 1.5, this.x, this.top - 0.05);
      this.restY = this.mesh.position.y;
      this.cooldown = 0;
    }

    update(deltaSeconds, player) {
      super.update(deltaSeconds);
      this.cooldown -= deltaSeconds;
      const squash = this.cooldown > PUFF_COOLDOWN - 0.3 ? 0.7 : 1 + Math.sin(this.time * 3) * 0.04;
      this.mesh.scale.set(2 - squash, squash, 1);
      if (Math.random() < 0.05) this.particles.burst(this.x, this.top + 0.8, 1, '#f0c0ff', 0.3, 0.8);
      if (this.cooldown > 0 || player.isDefeated) return;
      if (Math.abs(player.x - this.x) < 1.0 && player.y < this.top + 1.4) {
        this.cooldown = PUFF_COOLDOWN;
        player.makeDizzy(DIZZY_SECONDS);
        this.sound(player, 'trapPuff');
        this.particles.burst(this.x, this.top + 0.7, 26, '#c07aff', 2.0, 0.9);
        this.particles.burst(this.x, this.top + 0.7, 12, '#f0c0ff', 1.4, 1.0);
        this.context.say('DIZZY! ⇄', player.x, player.y + player.height + 0.4, '#f0c0ff');
      }
    }
  }

  // ==========================================
  // Mech dragon keep: flamethrower nozzle, firing back the way he comes
  // ==========================================
  const NOZZLE_PALETTE = { k: '#101216', m: '#3a3f48', M: '#6a707a', r: '#ff5a1f' };
  const NOZZLE_ROWS = [
    '....kkkkkk',
    'kkkkmMMMmk',
    'krmmMMMMmk',
    'kkkkmmmmmk',
    '....kmmmk.',
    '...kmmmmmk'
  ];
  const FLAME_LENGTH = 3.2;
  const FLAME_HEIGHT = 0.8;

  class Flamethrower extends Trap {
    constructor(context, spot) {
      super(context, spot);
      this.period = 3.0 + this.phase * 0.6;
      this.addSprite(pixelSprite('nozzle', NOZZLE_ROWS, NOZZLE_PALETTE), 1.5, this.x, this.top - 0.05);
      this.mouthX = this.x - 0.45;
      this.mouthY = this.top + 0.4;
      this.outer = this.addRect('#ff3b1f', FLAME_LENGTH, FLAME_HEIGHT, this.mouthX - FLAME_LENGTH / 2, this.mouthY, 0);
      this.inner = this.addRect('#ffd25e', FLAME_LENGTH * 0.8, FLAME_HEIGHT * 0.45, this.mouthX - FLAME_LENGTH * 0.4, this.mouthY, 0, BEAM_Z + 0.001);
      this.wasFiring = false;
    }

    update(deltaSeconds, player) {
      super.update(deltaSeconds);
      const cycle = cycleAt(this.time, this.period, this.phase);
      const firing = cycle > 0.62;
      const warning = cycle > 0.45 && !firing;
      if (firing && !this.wasFiring) this.sound(player, 'fireballLaunch');
      this.wasFiring = firing;
      if (warning && Math.random() < 0.3) this.particles.burst(this.mouthX, this.mouthY, 1, '#8a8f99', 0.5, 0.5);
      const length = firing ? FLAME_LENGTH * (0.9 + Math.random() * 0.15) : 0.01;
      this.outer.scale.x = length;
      this.outer.position.x = this.mouthX - length / 2;
      this.inner.scale.x = length * 0.8;
      this.inner.position.x = this.mouthX - length * 0.4;
      this.outer.material.opacity = firing ? 0.85 : 0;
      this.inner.material.opacity = firing ? 0.95 : 0;
      if (firing && Math.random() < 0.6) this.particles.burst(this.mouthX - Math.random() * length, this.mouthY + (Math.random() - 0.5) * 0.5, 1, '#ff8a2a', 0.8, 0.3);
      if (firing && touchesBox(player, this.mouthX - length, this.mouthX, this.mouthY - FLAME_HEIGHT / 2, this.mouthY + FLAME_HEIGHT / 2)) this.hurt(player, this.mouthX);
    }
  }

  // ==========================================
  // Quantum rift: a portal that throws him back
  // ==========================================
  const RIFT_PALETTE = { k: '#00f0ff', p: '#b04aff', P: '#ff4fd8', d: '#12001e', w: '#ffffff' };
  const RIFT_ROWS = [
    '...kkkk...',
    '..kpppPk..',
    '.kpPddPpk.',
    '.kPddddPk.',
    'kpPdwddPpk',
    'kPddddwdPk',
    'kpddddddPk',
    'kPdwddddpk',
    'kpPddddPpk',
    '.kPddddPk.',
    '.kpPddPpk.',
    '..kPpppk..',
    '...kkkk...'
  ];
  const RIFT_THROW_BACK = 10;

  class Rift extends Trap {
    constructor(context, spot) {
      super(context, spot);
      this.mesh = this.addSprite(pixelSprite('rift', RIFT_ROWS, RIFT_PALETTE), 1.5, this.x, this.top + 0.1);
      this.restY = this.mesh.position.y;
      this.cooldown = 0;
    }

    update(deltaSeconds, player) {
      super.update(deltaSeconds);
      this.cooldown -= deltaSeconds;
      this.mesh.position.y = this.restY + Math.sin(this.time * 2) * 0.1;
      this.mesh.scale.x = 1 + Math.sin(this.time * 5) * 0.08;
      if (Math.random() < 0.2) this.particles.burst(this.x + (Math.random() - 0.5) * 0.8, this.mesh.position.y + (Math.random() - 0.5) * 1.1, 1, Math.random() < 0.5 ? '#00f0ff' : '#ff4fd8', 0.4, 0.4);
      if (this.cooldown > 0) return;
      const halfHeight = 0.6;
      if (!touchesBox(player, this.x - 0.35, this.x + 0.35, this.mesh.position.y - halfHeight, this.mesh.position.y + halfHeight)) return;
      // Whoosh: back to solid ground some way behind
      this.cooldown = 1;
      const terrain = this.context.terrain;
      let backX = terrain.safeGroundFrom(Math.max(player.minX + 1, this.x - RIFT_THROW_BACK));
      if (backX > this.x - 2) backX = Math.max(player.minX + 1, this.x - 3);
      this.particles.burst(player.x, player.y + 0.6, 16, '#ff4fd8', 1.8, 0.5);
      player.x = backX;
      player.y = terrain.groundTopAt(backX) + 0.05;
      player.velocityX = 0;
      player.velocityY = 0;
      player.groundSurface = null;
      this.particles.burst(player.x, player.y + 0.6, 16, '#00f0ff', 1.8, 0.5);
      this.sound(player, 'trapWhoosh');
      this.context.say('WHOOSH!', player.x, player.y + player.height + 0.4, '#9ff8ff');
      this.context.snapCamera();
    }
  }

  // ==========================================
  // Starwizard station: airlock vent blowing him backwards
  // ==========================================
  const VENT_GRATE_ROWS = ['kmkmkmkmkmkmkmkm', 'mkmkmkmkmkmkmkmk', 'kkkkkkkkkkkkkkkk'];
  const VENT_GRATE_PALETTE = { k: '#151920', m: '#6a7484' };
  const VENT_REACH = 4;
  const VENT_HEIGHT = 2.6;
  const VENT_PUSH_SPEED = 6;

  class AirlockVent extends Trap {
    constructor(context, spot) {
      super(context, spot);
      this.period = 3.2 + this.phase * 0.6;
      this.addSprite(pixelSprite('grate', VENT_GRATE_ROWS, VENT_GRATE_PALETTE), 1.3, this.x, this.top - 0.1);
      this.lamp = this.addRect('#ff3b3b', 0.18, 0.18, this.x + 0.9, this.top + 0.12, 0.3, TRAP_Z);
      this.wasBlowing = false;
    }

    update(deltaSeconds, player) {
      super.update(deltaSeconds);
      const cycle = cycleAt(this.time, this.period, this.phase);
      const blowing = cycle > 0.5;
      const warning = cycle > 0.38 && !blowing;
      if (blowing && !this.wasBlowing) this.sound(player, 'trapHiss');
      this.wasBlowing = blowing;
      this.lamp.material.opacity = blowing || (warning && Math.floor(this.time * 8) % 2) ? 1 : 0.3;
      if (blowing && Math.random() < 0.8) {
        this.particles.burst(this.x - Math.random() * VENT_REACH, this.top + 0.2 + Math.random() * (VENT_HEIGHT - 0.4), 1, '#e8f4ff', 0.6, 0.35);
      }
      if (!blowing || !touchesBox(player, this.x - VENT_REACH, this.x + 0.6, this.top - 0.2, this.top + VENT_HEIGHT)) return;
      const fromX = player.x;
      const toX = Math.max(player.minX, fromX - VENT_PUSH_SPEED * deltaSeconds);
      player.x = this.context.terrain.blockSideways(fromX, toX, player.y, 0.22);
    }
  }

  // ==========================================
  // Silent film: banana peel
  // ==========================================
  const PEEL_PALETTE = { y: '#ffe14d', Y: '#fff3a0', b: '#8a6a1a', k: '#3a2a08' };
  const PEEL_ROWS = ['....kb....', '...yYyk...', '.yyYYYyy..', 'yYy.yy.yYy', 'y........y'];
  const PEEL_RESPAWN_SECONDS = 5;

  class BananaPeel extends Trap {
    constructor(context, spot) {
      super(context, spot);
      this.mesh = this.addSprite(pixelSprite('peel', PEEL_ROWS, PEEL_PALETTE), 1.3, this.x, this.top - 0.04);
      this.goneSeconds = 0;
    }

    update(deltaSeconds, player) {
      super.update(deltaSeconds);
      if (this.goneSeconds > 0) {
        this.goneSeconds -= deltaSeconds;
        this.mesh.visible = this.goneSeconds <= 0;
        return;
      }
      const onIt = player.isGrounded && Math.abs(player.x - this.x) < 0.4 && Math.abs(player.y - this.top) < 0.05;
      if (!onIt || !player.slip()) return;
      this.goneSeconds = PEEL_RESPAWN_SECONDS;
      this.mesh.visible = false;
      this.sound(player, 'trapSlip');
      this.context.say('SLIP!', player.x, player.y + player.height + 0.4, '#ffffff');
    }
  }

  // ==========================================
  // The world that falls up: boulders shooting up out of the ground
  // ==========================================
  const BOULDER_PALETTE = { k: '#3a2a40', r: '#6a5a80', R: '#9a8ab0', w: '#d8d0e8' };
  const BOULDER_ROWS = [
    '...kkkkk...',
    '..krRRRrk..',
    '.krRRwRRrk.',
    'krRRRRRRRrk',
    'krRRRRRRrrk',
    'krrRRRRrrrk',
    '.krrrrrrrk.',
    '..kkkkkkk..'
  ];
  const CRACK_ROWS = ['k..kk..k', '.kk..kk.'];
  const BOULDER_SPEED = 7;
  const BOULDER_RADIUS = 0.5;

  class Boulder extends Trap {
    constructor(context, spot) {
      super(context, spot);
      this.period = 3.4 + this.phase * 0.8;
      this.crack = this.addSprite(pixelSprite('crack', CRACK_ROWS, { k: '#1a1020' }), 1.6, this.x, this.top - 0.12, 0.118);
      this.rock = this.addSprite(pixelSprite('boulder', BOULDER_ROWS, BOULDER_PALETTE), 1.6, this.x, this.top);
      this.rock.visible = false;
      this.launched = false;
    }

    update(deltaSeconds, player) {
      super.update(deltaSeconds);
      const elapsed = cycleAt(this.time, this.period, this.phase) * this.period;
      const flyFrom = this.period - 1.6;
      const warning = elapsed > flyFrom - 0.7 && elapsed < flyFrom;
      this.crack.material.color.setScalar(warning && Math.floor(this.time * 10) % 2 ? 3 : 1);
      if (warning && Math.random() < 0.4) this.particles.burst(this.x + (Math.random() - 0.5) * 0.6, this.top + 0.05, 1, '#9a8ab0', 0.8, 0.5);
      if (elapsed < flyFrom) {
        this.rock.visible = false;
        this.launched = false;
        return;
      }
      if (!this.launched) {
        this.launched = true;
        this.sound(player, 'creatureLand');
        this.particles.burst(this.x, this.top + 0.1, 10, '#6a5a80', 1.6, 0.5);
      }
      const y = this.top - 0.3 + BOULDER_SPEED * (elapsed - flyFrom);
      this.rock.visible = true;
      this.rock.position.y = y;
      this.rock.rotation.z += deltaSeconds * 2;
      this.rock.material.opacity = Math.min(1, (this.period - elapsed) * 2);
      if (touchesCircle(player, this.x, y, BOULDER_RADIUS)) this.hurt(player);
    }
  }

  // ==========================================
  // Giant's kitchen: hot stove burner
  // ==========================================
  const BURNER_ROWS = [
    '.wwwwwwwwwwwwwwwwww.',
    'w.ww.ww.ww.ww.ww.w.w',
    '.wwwwwwwwwwwwwwwwww.'
  ];
  const BURNER_WIDTH = 2.2;
  const BURNER_COLORS = { cold: '#8a8a8a', warm: '#ff9a3a', hot: '#ff3b1f' };

  class StoveBurner extends Trap {
    constructor(context, spot) {
      super(context, spot);
      this.period = 3.4 + this.phase * 0.6;
      this.from = this.x;
      this.to = this.x + BURNER_WIDTH;
      const centerX = this.x + BURNER_WIDTH / 2;
      this.addRect('#2a2a2a', BURNER_WIDTH + 0.2, 0.2, centerX, this.top - 0.04, 1, 0.116);
      this.coil = this.addSprite(pixelSprite('burner', BURNER_ROWS, { w: '#ffffff' }), 1.75, centerX, this.top - 0.12, 0.117);
      this.glow = this.addRect('#ff5a1f', BURNER_WIDTH, 0.9, centerX, this.top + 0.45, 0, BEAM_Z);
      this.wasHot = false;
    }

    update(deltaSeconds, player) {
      super.update(deltaSeconds);
      const cycle = cycleAt(this.time, this.period, this.phase);
      const state = cycle < 0.45 ? 'cold' : (cycle < 0.62 ? 'warm' : 'hot');
      this.coil.material.color.set(BURNER_COLORS[state]);
      this.glow.material.opacity = state === 'hot' ? 0.18 + Math.random() * 0.08 : 0;
      const hot = state === 'hot';
      if (hot && !this.wasHot) this.sound(player, 'trapHiss');
      this.wasHot = hot;
      if (state !== 'cold' && Math.random() < (hot ? 0.5 : 0.15)) {
        this.particles.burst(this.from + Math.random() * BURNER_WIDTH, this.top + 0.2, 1, hot ? '#ffb347' : '#cccccc', 0.4, 0.6);
      }
      const onIt = player.x > this.from - 0.1 && player.x < this.to + 0.1 && player.y < this.top + 0.3 && player.y > this.top - 0.2;
      if (hot && onIt && !player.isDefeated) this.hurt(player, player.x < this.from + BURNER_WIDTH / 2 ? this.to : this.from);
    }
  }

  // ==========================================
  // Octopus rock concert: speaker shockwaves rolling along the floor
  // ==========================================
  const SPEAKER_PALETTE = { k: '#000000', d: '#1a1420', m: '#3a3048', c: '#5a5070', p: '#ff4fd8' };
  const SPEAKER_ROWS = [
    'kkkkkkkkkkkk',
    'kddddddddddk',
    'kdmmmmmmmmdk',
    'kdmccccccmdk',
    'kdmcddddcmdk',
    'kdmcdppdcmdk',
    'kdmcddddcmdk',
    'kdmccccccmdk',
    'kdmmmmmmmmdk',
    'kddddddddddk',
    'kdmmmmmmmmdk',
    'kdmcdppdcmdk',
    'kdmmmmmmmmdk',
    'kkkkkkkkkkkk'
  ];
  const WAVE_ROWS = ['..pp', '.p..', 'p...', 'p...', 'p...', 'p...', '.p..', '..pp'];
  const WAVE_SPEED = 6;
  const WAVE_TRAVEL = 5;

  class Speaker extends Trap {
    constructor(context, spot) {
      super(context, spot);
      this.period = 2.8 + this.phase * 0.6;
      this.box = this.addSprite(pixelSprite('speaker', SPEAKER_ROWS, SPEAKER_PALETTE), 1.4, this.x, this.top - 0.05);
      this.wave = this.addSprite(pixelSprite('wave', WAVE_ROWS, { p: '#ff4fd8' }), 1.6, this.x, this.top);
      this.waveX = null;
      this.lastCycle = cycleAt(0, this.period, this.phase);
    }

    update(deltaSeconds, player) {
      super.update(deltaSeconds);
      const cycle = cycleAt(this.time, this.period, this.phase);
      // A thump as it fires, and the speaker bulges just before
      const pulse = cycle > 0.85 ? 1 + (cycle - 0.85) * 0.6 : 1;
      this.box.scale.set(pulse, pulse, 1);
      if (cycle < this.lastCycle) {
        this.waveX = this.x - 0.5;
        this.sound(player, 'trapThump');
      }
      this.lastCycle = cycle;
      if (this.waveX === null) {
        this.wave.visible = false;
        return;
      }
      this.waveX -= WAVE_SPEED * deltaSeconds;
      const travelled = this.x - 0.5 - this.waveX;
      if (travelled > WAVE_TRAVEL || this.waveX < this.left) {
        this.waveX = null;
        this.wave.visible = false;
        return;
      }
      this.wave.visible = true;
      this.wave.position.x = this.waveX;
      this.wave.material.opacity = Math.min(1, (WAVE_TRAVEL - travelled) * 1.5);
      if (touchesBox(player, this.waveX - 0.25, this.waveX + 0.25, this.top, this.top + 0.75)) this.hurt(player, this.waveX + 1);
    }
  }

  // ==========================================
  // The lot
  // ==========================================
  const TRAP_CLASSES = {
    flytrap: Flytrap,
    pendulum: Pendulum,
    thundercloud: Column,
    geyser: Column,
    laserGate: Column,
    tractorBeam: Column,
    quicksand: Quicksand,
    jawbreaker: Jawbreaker,
    meteor: Meteor,
    crystalArc: CrystalArc,
    crusher: Crusher,
    seaMine: Bobber,
    spider: Bobber,
    puffball: Puffball,
    flamethrower: Flamethrower,
    rift: Rift,
    airlockVent: AirlockVent,
    bananaPeel: BananaPeel,
    boulder: Boulder,
    stoveBurner: StoveBurner,
    speaker: Speaker
  };

  class WorldTraps {
    /**
     * @param {object} context { scene, particles, effects, terrain, say(text, x, y, color), snapCamera() }
     * @param {string} kind the world's trap (see TRAP_CLASSES)
     * @param {Array<{x:number, height:number, left:number, right:number, phase:number}>} spots
     */
    constructor(context, kind, spots = []) {
      const TrapClass = TRAP_CLASSES[kind];
      this.traps = TrapClass
        ? spots.map(spot => new TrapClass(context, { ...spot, top: spot.height }, kind))
        : [];
      this.particles = context.particles;
      this.starTimer = 0;
    }

    update(deltaSeconds, player) {
      this.traps.forEach(trap => trap.update(deltaSeconds, player));
      // Dizzy: little stars spin round his head
      if (player.isDizzy) {
        this.starTimer -= deltaSeconds;
        if (this.starTimer <= 0) {
          this.starTimer = 0.12;
          const angle = Math.random() * Math.PI * 2;
          this.particles.burst(player.x + Math.cos(angle) * 0.35, player.y + player.height + 0.1 + Math.sin(angle) * 0.1, 1, '#ffe14d', 0.3, 0.4);
        }
      }
    }

    dispose() {
      this.traps.forEach(trap => trap.dispose());
      this.traps = [];
    }
  }

  /** The traps the generator can place, so it can check a world's `trap` exists. */
  WorldTraps.kinds = Object.keys(TRAP_CLASSES);

  Forest.WorldTraps = WorldTraps;
})(window.Forest);
