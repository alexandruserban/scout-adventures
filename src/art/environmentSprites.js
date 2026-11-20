/**
 * Procedurally painted static forest props: the foreground oak, the ground tile and wildflowers.
 * Each function returns a fresh canvas at 1 canvas pixel = 1 game pixel.
 */
(function (Forest) {
  const { createPixelCanvas } = Forest.PixelCanvas;

  // ==========================================
  // Ancient oak (64x96)
  // ==========================================
  const OAK_WIDTH = 64;
  const OAK_HEIGHT = 96;

  const OAK_COLORS = {
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

  /** Three shading tiers for leaf clusters, from the back of the canopy to the sunlit front. */
  const LEAF_SHADES = {
    back: {
      base: OAK_COLORS.foliageDark, light: OAK_COLORS.foliageMid,
      sun: OAK_COLORS.foliageLight, shadow: OAK_COLORS.foliageShadow
    },
    middle: {
      base: OAK_COLORS.foliageMid, light: OAK_COLORS.foliageLight,
      sun: OAK_COLORS.foliageHighlight, shadow: OAK_COLORS.foliageDark
    },
    front: {
      base: OAK_COLORS.foliageLight, light: OAK_COLORS.foliageHighlight,
      sun: OAK_COLORS.foliageSun, shadow: OAK_COLORS.foliageDark
    }
  };

  // Drawn in order, back to front
  const CANOPY_CLUSTERS = [
    { x: 22, y: 30, radius: 16, shade: LEAF_SHADES.back },
    { x: 42, y: 28, radius: 16, shade: LEAF_SHADES.back },
    { x: 32, y: 18, radius: 17, shade: LEAF_SHADES.back },
    { x: 16, y: 36, radius: 13, shade: LEAF_SHADES.middle },
    { x: 48, y: 34, radius: 13, shade: LEAF_SHADES.middle },
    { x: 24, y: 22, radius: 14, shade: LEAF_SHADES.middle },
    { x: 40, y: 20, radius: 14, shade: LEAF_SHADES.middle },
    { x: 30, y: 24, radius: 12, shade: LEAF_SHADES.front },
    { x: 20, y: 26, radius: 9, shade: LEAF_SHADES.front },
    { x: 44, y: 24, radius: 9, shade: LEAF_SHADES.front },
    { x: 32, y: 12, radius: 11, shade: LEAF_SHADES.front }
  ];

  const ROOTS = [
    { fromX: 24, fromY: 82, toX: 12, toY: 94, halfWidth: 4 },
    { fromX: 38, fromY: 82, toX: 52, toY: 94, halfWidth: 4 },
    { fromX: 30, fromY: 84, toX: 25, toY: 95, halfWidth: 3 },
    { fromX: 35, fromY: 84, toX: 40, toY: 95, halfWidth: 3 }
  ];

  const BRANCHES = [
    { fromX: 30, fromY: 52, toX: 18, toY: 38, halfWidth: 5 },
    { fromX: 34, fromY: 50, toX: 46, toY: 36, halfWidth: 5 },
    { fromX: 32, fromY: 46, toX: 32, toY: 28, halfWidth: 6 }
  ];

  const TRUNK_TOP_Y = 46;

  function createOakTree() {
    const { canvas, ctx } = createPixelCanvas(OAK_WIDTH, OAK_HEIGHT);

    function plot(x, y, color) {
      if (x < 0 || x >= OAK_WIDTH || y < 0 || y >= OAK_HEIGHT) return;
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }

    paintTrunk(plot);
    paintRoots(plot);
    paintBranches(plot);
    CANOPY_CLUSTERS.forEach(cluster => paintLeafCluster(plot, cluster));
    return canvas;
  }

  /** Gnarled trunk that widens towards the ground, lit from the right, with moss on the shady left. */
  function paintTrunk(plot) {
    for (let y = TRUNK_TOP_Y; y < OAK_HEIGHT - 2; y++) {
      const progress = (y - TRUNK_TOP_Y) / (OAK_HEIGHT - TRUNK_TOP_Y);
      const trunkWidth = 10 + progress * 14;
      const centerX = 32 + Math.sin(y * 0.15) * 1.5;
      const startX = Math.floor(centerX - trunkWidth / 2);
      const endX = Math.floor(centerX + trunkWidth / 2);

      for (let x = startX; x <= endX; x++) {
        const across = (x - startX) / (endX - startX); // 0 = left edge, 1 = right edge
        let color = OAK_COLORS.barkMid;
        if (across < 0.15) color = OAK_COLORS.barkShadow;
        else if (across < 0.35) color = OAK_COLORS.barkDark;
        else if (across > 0.85) color = OAK_COLORS.barkHighlight;
        else if (across > 0.65) color = OAK_COLORS.barkLight;

        if (across < 0.25 && (x + y) % 3 === 0) color = OAK_COLORS.moss;
        if (across < 0.2 && (x + y) % 5 === 0) color = OAK_COLORS.mossLight;

        // Bark grain: scattered dark pixels in a fixed pseudo-random pattern
        if ((x * 7 + y * 13) % 9 === 0) color = OAK_COLORS.barkShadow;
        if ((x * 3 + y * 5) % 11 === 0) color = OAK_COLORS.barkDark;

        plot(x, y, color);
      }
    }
  }

  function paintRoots(plot) {
    ROOTS.forEach(root => {
      for (let step = 0; step <= 20; step++) {
        const t = step / 20;
        const x = Math.floor(root.fromX + (root.toX - root.fromX) * t);
        const y = Math.floor(root.fromY + (root.toY - root.fromY) * t);
        const halfWidth = root.halfWidth * (1 - t * 0.5); // roots taper as they spread
        for (let offset = -halfWidth; offset <= halfWidth; offset++) {
          plot(x + offset, y, x < 32 ? OAK_COLORS.barkDark : OAK_COLORS.barkMid);
        }
      }
    });
  }

  function paintBranches(plot) {
    BRANCHES.forEach(branch => {
      for (let step = 0; step <= 20; step++) {
        const t = step / 20;
        const x = Math.floor(branch.fromX + (branch.toX - branch.fromX) * t);
        const y = Math.floor(branch.fromY + (branch.toY - branch.fromY) * t);
        const halfWidth = Math.floor(branch.halfWidth * (1 - t * 0.6));
        for (let offset = -halfWidth; offset <= halfWidth; offset++) {
          plot(x + offset, y, OAK_COLORS.barkDark);
        }
      }
    });
  }

  /** A lumpy disc of leaves, sunlit on the upper left and shaded underneath. */
  function paintLeafCluster(plot, { x: centerX, y: centerY, radius, shade }) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const wobble = Math.sin(dx * 1.5) * 0.8;
        if (Math.hypot(dx, dy) > radius + wobble) continue;

        let color = shade.base;
        if (dy > radius * 0.45) color = shade.shadow;
        else if (dy < -radius * 0.3 && dx < 0) color = shade.sun;
        else if (dy < 0 || dx < -radius * 0.2) color = shade.light;

        plot(Math.floor(centerX + dx), Math.floor(centerY + dy), color);
      }
    }
  }

  // ==========================================
  // Ground tile (32x32, tiles horizontally)
  // ==========================================
  const TILE_SIZE = 32;

  const GROUND_COLORS = {
    grassHighlight: '#a3e635',
    grassBright: '#65a30d',
    grassMid: '#3f6212',
    grassDark: '#1a2e05',
    soilLight: '#78350f',
    soilMid: '#451a03',
    soilDark: '#290f02',
    stoneDark: '#334155',
    stoneLight: '#64748b',
    rootLine: '#5c3924'
  };

  const STONES = [
    { x: 6, y: 14, width: 3, height: 2 },
    { x: 22, y: 20, width: 4, height: 3 },
    { x: 12, y: 26, width: 2, height: 2 }
  ];

  // One blade on every odd column so the pattern tiles seamlessly
  const GRASS_BLADE_HEIGHTS = [3, 4, 2, 5, 3, 4, 5, 2, 4, 3, 5, 3, 4, 5, 2, 4];

  /** Rows of grass at the top of the ground tile; everything below is soil. */
  const GRASS_DEPTH_PIXELS = 8;

  function createGrassTile() {
    const { canvas, ctx } = createPixelCanvas(TILE_SIZE, TILE_SIZE);
    const fillPixel = (x, y, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    };

    ctx.fillStyle = GROUND_COLORS.soilMid;
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Speckled soil: lighter near the surface, darker deeper down
    for (let y = GRASS_DEPTH_PIXELS; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const noise = (x * 13 + y * 29) % 17;
        let color;
        if (y > 22) {
          color = noise < 6 ? GROUND_COLORS.soilDark : GROUND_COLORS.soilMid;
        } else {
          color = noise < 5 ? GROUND_COLORS.soilLight : (noise > 12 ? GROUND_COLORS.soilDark : GROUND_COLORS.soilMid);
        }
        fillPixel(x, y, color);
      }
    }

    STONES.forEach(stone => {
      ctx.fillStyle = GROUND_COLORS.stoneDark;
      ctx.fillRect(stone.x, stone.y, stone.width, stone.height);
      ctx.fillStyle = GROUND_COLORS.stoneLight;
      ctx.fillRect(stone.x, stone.y, stone.width - 1, 1);
    });

    // A thin wavy root running through the soil
    for (let x = 0; x < TILE_SIZE; x++) {
      fillPixel(x, Math.floor(18 + Math.sin(x * 0.3) * 2), GROUND_COLORS.rootLine);
    }

    // Grass layers, darkest at the bottom
    ctx.fillStyle = GROUND_COLORS.grassDark;
    ctx.fillRect(0, 4, TILE_SIZE, 4);
    ctx.fillStyle = GROUND_COLORS.grassMid;
    ctx.fillRect(0, 2, TILE_SIZE, 3);
    ctx.fillStyle = GROUND_COLORS.grassBright;
    ctx.fillRect(0, 1, TILE_SIZE, 2);

    // Individual blades poking up, with a bright tip
    GRASS_BLADE_HEIGHTS.forEach((bladeHeight, index) => {
      const x = index * 2 + 1;
      for (let step = 0; step < bladeHeight; step++) {
        const y = 3 - step;
        if (y < 0) continue;
        const isTip = step === bladeHeight - 1;
        fillPixel(x, y, isTip ? GROUND_COLORS.grassHighlight : GROUND_COLORS.grassBright);
      }
    });

    return canvas;
  }

  // ==========================================
  // Wildflower tuft (16x16)
  // ==========================================
  function createFlowerTuft() {
    const { canvas, ctx } = createPixelCanvas(16, 16);
    const fillRects = (color, rects) => {
      ctx.fillStyle = color;
      rects.forEach(([x, y, width, height]) => ctx.fillRect(x, y, width, height));
    };

    fillRects('#4d7c0f', [[5, 7, 1, 9], [10, 5, 1, 11], [8, 9, 1, 7]]); // stems
    fillRects('#65a30d', [[3, 11, 2, 1], [6, 12, 2, 1], [11, 10, 2, 1]]); // leaves
    fillRects('#38bdf8', [[4, 5, 3, 3]]); // blue flower
    fillRects('#bae6fd', [[5, 6, 1, 1]]);
    fillRects('#f43f5e', [[9, 3, 3, 3]]); // red flower
    fillRects('#fef08a', [[10, 4, 1, 1]]);

    return canvas;
  }

  Forest.EnvironmentSprites = {
    GRASS_DEPTH_PIXELS,
    createOakTree,
    createGrassTile,
    createFlowerTuft
  };
})(window.Forest);
