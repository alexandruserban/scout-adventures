/**
 * Things the boy can pick up:
 *  - HeartPickups: hearts dropped by defeated foes. They pop out, bounce, bob on the grass,
 *    and blink away if nobody grabs them in time.
 *  - FloatingText: little "+50" labels that rise and fade where points were earned.
 */
(function (Forest) {
  const { PIXEL_SCALE, GROUND_Y, LEVEL_START_X, LEVEL_END_X } = Forest.Config;
  const { createSprite, createSpriteMesh, removeMesh, createPixelTexture } = Forest.Graphics;
  const { asciiToCanvas, createPixelCanvas } = Forest.PixelCanvas;
  const { clamp, randomBetween } = Forest.MathUtils;

  // ==========================================
  // Hearts
  // ==========================================
  const HEART_ROWS = [
    '.KK.KK.',
    'KwrKrrK',
    'KrrrrrK',
    'KrrrrdK',
    '.KrrdK.',
    '..KdK..',
    '...K...'
  ];
  const HEART_PALETTE = { K: '#4a0000', r: '#e63946', d: '#a81c2b', w: '#ffd6d6' };

  const HEART_SCALE = 1.7;
  const HEART_Z = 0.3;
  const HEART_GRAVITY = 18;
  const HEART_POP_SPEED = 5.5;
  const HEART_POP_SIDEWAYS = 1.5;
  /** Bounces lose this much speed; slower than BOUNCE_STOP_SPEED it settles. */
  const HEART_BOUNCINESS = 0.45;
  const BOUNCE_STOP_SPEED = 1.5;
  const HEART_LIFETIME = 15;
  /** Blinks for this long before vanishing. */
  const HEART_BLINK_SECONDS = 3;
  /** Can't be grabbed the instant it appears, so it visibly pops out first. */
  const HEART_PICKUP_DELAY = 0.3;
  const HEART_PICKUP_RADIUS = 0.35;
  const HEART_BOB_SPEED = 4;
  const HEART_BOB_HEIGHT = 0.06;
  const LEVEL_MARGIN = 0.4;
  /** A heart dropped from the sky floats down no faster than this, so the boy sees it coming. */
  const SKY_HEART_FALL_SPEED = 3.5;
  /** A heart that fell this far into a pit is gone. */
  const FALLEN_AWAY_Y = -6;

  class HeartPickups {
    /**
     * @param {object} world shared game systems (scene, particles)
     * @param {(heart: {x:number, y:number}) => void} onCollected
     */
    constructor(world, onCollected) {
      this.world = world;
      this.scene = world.scene;
      this.particles = world.particles;
      this.onCollected = onCollected;
      this.sprite = createSprite(asciiToCanvas(HEART_ROWS, 1, HEART_PALETTE));
      this.unitsPerPixel = PIXEL_SCALE * HEART_SCALE;
      this.size = this.sprite.height * this.unitsPerPixel;
      this.hearts = [];
    }

    /** Pop a heart out at (x, y). */
    spawn(x, y) {
      const mesh = createSpriteMesh(this.sprite, this.unitsPerPixel);
      this.scene.add(mesh);
      this.hearts.push({
        mesh,
        x,
        y: Math.max(GROUND_Y, y),
        velocityX: randomBetween(-HEART_POP_SIDEWAYS, HEART_POP_SIDEWAYS),
        velocityY: HEART_POP_SPEED,
        age: 0
      });
      this.particles.burst(x, y, 6, '#ff6b6b', 0.8, 0.4);
    }

    /** Let a heart float down from the sky at (x, skyY); it stays until picked up. */
    dropFromSky(x, skyY) {
      const mesh = createSpriteMesh(this.sprite, this.unitsPerPixel);
      this.scene.add(mesh);
      this.hearts.push({ mesh, x, y: skyY, velocityX: 0, velocityY: 0, age: 0, stays: true, maxFallSpeed: SKY_HEART_FALL_SPEED });
    }

    /** A heart already lying in the level at (x, y), standing on whatever is there; it never blinks away. */
    place(x, y) {
      const mesh = createSpriteMesh(this.sprite, this.unitsPerPixel);
      this.scene.add(mesh);
      this.hearts.push({ mesh, x, y, velocityX: 0, velocityY: 0, age: HEART_PICKUP_DELAY, stays: true });
    }

    update(deltaSeconds, player) {
      for (let i = this.hearts.length - 1; i >= 0; i--) {
        const heart = this.hearts[i];
        heart.age += deltaSeconds;
        this.move(heart, deltaSeconds);

        if (heart.age > HEART_PICKUP_DELAY && this.isTouching(heart, player)) {
          this.particles.burst(heart.x, heart.y + this.size / 2, 10, '#ff6b6b', 1.2, 0.4);
          this.particles.burst(heart.x, heart.y + this.size / 2, 6, '#ffffff', 0.8, 0.3);
          this.onCollected(heart);
          this.removeAt(i);
        } else if (heart.y < FALLEN_AWAY_Y) {
          this.removeAt(i);
        } else if (!heart.stays && heart.age >= HEART_LIFETIME) {
          this.particles.burst(heart.x, heart.y + this.size / 2, 5, '#a81c2b', 0.6, 0.3);
          this.removeAt(i);
        }
      }
    }

    move(heart, deltaSeconds) {
      const previousY = heart.y;
      heart.velocityY -= HEART_GRAVITY * deltaSeconds;
      if (heart.maxFallSpeed) heart.velocityY = Math.max(heart.velocityY, -heart.maxFallSpeed);
      heart.x = clamp(heart.x + heart.velocityX * deltaSeconds, LEVEL_START_X + LEVEL_MARGIN, LEVEL_END_X - LEVEL_MARGIN);
      heart.y += heart.velocityY * deltaSeconds;

      // Lands on ground or a platform; over a pit it falls away (and is removed once out of sight)
      const terrain = this.world.terrain;
      heart.floorY = terrain ? terrain.floorBelow(heart.x, previousY) : GROUND_Y;
      if (heart.y <= heart.floorY) {
        heart.y = heart.floorY;
        heart.velocityX *= 0.7;
        heart.velocityY = heart.velocityY < -BOUNCE_STOP_SPEED ? -heart.velocityY * HEART_BOUNCINESS : 0;
      }

      const isResting = heart.y === heart.floorY && heart.velocityY === 0;
      const bob = isResting ? (1 + Math.sin(heart.age * HEART_BOB_SPEED)) * HEART_BOB_HEIGHT : 0;
      heart.mesh.position.set(heart.x, heart.y + this.size / 2 + bob, HEART_Z);

      const blinkStartsAt = HEART_LIFETIME - HEART_BLINK_SECONDS;
      heart.mesh.visible = heart.stays || heart.age < blinkStartsAt || Math.floor(heart.age * 10) % 2 === 0;
    }

    isTouching(heart, player) {
      if (player.isDefeated) return false;
      const heartCenterY = heart.y + this.size / 2;
      return Math.abs(player.x - heart.x) < player.width * 0.3 + HEART_PICKUP_RADIUS
        && heartCenterY > player.y - HEART_PICKUP_RADIUS
        && heartCenterY < player.y + player.height + HEART_PICKUP_RADIUS;
    }

    removeAt(index) {
      removeMesh(this.scene, this.hearts[index].mesh, { disposeGeometry: true });
      this.hearts.splice(index, 1);
    }

    clear() {
      for (let i = this.hearts.length - 1; i >= 0; i--) this.removeAt(i);
    }
  }

  // ==========================================
  // Floating "+points" text
  // ==========================================
  const TEXT_FONT_PIXELS = 16;
  const TEXT_PADDING = 4;
  /** On-screen height of the label, in world units. */
  const TEXT_HEIGHT = 0.3;
  const TEXT_Z = 0.7;
  const TEXT_LIFETIME = 1.0;
  const TEXT_RISE_SPEED = 1.2;
  /** Starts fading after this fraction of its lifetime. */
  const TEXT_FADE_FROM = 0.6;

  class FloatingText {
    constructor(scene) {
      this.scene = scene;
      this.labels = [];
    }

    /**
     * @param {string} text
     * @param {number} x
     * @param {number} y
     * @param {string} [color]
     */
    spawn(text, x, y, color = '#ffbe0b') {
      const texture = createPixelTexture(this.paintText(text, color));
      const { width, height } = texture.image;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(TEXT_HEIGHT * (width / height), TEXT_HEIGHT),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
      );
      mesh.position.set(x, y, TEXT_Z);
      this.scene.add(mesh);
      this.labels.push({ mesh, texture, x, y, age: 0 });
    }

    /** Pixel-font text with a dark outline, so it reads on any background. */
    paintText(text, color) {
      const font = `${TEXT_FONT_PIXELS}px 'Press Start 2P', monospace`;
      const measure = createPixelCanvas(1, 1).ctx;
      measure.font = font;
      const width = Math.ceil(measure.measureText(text).width) + TEXT_PADDING * 2;
      const height = TEXT_FONT_PIXELS + TEXT_PADDING * 2;

      const { canvas, ctx } = createPixelCanvas(width, height);
      ctx.font = font;
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#1a0b00';
      ctx.strokeText(text, TEXT_PADDING, height / 2);
      ctx.fillStyle = color;
      ctx.fillText(text, TEXT_PADDING, height / 2);
      return canvas;
    }

    update(deltaSeconds) {
      for (let i = this.labels.length - 1; i >= 0; i--) {
        const label = this.labels[i];
        label.age += deltaSeconds;
        const progress = label.age / TEXT_LIFETIME;
        if (progress >= 1) {
          this.removeAt(i);
          continue;
        }
        label.y += TEXT_RISE_SPEED * (1 - progress) * deltaSeconds;
        label.mesh.position.set(label.x, label.y, TEXT_Z);
        label.mesh.material.opacity = progress < TEXT_FADE_FROM ? 1 : 1 - (progress - TEXT_FADE_FROM) / (1 - TEXT_FADE_FROM);
      }
    }

    removeAt(index) {
      const label = this.labels[index];
      label.texture.dispose();
      removeMesh(this.scene, label.mesh, { disposeGeometry: true });
      this.labels.splice(index, 1);
    }

    clear() {
      for (let i = this.labels.length - 1; i >= 0; i--) this.removeAt(i);
    }
  }

  Forest.HeartPickups = HeartPickups;
  Forest.FloatingText = FloatingText;
})(window.Forest);
