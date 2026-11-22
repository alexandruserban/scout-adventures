/** Spinning gold coins placed around a level. Touch one to collect it for points. */
(function (Forest) {
  const { PIXEL_SCALE } = Forest.Config;
  const { createSprite, createSpriteMesh, removeMesh } = Forest.Graphics;

  const COIN_SCALE = 1.0;
  const COIN_Z = 0.28;
  const SPIN_SPEED = 4;
  const BOB_SPEED = 3;
  const BOB_HEIGHT = 0.05;
  const PICKUP_RADIUS = 0.3;
  /** Coins further than this from the boy aren't checked or animated. */
  const ACTIVE_DISTANCE = 16;

  class Coins {
    /**
     * @param {object} world shared game systems (scene, particles)
     * @param {(coin: {x:number, y:number}) => void} onCollected
     */
    constructor(world, onCollected) {
      this.scene = world.scene;
      this.particles = world.particles;
      this.onCollected = onCollected;
      this.sprite = createSprite(Forest.LevelSprites.createCoin());
      this.unitsPerPixel = PIXEL_SCALE * COIN_SCALE;
      this.coins = [];
      this.elapsed = 0;
    }

    /** Replace all coins with these positions (coin centres). */
    place(positions) {
      this.clear();
      positions.forEach(({ x, y }, index) => {
        const mesh = createSpriteMesh(this.sprite, this.unitsPerPixel);
        mesh.position.set(x, y, COIN_Z);
        this.scene.add(mesh);
        this.coins.push({ mesh, x, y, phase: index * 0.45 });
      });
    }

    get remaining() {
      return this.coins.length;
    }

    update(deltaSeconds, player) {
      this.elapsed += deltaSeconds;
      const playerCenterY = player.y + player.height / 2;

      for (let i = this.coins.length - 1; i >= 0; i--) {
        const coin = this.coins[i];
        if (Math.abs(coin.x - player.x) > ACTIVE_DISTANCE) continue;

        // Spin: squash the coin horizontally, never quite to nothing
        const spin = Math.cos(this.elapsed * SPIN_SPEED + coin.phase);
        coin.mesh.scale.x = Math.max(0.15, Math.abs(spin));
        coin.mesh.position.y = coin.y + Math.sin(this.elapsed * BOB_SPEED + coin.phase) * BOB_HEIGHT;

        const isTouching = !player.isDefeated
          && Math.abs(player.x - coin.x) < player.width * 0.3 + PICKUP_RADIUS
          && Math.abs(playerCenterY - coin.y) < player.height * 0.5 + PICKUP_RADIUS;
        if (isTouching) {
          this.particles.burst(coin.x, coin.y, 8, '#ffd84a', 1.0, 0.3);
          this.particles.burst(coin.x, coin.y, 4, '#ffffff', 0.7, 0.25);
          this.onCollected(coin);
          this.removeAt(i);
        }
      }
    }

    removeAt(index) {
      removeMesh(this.scene, this.coins[index].mesh, { disposeGeometry: true });
      this.coins.splice(index, 1);
    }

    clear() {
      for (let i = this.coins.length - 1; i >= 0; i--) this.removeAt(i);
    }
  }

  Forest.Coins = Coins;
})(window.Forest);
