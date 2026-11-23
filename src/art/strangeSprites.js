/**
 * Ground tiles, platforms, bounce pads and decorations for the six strange worlds: the silent film
 * (black and white), the alien mothership, the rainbow, the rising world (everything floats up),
 * the giant kitchen (you're tiny) and the octopus rock concert.
 *
 * Same conventions as worldSprites.js (1 canvas pixel = 1 game pixel; tiles are 32x32 and tile left
 * to right; platform painters return { canvas, surfaceRow }). Everything is merged into
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

  /** A 32x32 tile; colorAt may return null for a see-through pixel. */
  function paintTile(colorAt) {
    const { canvas, plot } = canvasWithPlot(TILE_SIZE, TILE_SIZE);
    for (let x = 0; x < TILE_SIZE; x++) {
      for (let y = 0; y < TILE_SIZE; y++) {
        const color = colorAt(x, y);
        if (color) plot(x, y, color);
      }
    }
    return canvas;
  }

  /** A slab `height` rows tall; colorAt may return null for a see-through pixel. */
  function paintSlab(widthPixels, height, colorAt, surfaceRow = 0) {
    const { canvas, plot } = canvasWithPlot(widthPixels, height);
    for (let x = 0; x < widthPixels; x++) {
      for (let y = 0; y < height; y++) {
        const color = colorAt(x, y, widthPixels, height);
        if (color) plot(x, y, color);
      }
    }
    return { canvas, surfaceRow };
  }

  /** A canvas painted pixel by pixel, for decorations easier to draw with maths than letters. */
  function paintProp(width, height, colorAt) {
    const { canvas, plot } = canvasWithPlot(width, height);
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const color = colorAt(x, y);
        if (color) plot(x, y, color);
      }
    }
    return canvas;
  }

  const RAINBOW = ['#ff4d4d', '#ff9a3c', '#ffe14d', '#5fe07a', '#4fb6ff', '#9a6bff'];

  // ==========================================
  // Ground: fill under each world's ground, cliff edge and pit (null fill = floating, no pit shaft)
  // ==========================================
  const STYLES = {
    noir: { fill: '#2b2b2b', edge: '#0d0d0d', pit: '#000000' },
    mothership: { fill: '#161d20', edge: '#070b0c', pit: 'goo' },
    rainbow: { fill: null, edge: null, pit: null },
    rising: { fill: null, edge: null, pit: null },
    kitchen: { fill: '#8a5a32', edge: '#4a2c14', pit: '#140c06' },
    concert: { fill: '#120c18', edge: '#000000', pit: '#05030a' }
  };

  const tiles = {
    /** An old cartoon's inked street: bold outline on top, cross-hatched kerb stones. */
    noir: () => paintTile((x, y) => {
      if (y === 0) return '#ffffff';
      if (y < 3) return '#111111';
      if (y < 9) return (x % 16 === 0) ? '#111111' : (noise(x, y) < 0.15 ? '#9a9a9a' : '#d8d8d8');
      if (y === 9) return '#111111';
      const hatch = (x + y) % 6 === 0 || (x - y + 64) % 9 === 0;
      return hatch ? '#555555' : '#7a7a7a';
    }),
    /** Hull deck grating with a strip of alien lights and dripping goo. */
    mothership: () => paintTile((x, y) => {
      if (y === 0) return '#b4ffd8';
      if (y < 3) return '#5a7a80';
      if (y === 3) return x % 8 < 2 ? '#7dff9a' : '#1a2426'; // running lights
      if (y < 12) {
        const isGrate = x % 4 === 0 || y % 4 === 0;
        return isGrate ? '#2a383c' : '#0c1214';
      }
      const drip = x % 11 === 3 && y < 12 + (x % 5) * 3;
      if (drip) return '#7dff5a';
      if (y === 12) return '#3a4a50';
      return noise(x, y) < 0.3 ? '#1a2426' : '#222e32';
    }),
    /** A stripe of rainbow lying on a puffy cloud bank (the cloud's underside is see-through). */
    rainbow: () => paintTile((x, y) => {
      if (y < 12) {
        if (y === 0) return '#ffffff';
        return RAINBOW[Math.min(RAINBOW.length - 1, Math.floor((y - 1) / 2))];
      }
      const puff = 22 + Math.round(Math.sin((x / TILE_SIZE) * Math.PI * 2 * 2) * 4 + Math.sin((x / TILE_SIZE) * Math.PI * 2 * 3) * 2);
      if (y > puff) return null;
      if (y === puff || y === puff - 1) return '#cfd8f0';
      return noise(x, y) < 0.12 ? '#eef2ff' : '#ffffff';
    }),
    /** Grass on a floating island, roots and pebbles dangling underneath. */
    rising: () => paintTile((x, y) => {
      const blades = 2 + (x % 4 === 1 ? 1 : 0);
      if (y < blades) return y === 0 ? '#d8ffb0' : '#7ed957';
      if (y < blades + 2) return '#4a9a3a';
      const bottom = 20 + Math.round(Math.sin((x / TILE_SIZE) * Math.PI * 2) * 3 + Math.sin((x / TILE_SIZE) * Math.PI * 4 + 1) * 2);
      if (y > bottom) {
        const root = (x % 7 === 2 && y < bottom + 9) || (x % 13 === 8 && y < bottom + 6);
        return root ? '#6a4a2a' : null;
      }
      if (y === bottom) return '#3a2616';
      return noise(x, y) < 0.25 ? '#6a4a30' : '#7a5838';
    }),
    /** A giant's countertop: speckled granite slab with a steel trim. */
    kitchen: () => paintTile((x, y) => {
      if (y === 0) return '#ffffff';
      if (y < 6) {
        const speck = noise(x, y);
        if (speck < 0.08) return '#3a3a44';
        if (speck > 0.94) return '#ffffff';
        return speck < 0.4 ? '#c8c4cc' : '#dcd8de';
      }
      if (y < 9) return y === 6 ? '#f0f4f8' : '#9aa3b2'; // steel trim
      if (y === 9) return '#4a2c14';
      // Cupboard door wood grain
      const grain = Math.sin(y * 0.9 + Math.sin(x * 0.3) * 2) > 0.7;
      if (x % 32 === 0) return '#4a2c14';
      return grain ? '#7a4c26' : '#9a6436';
    }),
    /** Stage floorboards, a strip of glowing footlights along the front. */
    concert: () => paintTile((x, y) => {
      if (y === 0) return '#f4e6ff';
      if (y < 4) return (x % 16 < 13) ? '#3a2e48' : '#241c30';
      if (y === 4) return '#120c18';
      if (y >= 6 && y <= 8) {
        const lamp = x % 16;
        if (lamp >= 6 && lamp <= 10) return lamp === 8 ? '#ffffff' : (x % 32 < 16 ? '#ff4fd8' : '#4fe8ff');
        return '#1a1424';
      }
      if (y === 9) return '#000000';
      // Black stage skirt with folds
      return x % 6 === 0 ? '#0a060e' : '#18101f';
    })
  };

  // ==========================================
  // Floating platforms
  // ==========================================
  const platforms = {
    /** A plank with a bold ink outline. */
    noir: widthPixels => paintSlab(widthPixels, 8, (x, y, w, h) => {
      if (y === 0 || y === h - 1 || x === 0 || x === w - 1) return '#111111';
      if (y === 1) return '#ffffff';
      if (x % 12 === 0) return '#111111';
      return y > h - 3 ? '#8a8a8a' : '#c8c8c8';
    }),
    /** Hovering alien hull plate with an underglow. */
    mothership: widthPixels => paintSlab(widthPixels, 10, (x, y, w, h) => {
      const fromEdge = Math.min(x, w - 1 - x);
      if (y > 6 && fromEdge < y - 6) return null;
      if (y === 0) return '#b4ffd8';
      if (y < 3) return '#5a7a80';
      if (y === h - 1) return x % 4 < 2 ? '#7dff9a' : '#2a383c';
      return x % 6 === 0 ? '#2a383c' : '#3a4a50';
    }),
    /** A short rainbow arc lying flat, with a cloud puff at each end. */
    rainbow: widthPixels => paintSlab(widthPixels, 10, (x, y, w, h) => {
      const fromEdge = Math.min(x, w - 1 - x);
      if (fromEdge < 5) {
        const dx = fromEdge - 4;
        if (Math.hypot(dx * 0.9, y - 5) < 5) return y > 7 ? '#cfd8f0' : '#ffffff';
        return null;
      }
      if (y === 0) return '#ffffff';
      if (y > 7) return null;
      return RAINBOW[Math.min(RAINBOW.length - 1, y - 1)];
    }),
    /** A chunk of floating rock with a tuft of grass. */
    rising: widthPixels => paintSlab(widthPixels, 14, (x, y, w, h) => {
      const fromEdge = Math.min(x, w - 1 - x);
      const depth = 3 + Math.round(Math.min(fromEdge * 0.9, 10) + Math.sin(x * 0.7) * 1.5);
      if (y > depth) return null;
      if (y === 0) return '#d8ffb0';
      if (y < 3) return '#7ed957';
      return noise(x, y) < 0.3 ? '#6a4a30' : '#8a6644';
    }),
    /** A chocolate chip cookie. */
    kitchen: widthPixels => paintSlab(widthPixels, 9, (x, y, w, h) => {
      const fromEdge = Math.min(x, w - 1 - x);
      if (fromEdge === 0 && (y === 0 || y === h - 1)) return null;
      if (y === 0) return '#f4c27a';
      if (y === h - 1) return '#7a4a1e';
      const chip = noise(Math.floor(x / 2), Math.floor(y / 2)) > 0.82;
      if (chip) return '#3a1f0e';
      return y < 3 ? '#e0a456' : '#c8863a';
    }),
    /** A road case (flight case) with steel corners. */
    concert: widthPixels => paintSlab(widthPixels, 10, (x, y, w, h) => {
      const fromEdge = Math.min(x, w - 1 - x);
      if (y === 0) return '#c8ccd8';
      if (fromEdge < 3 && (y < 3 || y > h - 4)) return '#9aa3b2';
      if (y === h - 1 || fromEdge === 0) return '#000000';
      if (y === Math.floor(h / 2)) return '#9aa3b2';
      return '#22202a';
    })
  };

  // ==========================================
  // Bounce pads
  // ==========================================
  const bouncePads = {
    /** A springy cloud puff. */
    rainbow: widthPixels => paintSlab(widthPixels, 11, (x, y, w, h) => {
      const t = x / (w - 1);
      const top = 4 - Math.round(Math.sin(t * Math.PI) * 4 + Math.sin(t * Math.PI * 3) * 1);
      if (y < top) return null;
      if (y === top) return '#ffffff';
      if (y > h - 3) return '#cfd8f0';
      return noise(x, y) < 0.15 ? '#ffe6fa' : '#f6f8ff';
    }),
    /** A wobbly cube of strawberry jelly. */
    kitchen: widthPixels => paintSlab(widthPixels, 12, (x, y, w, h) => {
      const fromEdge = Math.min(x, w - 1 - x);
      if (fromEdge === 0 && y < 2) return null;
      if (y === 0) return '#ffc0d0';
      if (fromEdge < 2 && y > 1 && y < 5) return '#ffffff';
      if (y === h - 1) return '#8a1030';
      return y < 4 ? '#ff5a7a' : '#e0284a';
    }),
    /** A loudspeaker cabinet, cone facing up. */
    concert: widthPixels => paintSlab(widthPixels, 12, (x, y, w, h) => {
      const cx = w / 2;
      const r = Math.hypot((x - cx) / (w / 2), 0);
      if (y === 0) return '#3a3a44';
      if (y < 4) return r < 0.25 ? '#9aa3b2' : (r < 0.8 ? '#1a1a20' : '#3a3a44');
      if (y === 4) return '#5a5a66';
      return x % 3 === 0 ? '#1a1a20' : '#2a2a32';
    })
  };

  // ==========================================
  // Decorations
  // ==========================================
  const NOIR = { K: '#111111', W: '#ffffff', g: '#8a8a8a', G: '#c8c8c8', d: '#3a3a3a' };

  const decorations = {
    noir: [
      // Old street lamp
      () => asciiToCanvas([
        '..KKKKK..',
        '.KWWWWWK.',
        '.KWWWWWK.',
        '..KGGGK..',
        '...KdK...',
        '...KdK...',
        '...KdK...',
        '...KdK...',
        '...KdK...',
        '...KdK...',
        '...KdK...',
        '...KdK...',
        '..KdddK..',
        '.KKKKKKK.'
      ], 1, NOIR),
      // A cartoon flower with a face, grinning
      () => asciiToCanvas([
        '..KK.KK..',
        '.KWWKWWK.',
        'KWWKKKWWK',
        '.KKGGGKK.',
        'KWKGKGKWK',
        'KWKGGGKWK',
        '.KKKGKKK.',
        '....K....',
        '..K.K.K..',
        '...KKK...',
        '....K....',
        '....K....'
      ], 1, NOIR),
      // Fire hydrant
      () => asciiToCanvas([
        '..KKK..',
        '.KGGGK.',
        'KKKKKKK',
        '.KWGgK.',
        'KKWGgKK',
        'KGWGggK',
        'KKWGgKK',
        '.KWGgK.',
        'KKKKKKK'
      ], 1, NOIR)
    ],
    mothership: [
      // Glowing alien egg, cracked open a little
      () => paintProp(10, 13, (x, y) => {
        const d = Math.hypot((x - 4.5) / 4.5, (y - 7) / 6);
        if (d > 1) return null;
        if (d > 0.85) return '#0a1a10';
        if (y < 3 && (x === 4 || x === 5)) return '#d4ff5a';
        return y < 6 ? '#8adf6a' : (noise(x, y) < 0.3 ? '#3f8a2a' : '#5fae38');
      }),
      // Specimen tube with something floating inside
      () => asciiToCanvas([
        '.KKKKKKK.',
        'KsssssssK',
        '.KgggggK.',
        '.KgggGgK.',
        '.KggEEgK.',
        '.KgGEEgK.',
        '.KgggggK.',
        '.KgmgmgK.',
        '.KgggGgK.',
        '.KgggggK.',
        'KsssssssK',
        'KsLsLsLsK',
        'KKKKKKKKK'
      ], 1, { K: '#06120a', s: '#3a4a50', g: '#2a6a4a', G: '#7dff9a', E: '#ff3b6b', m: '#8adf6a', L: '#7dff9a' }),
      // Control console with screens
      () => asciiToCanvas([
        'KKKKKKKKKKK',
        'KccKllKccrK',
        'KccKllKccKK',
        'KKKKKKKKKKK',
        '.KsgsrsgsK.',
        '.KsssssssK.',
        '.KsssssssK.',
        'KKKKKKKKKKK'
      ], 1, { K: '#0a0f10', c: '#4ff0ff', l: '#7dff9a', r: '#ff3b6b', s: '#3a4a50', g: '#d4ff5a' })
    ],
    rainbow: [
      // Pot of gold
      () => asciiToCanvas([
        '..y.Y.y..',
        '.YyYyYyY.',
        'KKKKKKKKK',
        '.KpppppK.',
        'KpppppppK',
        'KpppppppK',
        '.KpppppK.',
        '..KKKKK..'
      ], 1, { y: '#ffe14d', Y: '#fff7b3', K: '#14141a', p: '#2a2a36' }),
      // Star flower
      () => asciiToCanvas([
        '...y...',
        '..yYy..',
        'yyYWYyy',
        '.yYYYy.',
        '.yy.yy.',
        '...g...',
        '..gg...',
        '...g...',
        '...gg..',
        '...g...'
      ], 1, { y: '#ffe14d', Y: '#ffd23f', W: '#ffffff', g: '#5fe07a' }),
      // A spider web strung between two twigs
      () => paintProp(16, 16, (x, y) => {
        if (x === 0 || x === 15) return y > 1 ? '#8a6a4a' : null;
        const dx = x - 7.5;
        const dy = y - 6.5;
        const r = Math.hypot(dx, dy);
        if (r > 7) return null;
        const angle = Math.atan2(dy, dx);
        const isSpoke = Math.abs(Math.sin(angle * 4)) < 0.12;
        const isRing = Math.abs(r - Math.round(r / 2.3) * 2.3) < 0.35;
        return isSpoke || isRing ? '#ffffff' : null;
      })
    ],
    rising: [
      // A floating boulder
      () => paintProp(12, 10, (x, y) => {
        const d = Math.hypot((x - 5.5) / 5.5, (y - 5) / 4.5);
        if (d > 1) return null;
        if (d > 0.82) return '#3a3440';
        return (x - y) > 2 ? '#6a6070' : '#8a8090';
      }),
      // A wooden chair
      () => asciiToCanvas([
        'K......',
        'Kw.....',
        'Kw.....',
        'Kw.....',
        'KwwwwwK',
        'KKKKKKK',
        'Kw...Kw',
        'Kw...Kw',
        'Kw...Kw'
      ], 1, { K: '#4a2c14', w: '#9a6436' }),
      // A mailbox, flag up
      () => asciiToCanvas([
        '.KKKKK.r',
        'KbbbbbKr',
        'KbbbbbKr',
        'KKKKKKK.',
        '...K....',
        '...K....',
        '...K....'
      ], 1, { K: '#1a2a4a', b: '#4f8aff', r: '#ff3b3b' }),
      // A red balloon
      () => asciiToCanvas([
        '.KKK.',
        'KrWrK',
        'KrrrK',
        'KrrrK',
        '.KrK.',
        '..K..',
        '..w..',
        '...w.',
        '..w..',
        '.w...'
      ], 1, { K: '#6a0a0a', r: '#ff3b3b', W: '#ffd0d0', w: '#e8e8e8' })
    ],
    kitchen: [
      // A giant sugar cube
      () => paintProp(14, 13, (x, y) => {
        if (x > 12 || y > 12) return null;
        if (y < 3 && x > 2 - y + 0 && x < 13) return y === 0 ? '#ffffff' : '#f4f4f8';
        if (x > 9 && y >= 3) return '#cfd2dc';
        if (x === 0 || y === 12) return '#b4b8c4';
        return noise(x, y) < 0.15 ? '#e8eaf0' : '#ffffff';
      }),
      // A pea as big as a boulder
      () => paintProp(12, 12, (x, y) => {
        const d = Math.hypot(x - 5.5, y - 5.5);
        if (d > 5.6) return null;
        if (d > 4.8) return '#2a6a1a';
        if (Math.hypot(x - 3.5, y - 3.5) < 1.6) return '#c8ff9a';
        return '#5fbf3a';
      }),
      // A cereal ring lying on its side
      () => paintProp(16, 9, (x, y) => {
        const d = Math.hypot((x - 7.5) / 7.5, (y - 4) / 4);
        if (d > 1 || d < 0.42) return null;
        if (d > 0.88) return '#a8641e';
        return (x + y) % 5 === 0 ? '#ffd27a' : '#f4a83a';
      }),
      // A fork stuck in the counter, prongs up
      () => asciiToCanvas([
        'K.K.K.K',
        'sKsKsKs',
        'sKsKsKs',
        'sKsKsKs',
        'sssssss',
        '.sssss.',
        '..sss..',
        '...s...',
        '...s...',
        '..sWs..',
        '..sss..',
        '..sWs..',
        '..sss..',
        '..sss..',
        '..sss..',
        '..KKK..'
      ], 1, { K: '#5e6573', s: '#c8d0dc', W: '#ffffff' })
    ],
    concert: [
      // A stack of speakers
      () => asciiToCanvas([
        'KKKKKKKKK',
        'KsssssssK',
        'KsKKKKKsK',
        'KsKcccKsK',
        'KsKcWcKsK',
        'KsKcccKsK',
        'KsKKKKKsK',
        'KKKKKKKKK',
        'KsssssssK',
        'KsKKsKKsK',
        'KsKcsKcsK',
        'KsKKsKKsK',
        'KKKKKKKKK'
      ], 1, { K: '#0a0a0e', s: '#2a2a32', c: '#5a5a66', W: '#9aa3b2' }),
      // A microphone stand
      () => asciiToCanvas([
        '.KK.',
        'KssK',
        '.KK.',
        '..K.',
        '..K.',
        '..K.',
        '..K.',
        '..K.',
        '..K.',
        '..K.',
        '.K.K',
        'K...K'
      ], 1, { K: '#14141a', s: '#9aa3b2' }),
      // A floor light pointing up
      () => asciiToCanvas([
        '.yYYYy.',
        'KyYWYyK',
        'KKKKKKK',
        '.KsssK.',
        '..KKK..',
        '.K...K.'
      ], 1, { K: '#0a0a0e', s: '#3a3a44', y: '#ff4fd8', Y: '#ffb0f0', W: '#ffffff' })
    ]
  };

  Object.assign(WorldArt.WORLD_STYLES, STYLES);
  Object.assign(WorldArt.tiles, tiles);
  Object.assign(WorldArt.platforms, platforms);
  Object.assign(WorldArt.decorations, decorations);
  WorldArt.bouncePads = { ...(WorldArt.bouncePads || {}), ...bouncePads };
})(window.Forest);
