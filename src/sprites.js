// Pixel Art Sprite Definitions for Forest Adventure
// Handcrafted retro 16-bit pixel matrices
// The main character's frames are assembled in src/boyAnimation.js from this palette

const PALETTE = {
  // Transparency
  '.': 'transparent',

  // Boy Palette
  'H': '#2e1a07', // Hair dark shadow
  'h': '#59321f', // Hair base brown
  'j': '#804c2b', // Hair light highlight
  'C': '#a81c2b', // Cap dark red
  'c': '#e63946', // Cap vibrant red
  'v': '#ff6b6b', // Cap highlight
  'S': '#d6946e', // Skin shadow & solid defined nose tip
  's': '#fcd5b5', // Skin base peach
  'b': '#f59e8b', // Skin blush
  'E': '#181b22', // Profile eye dark pupil
  'W': '#ffffff', // White (eyes, teeth, highlights)
  'q': '#931215', // Mouth open in pain / grit teeth
  'J': '#1c2e4a', // Jacket dark navy
  'k': '#2d4b75', // Jacket blue
  'l': '#466fa8', // Jacket light blue
  'F': '#e07a22', // Scarf orange
  'f': '#f79f48', // Scarf light
  'P': '#5e432f', // Pants dark khaki
  'p': '#8c684a', // Pants khaki
  'B': '#2a1a11', // Boots dark
  'd': '#543623', // Boots leather

  // Two-Handed Sword Palette
  '-': '#475569', // Steel blade shadow
  '+': '#94a3b8', // Steel blade mid
  '*': '#ffffff', // Steel blade edge shine
  'i': '#d97706', // Hilt pommel & crossguard gold
  'I': '#fde047', // Crossguard highlight
  'o': '#451a03', // Two-handed leather grip wrap
  'O': '#290f02', // Grip shadow
  'L': '#ffeaa7', // Slash energy / arc trail

  // Hit Flash
  'X': '#ffffff', // Full white flash
  'Y': '#ff595e', // Red flash

  // Mushroom Palette
  'M': '#660708', // Mushroom cap deep shadow
  'm': '#a4161a', // Mushroom cap dark red
  'R': '#e5383b', // Mushroom cap vibrant crimson
  'r': '#f47074', // Mushroom cap highlight
  'U': '#2b1029', // Under-cap gills dark
  'u': '#562a52', // Under-cap gills
  'T': '#e0d1be', // Stem light cream
  't': '#a89884', // Stem shadow
  'Z': '#ffe49e', // Poison yellow wart
  'z': '#ffd166', // Poison yellow wart shadow
  'N': '#7209b7', // Poison purple spot
  'n': '#9d4edd', // Poison light purple
  'e': '#ffbe0b', // Evil eye amber glow
  'D': '#131114', // Evil eye pupil / mouth cavity

  // Environment Palette
  'g': '#2b580c', // Foliage darkest
  'G': '#42781a', // Foliage shadow
  'A': '#68a329', // Foliage mid
  'a': '#99cc33', // Foliage light
  'w': '#c2e85a', // Foliage highlight
  'K': '#281a10', // Bark darkest
  '8': '#6b452c', // Bark mid
  '9': '#8f6140', // Bark light
  '1': '#192b11', // Dirt deep
  '2': '#312015', // Dirt dark
  '3': '#4f3523', // Dirt mid
  '4': '#6e4c34', // Dirt light
  '7': '#8d6849', // Dirt surface
  '#': '#1b4d1b', // Grass dark
  '$': '#2f7a28', // Grass mid
  '%': '#4fb835', // Grass bright
  '^': '#8ae35a', // Grass tip highlight
};

// ==========================================
// 2. THE EVIL MUSHROOM (Straight & Symmetrical 20x18)
// ==========================================

// Mushroom Walk 1 (Perfect bilateral symmetry)
const MUSHROOM_WALK_1 = [
  ".......mmmmmm.......",
  ".....mmRRRRRRmm.....",
  "...mmRRRRrRRRRRRmm...",
  "..mRRRRrrrrrrRRRRm..",
  ".mRRZZRRrrrrRRZZRRm.",
  ".mRRzzZZRRRRZZzzRRm.",
  "mRRRRRRRNNNNRRRRRRRm",
  "mRRNNNRRnnnnRRNNNRRm",
  "mRRnnnNRRRRRRnNNnRRm",
  ".uUUUUUUUUUUUUUUUUu.",
  "..uuUUUUUUUUUUUUuu..",
  "...tttTTTTTTTTttt...",
  "...ttteDTTTTDeTttt..",
  "...tttDDTTTTDDtttt..",
  "...tttWWDDDDWWtttt..",
  "....ttDDDDDDDDtt....",
  "....tttt....tttt....",
  "....KKKK....KKKK...."
];

