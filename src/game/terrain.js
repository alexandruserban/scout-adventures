/**
 * The solid parts of a level: ground segments (with pits between them) and floating platforms.
 *
 * Ground segments are solid blocks whose top is the grass line (GROUND_Y), or higher for hills and
 * cliffs: the boy can't walk into the side of one taller than his feet. Platforms are one-way:
 * you can jump up through them from below and land on top. Some platforms move back and forth
 * (ferries) or up and down (lifts), carrying whoever stands on them, and crumbling ones shake and
 * drop away soon after he lands on them, coming back a little later. Everything the boy stands on,
 * and the stretch of ground each enemy is allowed to roam, is answered from here.
 */
(function (Forest) {
  const { GROUND_Y } = Forest.Config;

  /** Tops within this distance below the feet still count as "under" them (avoids jitter). */
  const SURFACE_TOLERANCE = 0.001;
  /** Monsters only land on ledges at least this wide, and no higher than this. */
  const LANDING_MIN_WIDTH = 2.4;
  const LANDING_MAX_HEIGHT = 5;
  /** A crumbling ledge shakes this long under the boy before it falls, and is back this long after. */
  const CRUMBLE_SHAKE_SECONDS = 0.5;
  const CRUMBLE_RETURN_SECONDS = 3.2;
  /** Ground counts as a wall when its top is this much above his feet. */
  const WALL_STEP = 0.02;

  /** A platform's surface, from its level data. */
  function createPlatform({ x, y, width, bouncy = false, move = null, crumble = false }) {
    return {
      left: x,
      right: x + width,
      top: y,
      isGround: false,
      isBouncy: bouncy,
      move,
      isCrumbly: crumble,
      /** Crumbling ledges: 'solid', 'shaking' (stood on) or 'fallen' (not there), for `stateSeconds`. */
      crumbleState: 'solid',
      stateSeconds: Infinity, // long settled: no fade-in at the start
      isGone: false,
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
     * @param {Array<[number, number, number?]>} level.ground [left, right, height] of every ground
     *   segment (height above the grass line, 0 when left out)
     * @param {Array<{x:number, y:number, width:number, bouncy?:boolean, crumble?:boolean,
     *   move?:{dx?:number, dy?:number, period:number, phase?:number, rise?:number}}>} [level.platforms]
     *   x is the left edge, y the top. Bouncy ones launch whoever lands on them; moving ones travel
     *   (dx, dy) away from their start and back again every `period` seconds (starting `phase` of
     *   the way through), or with `rise` float up through that height and pop back down
     */
    constructor({ ground, platforms = [] }) {
      this.ground = ground
        .map(([left, right, height = 0]) => ({ left, right, top: GROUND_Y + height, isGround: true }))
        .sort((a, b) => a.left - b.left);
      this.platforms = platforms.map(createPlatform);
      this.movingPlatforms = this.platforms.filter(platform => platform.move);
      this.crumblyPlatforms = this.platforms.filter(platform => platform.isCrumbly);
      this.surfaces = [...this.ground, ...this.platforms];
      this.elapsed = 0;
      /** Called with a crumbling ledge as it gives way (for its sound and dust). */
      this.onCrumble = null;
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

    /**
     * Move the ferries and lifts along their paths, and crumble the ledges the boy stands on.
     * @param {number} deltaSeconds
     * @param {object} [player] whoever might be standing on a crumbling ledge
     */
    update(deltaSeconds, player = null) {
      this.elapsed += deltaSeconds;
      this.updateCrumbling(deltaSeconds, player);
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

    updateCrumbling(deltaSeconds, player) {
      const standingOn = player && player.isGrounded && !player.isDefeated ? player.groundSurface : null;
      this.crumblyPlatforms.forEach(platform => {
        platform.stateSeconds += deltaSeconds;
        if (platform.crumbleState === 'solid') {
          if (standingOn === platform) this.setCrumbleState(platform, 'shaking');
        } else if (platform.crumbleState === 'shaking') {
          if (platform.stateSeconds >= CRUMBLE_SHAKE_SECONDS) this.setCrumbleState(platform, 'fallen');
        } else if (platform.stateSeconds >= CRUMBLE_RETURN_SECONDS) {
          this.setCrumbleState(platform, 'solid');
        }
      });
    }

    setCrumbleState(platform, state) {
      platform.crumbleState = state;
      platform.stateSeconds = 0;
      platform.isGone = state === 'fallen';
      if (platform.isGone && this.onCrumble) this.onCrumble(platform);
    }

    /**
     * Stop something moving sideways from fromX to toX (feet at y, x ± halfWidth wide) at the side
     * of any ground taller than its feet: hills and cliff faces are walls.
     * @returns {number} where it ends up
     */
    blockSideways(fromX, toX, y, halfWidth) {
      let x = toX;
      for (const segment of this.ground) {
        if (segment.top <= y + WALL_STEP) continue;
        if (x > fromX && fromX + halfWidth <= segment.left + WALL_STEP && x + halfWidth > segment.left) {
          x = segment.left - halfWidth;
        } else if (x < fromX && fromX - halfWidth >= segment.right - WALL_STEP && x - halfWidth < segment.right) {
          x = segment.right + halfWidth;
        }
      }
      return x;
    }

    /** Height of the ground at x (the grass line over a pit). */
    groundTopAt(x) {
      const segment = this.groundAt(x);
      return segment ? segment.top : GROUND_Y;
    }

    /**
     * The highest surface under something at (x, fromY) whose feet span x ± halfWidth.
     * @returns {{top:number, isGround:boolean, left:number, right:number}|null} null over a pit
     */
    surfaceBelow(x, fromY, halfWidth = 0) {
      let best = null;
      for (const surface of this.surfaces) {
        if (surface.isGone) continue;
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
        const isRoomyLedge = !surface.isGround && !surface.move && !surface.isBouncy && !surface.isCrumbly
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

    /** The ground segment containing x, if any (the taller one where two meet). */
    groundAt(x) {
      let best = null;
      for (const segment of this.ground) {
        if (x >= segment.left && x <= segment.right && (!best || segment.top > best.top)) best = segment;
      }
      return best;
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
