/**
 * Ground tiles, platforms and decorations for the later worlds: desert, ice, volcano, candy and moon.
 * Each function returns a fresh canvas at 1 canvas pixel = 1 game pixel (platform painters return
 * { canvas, surfaceRow } like the ones in levelSprites.js).
 */
(function (Forest) {
  const { createPixelCanvas, asciiToCanvas } = Forest.PixelCanvas;

  const TILE_SIZE = 32;

  function canvasWithPlot(width, height) {
    const { canvas, ctx } = createPixelCanvas(width, height);
    const plot = (x, y, color) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return;
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    };
    return { canvas, ctx, plot };
  }

  /** Repeatable pseudo-noise in [0, 1) for a pixel. */
  function noise(x, y) {
    const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  // ==========================================
  // Ground tiles (32x32, tile seamlessly left to right)
  // ==========================================
  /** Fill colour under each world's ground, plus the cliff edge and pit colours. */
  const WORLD_STYLES = {
    desert: { fill: '#b9773d', edge: '#7d4a22', pit: '#2a1608' },
    ice: { fill: '#5b81a3', edge: '#2d4d6e', pit: '#050c1c' },
    volcano: { fill: '#1a0f0e', edge: '#0a0505', pit: 'lava' },
    candy: { fill: '#5a2e1b', edge: '#3a1b0f', pit: '#2a120a' },
    moon: { fill: '#34343e', edge: '#1c1c22', pit: '#000000' }
  };

  function createSandTile() {
    const { canvas, plot } = canvasWithPlot(TILE_SIZE, TILE_SIZE);
    for (let x = 0; x < TILE_SIZE; x++) {
      for (let y = 0; y < TILE_SIZE; y++) {
        let color = '#d9a35c';
        if (y < 2) color = '#f6d89a';
        else if (y < 5) color = '#ecc07a';
        else if ((y + Math.round(Math.sin(x * 0.4) * 1.5)) % 7 === 0) color = '#c38c48'; // wind ripples
        else if (y > 18) color = noise(x, y) < 0.3 ? '#b9773d' : '#c7864a';
        if (noise(x, y) > 0.97) color = '#fff1c8'; // glinting grains
        plot(x, y, color);
      }
    }
    return canvas;
  }

  function createSnowTile() {
    const { canvas, plot } = canvasWithPlot(TILE_SIZE, TILE_SIZE);
    for (let x = 0; x < TILE_SIZE; x++) {
      const snowDepth = 6 + Math.round(Math.sin(x * 0.5) * 1.5 + Math.sin(x * 1.3));
      for (let y = 0; y < TILE_SIZE; y++) {
        let color;
        if (y < snowDepth) color = y === 0 ? '#ffffff' : (y < snowDepth - 1 ? '#eef6ff' : '#c6dcf2');
        else {
          // Ice blocks with bright cracks
          const isJoint = (y - snowDepth) % 10 === 9 || (x + (Math.floor((y - snowDepth) / 10) % 2) * 8) % 16 === 0;
          color = isJoint ? '#3f6a92' : (noise(x, y) < 0.25 ? '#7fb2dd' : '#93c3ea');
          if (!isJoint && (x - y) % 11 === 0) color = '#d9f0ff';
        }
        plot(x, y, color);
      }
    }
    return canvas;
  }

  function createBasaltTile() {
    const { canvas, plot } = canvasWithPlot(TILE_SIZE, TILE_SIZE);
    for (let x = 0; x < TILE_SIZE; x++) {
      for (let y = 0; y < TILE_SIZE; y++) {
        let color = noise(x, y) < 0.35 ? '#1f1312' : '#2a1916';
        if (y === 0) color = '#4a2a22';
        else if (y < 3) color = '#3a201b';
        // Glowing cracks
        const crack = Math.round(10 + Math.sin(x * 0.45) * 4);
        if (y === crack || (x === 20 && y > crack && y < crack + 9) || (x === 7 && y > 3 && y < crack)) color = y % 3 ? '#ff6a1f' : '#ffb347';
        plot(x, y, color);
      }
    }
    return canvas;
  }

  function createFrostingTile() {
    const { canvas, plot } = canvasWithPlot(TILE_SIZE, TILE_SIZE);
    for (let x = 0; x < TILE_SIZE; x++) {
      // Frosting drips hang down to different depths
      const drip = 5 + (x % 8 < 3 ? 3 + (x % 8) : 0) + (x % 16 < 2 ? 3 : 0);
      for (let y = 0; y < TILE_SIZE; y++) {
        let color;
        if (y < drip) color = y === 0 ? '#ffe3f1' : (y < drip - 1 ? '#ff9ccc' : '#e57ab0');
        else if (y > 16 && y < 20) color = '#fff4e0'; // cream filling
        else color = noise(x, y) < 0.3 ? '#4d2616' : '#6b3a22';
        // Sprinkles on the frosting
        if (y > 0 && y < 4 && noise(x, y) > 0.86) color = ['#7fd6ff', '#ffe066', '#9af08f', '#ffffff'][Math.floor(noise(y, x) * 4)];
        plot(x, y, color);
      }
    }
    return canvas;
  }

  function createRegolithTile() {
    const { canvas, plot } = canvasWithPlot(TILE_SIZE, TILE_SIZE);
    for (let x = 0; x < TILE_SIZE; x++) {
      for (let y = 0; y < TILE_SIZE; y++) {
        let color = noise(x, y) < 0.4 ? '#5c5c68' : '#6a6a76';
        if (y === 0) color = '#a8a8b4';
        else if (y < 3) color = '#8a8a96';
        else if (y > 16) color = noise(x, y) < 0.4 ? '#45454f' : '#50505a';
        plot(x, y, color);
      }
    }
    // Two little craters
    [[8, 6, 3], [23, 11, 2]].forEach(([cx, cy, r]) => {
      for (let dx = -r; dx <= r; dx++) {
        plot(cx + dx, cy, '#3e3e48');
        plot(cx + dx, cy + 1, '#9a9aa6');
      }
    });
    return canvas;
  }

  // ==========================================
  // Floating platforms (any width, in pixels)
  // ==========================================
  /** Common shape: a slab of `height` rows, coloured per row/column by `colorAt`. */
  function paintSlab(widthPixels, height, colorAt) {
    const { canvas, plot } = canvasWithPlot(widthPixels, height);
    for (let x = 0; x < widthPixels; x++) {
      for (let y = 0; y < height; y++) {
        const color = colorAt(x, y, widthPixels, height);
        if (color) plot(x, y, color);
      }
    }
    return canvas;
  }

  function createSandstoneBlock(widthPixels) {
    const canvas = paintSlab(widthPixels, 12, (x, y, w, h) => {
      if (y === 0) return '#f6d89a';
      if (y === h - 1 || x === 0 || x === w - 1) return '#8f5a2e';
      if (x % 16 === 0 || y === 6) return '#a86c38'; // carved block lines
      return noise(x, y) < 0.25 ? '#d29a58' : '#e2ae6a';
    });
    return { canvas, surfaceRow: 0 };
  }

  function createIceSlab(widthPixels) {
    const canvas = paintSlab(widthPixels, 10, (x, y, w, h) => {
      const fromEdge = Math.min(x, w - 1 - x);
      if (y > h - 3 && fromEdge < 2) return null;
      if (y === 0) return '#ffffff';
      if (y === 1) return '#dff2ff';
      if (y === h - 1) return '#4a7aa6';
      if ((x + y * 2) % 13 === 0) return '#f2fbff'; // sparkle streaks
      return '#9fd0f2';
    });
    // Icicles hanging below
    const ctx = canvas.getContext('2d');
    for (let x = 3; x < widthPixels - 3; x += 7) {
      ctx.fillStyle = '#cfeaff';
      ctx.fillRect(x, 9, 1, 1);
    }
    return { canvas, surfaceRow: 0 };
  }

  function createObsidianSlab(widthPixels) {
    const canvas = paintSlab(widthPixels, 11, (x, y, w, h) => {
      if (y === 0) return '#5a3028';
      if (y === h - 1 || x === 0 || x === w - 1) return '#0d0606';
      if (y === 5 + Math.round(Math.sin(x * 0.6) * 2)) return '#ff6a1f'; // molten seam
      return noise(x, y) < 0.3 ? '#1c100e' : '#2a1714';
    });
    return { canvas, surfaceRow: 0 };
  }

  function createWafer(widthPixels) {
    const canvas = paintSlab(widthPixels, 12, (x, y, w, h) => {
      if (y < 3) return y === 0 ? '#fff4fa' : '#ffd0e6'; // icing
      if (y === h - 1 || x === 0 || x === w - 1) return '#a8652d';
      if (x % 5 === 0 || y % 4 === 3) return '#c98a44'; // wafer grid
      return '#e8b468';
    });
    return { canvas, surfaceRow: 0 };
  }

  /** Squishy marshmallow pad that bounces the boy high into the air. */
  function createMarshmallowPad(widthPixels) {
    const canvas = paintSlab(widthPixels, 12, (x, y, w, h) => {
      const fromEdge = Math.min(x, w - 1 - x);
      if (fromEdge < 2 && (y < 2 || y > h - 3)) return null;
      if (y === 0) return '#ffffff';
      if (y < 4) return '#fff0f6';
      if (y > h - 3) return '#e8b3cf';
      return Math.floor((x + y) / 4) % 2 === 0 ? '#ffd1e6' : '#ffe6f1'; // swirl stripes
    });
    return { canvas, surfaceRow: 0 };
  }

  function createMetalPanel(widthPixels) {
    const canvas = paintSlab(widthPixels, 10, (x, y, w, h) => {
      if (y === 0) return '#d6dbe4';
      if (y === h - 1) return '#3a404c';
      if (y >= 6 && y <= 7) return Math.floor(x / 4) % 2 === 0 ? '#ffd23f' : '#2a2a2a'; // hazard stripe
      if ((x % 12 === 2 || x % 12 === 9) && y === 3) return '#5e6573'; // rivets
      return '#9aa3b2';
    });
    return { canvas, surfaceRow: 0 };
  }

  // ==========================================
  // Decorations
  // ==========================================
  function createCactus() {
    return asciiToCanvas([
      '......gG......',
      '.....gGGd.....',
      '.....gGGd.....',
      '.....gGGd..gd.',
      '.gd..gGGd..Gd.',
      '.Gd..gGGd..Gd.',
      '.Gd..gGGd.gGd.',
      '.GGddgGGdgGd..',
      '..GGGgGGGGd...',
      '.....gGGd.....',
      '.....gGGd.....',
      '.....gGGd.....',
      '.....gGGd.....',
      '.....gGGd.....',
      '....ssssss....'
    ], 1, { g: '#6fb04f', G: '#4f8f3c', d: '#2f5e2a', s: '#c38c48' });
  }

  function createIceCrystal() {
    return asciiToCanvas([
      '.....W.....',
      '....WbW....',
      '....bBb..W.',
      '.W..bBb.WbW',
      'WbW.bBb.bBb',
      'bBb.bBb.bBb',
      'bBbbbBbbbBb',
      '.bBbBBBbBb.',
      '..sssssss..'
    ], 1, { W: '#ffffff', b: '#a8e4ff', B: '#5fb8ec', s: '#c6dcf2' });
  }

  function createCharredTree() {
    return asciiToCanvas([
      'k.........k.',
      '.k...k...k..',
      '..k..k..k...',
      '...k.k.k..k.',
      '....kkk..k..',
      '.....kkkk...',
      '.....kk.....',
      '.....kk.....',
      '.....kko....',
      '.....kk.....',
      '....okk.....',
      '.....kk.....',
      '....kkkk....'
    ], 1, { k: '#1a0e0c', o: '#ff6a1f' });
  }

  function createLollipop() {
    return asciiToCanvas([
      '..pppp..',
      '.pWWppp.',
      'pWppWWpp',
      'pWpWppWp',
      'ppWppWpp',
      '.ppWWpp.',
      '..pppp..',
      '...ws...',
      '...ws...',
      '...ws...',
      '...ws...',
      '...ws...'
    ], 1, { p: '#ff5fa2', W: '#fff2f8', w: '#fffaf5', s: '#e6d8cc' });
  }

  function createCandyCane() {
    return asciiToCanvas([
      '.rWWr.',
      'W....r',
      'r....W',
      '.....r',
      '.....W',
      '.....r',
      '.....W',
      '.....r',
      '.....W',
      '.....r'
    ], 1, { r: '#e8283c', W: '#ffffff' });
  }

  function createBeacon() {
    return asciiToCanvas([
      '...R...',
      '..RrR..',
      '...m...',
      '...m...',
      '.mmmmm.',
      '...m...',
      '...m...',
      '...m...',
      '..mMm..',
      '.mMMMm.'
    ], 1, { R: '#ff4d4d', r: '#ffd0d0', m: '#9aa3b2', M: '#5e6573' });
  }

  function createMoonRock() {
    return asciiToCanvas([
      '...LLLL...',
      '.LLlllldd.',
      'Llllllddd.',
      'llllldddd.',
      '.dddddddd.'
    ], 1, { L: '#9a9aa6', l: '#76767f', d: '#4a4a54' });
  }

  Forest.WorldSprites = {
    WORLD_STYLES,
    tiles: {
      desert: createSandTile,
      ice: createSnowTile,
      volcano: createBasaltTile,
      candy: createFrostingTile,
      moon: createRegolithTile
    },
    platforms: {
      desert: createSandstoneBlock,
      ice: createIceSlab,
      volcano: createObsidianSlab,
      candy: createWafer,
      moon: createMetalPanel
    },
    createMarshmallowPad,
    decorations: {
      desert: [createCactus],
      ice: [createIceCrystal],
      volcano: [createCharredTree],
      candy: [createLollipop, createCandyCane],
      moon: [createBeacon, createMoonRock]
    }
  };
})(window.Forest);
