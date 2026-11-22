/**
 * Parallax background painters for the later worlds: desert, ice, volcano, candy and moon.
 * Same rules as the other painters: 1 canvas pixel = 1 game pixel, and scrolling layers are
 * LAYER_WIDTH wide and wrap horizontally.
 */
(function (Forest) {
  const { LAYER_WIDTH, createWrappingCanvas, ditherThreshold, ridgeOffset } = Forest.BackgroundPainters;
  const { createSeededRandom } = Forest.MathUtils;

  // ==========================================
  // Shared building blocks
  // ==========================================
  /**
   * Rolling silhouette: a wavy ridge filled down to the bottom, shaded lighter on slopes facing
   * the light (to the right), with an optional cap colour along the top (snow, sunlit sand).
   * @param {object} options
   * @param {number} options.height canvas height
   * @param {number} options.baseY average ridge height from the top of the canvas
   * @param {Array<[number, number, number]>} options.waves see ridgeOffset
   * @param {{body:string, shade:string, light:string, cap?:string}} options.colors
   * @param {number} [options.capDepth] pixels of cap colour along the ridge
   */
  function paintRidge({ height, baseY, waves, colors, capDepth = 0 }) {
    const { canvas, plot } = createWrappingCanvas(LAYER_WIDTH, height);
    for (let x = 0; x < LAYER_WIDTH; x++) {
      const top = Math.round(baseY + ridgeOffset(x, waves));
      const facesLight = ridgeOffset(x + 1, waves) > ridgeOffset(x, waves);
      for (let y = top; y < height; y++) {
        const depth = y - top;
        let color = colors.body;
        if (colors.cap && depth < capDepth + (x % 3 === 0 ? 1 : 0)) color = colors.cap;
        else if (facesLight && depth < 6) color = colors.light;
        else if (depth > 14 && ditherThreshold(x, y) < Math.min(1, (depth - 14) / 30)) color = colors.shade;
        plot(x, y, color);
      }
    }
    return canvas;
  }

  /** Scattered twinkling stars (a few bright crosses) on a transparent layer. */
  function paintStars({ height = 256, count = 140, seed = 3, colors = ['#ffffff', '#cfe3ff', '#fff3c4'] } = {}) {
    const { canvas, plot } = createWrappingCanvas(LAYER_WIDTH, height);
    const random = createSeededRandom(seed);
    for (let i = 0; i < count; i++) {
      const x = Math.floor(random() * LAYER_WIDTH);
      const y = Math.floor(random() * height);
      const color = colors[Math.floor(random() * colors.length)];
      plot(x, y, color);
      if (random() < 0.08) {
        plot(x - 1, y, color);
        plot(x + 1, y, color);
        plot(x, y - 1, color);
        plot(x, y + 1, color);
      }
    }
    return canvas;
  }

  /** A big round disc with simple shading, used for suns, planets and moons (does not scroll). */
  function paintDisc({ size, colors, craters = [] }) {
    const { canvas, plot } = createWrappingCanvas(size, size);
    const center = size / 2;
    const radius = size / 2 - 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x + 0.5 - center;
        const dy = y + 0.5 - center;
        const distance = Math.hypot(dx, dy);
        if (distance > radius) continue;
        const light = (-dx - dy) / radius; // lit from the upper left
        let color = colors.mid;
        if (light > 0.55) color = colors.light;
        else if (light < -0.45 + ditherThreshold(x, y) * 0.3) color = colors.dark;
        plot(x, y, color);
      }
    }
    craters.forEach(([cx, cy, r, color]) => {
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          if (Math.hypot(x, y) <= r && Math.hypot(cx + x - center, cy + y - center) < radius) plot(cx + x, cy + y, color);
        }
      }
    });
    return canvas;
  }

  // ==========================================
  // Desert
  // ==========================================
  const DESERT_SKY_COLORS = ['#2b78c9', '#3a88d2', '#4d98d8', '#64a8dc', '#80b8dc', '#a1c8d6', '#c4d6c6', '#e4dfb0', '#f8e6a4'];

  function paintMesas() {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, 128);
    const random = createSeededRandom(17);
    const COLORS = { top: '#e8a36a', face: '#c9784a', shade: '#a65c3a', band: '#b86a42' };
    for (let x = 0; x < LAYER_WIDTH; x += 70 + Math.floor(random() * 60)) {
      const width = 40 + Math.floor(random() * 50);
      const top = 50 + Math.floor(random() * 30);
      for (let dx = -4; dx < width + 4; dx++) {
        // Flat top, then sloping scree towards the base
        const slope = dx < 0 ? -dx * 6 : (dx >= width ? (dx - width + 1) * 6 : 0);
        for (let y = top + slope; y < height; y++) {
          let color = COLORS.face;
          if (y < top + slope + 2) color = COLORS.top;
          else if (dx > width * 0.7) color = COLORS.shade;
          if ((y - top) % 14 === 7 && dx >= 0 && dx < width) color = COLORS.band;
          plot(x + dx, y, color);
        }
      }
    }
    return canvas;
  }

  function paintPyramids() {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, 96);
    const COLORS = { lit: '#f2c27c', shade: '#c9935a', line: '#b07c48' };
    [[90, 40], [250, 30], [400, 46]].forEach(([centerX, halfWidth]) => {
      const top = height - halfWidth - 8;
      for (let y = top; y < height; y++) {
        const half = y - top;
        for (let dx = -half; dx <= half; dx++) {
          let color = dx < 0 ? COLORS.lit : COLORS.shade;
          if ((y - top) % 5 === 0) color = COLORS.line;
          plot(centerX + dx, y, color);
        }
      }
    });
    return canvas;
  }

  function paintNearDunes() {
    return paintRidge({
      height: 64, baseY: 40, waves: [[5, 2, 0.3], [3, 5, 1.7], [1, 13, 0.5]],
      colors: { body: '#d9a35c', shade: '#c38c48', light: '#ecc07a', cap: '#f6d89a' }, capDepth: 1
    });
  }

  function paintFarDunes() {
    return paintRidge({
      height: 96, baseY: 56, waves: [[8, 3, 1.1], [4, 7, 0.2]],
      colors: { body: '#e8be7c', shade: '#ddb06c', light: '#f3d394' }
    });
  }

  function paintCactusRow() {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, 64);
    const random = createSeededRandom(77);
    const COLORS = { body: '#3f7a3a', light: '#5f9e4c', dark: '#2c5a2b' };
    for (let x = 10; x < LAYER_WIDTH; x += 40 + Math.floor(random() * 60)) {
      const trunkHeight = 22 + Math.floor(random() * 20);
      const bottom = height - 2;
      const drawColumn = (cx, fromY, toY) => {
        for (let y = fromY; y < toY; y++) {
          for (let dx = -2; dx <= 2; dx++) plot(cx + dx, y, dx === -2 ? COLORS.dark : (dx === 1 ? COLORS.light : COLORS.body));
        }
      };
      drawColumn(x, bottom - trunkHeight, bottom);
      // Two arms bending upwards
      const armY = bottom - trunkHeight + 8 + Math.floor(random() * 6);
      for (let dx = 3; dx < 7; dx++) for (let dy = 0; dy < 3; dy++) plot(x + dx, armY + dy, COLORS.body);
      drawColumn(x + 7, armY - 8, armY + 3);
      for (let dx = -6; dx < -2; dx++) for (let dy = 0; dy < 3; dy++) plot(x + dx, armY + 6 + dy, COLORS.body);
      drawColumn(x - 7, armY - 2, armY + 9);
    }
    return canvas;
  }

  // ==========================================
  // Ice (night)
  // ==========================================
  const ICE_SKY_COLORS = ['#040918', '#071027', '#0b1834', '#102341', '#16304f', '#1d3f5c', '#264f68', '#305f72', '#3b707c'];

  /** Curtains of aurora light, drawn additively. */
  function paintAurora() {
    const { canvas, ctx, width, height } = createWrappingCanvas(LAYER_WIDTH, 128);
    const image = ctx.createImageData(width, height);
    for (let x = 0; x < width; x++) {
      const curtainTop = 20 + ridgeOffset(x, [[10, 3, 0.4], [6, 7, 2.1]]);
      const strength = 0.5 + 0.5 * Math.sin((x / width) * Math.PI * 2 * 4 + 1.2);
      for (let y = Math.floor(curtainTop); y < height; y++) {
        const fade = 1 - (y - curtainTop) / 70;
        const value = fade * strength;
        let alpha = 0;
        if (value > 0.6) alpha = 0.9;
        else if (value > 0.3) alpha = 0.5;
        else if (value > 0.08 && ditherThreshold(x, y) < 0.5) alpha = 0.3;
        if (!alpha) continue;
        const isPurple = (x / width) * 4 % 1 > 0.7;
        const index = (y * width + x) * 4;
        image.data[index] = isPurple ? 170 : 60;
        image.data[index + 1] = isPurple ? 90 : 255;
        image.data[index + 2] = isPurple ? 255 : 160;
        image.data[index + 3] = Math.round(alpha * 255);
      }
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  function paintIcePeaks() {
    return paintRidge({
      height: 128, baseY: 52, waves: [[18, 3, 0.9], [9, 7, 0.1], [4, 17, 1.6]],
      colors: { body: '#3c5f86', shade: '#2f4c70', light: '#6d94bb', cap: '#e6f2ff' }, capDepth: 6
    });
  }

  function paintSnowyPines() {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, 96);
    const random = createSeededRandom(909);
    for (let x = 0; x < LAYER_WIDTH; x++) for (let y = height - 10; y < height; y++) plot(x, y, '#d8e6f5');
    for (let x = 0; x < LAYER_WIDTH; x += 9 + Math.floor(random() * 10)) {
      const treeHeight = 30 + random() * 40;
      const groundY = height - 8;
      const tipY = groundY - treeHeight;
      for (let y = Math.floor(tipY); y < groundY; y++) {
        const progress = (y - tipY) / treeHeight;
        const tier = (progress * 4) % 1;
        const halfWidth = Math.max(0.5, progress * treeHeight * 0.32 * (0.7 + tier * 0.4));
        const edge = Math.floor(halfWidth);
        for (let dx = -edge; dx <= edge; dx++) {
          const isSnow = tier < 0.25 && Math.abs(dx) < edge;
          plot(x + dx, y, isSnow ? '#eef6ff' : (dx > halfWidth * 0.3 ? '#173a3a' : '#1f4a46'));
        }
      }
    }
    return canvas;
  }

  function paintSnowDrifts() {
    return paintRidge({
      height: 64, baseY: 44, waves: [[3, 4, 0.7], [2, 9, 2.3]],
      colors: { body: '#cddff2', shade: '#b4cae3', light: '#f2f8ff', cap: '#ffffff' }, capDepth: 2
    });
  }

  // ==========================================
  // Volcano
  // ==========================================
  const VOLCANO_SKY_COLORS = ['#140404', '#220806', '#330c07', '#461209', '#5c170a', '#741d0b', '#8e250c', '#ab300e', '#c74010'];

  /** A smoking volcano with glowing lava streams down its sides. */
  function paintVolcano() {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, 160);
    const COLORS = { rock: '#2b1512', shade: '#1e0e0c', lit: '#4a2219', lava: '#ff6a1f', lavaHot: '#ffd25e' };
    [[150, 60], [400, 40]].forEach(([centerX, craterTop]) => {
      for (let y = craterTop; y < height; y++) {
        const half = 14 + (y - craterTop) * 1.25;
        for (let dx = -Math.floor(half); dx <= half; dx++) {
          let color = dx < -half * 0.3 ? COLORS.shade : (dx > half * 0.5 ? COLORS.lit : COLORS.rock);
          // Lava rivers snaking down
          const river1 = Math.round(Math.sin(y * 0.15) * 3 - (y - craterTop) * 0.35);
          const river2 = Math.round(Math.sin(y * 0.12 + 2) * 3 + (y - craterTop) * 0.45);
          if (dx === river1 || dx === river2) color = COLORS.lava;
          if (y < craterTop + 4 && Math.abs(dx) < 10) color = COLORS.lavaHot;
          plot(centerX + dx, y, color);
        }
      }
    });
    return canvas;
  }

  const ASH_CLOUD_COLORS = { body: '#3a2a28', underside: '#7a3a1e', shade: '#4a3230', top: '#55403c' };

  function paintBasaltColumns() {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, 128);
    const random = createSeededRandom(4040);
    for (let x = 0; x < LAYER_WIDTH; x += 6 + Math.floor(random() * 4)) {
      const top = 60 + Math.floor(Math.abs(ridgeOffset(x, [[20, 3, 0.5], [10, 8, 1.1]])) + random() * 10);
      for (let y = top; y < height; y++) {
        for (let dx = 0; dx < 6; dx++) {
          let color = dx === 0 ? '#120808' : (dx === 5 ? '#3a1d17' : '#24110e');
          if (y < top + 2) color = '#4d2a20';
          plot(x + dx, y, color);
        }
      }
    }
    return canvas;
  }

  /** Molten glow along the bottom of the screen (additive). */
  function paintLavaGlow() {
    const { canvas, ctx, width, height } = createWrappingCanvas(LAYER_WIDTH, 96);
    const image = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const value = (y / height) * (0.75 + 0.25 * Math.sin(x * 0.05));
        let alpha = 0;
        if (value > 0.7) alpha = 0.8;
        else if (value > 0.45) alpha = 0.5;
        else if (value > 0.2 && ditherThreshold(x, y) < 0.5) alpha = 0.3;
        if (!alpha) continue;
        const index = (y * width + x) * 4;
        image.data[index] = 255;
        image.data[index + 1] = 90;
        image.data[index + 2] = 20;
        image.data[index + 3] = Math.round(alpha * 255);
      }
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  function paintVolcanicRocks() {
    return paintRidge({
      height: 64, baseY: 42, waves: [[4, 5, 0.3], [3, 11, 1.4], [1, 29, 0.2]],
      colors: { body: '#160b0a', shade: '#0d0606', light: '#2d1612', cap: '#ff7a2a' }, capDepth: 1
    });
  }

  // ==========================================
  // Candy
  // ==========================================
  const CANDY_SKY_COLORS = ['#b99cff', '#c6a6ff', '#d3b0fb', '#e0b9f5', '#ecc1ee', '#f6c9e6', '#fdd2e0', '#ffdcdc', '#ffe8d8'];
  const COTTON_CANDY_COLORS = { body: '#ffd1ec', underside: '#d7a6f0', shade: '#f2b8e6', top: '#fff0fa' };

  function paintCandyHills() {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, 112);
    const waves = [[10, 3, 0.2], [6, 7, 1.9]];
    for (let x = 0; x < LAYER_WIDTH; x++) {
      const top = Math.round(56 + ridgeOffset(x, waves));
      for (let y = top; y < height; y++) {
        // Diagonal candy stripes, mint and pink
        const stripe = Math.floor((x + y) / 8) % 2 === 0;
        let color = stripe ? '#9ff0d0' : '#ffb3d1';
        if (y < top + 3) color = '#fffaf0';
        plot(x, y, color);
      }
    }
    return canvas;
  }

  function paintLollipops() {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, 128);
    const random = createSeededRandom(1234);
    const SWIRLS = [['#ff5fa2', '#fff2f8'], ['#5fc8ff', '#f0fbff'], ['#ffd23f', '#fffbe6'], ['#7ee081', '#f2fff2']];
    for (let x = 20; x < LAYER_WIDTH; x += 50 + Math.floor(random() * 40)) {
      const radius = 10 + Math.floor(random() * 8);
      const centerY = 40 + Math.floor(random() * 30);
      const [a, b] = SWIRLS[Math.floor(random() * SWIRLS.length)];
      for (let y = centerY; y < height; y++) plot(x, y, '#fff8f0'); // stick
      for (let y = centerY; y < height; y++) plot(x + 1, y, '#e6d8cc');
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const distance = Math.hypot(dx, dy);
          if (distance > radius) continue;
          const angle = Math.atan2(dy, dx);
          const swirl = Math.floor((angle / (Math.PI * 2)) * 6 + distance / 3.5) % 2 === 0;
          plot(x + dx, centerY + dy, distance > radius - 1 ? b : (swirl ? a : b));
        }
      }
    }
    return canvas;
  }

  function paintGumdrops() {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, 64);
    const random = createSeededRandom(5555);
    const COLORS = ['#ff6fae', '#7fd6ff', '#ffe066', '#9af08f', '#c79bff'];
    for (let x = 0; x < LAYER_WIDTH; x++) for (let y = 50; y < height; y++) plot(x, y, '#7a3f26');
    for (let x = 0; x < LAYER_WIDTH; x++) plot(x, 50, '#a35c3a');
    for (let x = 4; x < LAYER_WIDTH; x += 14 + Math.floor(random() * 12)) {
      const color = COLORS[Math.floor(random() * COLORS.length)];
      const radius = 6 + Math.floor(random() * 4);
      for (let dy = -radius; dy <= 0; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.hypot(dx, dy * 1.2) > radius) continue;
          const isShine = dx < -radius * 0.3 && dy < -radius * 0.4;
          plot(x + dx, 50 + dy, isShine ? '#ffffff' : color);
        }
      }
    }
    return canvas;
  }

  // ==========================================
  // Moon
  // ==========================================
  const SPACE_SKY_COLORS = ['#000000', '#020208', '#04040e', '#070714', '#0a0a1a', '#0d0d20', '#111126', '#15152c', '#191932'];

  /** Faint purple nebula clouds (additive). */
  function paintNebula() {
    const { canvas, ctx, width, height } = createWrappingCanvas(LAYER_WIDTH, 192);
    const image = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const value = 0.5 + 0.3 * Math.sin((x / width) * Math.PI * 2 * 2 + y * 0.03) + 0.2 * Math.sin((x / width) * Math.PI * 2 * 5 - y * 0.05);
        let alpha = 0;
        if (value > 0.85) alpha = 0.45;
        else if (value > 0.7 && ditherThreshold(x, y) < 0.5) alpha = 0.3;
        if (!alpha) continue;
        const index = (y * width + x) * 4;
        const isPink = Math.sin(x * 0.01 + y * 0.02) > 0.3;
        image.data[index] = isPink ? 200 : 110;
        image.data[index + 1] = isPink ? 80 : 70;
        image.data[index + 2] = 220;
        image.data[index + 3] = Math.round(alpha * 255);
      }
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  /** Grey lunar hills pocked with craters. */
  function paintMoonHills({ height, baseY, waves, colors, seed }) {
    const canvas = paintRidge({ height, baseY, waves, colors });
    const ctx = canvas.getContext('2d');
    const random = createSeededRandom(seed);
    for (let i = 0; i < 24; i++) {
      const x = Math.floor(random() * LAYER_WIDTH);
      const y = Math.floor(baseY + 10 + random() * (height - baseY - 14));
      const radius = 2 + Math.floor(random() * 5);
      ctx.fillStyle = colors.shade;
      ctx.fillRect(x - radius, y, radius * 2, 2);
      ctx.fillStyle = colors.light;
      ctx.fillRect(x - radius, y + 2, radius * 2, 1);
    }
    return canvas;
  }

  Forest.WorldPainters = {
    paintStars,
    paintDisc,
    // Desert
    DESERT_SKY_COLORS,
    paintMesas,
    paintPyramids,
    paintFarDunes,
    paintNearDunes,
    paintCactusRow,
    // Ice
    ICE_SKY_COLORS,
    paintAurora,
    paintIcePeaks,
    paintSnowyPines,
    paintSnowDrifts,
    // Volcano
    VOLCANO_SKY_COLORS,
    ASH_CLOUD_COLORS,
    paintVolcano,
    paintBasaltColumns,
    paintLavaGlow,
    paintVolcanicRocks,
    // Candy
    CANDY_SKY_COLORS,
    COTTON_CANDY_COLORS,
    paintCandyHills,
    paintLollipops,
    paintGumdrops,
    // Moon
    SPACE_SKY_COLORS,
    paintNebula,
    paintMoonHills
  };
})(window.Forest);