// Mushroom Walk 2 (Straight squashing hop)
const MUSHROOM_WALK_2 = [
  "....................",
  ".......mmmmmm.......",
  ".....mmRRRRRRmm.....",
  "...mmRRRRrRRRRRRmm...",
  "..mRRZZRRrrrrRRZZRRm",
  ".mRRzzZZRRRRZZzzRRm.",
  "mRRRRRRRNNNNRRRRRRRm",
  "mRRNNNRRnnnnRRNNNRRm",
  "mRRnnnNRRRRRRnNNnRRm",
  ".uUUUUUUUUUUUUUUUUu.",
  "..uuUUUUUUUUUUUUuu..",
  "...tttTTTTTTTTttt...",
  "...ttteDTTTTDeTttt..",
  "...tttDDTTTTDDtttt..",
  "...tttWWDDDDWWtttt..",
  "....ttDDDDDDDDtt....",
  ".....tttt..tttt.....",
  ".....KKKK..KKKK....."
];

// Mushroom Walk 3 (Straight stretch hop)
const MUSHROOM_WALK_3 = [
  ".......mmmmmm.......",
  ".....mmRRRRRRmm.....",
  "...mmRRRRrRRRRRRmm...",
  "..mRRRRrrrrrrRRRRm..",
  ".mRRZZRRrrrrRRZZRRm.",
  ".mRRzzZZRRRRZZzzRRm.",
  "mRRRRRRRNNNNRRRRRRRm",
  "mRRNNNRRnnnnRRNNNRRm",
  "mRRnnnNRRRRRRnNNnRRm",
  ".uUUUUUUUUUUUUUUUUu.",
  "..uuUUUUUUUUUUUUuu..",
  "...tttTTTTTTTTttt...",
  "...ttteDTTTTDeTttt..",
  "...tttDDTTTTDDtttt..",
  "...tttWWDDDDWWtttt..",
  "....ttDDDDDDDDtt....",
  "...tttt......tttt...",
  "...KKKK......KKKK..."
];

// Mushroom Walk 4 (Straight landing)
const MUSHROOM_WALK_4 = [
  ".......mmmmmm.......",
  ".....mmRRRRRRmm.....",
  "...mmRRRRrRRRRRRmm...",
  "..mRRRRrrrrrrRRRRm..",
  ".mRRZZRRrrrrRRZZRRm.",
  ".mRRzzZZRRRRZZzzRRm.",
  "mRRRRRRRNNNNRRRRRRRm",
  "mRRNNNRRnnnnRRNNNRRm",
  "mRRnnnNRRRRRRnNNnRRm",
  ".uUUUUUUUUUUUUUUUUu.",
  "..uuUUUUUUUUUUUUuu..",
  "...tttTTTTTTTTttt...",
  "...ttteDTTTTDeTttt..",
  "...tttDDTTTTDDtttt..",
  "...tttWWDDDDWWtttt..",
  "....ttDDDDDDDDtt....",
  "....tttttttttttt....",
  "....KKKKKKKKKKKK...."
];

// Mushroom Aggro (Symmetrical menacing teeth and glowing amber eyes)
const MUSHROOM_AGGRO = [
  ".......mmmmmm.......",
  ".....mmRRRRRRmm.....",
  "...mmRRRRrRRRRRRmm...",
  "..mRRRRrrrrrrRRRRm..",
  ".mRRZZRRrrrrRRZZRRm.",
  ".mRRzzZZRRRRZZzzRRm.",
  "mRRRRRRRNNNNRRRRRRRm",
  "mRRNNNRRnnnnRRNNNRRm",
  "mRRnnnNRRRRRRnNNnRRm",
  ".uUUUUUUUUUUUUUUUUu.",
  "..uuUUUUUUUUUUUUuu..",
  "...tttTTTTTTTTttt...",
  "...tteeDDTTDDeeTtt..",
  "...tttDDDDDDDDtttt..",
  "..tttWDDDDDDDDWttt..",
  "..tttDWWDDDDWWDttt..",
  "....tttt....tttt....",
  "....KKKK....KKKK...."
];

