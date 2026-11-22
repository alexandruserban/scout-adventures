/**
 * The solid parts of a level: ground segments (with pits between them) and floating platforms.
 *
 * Ground segments are solid blocks whose top is the grass line (GROUND_Y). Platforms are one-way:
 * you can jump up through them from below and land on top. Everything the boy stands on, and the
 * stretch of ground each enemy is allowed to roam, is answered from here.
 */
(function (Forest) {
  const { GROUND_Y } = Forest.Config;

  /** Tops within this distance below the feet still count as "under" them (avoids jitter). */
  const SURFACE_TOLERANCE = 0.001;

  class Terrain {
    /**
     * @param {object} level
     * @param {Array<[number, number]>} level.ground [left, right] of every ground segment
     * @param {Array<{x:number, y:number, width:number, bouncy?:boolean}>} [level.platforms] x is the left edge,
     *   y the top; bouncy ones launch whoever lands on them
     */
    constructor({ ground, platforms = [] }) {
      this.ground = ground
        .map(([left, right]) => ({ left, right, top: GROUND_Y, isGround: true }))
        .sort((a, b) => a.left - b.left);
      this.platforms = platforms.map(({ x, y, width, bouncy = false }) => ({ left: x, right: x + width, top: y, isGround: false, isBouncy: bouncy }));
      this.surfaces = [...this.ground, ...this.platforms];
    }

    /**
     * The highest surface under something at (x, fromY) whose feet span x ± halfWidth.
     * @returns {{top:number, isGround:boolean, left:number, right:number}|null} null over a pit
     */
    surfaceBelow(x, fromY, halfWidth = 0) {
      let best = null;
      for (const surface of this.surfaces) {
        if (x + halfWidth <= surface.left || x - halfWidth >= surface.right) continue;
        if (surface.top > fromY + SURFACE_TOLERANCE) continue;
        if (!best || surface.top > best.top) best = surface;
      }
      return best;
    }

    /** Height of the surface under (x, fromY), or -Infinity over a pit. */
    floorBelow(x, fromY, halfWidth = 0) {
      const surface = this.surfaceBelow(x, fromY, halfWidth);
      return surface ? surface.top : -Infinity;
    }

    /** The ground segment containing x, if any. */
    groundAt(x) {
      return this.ground.find(segment => x >= segment.left && x <= segment.right) || null;
    }

    /** The ground segment containing x, or the closest one when x is over a pit. */
    nearestGround(x) {
      let best = this.ground[0];
      let bestDistance = Infinity;
      for (const segment of this.ground) {
        const distance = x < segment.left ? segment.left - x : (x > segment.right ? x - segment.right : 0);
        if (distance < bestDistance) {
          best = segment;
          bestDistance = distance;
        }
      }
      return best;
    }

    /** Where a ground creature near x may roam: the ends of its ground segment. */
    walkableRange(x) {
      const segment = this.nearestGround(x);
      return { minX: segment.left, maxX: segment.right };
    }
  }

  Forest.Terrain = Terrain;
})(window.Forest);
