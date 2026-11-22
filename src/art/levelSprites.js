/**
 * Pixel art for the side-scrolling levels: ground tiles for the dungeon and treetops (the forest
 * reuses its grass tile), floating platforms of any width, coins and small decorations.
 * Each function returns a fresh canvas at 1 canvas pixel = 1 game pixel.
 */
(function (Forest) {
  const { createPixelCanvas, asciiToCanvas } = Forest.PixelCanvas;

  const TILE_SIZE = 32;

  /** Canvas plus a bounds-checked `plot`. */
  function canvasWithPlot(width, height) {
    const { canvas, ctx } = createPixelCanvas(width, height);
    const plot = (x, y, color) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return;
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    };
    return { canvas, ctx, plot };
  }

  // ==========================================
  // Ground tiles (32x32, tile seamlessly left to right)
  // ==========================================
  const DUNGEON_COLORS = {
    edgeLight: '#7a6d86', edge: '#5a4f66', stone: '#433a4e', stoneDark: '#352d3e',
    mortar: '#1d1823', brick: '#2e2737', brickLight: '#3a3245', fill: '#1a1620'
  };

  /** Cut flagstones on top, rough bricks underneath. */
  function createDungeonFloorTile() {
    const { canvas, ctx, plot } = canvasWithPlot(TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = DUNGEON_COLORS.brick;
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Flagstones: two per tile, lit along the top
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        let color = (x * 7 + y * 3) % 11 < 3 ? DUNGEON_COLORS.stoneDark : DUNGEON_COLORS.stone;
        if (y === 0) color = DUNGEON_COLORS.edgeLight;
        else if (y === 1) color = DUNGEON_COLORS.edge;
        if (x % 16 === 0 && y > 0) color = DUNGEON_COLORS.mortar;
        if (y === 9) color = DUNGEON_COLORS.mortar;
        plot(x, y, color);
      }
    }
    // Bricks below
    for (let y = 10; y < TILE_SIZE; y++) {
      const row = Math.floor((y - 10) / 6);
      const offset = row % 2 ? 4 : 12;
      for (let x = 0; x < TILE_SIZE; x++) {
        const isMortar = (y - 10) % 6 === 5 || (x + offset) % 16 === 0;
        let color = isMortar ? DUNGEON_COLORS.mortar : DUNGEON_COLORS.brick;
        if (!isMortar && (y - 10) % 6 === 0) color = DUNGEON_COLORS.brickLight;
        if (!isMortar && y > 24 && (x + y) % 3 === 0) color = DUNGEON_COLORS.fill;
        plot(x, y, color);
      }
    }
    return canvas;
  }

  const BRANCH_COLORS = {
    mossLight: '#9ad65c', moss: '#6fb043', mossDark: '#4a8a32',
    barkLight: '#a7774e', bark: '#85583a', barkDark: '#64402a', barkShadow: '#3f2819', grain: '#734c31'
  };

  /** A thick mossy branch: leafy moss on top, grained bark, a shadowed round underside. */
  function createBranchTile() {
    const { canvas, plot } = canvasWithPlot(TILE_SIZE, TILE_SIZE);
    for (let x = 0; x < TILE_SIZE; x++) {
      // Wavy line of moss along the top
      const mossDepth = 4 + Math.round(Math.sin(x * 0.7) * 1.2 + Math.sin(x * 1.9) * 0.6);
      for (let y = 0; y < TILE_SIZE; y++) {
        let color;
        if (y < mossDepth) {
          color = y === 0 ? BRANCH_COLORS.mossLight : (y < mossDepth - 1 ? BRANCH_COLORS.moss : BRANCH_COLORS.mossDark);
          if (y === 0 && x % 5 === 2) color = BRANCH_COLORS.moss;
        } else if (y < 22) {
          color = y < mossDepth + 3 ? BRANCH_COLORS.barkLight : BRANCH_COLORS.bark;
          // Long grain lines
          if ((y * 5 + Math.floor(x / 9) * 3) % 7 === 0) color = BRANCH_COLORS.grain;
        } else if (y < 28) {
          color = BRANCH_COLORS.barkDark;
          if ((y + Math.floor(x / 7)) % 5 === 0) color = BRANCH_COLORS.grain;
        } else {
          color = BRANCH_COLORS.barkShadow;
        }
        plot(x, y, color);
      }
    }
    // A knot in the bark
    [[20, 13], [21, 13], [19, 14], [22, 14], [20, 15], [21, 15]].forEach(([x, y]) => plot(x, y, BRANCH_COLORS.barkShadow));
    plot(20, 14, BRANCH_COLORS.barkDark);
    plot(21, 14, BRANCH_COLORS.barkDark);
    return canvas;
  }

  // ==========================================
  // Floating platforms (any width, in pixels)
  // ==========================================
  /**
   * Each platform painter returns { canvas, surfaceRow }: surfaceRow is the canvas row that lines up
   * with the walkable top of the platform.
   */
  function createForestLedge(widthPixels) {
    const height = 16;
    const { canvas, plot } = canvasWithPlot(widthPixels, height);
    const COLORS = {
      grassTip: '#b7e34d', grass: '#5fb534', grassDark: '#3e8a28',
      dirtLight: '#8a5a33', dirt: '#6b4226', dirtDark: '#4a2c18', root: '#3a2212'
    };
    for (let x = 0; x < widthPixels; x++) {
      const fromEdge = Math.min(x, widthPixels - 1 - x);
      // The underside tapers in towards both ends
      const bottom = 12 - Math.max(0, 4 - fromEdge);
      for (let y = 2; y < bottom; y++) {
        let color;
        if (y < 4) color = COLORS.grass;
        else if (y < 6) color = COLORS.grassDark;
        else color = (x * 5 + y * 7) % 9 < 2 ? COLORS.dirtDark : (y < 8 ? COLORS.dirtLight : COLORS.dirt);
        if (y >= 6 && (fromEdge === 0 || y === bottom - 1)) color = COLORS.dirtDark;
        plot(x, y, color);
      }
      // Blades on top, roots dangling below
      if (x % 3 === 1) plot(x, 1, COLORS.grassTip);
      if (x % 4 === 0 && fromEdge > 2) plot(x, 2, COLORS.grassTip);
      if (x % 7 === 3 && fromEdge > 3) {
        for (let y = bottom; y < bottom + 2 + (x % 3); y++) plot(x, y, COLORS.root);
      }
    }
    return { canvas, surfaceRow: 2 };
  }

  function createStoneSlab(widthPixels) {
    const height = 11;
    const { canvas, plot } = canvasWithPlot(widthPixels, height);
    const C = DUNGEON_COLORS;
    for (let x = 0; x < widthPixels; x++) {
      const isEnd = x === 0 || x === widthPixels - 1;
      for (let y = 0; y < height; y++) {
        let color = C.stone;
        if (y === 0) color = C.edgeLight;
        else if (y === 1) color = C.edge;
        else if (y === height - 1) color = C.mortar;
        else if (y > 6) color = C.stoneDark;
        if ((x % 12 === 0 && y > 1) || isEnd) color = y === 0 ? C.edge : C.mortar;
        plot(x, y, color);
      }
    }
    // A few chipped notches along the bottom
    for (let x = 5; x < widthPixels - 3; x += 9) plot(x, height - 2, C.mortar);
    return { canvas, surfaceRow: 0 };
  }

  function createCloudPlatform(widthPixels) {
    const height = 16;
    const { canvas, plot } = canvasWithPlot(widthPixels, height);
    const COLORS = { top: '#ffffff', body: '#f2f7fd', shade: '#d7e5f5', under: '#b9cfe8' };
    const puffCount = Math.max(2, Math.round(widthPixels / 10));
    const puffs = Array.from({ length: puffCount }, (_, i) => ({
      x: (i + 0.5) * (widthPixels / puffCount),
      radius: Math.min(7, widthPixels / puffCount * 0.75) + (i % 2)
    }));
    for (let x = 0; x < widthPixels; x++) {
      let top = Infinity;
      puffs.forEach(puff => {
        const dx = x - puff.x;
        if (Math.abs(dx) < puff.radius) top = Math.min(top, 8 - Math.sqrt(puff.radius * puff.radius - dx * dx) * 0.7);
      });
      if (top === Infinity) top = 6;
      const bottom = 12 - (x < 2 || x > widthPixels - 3 ? 2 : 0);
      for (let y = Math.max(1, Math.floor(top)); y < bottom; y++) {
        let color = COLORS.body;
        if (y < top + 1.5) color = COLORS.top;
        else if (y > bottom - 2) color = COLORS.under;
        else if (y > bottom - 4) color = COLORS.shade;
        plot(x, y, color);
      }
    }
    return { canvas, surfaceRow: 4 };
  }

  // ==========================================
  // Coin (10x10)
  // ==========================================
  const COIN_ROWS = [
    '...KKKK...',
    '..KYYYYK..',
    '.KYyyyyoK.',
    'KYyYyyyyoK',
    'KYyYyyyyoK',
    'KYyYyyyyoK',
    'KYyyyyyyoK',
    '.KyyyyyoK.',
    '..KoooOK..',
    '...KKKK...'
  ];
  const COIN_PALETTE = { K: '#6b3d00', Y: '#fff4b0', y: '#ffcc2e', o: '#e0901a', O: '#b86a0a' };

  function createCoin() {
    return asciiToCanvas(COIN_ROWS, 1, COIN_PALETTE);
  }

  // ==========================================
  // Decorations
  // ==========================================
  /** Leafy clump that hides the cut end of a branch (32x32). */
  function createLeafClump() {
    const { canvas, plot } = canvasWithPlot(TILE_SIZE, TILE_SIZE);
    const COLORS = { dark: '#2f7a35', mid: '#46a144', light: '#74c45a', sun: '#a9e070' };
    const blobs = [[16, 18, 11], [9, 12, 8], [23, 11, 8], [16, 7, 7], [8, 22, 7], [24, 22, 7]];
    blobs.forEach(([centerX, centerY, radius]) => {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.hypot(dx, dy) > radius + Math.sin((centerX + dx) * 1.3 + dy) * 0.9) continue;
          const light = (dx * 0.4 - dy) / radius;
          let color = COLORS.mid;
          if (light > 0.75) color = COLORS.sun;
          else if (light > 0.3) color = COLORS.light;
          else if (light < -0.4) color = COLORS.dark;
          plot(centerX + dx, centerY + dy, color);
        }
      }
    });
    return canvas;
  }

  /** Iron brazier with a fire in it (14x18). */
  function createBrazier() {
    return asciiToCanvas([
      '....y..f......',
      '...fyf.ff.....',
      '..fyYyffyf....',
      '..fYWYyfyyf...',
      '.ffyYYyyYyf...',
      '.frryyyyyrrf..',
      'IIIIIIIIIIIIII',
      '.iIIIIIIIIIIi.',
      '..iIIIIIIIIi..',
      '....iIIIIi....',
      '......II......',
      '......II......',
      '......Ii......',
      '......Ii......',
      '.....IIii.....',
      '....IIIiii....',
      '...IIi..iII...',
      '..III....III..'
    ], 1, { I: '#3b3a44', i: '#24232b', f: '#ff5a1f', r: '#c2361a', y: '#ffb347', Y: '#ffe07a', W: '#fffbe0' });
  }

  /** Small pile of old bones (16x7). */
  function createBones() {
    return asciiToCanvas([
      '.....WWW........',
      '....WwWWW...w.w.',
      '....WWkWW..wWWWw',
      'w.w..WWW....w.w.',
      'WWWWWWWWWWw.....',
      'w.w.....wWw.....',
      '........w.w.....'
    ], 1, { W: '#e8e0cf', w: '#b3aa96', k: '#2a2430' });
  }

  Forest.LevelSprites = {
    TILE_SIZE,
    DUNGEON_FILL_COLOR: DUNGEON_COLORS.fill,
    createDungeonFloorTile,
    createBranchTile,
    createForestLedge,
    createStoneSlab,
    createCloudPlatform,
    createCoin,
    createLeafClump,
    createBrazier,
    createBones
  };
})(window.Forest);