// Mushroom Hit State 1: Squash & Flash (Symmetrical shock, bulging eyes)
const MUSHROOM_HIT_1 = [
  "....................",
  "....................",
  ".....mmmmmmmmmm.....",
  "...mmRRRRRRRRRRmm...",
  "..mRRZZRRrrrrRRZZRRm",
  ".mRRzzZZRRRRZZzzRRm.",
  "mRRRRRRRNNNNRRRRRRRm",
  ".uUUUUUUUUUUUUUUUUu.",
  "..uuUUUUUUUUUUUUuu..",
  "...tttTTTTTTTTttt...",
  "..ttWWDDTTTTDDWWtt..",
  "..ttWDDWTTTTWDDWtt..",
  "..ttWWDDTTTTDDWWtt..",
  "...tttDDqqqqDDtttt..",
  "....ttDDqqqqDDtt....",
  ".....TTTTTTTTTT.....",
  "....tttt....tttt....",
  "....KKKK....KKKK...."
];

// Mushroom Hit State 2: Dazed (Straight upright with spiral eyes @_@ and drool)
const MUSHROOM_HIT_2 = [
  ".......mmmmmm.......",
  ".....mmRRRRRRmm.....",
  "...mmRRRRrRRRRRRmm...",
  "..mRRRRrrrrrrRRRRm..",
  ".mRRZZRRrrrrRRZZRRm.",
  ".mRRzzZZRRRRZZzzRRm.",
  "mRRRRRRRNNNNRRRRRRRm",
  "mRRNNNRRnnnnRRNNNRRm",
  "mRRnnnNRRRRRRnNNnRRm",
  ".uUUUUUUUUUUUUUUUUu.",
  "..uuUUUUUUUUUUUUuu..",
  "...tttTTTTTTTTttt...",
  "...tttDeDTTDeDtttt..",
  "...tttEDDTTEDDtttt..",
  "...tttqqqqqqqqtttt..",
  "....ttDqqqqqqDtt....",
  "....tttt....tttt....",
  "....KKKK....KKKK...."
];

// ==========================================
// 3. STATIC FOREST ASSETS (Tree, Grass, Props)
// ==========================================

/**
 * Creates high-detail 64x96 Ancient Forest Oak pixel art
 */
