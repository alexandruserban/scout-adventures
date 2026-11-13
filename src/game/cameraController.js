/** Smoothly follows the player with a little look-ahead, stays inside the level, and handles screen shake. */
(function (Forest) {
  const { PIXEL_SCALE, LEVEL_START_X, LEVEL_END_X, CAMERA_REST_Y } = Forest.Config;
  const { clamp } = Forest.MathUtils;

  const LOOK_AHEAD = 1.3;
  /** Camera height above the player's feet while jumping. */
  const HEIGHT_ABOVE_PLAYER = 2.0;
  const FOLLOW_SPEED_X = 4.5;
  const FOLLOW_SPEED_Y = 4.0;
  /** How far the view may go past each end of the level. */
  const EDGE_OVERSCROLL = 2;
  /** Shake fades out over its last this-many seconds. */
  const SHAKE_FADE_SECONDS = 0.15;

  class CameraController {
    /**
     * @param {THREE.OrthographicCamera} camera
     * @param {number} viewWidthUnits visible width in world units
     */
    constructor(camera, viewWidthUnits) {
      this.camera = camera;
      this.minX = LEVEL_START_X + viewWidthUnits / 2 - EDGE_OVERSCROLL;
      this.maxX = LEVEL_END_X - viewWidthUnits / 2 + EDGE_OVERSCROLL;
      // Smoothed position before shake is added
      this.focusX = camera.position.x;
      this.focusY = camera.position.y;
      this.shakeSecondsLeft = 0;
      this.shakeMagnitude = 0;
    }

    /** Start shaking; a stronger or longer request overrides a weaker one already running. */
    shake(magnitude, seconds) {
      this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
      this.shakeSecondsLeft = Math.max(this.shakeSecondsLeft, seconds);
    }

    stopShake() {
      this.shakeSecondsLeft = 0;
      this.shakeMagnitude = 0;
    }

    /** @param {{x:number, y:number, facing:number}} target */
    update(target, deltaSeconds) {
      const targetX = target.x + target.facing * LOOK_AHEAD;
      const targetY = Math.max(CAMERA_REST_Y, target.y + HEIGHT_ABOVE_PLAYER);

      this.focusX += (targetX - this.focusX) * FOLLOW_SPEED_X * deltaSeconds;
      this.focusY += (targetY - this.focusY) * FOLLOW_SPEED_Y * deltaSeconds;
      this.focusX = clamp(this.focusX, this.minX, this.maxX);

      const shake = this.nextShakeOffset(deltaSeconds);
      this.camera.position.x = this.focusX + shake.x;
      this.camera.position.y = this.focusY + shake.y;
    }

    /** Random offset snapped to the pixel grid so sprites stay crisp while shaking. */
    nextShakeOffset(deltaSeconds) {
      if (this.shakeSecondsLeft <= 0) return { x: 0, y: 0 };

      this.shakeSecondsLeft -= deltaSeconds;
      const strength = this.shakeMagnitude * clamp(this.shakeSecondsLeft / SHAKE_FADE_SECONDS, 0, 1);
      const randomPixelOffset = () => Math.round(((Math.random() * 2 - 1) * strength) / PIXEL_SCALE) * PIXEL_SCALE;
      const offset = { x: randomPixelOffset(), y: randomPixelOffset() };

      if (this.shakeSecondsLeft <= 0) this.shakeMagnitude = 0;
      return offset;
    }
  }

  Forest.CameraController = CameraController;
})(window.Forest);
