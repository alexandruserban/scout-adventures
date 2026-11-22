/**
 * World-wide constants shared by several modules.
 * Values that only matter to one entity (player speeds, mushroom AI ranges, ...)
 * live at the top of that entity's own file.
 */
(function (Forest) {
  Forest.Config = Object.freeze({
    /** World units per sprite pixel: 16 sprite pixels = 1 world unit. */
    PIXEL_SCALE: 1 / 16,

    /** Width of the retro internal resolution. The height follows the window's aspect ratio. */
    VIEW_WIDTH_PIXELS: 368,

    /** Height of the grass surface everything stands on. */
    GROUND_Y: 0,

    /** Horizontal limits of the playable forest. */
    LEVEL_START_X: -12,
    LEVEL_END_X: 48,

    /** Camera height when the player stands on the ground. */
    CAMERA_REST_Y: 2.6,

    /** Longest frame time we simulate in one step, so a lag spike can't tunnel through things. */
    MAX_FRAME_SECONDS: 0.05
  });
})(window.Forest);
