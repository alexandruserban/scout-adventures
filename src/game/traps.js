/**
 * Spike traps: rows of metal spikes hidden in the ground that rattle as a warning, snap up, stay
 * out for a moment and sink back again, each on its own clock. Touching them while they are out
 * costs a heart and throws the boy clear. A dark slot in the grass shows where each one hides.
 */
(function (Forest) {
  const { PIXEL_SCALE, GROUND_Y } = Forest.Config;
  const { createSprite, createSpriteMesh, removeMesh } = Forest.Graphics;
  const Sfx = Forest.SoundEffects;

  /** Spikes are drawn this much bigger than the game's normal pixel size. */
  const SPRITE_SCALE = 1.3;
  /** One spike, bottom row first: how many pixels wide each row is. */
  const SPIKE_ROWS = [5, 5, 3, 3, 3, 1, 1];
  const SPIKE_PITCH = 5;
  const COLORS = { tip: '#f2f6fb', light: '#c3ccd6', dark: '#6b7482', base: '#3a3f48' };
  /** Behind the grass strip (so they hide in the ground) but in front of the earth below it. */
  const SPIKES_Z = 0.09;
  const SLOT_Z = 0.115;
  const SLOT_COLOR = '#14110f';
  /**
   * The cycle, as parts of its period: hidden until WARN, rattling a little way up until RISE,
   * shooting up until OUT, out until SINK, and sliding back down to the end.
   */
  const WARN = 0.5;
  const RISE = 0.68;
  const OUT = 0.72;
  const SINK = 0.94;
  /** How far up they peek while rattling (a share of their height). */
  const WARN_PEEK = 0.22;
  const RATTLE = 0.035;
  /** They only hurt when at least this far out, and this far in from either end. */
  const HURT_FROM = 0.6;
  const HURT_INSET = 0.12;
  const FOOT_HALF_WIDTH = 0.22;
  /** Only traps this close to the boy make a sound when they snap up. */
  const HEARING_DISTANCE = 12;

  /** A row of spikes `widthPixels` wide (shared by every trap of that width). */
  const spriteCache = new Map();
  function spikeSprite(widthPixels) {
    if (spriteCache.has(widthPixels)) return spriteCache.get(widthPixels);
    const canvas = document.createElement('canvas');
    canvas.width = widthPixels;
    canvas.height = SPIKE_ROWS.length;
    const context = canvas.getContext('2d');
    const bottom = canvas.height - 1;
    for (let start = 0; start + SPIKE_ROWS[0] <= widthPixels; start += SPIKE_PITCH) {
      SPIKE_ROWS.forEach((rowWidth, row) => {
        const left = start + (SPIKE_ROWS[0] - rowWidth) / 2;
        for (let i = 0; i < rowWidth; i++) {
          // Lit on the left, shaded on the right, a shining tip and a dark foot
          let color = i < rowWidth / 2 ? COLORS.light : COLORS.dark;
          if (row === 0) color = COLORS.base;
          else if (row >= SPIKE_ROWS.length - 2) color = COLORS.tip;
          context.fillStyle = color;
          context.fillRect(left + i, bottom - row, 1, 1);
        }
      });
    }
    const sprite = createSprite(canvas);
    spriteCache.set(widthPixels, sprite);
    return sprite;
  }

  /** How far out a trap is (0 hidden, 1 fully out) at `cycle` (0 to 1) through its period. */
  function raisedAt(cycle) {
    if (cycle < WARN) return 0;
    if (cycle < RISE) return WARN_PEEK;
    if (cycle < OUT) return WARN_PEEK + (1 - WARN_PEEK) * ((cycle - RISE) / (OUT - RISE));
    if (cycle < SINK) return 1;
    return 1 - (cycle - SINK) / (1 - SINK);
  }

  class SpikeTraps {
    /**
     * @param {THREE.Scene} scene
     * @param {Array<{x:number, width:number, height?:number, period:number, phase:number}>} traps
     *   from the level (x is the left edge, height the ground's height there)
     */
    constructor(scene, traps = []) {
      this.scene = scene;
      this.time = 0;
      this.traps = traps.map(({ x, width, height = 0, period, phase }) => {
        const sprite = spikeSprite(Math.max(SPIKE_ROWS[0], Math.round(width / (PIXEL_SCALE * SPRITE_SCALE))));
        const mesh = createSpriteMesh(sprite, PIXEL_SCALE * SPRITE_SCALE);
        const spikeHeight = sprite.height * PIXEL_SCALE * SPRITE_SCALE;
        const spanWidth = sprite.width * PIXEL_SCALE * SPRITE_SCALE;
        const top = GROUND_Y + height;
        const centerX = x + width / 2;
        scene.add(mesh);
        const slot = new THREE.Mesh(
          new THREE.PlaneGeometry(spanWidth + 0.1, 0.07),
          new THREE.MeshBasicMaterial({ color: SLOT_COLOR, transparent: true, opacity: 0.7 })
        );
        slot.position.set(centerX, top - 0.03, SLOT_Z);
        scene.add(slot);
        return {
          mesh, slot, top, centerX, spikeHeight, period, phase,
          left: centerX - spanWidth / 2, right: centerX + spanWidth / 2,
          raised: 0, wasOut: false
        };
      });
      this.sync();
    }

    /**
     * Work the traps and hurt the boy if he's on one that's out.
     * @param {number} deltaSeconds
     * @param {object} player
     */
    update(deltaSeconds, player) {
      this.time += deltaSeconds;
      this.traps.forEach(trap => {
        const cycle = ((this.time / trap.period + trap.phase) % 1 + 1) % 1;
        trap.raised = raisedAt(cycle);
        const isOut = trap.raised >= 1;
        if (isOut && !trap.wasOut && Math.abs(player.x - trap.centerX) < HEARING_DISTANCE) Sfx.spikesUp();
        trap.wasOut = isOut;
        trap.isRattling = cycle >= WARN && cycle < RISE;
        if (this.isHurting(trap, player)) player.takeDamage(1, trap.centerX);
      });
      this.sync();
    }

    isHurting(trap, player) {
      if (player.isDefeated || trap.raised < HURT_FROM) return false;
      const overlaps = player.x + FOOT_HALF_WIDTH > trap.left + HURT_INSET && player.x - FOOT_HALF_WIDTH < trap.right - HURT_INSET;
      const tipY = trap.top + trap.spikeHeight * trap.raised - 0.1;
      return overlaps && player.y < tipY && player.y > trap.top - 0.3;
    }

    sync() {
      this.traps.forEach(trap => {
        const rattle = trap.isRattling ? Math.sin(this.time * 80) * RATTLE : 0;
        // Fully hidden, the tips sit just under the grass line
        const bottom = trap.top - trap.spikeHeight - 0.05 + (trap.spikeHeight + 0.02) * trap.raised;
        trap.mesh.position.set(trap.centerX + rattle, bottom + trap.spikeHeight / 2, SPIKES_Z);
      });
    }

    /** Take every trap out of the scene. */
    dispose() {
      this.traps.forEach(trap => {
        removeMesh(this.scene, trap.mesh, { disposeGeometry: true });
        removeMesh(this.scene, trap.slot, { disposeGeometry: true });
      });
      this.traps = [];
    }
  }

  Forest.SpikeTraps = SpikeTraps;
})(window.Forest);
