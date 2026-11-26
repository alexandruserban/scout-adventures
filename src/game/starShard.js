/**
 * The Heart Star shard a beaten boss leaves behind. It drops to the arena floor and hovers there,
 * glowing, until the boy touches it; only then is the level won (see main.js).
 */
(function (Forest) {
  const { PIXEL_SCALE, GROUND_Y } = Forest.Config;
  const { createSprite, createSpriteMesh, removeMesh } = Forest.Graphics;

  /** A jagged crystal splinter of the star: white-hot core, gold edges, a hint of rainbow. */
  const SHARD_ROWS = [
    '....W....',
    '...WYW...',
    '...WYW...',
    '..WYyYW..',
    '..WYyPW..',
    '.WYyWyPW.',
    '.WYWWWyW.',
    'WYyWWWcYW',
    '.WYyWyYW.',
    '..WYycW..',
    '..WYyYW..',
    '...WYW...',
    '....W....'
  ];
  const SHARD_PALETTE = { W: '#fffbe6', Y: '#ffd84a', y: '#fff3a0', P: '#ff9cf0', c: '#9ff0ff' };

  /** Sprite pixels are drawn this much bigger than the game's normal pixel size. */
  const SPRITE_SCALE = 1.6;
  /** It hovers with its centre this high above the floor, bobbing up and down. */
  const HOVER_HEIGHT = 0.95;
  const BOB_HEIGHT = 0.15;
  const BOB_SPEED = 3;
  const FALL_SPEED = 6;
  const SPIN_SPEED = 2.4;
  /** How close the boy's body has to come to pick it up. */
  const PICKUP_HALF_WIDTH = 0.65;
  const PICKUP_HALF_HEIGHT = 0.8;
  const SPARKLE_CHANCE = 0.35;
  const RING_SECONDS = 0.9;
  const GLOW_COLORS = ['#fff3a0', '#ffd84a', '#ffffff', '#ff9cf0', '#9ff0ff'];
  const SHARD_Z = 0.5;

  let sprite = null;

  function shardSprite() {
    if (sprite) return sprite;
    const canvas = document.createElement('canvas');
    canvas.width = SHARD_ROWS[0].length;
    canvas.height = SHARD_ROWS.length;
    const context = canvas.getContext('2d');
    SHARD_ROWS.forEach((row, y) => [...row].forEach((key, x) => {
      if (!SHARD_PALETTE[key]) return;
      context.fillStyle = SHARD_PALETTE[key];
      context.fillRect(x, y, 1, 1);
    }));
    sprite = createSprite(canvas);
    return sprite;
  }

  class StarShard {
    /**
     * @param {object} world shared game systems (scene, particles, effects)
     * @param {{x:number, y:number}} from where it appears (the beaten boss's middle)
     * @param {() => void} onCollected called once when the boy picks it up
     */
    constructor(world, { x, y }, onCollected) {
      this.scene = world.scene;
      this.particles = world.particles;
      this.effects = world.effects;
      this.onCollected = onCollected;
      this.x = x;
      this.y = y;
      this.restY = GROUND_Y + HOVER_HEIGHT;
      this.time = 0;
      this.ringTimer = 0;
      this.isCollected = false;
      this.mesh = createSpriteMesh(shardSprite(), PIXEL_SCALE * SPRITE_SCALE);
      this.scene.add(this.mesh);
      this.particles.burst(x, y, 20, '#fff3a0', 2.2, 0.6);
      this.effects.spawnRing({ color: '#fff3a0', x, y, fromScale: 0.3, toScale: 5, lifetime: 0.5, z: SHARD_Z + 0.1 });
      this.sync();
    }

    update(deltaSeconds, player) {
      if (this.isCollected) return;
      this.time += deltaSeconds;
      // Drops down to hover just above the floor
      if (this.y > this.restY) this.y = Math.max(this.restY, this.y - FALL_SPEED * deltaSeconds);

      if (Math.random() < SPARKLE_CHANCE) {
        const color = GLOW_COLORS[Math.floor(Math.random() * GLOW_COLORS.length)];
        this.particles.burst(this.x + (Math.random() - 0.5) * 0.6, this.centerY + (Math.random() - 0.5) * 0.8, 1, color, 0.6, 0.5);
      }
      this.ringTimer -= deltaSeconds;
      if (this.ringTimer <= 0) {
        this.ringTimer = RING_SECONDS;
        this.effects.spawnRing({ color: '#ffd84a', x: this.x, y: this.centerY, fromScale: 0.4, toScale: 2.6, lifetime: 0.7, z: SHARD_Z - 0.01 });
      }
      this.sync();

      if (!player.isDefeated && this.isTouching(player)) this.collect();
    }

    /** The bobbing height it's drawn at. */
    get centerY() {
      const bob = this.y <= this.restY ? Math.sin(this.time * BOB_SPEED) * BOB_HEIGHT : 0;
      return this.y + bob;
    }

    isTouching(player) {
      return Math.abs(player.x - this.x) < PICKUP_HALF_WIDTH
        && Math.abs(player.y + player.height / 2 - this.centerY) < PICKUP_HALF_HEIGHT + player.height / 2;
    }

    collect() {
      this.isCollected = true;
      this.particles.burst(this.x, this.centerY, 30, '#fff3a0', 3, 0.8);
      this.particles.burst(this.x, this.centerY, 16, '#ff9cf0', 2.2, 0.6);
      this.effects.spawnRing({ color: '#ffffff', x: this.x, y: this.centerY, fromScale: 0.5, toScale: 10, lifetime: 0.6, z: SHARD_Z + 0.1 });
      this.remove();
      this.onCollected();
    }

    sync() {
      if (!this.mesh) return;
      this.mesh.position.set(this.x, this.centerY, SHARD_Z);
      // A slow turn, shown by squeezing it sideways like a spinning coin
      this.mesh.scale.set(Math.max(0.25, Math.abs(Math.cos(this.time * SPIN_SPEED))), 1, 1);
    }

    remove() {
      if (!this.mesh) return;
      removeMesh(this.scene, this.mesh, { disposeGeometry: true });
      this.mesh = null;
    }
  }

  Forest.StarShard = StarShard;
})(window.Forest);
