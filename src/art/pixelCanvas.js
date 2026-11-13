/**
 * 2D canvas helpers used to paint pixel art at load time (no Three.js here).
 */
(function (Forest) {
  const { PALETTE } = Forest;

  /** Create a canvas whose 2D context never blurs when scaled. */
  function createPixelCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { canvas, ctx };
  }

  /** Palette colour for a sprite character, or null when the character is transparent/unknown. */
  function paletteColor(key) {
    const color = PALETTE[key];
    return color && color !== 'transparent' ? color : null;
  }

  /**
   * Paint ASCII pixel art onto a canvas.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string[]} rows one string per pixel row; each character is a palette key
   * @param {number} [offsetX] left edge, in canvas pixels
   * @param {number} [offsetY] top edge, in canvas pixels
   * @param {number} [pixelSize] size of each art pixel, in canvas pixels
   */
  function drawAsciiArt(ctx, rows, offsetX = 0, offsetY = 0, pixelSize = 1) {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const color = paletteColor(row[x]);
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(offsetX + x * pixelSize, offsetY + y * pixelSize, pixelSize, pixelSize);
      }
    });
  }

  /** Render ASCII pixel art to a new canvas sized to the first row's width. */
  function asciiToCanvas(rows, pixelSize = 1) {
    const { canvas, ctx } = createPixelCanvas(rows[0].length * pixelSize, rows.length * pixelSize);
    drawAsciiArt(ctx, rows, 0, 0, pixelSize);
    return canvas;
  }

  /** Copy a canvas, enlarged by a whole-number factor with hard pixel edges. */
  function scaleCanvas(source, factor) {
    const { canvas, ctx } = createPixelCanvas(source.width * factor, source.height * factor);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  /** Solid white copy of every painted pixel, used for the "just got hit" flash frame. */
  function createWhiteSilhouette(source) {
    const { canvas, ctx } = createPixelCanvas(source.width, source.height);
    ctx.drawImage(source, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }

  Forest.PixelCanvas = {
    createPixelCanvas,
    paletteColor,
    drawAsciiArt,
    asciiToCanvas,
    scaleCanvas,
    createWhiteSilhouette
  };
})(window.Forest);
