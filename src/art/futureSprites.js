/**
 * Ground tiles, platforms, bounce pads and decorations for the eight future-meets-fantasy worlds.
 * Same conventions as worldSprites.js (1 canvas pixel = 1 game pixel; tiles are 32x32 and tile
 * left to right; platform painters return { canvas, surfaceRow }). Everything is merged into
 * Forest.WorldSprites, so the level scenery picks the new worlds up like any other.
 */
(function (Forest) {
  const { createPixelCanvas, asciiToCanvas } = Forest.PixelCanvas;
  const WorldArt = Forest.WorldSprites;

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

  /** A 32x32 tile coloured pixel by pixel. */
  function paintTile(colorAt) {
    const { canvas, plot } = canvasWithPlot(TILE_SIZE, TILE_SIZE);
    for (let x = 0; x < TILE_SIZE; x++) {
      for (let y = 0; y < TILE_SIZE; y++) plot(x, y, colorAt(x, y));
    }
    return canvas;
  }

  /** A slab `height` rows tall; colorAt may return null for a see-through pixel. */
  function paintSlab(widthPixels, height, colorAt) {
    const { canvas, plot } = canvasWithPlot(widthPixels, height);
    for (let x = 0; x < widthPixels; x++) {
      for (let y = 0; y < height; y++) {
        const color = colorAt(x, y, widthPixels, height);
        if (color) plot(x, y, color);
      }
    }
    return { canvas, surfaceRow: 0 };
  }

  // ==========================================
  // Ground tiles
  // ==========================================
  /** Fill colour under each world's ground, plus the cliff edge and pit colours. */
  const STYLES = {
    neon: { fill: '#120a22', edge: '#ff4fd8', pit: '#05010c' },
    crystal: { fill: '#0b1c22', edge: '#2fd8b8', pit: '#010507' },
    clockwork: { fill: '#3a2414', edge: '#1f130a', pit: '#120a06' },
    atlantis: { fill: '#0d3a44', edge: '#06202a', pit: '#010812' },
    fae: { fill: '#1c0f2e', edge: '#100819', pit: '#06020c' },
    mechKeep: { fill: '#22252e', edge: '#101216', pit: 'lava' },
    rift: { fill: '#1a0f28', edge: '#00f0ff', pit: '#000000' },
    station: { fill: '#2a2f38', edge: '#151920', pit: '#000000' }
  };

  const tiles = {
    /** Dark street with a neon strip along the kerb and cyan circuit traces. */
    neon: () => paintTile((x, y) => {
      if (y === 0) return '#ffd6f6';
      if (y < 3) return '#ff4fd8';
      if (y === 3) return '#8a1a7a';
      const isTrace = (y === 12 && x > 4 && x < 20) || (x === 20 && y >= 12 && y < 22) || (y === 22 && x >= 20) || (x === 6 && y > 16);
      if (isTrace) return '#4ff0ff';
      if ((x === 6 && y === 16) || (x === 4 && y === 12)) return '#ffffff';
      return noise(x, y) < 0.3 ? '#1b1030' : '#22143a';
    }),
    /** Cave rock with glowing mint crystal along the top and green circuit veins. */
    crystal: () => paintTile((x, y) => {
      const crust = 3 + (x % 7 === 2 ? 2 : 0) + (x % 11 === 5 ? 1 : 0);
      if (y < crust) return y === 0 ? '#e0fff6' : (x % 7 === 2 ? '#7fffd4' : '#3fc8a8');
      if (y === crust) return '#16575a';
      const vein = Math.round(14 + Math.sin(x * 0.4) * 4);
      if (y === vein || (x % 16 === 9 && y > vein && y < vein + 8)) return y % 4 ? '#2fd8b8' : '#b4ffef';
      return noise(x, y) < 0.35 ? '#0e2a33' : '#143640';
    }),
    /** Brass deck plates with rivets and seams. */
    clockwork: () => paintTile((x, y) => {
      if (y === 0) return '#ffe8a8';
      if (y < 3) return '#f2c96b';
      if (y === 10 || x % 16 === 0) return '#7a4f1d';
      if ((y === 5 || y === 15) && x % 8 === 4) return '#fff3c4'; // rivets
      if (y > 18 && (x + y) % 9 === 0) return '#a8733a';
      return y < 10 ? '#c8913a' : (noise(x, y) < 0.3 ? '#8a5a28' : '#9a6a30');
    }),
    /** Sandy sea floor over teal metal with glowing portholes. */
    atlantis: () => paintTile((x, y) => {
      if (y === 0) return '#fff1c8';
      if (y < 4) return noise(x, y) < 0.3 ? '#d9c08a' : '#e8d4a0';
      if (y === 4) return '#2a8fa8';
      const dx = (x % 16) - 8;
      const dy = y - 15;
      const r = Math.hypot(dx, dy);
      if (r < 3) return r < 1.5 ? '#ffffff' : '#9ff7ff';
      if (r < 4.2) return '#1a5a6a';
      if (y === 26) return '#0a3040';
      return noise(x, y) < 0.3 ? '#1a5a6a' : '#226a7a';
    }),
    /** Dark moss with a glowing hem and faint hexagon lines of light. */
    fae: () => paintTile((x, y) => {
      if (y === 0) return '#f2e6ff';
      if (y < 3) return '#b48cff';
      if (y < 5) return (x + y) % 3 ? '#6a3fb0' : '#9af0ff';
      const hx = x % 12;
      const hy = (y + (Math.floor(x / 12) % 2) * 6) % 12;
      const isHexEdge = hy === 0 || (hy < 6 && (hx === 0 || hx === 11));
      if (isHexEdge && y > 6) return '#4a2f8a';
      if (noise(x, y) > 0.97) return '#6af0ff';
      return noise(x, y) < 0.35 ? '#1c0f2e' : '#26143e';
    }),
    /** Steel castle blocks with red-hot seams. */
    mechKeep: () => paintTile((x, y) => {
      if (y === 0) return '#c4ccdb';
      if (y < 3) return '#8a92a3';
      const row = Math.floor((y - 3) / 9);
      const offset = row % 2 ? 8 : 0;
      if ((y - 3) % 9 === 0 || (x + offset) % 16 === 0) return (x + y) % 5 === 0 ? '#ff3b3b' : '#1a1c22';
      return noise(x, y) < 0.3 ? '#3a3f4c' : '#4a4f5c';
    }),
    /** Floating void rock with violet crystal grass and glitching pixels. */
    rift: () => paintTile((x, y) => {
      const blades = 2 + (x % 5 === 1 ? 2 : 0);
      if (y < blades) return y === 0 ? '#f0d8ff' : '#c38cff';
      if (y === blades) return '#7a4fb0';
      if (y > 8 && noise(x, y) > 0.96) return noise(y, x) < 0.5 ? '#00f0ff' : '#ff6bd8';
      if (y > 20 && (x + y * 3) % 17 === 0) return '#0d0618';
      return noise(x, y) < 0.35 ? '#22143a' : '#2a1a3d';
    }),
    /** Polished deck plates with a blue light strip and warning stripes. */
    station: () => paintTile((x, y) => {
      if (y === 0) return '#ffffff';
      if (y < 3) return '#d8e0ee';
      if (y === 3) return '#4fc3ff';
      if (y === 4) return '#2a7ab0';
      if (y >= 12 && y <= 14) return Math.floor((x + y) / 4) % 2 === 0 ? '#ffd23f' : '#2a2a2a';
      if (x % 16 === 0 || y === 24) return '#5e6573';
      if (y === 8 && x % 16 === 3) return '#9aa3b2';
      return y < 12 ? '#b8c2d4' : '#7a8494';
    })
  };

  // ==========================================
  // Floating platforms
  // ==========================================
  const platforms = {
    /** Holographic panel: cyan glass edged in magenta, with scan lines. */
    neon: widthPixels => paintSlab(widthPixels, 9, (x, y, w, h) => {
      if (y === 0) return '#ffd6f6';
      if (y === 1 || x === 0 || x === w - 1) return '#ff4fd8';
      if (y === h - 1) return '#8a1a7a';
      return y % 2 ? '#2a7ab0' : '#4ff0ff';
    }),
    /** A slab of crystal, see-through at the bottom corners. */
    crystal: widthPixels => paintSlab(widthPixels, 10, (x, y, w, h) => {
      const fromEdge = Math.min(x, w - 1 - x);
      if (y > 5 && fromEdge < y - 5) return null;
      if (y === 0) return '#e0fff6';
      if (y === 1) return '#7fffd4';
      if ((x + y * 2) % 9 === 0) return '#b4ffef';
      return x % 6 < 3 ? '#2a8f8a' : '#3fb0a0';
    }),
    /** Brass girder with a row of rivets and an open lattice. */
    clockwork: widthPixels => paintSlab(widthPixels, 10, (x, y, w, h) => {
      if (y === 0) return '#ffe8a8';
      if (y < 3) return y === 2 && x % 6 === 3 ? '#fff3c4' : '#c8913a';
      if (y === h - 1) return '#7a4f1d';
      const lattice = (x + y) % 8 === 0 || (x - y + 64) % 8 === 0;
      return lattice || x === 0 || x === w - 1 ? '#9a6a30' : null;
    }),
    /** Glowing coral-tech slab. */
    atlantis: widthPixels => paintSlab(widthPixels, 10, (x, y, w, h) => {
      if (y === 0) return '#b4ffef';
      if (y === 1) return '#3fd8c8';
      if (y === h - 1 || x === 0 || x === w - 1) return '#0a3040';
      if (y === 5 && x % 6 === 3) return '#ffe58a';
      if (y > 6 && noise(x, y) < 0.25) return '#ff8a9a'; // coral growing underneath
      return '#1a6a7a';
    }),
    /** A giant leaf with a shimmering holo-hem. */
    fae: widthPixels => paintSlab(widthPixels, 8, (x, y, w, h) => {
      const fromEdge = Math.min(x, w - 1 - x);
      if (fromEdge < 3 - Math.min(3, y) || (y > h - 3 && fromEdge < 2)) return null;
      if (y === 0) return '#b4ffef';
      if (y === h - 1) return '#6af0ff';
      if (x === Math.floor(w / 2) || (y === 3 && x % 5 === 0)) return '#4fb05a'; // veins
      return '#2f8a4a';
    }),
    /** Steel battlement with a glowing red seam. */
    mechKeep: widthPixels => paintSlab(widthPixels, 11, (x, y, w, h) => {
      if (y === 0) return '#c4ccdb';
      if (y === 1) return '#8a92a3';
      if (y === 6) return x % 4 < 2 ? '#ff3b3b' : '#ffb347';
      if (y === h - 1 || x === 0 || x === w - 1) return '#1a1c22';
      return noise(x, y) < 0.3 ? '#3a3f4c' : '#4a4f5c';
    }),
    /** Floating shard of void rock, tapering underneath. */
    rift: widthPixels => paintSlab(widthPixels, 12, (x, y, w, h) => {
      const fromEdge = Math.min(x, w - 1 - x);
      if (y > 3 && fromEdge < (y - 3) * (w / 18)) return null;
      if (y === 0) return '#f0d8ff';
      if (y === 1) return '#c38cff';
      if (noise(x, y) > 0.94) return '#00f0ff';
      return y < 5 ? '#3a2454' : '#2a1a3d';
    }),
    /** Hover panel with thruster lights underneath. */
    station: widthPixels => paintSlab(widthPixels, 10, (x, y, w, h) => {
      if (y === 0) return '#ffffff';
      if (y === 1) return '#d8e0ee';
      if (y === h - 1) return x % 8 < 2 ? '#4fc3ff' : '#3a404c';
      if (y === 5) return '#4fc3ff';
      return '#9aa3b2';
    })
  };

  // ==========================================
  // Bounce pads (the theme's own stand-in for the candy marshmallow)
  // ==========================================
  const bouncePads = {
    /** A springy glowing mushroom cap. */
    fae: widthPixels => paintSlab(widthPixels, 12, (x, y, w, h) => {
      const fromEdge = Math.min(x, w - 1 - x);
      const stemHalf = Math.max(2, Math.floor(w / 6));
      if (y > 6) return Math.abs(x - w / 2) < stemHalf ? (y === h - 1 ? '#8a6ab8' : '#e8dcff') : null;
      if (fromEdge < 3 - y) return null;
      if (y === 0) return '#ffe6f8';
      if (y === 6) return '#c02c9a';
      return noise(x, y) > 0.8 ? '#ffffff' : '#ff5fc8';
    })
  };

  // ==========================================
  // Decorations
  // ==========================================
  const decorations = {
    neon: [
      // Neon street lamp
      () => asciiToCanvas([
        '.ccccc.',
        'cWWWWWc',
        '.ccccc.',
        '...m...',
        '...m...',
        '...m...',
        '...m...',
        '...m...',
        '...m...',
        '..mMm..',
        '.mMMMm.'
      ], 1, { c: '#ff4fd8', W: '#ffd6f6', m: '#3a1d5e', M: '#22143a' }),
      // Rune obelisk with a glowing glyph
      () => asciiToCanvas([
        '..oo..',
        '.oSSo.',
        '.SSSS.',
        '.SgSS.',
        '.SggS.',
        '.SSgS.',
        '.SgSS.',
        '.SSSS.',
        'SSSSSS'
      ], 1, { o: '#4ff0ff', S: '#2e1450', g: '#4ff0ff' })
    ],
    crystal: [
      () => asciiToCanvas([
        '....W......',
        '...WbW...W.',
        '...bBb..WbW',
        '.W.bBb..bBb',
        'WbWbBb.bBBb',
        'bBbbBbbbBb.',
        '.sssssssss.'
      ], 1, { W: '#e0fff6', b: '#7fffd4', B: '#2a8f8a', s: '#143640' }),
      // Data pylon with a blinking light
      () => asciiToCanvas([
        '..g..',
        '.ggg.',
        '..p..',
        '.ppp.',
        '.pLp.',
        '.ppp.',
        '.pLp.',
        'ppppp'
      ], 1, { g: '#b4ffef', p: '#16404a', L: '#2fd8b8' })
    ],
    clockwork: [
      // Steam pipe with a valve wheel
      () => asciiToCanvas([
        '.ww..',
        'w..w.',
        '.pp..',
        '.pp..',
        'vvvv.',
        '.pp..',
        '.pp..',
        '.pp..',
        'pppp.'
      ], 1, { w: '#e8e0d8', p: '#a8733a', v: '#ffd25e' }),
      // Little cog on a post
      () => asciiToCanvas([
        '.b.b.b.',
        'bbbbbbb',
        '.bb.bb.',
        'bb...bb',
        '.bb.bb.',
        'bbbbbbb',
        '.b.p.b.',
        '...p...',
        '...p...',
        '..ppp..'
      ], 1, { b: '#f2c96b', p: '#7a4f1d' })
    ],
    atlantis: [
      // Kelp
      () => asciiToCanvas([
        '.g....',
        '..G...',
        '.gG...',
        '..Gg..',
        '...G..',
        '..gG..',
        '..G..g',
        '.gG.G.',
        '..GG..',
        '..G...',
        '.sss..'
      ], 1, { g: '#3fb07a', G: '#1f7a5a', s: '#d9c08a' }),
      // Glowing orb lamp
      () => asciiToCanvas([
        '.ooo.',
        'oWWoo',
        'oWooo',
        '.ooo.',
        '..f..',
        '..f..',
        '..f..',
        '.fff.'
      ], 1, { o: '#9ff7ff', W: '#ffffff', f: '#2a8fa8' })
    ],
    fae: [
      // Glow mushroom
      () => asciiToCanvas([
        '..pppp..',
        '.pWppWp.',
        'pppppppp',
        '..ssss..',
        '...ss...',
        '...ss...',
        '..ssss..'
      ], 1, { p: '#ff5fc8', W: '#ffe6f8', s: '#e8dcff' }),
      // Fairy lantern on a stalk
      () => asciiToCanvas([
        '.yyy.',
        'yWWWy',
        'yWWWy',
        '.yyy.',
        '..g..',
        '..g..',
        '.gg..',
        '..g..',
        '..gg.',
        '..g..'
      ], 1, { y: '#b4ffef', W: '#ffffff', g: '#4fb05a' })
    ],
    mechKeep: [
      // Laser turret
      () => asciiToCanvas([
        '.......',
        'rr.....',
        '.GGGG..',
        'GGGGGG.',
        '.GddG..',
        '.GddG..',
        'GGGGGG.'
      ], 1, { r: '#ff3b3b', G: '#6a7282', d: '#3a3f4c' }),
      // Banner pole with a holo flag
      () => asciiToCanvas([
        'mrrrr',
        'mrRrr',
        'mrrrr',
        'mrr..',
        'm....',
        'm....',
        'm....',
        'm....',
        'mm...'
      ], 1, { m: '#8a92a3', r: '#c02c2c', R: '#ffb347' })
    ],
    rift: [
      // Floating rune stone (hovers above the ground)
      () => asciiToCanvas([
        '.sss.',
        'ssCss',
        'sCCCs',
        'ssCss',
        '.sss.',
        '.....',
        '..c..',
        '.....'
      ], 1, { s: '#3a2454', C: '#00f0ff', c: '#7a4fb0' }),
      // Glitch crystal
      () => asciiToCanvas([
        '..c..',
        '.cCc.',
        '.cCcp',
        'pcCc.',
        '.cCc.',
        '.ccc.'
      ], 1, { c: '#c38cff', C: '#f0d8ff', p: '#00f0ff' })
    ],
    station: [
      // Console with a blinking screen
      () => asciiToCanvas([
        'mmmmmm',
        'mbbbbm',
        'mbBbbm',
        'mmmmmm',
        '.m..m.',
        'mmmmmm'
      ], 1, { m: '#5e6573', b: '#2a7ab0', B: '#b4ffef' }),
      // Arcane rune engine core
      () => asciiToCanvas([
        '.mmm.',
        'mpPpm',
        'mPWPm',
        'mpPpm',
        '.mmm.',
        '..m..',
        '.mmm.'
      ], 1, { m: '#9aa3b2', p: '#7a2fd0', P: '#c86bff', W: '#ffffff' })
    ]
  };

  Object.assign(WorldArt.WORLD_STYLES, STYLES);
  Object.assign(WorldArt.tiles, tiles);
  Object.assign(WorldArt.platforms, platforms);
  Object.assign(WorldArt.decorations, decorations);
  WorldArt.bouncePads = { ...(WorldArt.bouncePads || {}), ...bouncePads };
})(window.Forest);
