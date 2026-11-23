/**
 * The solid parts of a level: ground segments (with pits between them) and floating platforms.
 *
 * Ground segments are solid blocks whose top is the grass line (GROUND_Y). Platforms are one-way:
 * you can jump up through them from below and land on top. Some platforms move back and forth
 * (ferries) or up and down (lifts), carrying whoever stands on them. Everything the boy stands on,
 * and the stretch of ground each enemy is allowed to roam, is answered from here.
 */
(function (Forest) {
  const { GROUND_Y } = Forest.Config;

  /** Tops within this distance below the feet still count as "under" them (avoids jitter). */
  const SURFACE_TOLERANCE = 0.001;
  /** Monsters only land on ledges at least this wide, and no higher than this. */
  const LANDING_MIN_WIDTH = 2.4;
  const LANDING_MAX_HEIGHT = 5;

  /** A platform's surface, from its level data. */
  function createPlatform({ x, y, width, bouncy = false, move = null }) {
    return {
      left: x,
      right: x + width,
      top: y,
      isGround: false,
      isBouncy: bouncy,
      move,
      start: { x, y },
      width,
      /** How far it moved during the last update (to carry riders along). */
      deltaX: 0,
      deltaY: 0
    };
  }

  class Terrain {
    /**
     * @param {object} level
     * @param {Array<[number, number]>} level.ground [left, right] of every ground segment
     * @param {Array<{x:number, y:number, width:number, bouncy?:boolean,
     *   move?:{dx?:number, dy?:number, period:number, phase?:number, rise?:number}}>} [level.platforms]
     *   x is the left edge, y the top. Bouncy ones launch whoever lands on them; moving ones travel
     *   (dx, dy) away from their start and back again every `period` seconds (starting `phase` of
     *   the way through), or with `rise` float up through that height and pop back down
     */
    constructor({ ground, platforms = [] }) {
      this.ground = ground
        .map(([left, right]) => ({ left, right, top: GROUND_Y, isGround: true }))
        .sort((a, b) => a.left - b.left);
      this.platforms = platforms.map(createPlatform);
      this.movingPlatforms = this.platforms.filter(platform => platform.move);
      this.surfaces = [...this.ground, ...this.platforms];
      this.elapsed = 0;
    }

    /**
     * Add a still ledge after the level was built (e.g. footholds over a boss too big to jump).
     * @param {{x:number, y:number, width:number}} platform
     * @returns {object} its surface
     */
    addPlatform(platform) {
      const surface = createPlatform(platform);
      this.platforms.push(surface);
      this.surfaces.push(surface);
      return surface;
    }

    /** Move the ferries and lifts along their paths. */
    update(deltaSeconds) {
      this.elapsed += deltaSeconds;
      this.movingPlatforms.forEach(platform => {
        const { dx = 0, dy = 0, period, phase = 0, rise } = platform.move;
        if (rise) {
          // Floats steadily up through `rise` around its spot, then pops back to the bottom.
          // The drop isn't carried over to a rider (see justWrapped): he drops and lands on it again.
          const cycle = ((this.elapsed / period + phase) % 1 + 1) % 1;
          const top = platform.start.y - rise / 2 + rise * cycle;
          platform.deltaX = 0;
          platform.justWrapped = top < platform.top;
          platform.deltaY = platform.justWrapped ? 0 : top - platform.top;
          platform.top = top;
          return;
        }
        // 0 at the start of the path, 1 at the far end, easing in and out at both ends
        const travel = 0.5 - 0.5 * Math.cos((this.elapsed / period + phase) * Math.PI * 2);
        const left = platform.start.x + dx * travel;
        const top = platform.start.y + dy * travel;
        platform.deltaX = left - platform.left;
        platform.deltaY = top - platform.top;
        platform.left = left;
        platform.right = left + platform.width;
        platform.top = top;
      });
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

    /**
     * Where something dropping down at x (from below fromY) comes to rest: the highest ground or
     * still, roomy ledge under it, up to LANDING_MAX_HEIGHT (narrow sky-route ledges are left alone).
     * @param {boolean} [allowLedges] false: only the ground counts
     * @returns {object|null} null over a pit
     */
    landingSurfaceAt(x, fromY = Infinity, allowLedges = true) {
      let best = null;
      for (const surface of this.surfaces) {
        if (x < surface.left || x > surface.right || surface.top > fromY) continue;
        const isRoomyLedge = !surface.isGround && !surface.move && !surface.isBouncy
          && surface.width >= LANDING_MIN_WIDTH && surface.top <= LANDING_MAX_HEIGHT;
        if (!surface.isGround && !(allowLedges && isRoomyLedge)) continue;
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

    /** The first spot at least `margin` onto solid ground at or after x (for respawning). */
    safeGroundFrom(x, margin = 1) {
      for (const segment of this.ground) {
        if (segment.right - margin < x) continue;
        if (segment.right - segment.left < margin * 2) continue;
        return Math.max(x, segment.left + margin);
      }
      return x;
    }

    /** Where a ground creature near x may roam: the ends of its ground segment. */
    walkableRange(x) {
      const segment = this.nearestGround(x);
      return { minX: segment.left, maxX: segment.right };
    }
  }

  Forest.Terrain = Terrain;
})(window.Forest);
