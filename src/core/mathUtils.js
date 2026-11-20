/** Small, dependency-free math helpers. */
(function (Forest) {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function toRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  /** Uniform random number in the range [min, max). */
  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  /** Random sign: 1 or -1 with equal probability. */
  function randomDirection() {
    return Math.random() > 0.5 ? 1 : -1;
  }

  /** Cubic ease-out: starts fast and settles gently at t = 1. */
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  /** Quadratic ease-out: like easeOutCubic but softer. */
  function easeOutQuad(t) {
    return 1 - Math.pow(1 - t, 2);
  }

  /**
   * Deterministic pseudo-random generator (mulberry32).
   * The same seed always yields the same sequence, so procedural art looks identical on every load.
   * @param {number} seed
   * @returns {() => number} function returning numbers in [0, 1)
   */
  function createSeededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Touch test between the boy and a ground enemy, using boxes that hug their bodies.
   * Both have `x` (centre), `y` (feet), `width` and `height`. The boy is safe once his feet are above
   * `topRatio` of the enemy's height, so whether he can jump over it depends only on how tall it is.
   */
  function isBodyTouching(player, enemy, { enemyHalfWidthRatio, playerHalfWidthRatio, topRatio }) {
    const halfWidth = enemy.width * enemyHalfWidthRatio + player.width * playerHalfWidthRatio;
    const isOverlappingX = Math.abs(player.x - enemy.x) < halfWidth;
    const isOverlappingY = player.y < enemy.y + enemy.height * topRatio && player.y + player.height > enemy.y;
    return isOverlappingX && isOverlappingY;
  }

  Forest.MathUtils = {
    clamp,
    isBodyTouching,
    toRadians,
    randomBetween,
    randomDirection,
    easeOutCubic,
    easeOutQuad,
    createSeededRandom
  };
})(window.Forest);