function createAncientTreeCanvas() {
  const width = 64;
  const height = 96;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const P = {
    foliageShadow: '#132b13',
    foliageDark: '#1e4620',
    foliageMid: '#386629',
    foliageLight: '#599137',
    foliageHighlight: '#8cb844',
    foliageSun: '#c2df6e',
    barkShadow: '#26170f',
    barkDark: '#3d2518',
    barkMid: '#5c3924',
    barkLight: '#805235',
    barkHighlight: '#aa734d',
    moss: '#42781a',
    mossLight: '#68a329'
  };

  function pixel(x, y, color) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }
  }

  function circleCluster(cx, cy, radius, baseColor, lightColor, sunColor, shadowColor) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius + (Math.sin(dx * 1.5) * 0.8)) {
          const px = Math.floor(cx + dx);
          const py = Math.floor(cy + dy);
          if (dy > radius * 0.45) {
            pixel(px, py, shadowColor);
          } else if (dy < -radius * 0.3 && dx < 0) {
            pixel(px, py, sunColor);
          } else if (dy < 0 || dx < -radius * 0.2) {
            pixel(px, py, lightColor);
          } else {
            pixel(px, py, baseColor);
          }
        }
      }
    }
  }

  // Draw Gnarled Trunk & Roots
  const trunkBaseY = 46;
  for (let y = trunkBaseY; y < height - 2; y++) {
    const progress = (y - trunkBaseY) / (height - trunkBaseY);
    const trunkWidth = 10 + progress * 14;
    const centerX = 32 + Math.sin(y * 0.15) * 1.5;
    const startX = Math.floor(centerX - trunkWidth / 2);
    const endX = Math.floor(centerX + trunkWidth / 2);

    for (let x = startX; x <= endX; x++) {
      const relX = (x - startX) / (endX - startX);
      let col = P.barkMid;
      if (relX < 0.15) col = P.barkShadow;
      else if (relX < 0.35) col = P.barkDark;
      else if (relX > 0.85) col = P.barkHighlight;
      else if (relX > 0.65) col = P.barkLight;

      if (relX < 0.25 && (x + y) % 3 === 0) col = P.moss;
      if (relX < 0.2 && (x + y) % 5 === 0) col = P.mossLight;

      if ((x * 7 + y * 13) % 9 === 0) col = P.barkShadow;
      if ((x * 3 + y * 5) % 11 === 0) col = P.barkDark;

      pixel(x, y, col);
    }
  }

  // Roots spreading into earth
  const rootSpreads = [
    { startX: 24, startY: 82, endX: 12, endY: 94, w: 4 },
    { startX: 38, startY: 82, endX: 52, endY: 94, w: 4 },
    { startX: 30, startY: 84, endX: 25, endY: 95, w: 3 },
    { startX: 35, startY: 84, endX: 40, endY: 95, w: 3 }
  ];
  rootSpreads.forEach(r => {
    for (let step = 0; step <= 20; step++) {
      const t = step / 20;
      const rx = Math.floor(r.startX + (r.endX - r.startX) * t);
      const ry = Math.floor(r.startY + (r.endY - r.startY) * t);
      for (let w = -r.w * (1 - t * 0.5); w <= r.w * (1 - t * 0.5); w++) {
        pixel(rx + w, ry, (rx < 32) ? P.barkDark : P.barkMid);
      }
    }
  });

  // Main Boughs/Branches
  const branches = [
    { x0: 30, y0: 52, x1: 18, y1: 38, w: 5 },
    { x0: 34, y0: 50, x1: 46, y1: 36, w: 5 },
    { x0: 32, y0: 46, x1: 32, y1: 28, w: 6 }
  ];
  branches.forEach(b => {
    for (let s = 0; s <= 20; s++) {
      const t = s / 20;
      const bx = Math.floor(b.x0 + (b.x1 - b.x0) * t);
      const by = Math.floor(b.y0 + (b.y1 - b.y0) * t);
      for (let w = -Math.floor(b.w * (1 - t * 0.6)); w <= Math.floor(b.w * (1 - t * 0.6)); w++) {
        pixel(bx + w, by, P.barkDark);
      }
    }
  });

  // Layered Lush Leaf Clusters (Back to Front)
  const canopyClusters = [
    { cx: 22, cy: 30, r: 16, b: P.foliageDark, l: P.foliageMid, s: P.foliageLight, sh: P.foliageShadow },
    { cx: 42, cy: 28, r: 16, b: P.foliageDark, l: P.foliageMid, s: P.foliageLight, sh: P.foliageShadow },
    { cx: 32, cy: 18, r: 17, b: P.foliageDark, l: P.foliageMid, s: P.foliageLight, sh: P.foliageShadow },
    { cx: 16, cy: 36, r: 13, b: P.foliageMid, l: P.foliageLight, s: P.foliageHighlight, sh: P.foliageDark },
    { cx: 48, cy: 34, r: 13, b: P.foliageMid, l: P.foliageLight, s: P.foliageHighlight, sh: P.foliageDark },
    { cx: 24, cy: 22, r: 14, b: P.foliageMid, l: P.foliageLight, s: P.foliageHighlight, sh: P.foliageDark },
    { cx: 40, cy: 20, r: 14, b: P.foliageMid, l: P.foliageLight, s: P.foliageHighlight, sh: P.foliageDark },
    { cx: 30, cy: 24, r: 12, b: P.foliageLight, l: P.foliageHighlight, s: P.foliageSun, sh: P.foliageDark },
    { cx: 20, cy: 26, r: 9, b: P.foliageLight, l: P.foliageHighlight, s: P.foliageSun, sh: P.foliageDark },
    { cx: 44, cy: 24, r: 9, b: P.foliageLight, l: P.foliageHighlight, s: P.foliageSun, sh: P.foliageDark },
    { cx: 32, cy: 12, r: 11, b: P.foliageLight, l: P.foliageHighlight, s: P.foliageSun, sh: P.foliageDark }
  ];

  canopyClusters.forEach(c => {
    circleCluster(c.cx, c.cy, c.r, c.b, c.l, c.s, c.sh);
  });

  return canvas;
}

