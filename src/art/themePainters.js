/**
 * Parallax background painters for the dungeon and treetop levels (the forest uses
 * backgroundPainters.js). Same rules: 1 canvas pixel = 1 game pixel, and scrolling layers are
 * LAYER_WIDTH wide and wrap horizontally.
 */
(function (Forest) {
  const Painters = Forest.BackgroundPainters;
  const { LAYER_WIDTH, createWrappingCanvas, ditherThreshold, ridgeOffset } = Painters;
  const { createSeededRandom } = Forest.MathUtils;

  // ==========================================
  // Dungeon
  // ==========================================
  /** From the darkness overhead down to the dim glow near the floor. */
  const DUNGEON_SKY_COLORS = ['#07060b', '#0a0911', '#0e0c17', '#13101d', '#181424', '#1d182a', '#231d31', '#2a2237', '#30273d'];

  /** Pillars (and the torches on them) repeat every this many pixels, so the glow layer can line up. */
  const PILLAR_SPACING = 128;
  const PILLAR_OFFSET = 40;
  /** Torch flame height on the pillar layer, from the top of its canvas. */
  const TORCH_Y = 92;

  /** Far back wall of uneven bricks with dark arched alcoves. */
  function paintDungeonWall() {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, 256);
    const BRICK_HEIGHT = 7;
    const BRICK_WIDTH = 16;
    const COLORS = { mortar: '#141019', dark: '#211b2a', mid: '#2a2333', light: '#332b3d', alcove: '#0c0a10', alcoveRim: '#3b3246' };

    for (let y = 0; y < height; y++) {
      const row = Math.floor(y / BRICK_HEIGHT);
      const rowOffset = row % 2 ? BRICK_WIDTH / 2 : 0;
      for (let x = 0; x < LAYER_WIDTH; x++) {
        const isMortarRow = y % BRICK_HEIGHT === 0;
        const brick = Math.floor((x + rowOffset) / BRICK_WIDTH);
        const isMortarColumn = (x + rowOffset) % BRICK_WIDTH === 0;
        if (isMortarRow || isMortarColumn) {
          plot(x, y, COLORS.mortar);
          continue;
        }
        const shade = (brick * 7 + row * 13) % 5;
        let color = shade === 0 ? COLORS.light : (shade < 3 ? COLORS.mid : COLORS.dark);
        // Darker towards the top, where the torchlight doesn't reach
        if (y < 90 && ditherThreshold(x, y) > y / 90) color = COLORS.dark;
        if (y < 50 && ditherThreshold(x, y) > y / 50) color = COLORS.mortar;
        plot(x, y, color);
      }
    }

    // Arched alcoves between the pillars
    for (let i = 0; i < LAYER_WIDTH / PILLAR_SPACING; i++) {
      const centerX = i * PILLAR_SPACING + PILLAR_OFFSET + PILLAR_SPACING / 2;
      const halfWidth = 18;
      const top = 130;
      const bottom = height - 20;
      for (let y = top - halfWidth; y < bottom; y++) {
        for (let dx = -halfWidth - 2; dx <= halfWidth + 2; dx++) {
          const archY = y < top ? top - Math.sqrt(Math.max(0, halfWidth * halfWidth - dx * dx)) : top;
          if (y < archY - 2) continue;
          const isRim = y < archY || Math.abs(dx) > halfWidth;
          plot(centerX + dx, y, isRim ? COLORS.alcoveRim : COLORS.alcove);
        }
      }
    }
    return canvas;
  }

  /** Stone pillars with a torch on each, between them transparent (the wall shows through). */
  function paintDungeonPillars() {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, 192);
    const COLORS = { shadow: '#1c1722', dark: '#2b2433', mid: '#3a3144', light: '#4c4158', rim: '#5f526d', crack: '#16121b' };
    const HALF_WIDTH = 10;

    for (let i = 0; i < LAYER_WIDTH / PILLAR_SPACING; i++) {
      const centerX = i * PILLAR_SPACING + PILLAR_OFFSET;
      for (let y = 0; y < height; y++) {
        // Wider capital near the top and base near the bottom
        const isCapital = y > 20 && y < 30;
        const isBase = y > height - 16;
        const halfWidth = HALF_WIDTH + (isCapital || isBase ? 3 : 0);
        for (let dx = -halfWidth; dx <= halfWidth; dx++) {
          const across = (dx + halfWidth) / (halfWidth * 2); // 0 left .. 1 right
          let color = COLORS.mid;
          if (across < 0.2) color = COLORS.shadow;
          else if (across < 0.4) color = COLORS.dark;
          else if (across > 0.85) color = COLORS.rim;
          else if (across > 0.65) color = COLORS.light;
          if (!isCapital && !isBase && y % 24 === 0) color = COLORS.crack; // block joints
          plot(centerX + dx, y, color);
        }
      }
      paintTorch(plot, centerX, TORCH_Y);
    }
    return canvas;
  }

  /** Iron bracket with a little flame, centred on (x, y). */
  function paintTorch(plot, x, y) {
    const IRON = '#2a2a30';
    for (let dy = 0; dy < 8; dy++) plot(x, y + dy, IRON);
    for (let dx = -2; dx <= 2; dx++) plot(x + dx, y, IRON);
    const flame = [
      [0, -6, '#fff3a0'], [0, -5, '#ffd25e'], [-1, -4, '#ffb347'], [0, -4, '#fff3a0'], [1, -4, '#ffb347'],
      [-1, -3, '#ff8c2a'], [0, -3, '#ffd25e'], [1, -3, '#ff8c2a'], [-2, -2, '#ff5a1f'], [-1, -2, '#ffb347'],
      [0, -2, '#ffd25e'], [1, -2, '#ffb347'], [2, -2, '#ff5a1f'], [-1, -1, '#ff5a1f'], [0, -1, '#ff8c2a'], [1, -1, '#ff5a1f']
    ];
    flame.forEach(([dx, dy, color]) => plot(x + dx, y + dy, color));
  }

  /** Warm, dithered pools of light around each torch (drawn additively over the scene). */
  function paintTorchGlow() {
    const { canvas, ctx, width, height } = createWrappingCanvas(LAYER_WIDTH, 192);
    const image = ctx.createImageData(width, height);
    const GLOW = [255, 150, 60];
    const RADIUS = 46;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let strength = 0;
        for (let i = 0; i < LAYER_WIDTH / PILLAR_SPACING; i++) {
          let dx = x - (i * PILLAR_SPACING + PILLAR_OFFSET);
          dx = ((dx % width) + width * 1.5) % width - width / 2;
          const distance = Math.hypot(dx, (y - (TORCH_Y - 4)) * 1.1);
          strength = Math.max(strength, 1 - distance / RADIUS);
        }
        let alpha = 0;
        if (strength > 0.6) alpha = 1;
        else if (strength > 0.35) alpha = 0.6;
        else if (strength > 0.1 && ditherThreshold(x, y) < 0.5) alpha = 0.3;
        if (!alpha) continue;
        const index = (y * width + x) * 4;
        image.data[index] = GLOW[0];
        image.data[index + 1] = GLOW[1];
        image.data[index + 2] = GLOW[2];
        image.data[index + 3] = Math.round(alpha * 255);
      }
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  /** Chains hanging from the darkness overhead. */
  function paintChains() {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, 128);
    const random = createSeededRandom(66);
    const COLORS = { dark: '#1e1c24', light: '#3d3a47' };
    for (let x = 12; x < LAYER_WIDTH; x += 30 + Math.floor(random() * 50)) {
      const length = 30 + Math.floor(random() * 80);
      for (let y = 0; y < Math.min(height, length); y++) {
        // Alternating links: a ring (two pixels wide) then a side-on link (one pixel)
        const isRing = Math.floor(y / 3) % 2 === 0;
        if (isRing) {
          plot(x - 1, y, COLORS.dark);
          plot(x + 1, y, COLORS.light);
        } else {
          plot(x, y, COLORS.light);
        }
      }
      // A heavy hook at the end of some chains
      if (random() < 0.5) {
        const endY = Math.min(height - 4, length);
        [[0, 0], [0, 1], [1, 2], [2, 2], [3, 1]].forEach(([dx, dy]) => plot(x + dx, endY + dy, COLORS.light));
      }
    }
    return canvas;
  }

  /** Dark rubble and broken masonry along the bottom. */
  function paintRubble() {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, 64);
    const random = createSeededRandom(808);
    const COLORS = { base: '#0d0b11', dark: '#16131c', mid: '#211c29', light: '#2d2636' };

    for (let x = 0; x < LAYER_WIDTH; x++) {
      const top = Math.round(42 + ridgeOffset(x, [[3, 5, 0.9], [2, 12, 2.1]]));
      for (let y = top; y < height; y++) plot(x, y, COLORS.base);
    }
    // Fallen blocks: rough rectangles lit from above
    for (let i = 0; i < 30; i++) {
      const blockX = Math.floor(random() * LAYER_WIDTH);
      const blockWidth = 5 + Math.floor(random() * 10);
      const blockHeight = 4 + Math.floor(random() * 7);
      const bottom = 46 + Math.floor(random() * 4);
      for (let dy = 0; dy < blockHeight; dy++) {
        for (let dx = 0; dx < blockWidth; dx++) {
          const y = bottom - dy;
          let color = COLORS.dark;
          if (dy === blockHeight - 1) color = COLORS.light;
          else if (dx === blockWidth - 1 || dy > blockHeight - 3) color = COLORS.mid;
          plot(blockX + dx, y, color);
        }
      }
    }
    return canvas;
  }

  // ==========================================
  // Treetops
  // ==========================================
  /** Bright midday blue, paling towards the haze far below. */
  const TREETOP_SKY_COLORS = ['#2f6fc4', '#3b7fd2', '#4a8fdc', '#5b9fe4', '#6eaeeb', '#84bef0', '#9bcdf3', '#b5dcf6', '#d2ebf9'];
  const WHITE_CLOUD_COLORS = { body: '#ffffff', underside: '#c6d9ee', shade: '#e3eef9', top: '#ffffff' };
  const FAR_CLOUD_COLORS = { body: '#eaf3fb', underside: '#bcd1e8', shade: '#d6e5f4', top: '#f7fbff' };

  /** Distant forest crowns poking up out of the haze. */
  function paintDistantCanopy() {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, 96);
    const random = createSeededRandom(321);
    const COLORS = { dark: '#5d8fa0', mid: '#6f9fae', light: '#86b3bd' };

    for (let x = 0; x < LAYER_WIDTH; x += 10 + Math.floor(random() * 14)) {
      const radius = 9 + random() * 14;
      const centerY = 50 + random() * 18;
      for (let dy = -radius; dy <= height; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const isCrown = dy < 0 ? Math.hypot(dx, dy) <= radius + Math.sin((x + dx) * 0.8) : Math.abs(dx) <= radius;
          if (!isCrown) continue;
          const light = dx / radius - (dy < 0 ? dy / radius : 0) * 0.5;
          let color = COLORS.mid;
          if (light > 0.55) color = COLORS.light;
          else if (light < -0.35 + ditherThreshold(x + dx, centerY + dy) * 0.2) color = COLORS.dark;
          plot(x + dx, centerY + dy, color);
        }
      }
    }
    return canvas;
  }

  /** A sea of cloud tops rolling below the branches. */
  function paintCloudSea() {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, 80);
    for (let x = 0; x < LAYER_WIDTH; x++) {
      // Billows: a row of overlapping bumps on top of a gentle swell
      const swell = ridgeOffset(x, [[4, 3, 0.4], [2, 7, 1.3]]);
      const bump = Math.abs(Math.sin((x / LAYER_WIDTH) * Math.PI * 2 * 18)) * 7;
      const top = Math.round(26 + swell - bump);
      for (let y = top; y < height; y++) {
        const depth = y - top;
        let color = '#ffffff';
        if (depth > 14) color = depth > 26 || ditherThreshold(x, y) < (depth - 14) / 12 ? '#dbe8f6' : '#eef4fb';
        else if (depth > 3) color = '#f4f8fd';
        plot(x, y, color);
      }
    }
    return canvas;
  }

  /** Leafy crowns of the giant tree right below, along the bottom of the screen. */
  function paintNearCanopy() {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, 64);
    const random = createSeededRandom(5150);
    const COLORS = { base: '#1f5a2c', dark: '#2a6e35', mid: '#3d8a3f', light: '#62ad4f', sun: '#93cf61' };

    for (let x = 0; x < LAYER_WIDTH; x++) {
      const top = Math.round(44 + ridgeOffset(x, [[3, 4, 0.2], [2, 11, 1.1]]));
      for (let y = top; y < height; y++) plot(x, y, COLORS.base);
    }
    for (let i = 0; i < 34; i++) {
      const clumpX = random() * LAYER_WIDTH;
      const radius = 6 + random() * 9;
      const clumpY = 40 + random() * 8;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius * 1.3; dx <= radius * 1.3; dx++) {
          if (Math.hypot(dx / 1.3, dy) > radius + Math.sin(dx * 1.9 + dy) * 1.2) continue;
          const light = (dx / (radius * 1.3)) * 0.4 - dy / radius;
          let color = COLORS.dark;
          if (light > 0.8) color = COLORS.sun;
          else if (light > 0.45) color = COLORS.light;
          else if (light > 0.05 + ditherThreshold(clumpX + dx, clumpY + dy) * 0.3) color = COLORS.mid;
          plot(clumpX + dx, clumpY + dy, color);
        }
      }
    }
    return canvas;
  }

  Forest.ThemePainters = {
    DUNGEON_SKY_COLORS,
    TREETOP_SKY_COLORS,
    WHITE_CLOUD_COLORS,
    FAR_CLOUD_COLORS,
    paintDungeonWall,
    paintDungeonPillars,
    paintTorchGlow,
    paintChains,
    paintRubble,
    paintDistantCanopy,
    paintCloudSea,
    paintNearCanopy
  };
})(window.Forest);