/**
 * Creates 32x32 Rich Tileable Grass & Soil ground tile
 */
function createGrassGroundCanvas() {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const P = {
    grassHighlight: '#a3e635',
    grassBright: '#65a30d',
    grassMid: '#3f6212',
    grassDark: '#1a2e05',
    soilLight: '#78350f',
    soilMid: '#451a03',
    soilDark: '#290f02',
    stoneDark: '#334155',
    stoneLight: '#64748b'
  };

  ctx.fillStyle = P.soilMid;
  ctx.fillRect(0, 0, size, size);

  for (let y = 8; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = (x * 13 + y * 29) % 17;
      if (y > 22) {
        ctx.fillStyle = (n < 6) ? P.soilDark : P.soilMid;
      } else {
        ctx.fillStyle = (n < 5) ? P.soilLight : (n > 12 ? P.soilDark : P.soilMid);
      }
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const stones = [
    { x: 6, y: 14, w: 3, h: 2 },
    { x: 22, y: 20, w: 4, h: 3 },
    { x: 12, y: 26, w: 2, h: 2 }
  ];
  stones.forEach(st => {
    ctx.fillStyle = P.stoneDark;
    ctx.fillRect(st.x, st.y, st.w, st.h);
    ctx.fillStyle = P.stoneLight;
    ctx.fillRect(st.x, st.y, st.w - 1, 1);
  });

  ctx.fillStyle = '#5c3924';
  for (let x = 0; x < size; x++) {
    const ry = Math.floor(18 + Math.sin(x * 0.3) * 2);
    ctx.fillRect(x, ry, 1, 1);
  }

  ctx.fillStyle = P.grassDark;
  ctx.fillRect(0, 4, size, 4);
  ctx.fillStyle = P.grassMid;
  ctx.fillRect(0, 2, size, 3);
  ctx.fillStyle = P.grassBright;
  ctx.fillRect(0, 1, size, 2);

  const blades = [
    { x: 1, h: 3 }, { x: 3, h: 4 }, { x: 5, h: 2 }, { x: 7, h: 5 },
    { x: 9, h: 3 }, { x: 11, h: 4 }, { x: 13, h: 5 }, { x: 15, h: 2 },
    { x: 17, h: 4 }, { x: 19, h: 3 }, { x: 21, h: 5 }, { x: 23, h: 3 },
    { x: 25, h: 4 }, { x: 27, h: 5 }, { x: 29, h: 2 }, { x: 31, h: 4 }
  ];
  blades.forEach(b => {
    for (let dy = 0; dy < b.h; dy++) {
      const gy = 3 - dy;
      if (gy >= 0) {
        ctx.fillStyle = (dy === b.h - 1) ? P.grassHighlight : P.grassBright;
        ctx.fillRect(b.x, gy, 1, 1);
      }
    }
  });

  return canvas;
}

/**
 * Creates 16x16 Foreground Wildflower / Grass Tuft
 */
function createFlowerTuftCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = '#4d7c0f';
  ctx.fillRect(5, 7, 1, 9);
  ctx.fillRect(10, 5, 1, 11);
  ctx.fillRect(8, 9, 1, 7);

  ctx.fillStyle = '#65a30d';
  ctx.fillRect(3, 11, 2, 1);
  ctx.fillRect(6, 12, 2, 1);
  ctx.fillRect(11, 10, 2, 1);

  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(4, 5, 3, 3);
  ctx.fillStyle = '#bae6fd';
  ctx.fillRect(5, 6, 1, 1);

  ctx.fillStyle = '#f43f5e';
  ctx.fillRect(9, 3, 3, 3);
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(10, 4, 1, 1);

  return canvas;
}

// Global Sprite Registry
window.SpriteData = {
  PALETTE,
  // The boy's frames are built from parts in src/boyAnimation.js (window.BoyAnimation)
  MUSHROOM: {
    WALK: [MUSHROOM_WALK_1, MUSHROOM_WALK_2, MUSHROOM_WALK_3, MUSHROOM_WALK_4],
    AGGRO: MUSHROOM_AGGRO,
    HIT_1: MUSHROOM_HIT_1,
    HIT_2: MUSHROOM_HIT_2
  },
  createAncientTreeCanvas,
  createGrassGroundCanvas,
  createFlowerTuftCanvas
};
