/**
 * Procedural painters for the golden-hour parallax background:
 * dithered sky, sun, drifting clouds, distant mountains, pine ridge, rolling mist,
 * mid-forest canopy, god rays and undergrowth.
 *
 * Every layer is drawn at 1 canvas pixel = 1 game pixel. Layers that scroll are
 * LAYER_WIDTH pixels wide and wrap horizontally so they tile seamlessly.
 */
(function (Forest) {
  const { createPixelCanvas } = Forest.PixelCanvas;
  const { createSeededRandom } = Forest.MathUtils;

  const LAYER_WIDTH = 512;

  /** Sky gradient from the top of the screen down to the horizon glow. */
  const SKY_COLORS = ['#1a2c3d', '#223f4f', '#2e5560', '#3f6d68', '#5e8a6f', '#93a874', '#c9c27e', '#efd58b', '#fbe7a6'];

  // 4x4 Bayer matrix for ordered dithering between colour bands
  const BAYER_4X4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  /** Dither threshold in (0, 1) for a pixel; compare a blend amount against it to pick a colour. */
  function ditherThreshold(x, y) {
    return (BAYER_4X4[y & 3][x & 3] + 0.5) / 16;
  }

  /**
   * Canvas plus a `plot` function that wraps horizontally,
   * so shapes crossing the right edge reappear on the left.
   */
  function createWrappingCanvas(width, height) {
    const { canvas, ctx } = createPixelCanvas(width, height);
    const plot = (x, y, color) => {
      if (y < 0 || y >= height) return;
      ctx.fillStyle = color;
      ctx.fillRect(((Math.floor(x) % width) + width) % width, Math.floor(y), 1, 1);
    };
    return { canvas, ctx, plot, width, height };
  }

  /**
   * Height offset of a wavy ridge line at x. Built from whole-number sine frequencies,
   * so the ridge repeats exactly every LAYER_WIDTH pixels.
   * @param {Array<[number, number, number]>} waves list of [amplitude, frequency, phase]
   */
  function ridgeOffset(x, waves) {
    let offset = 0;
    for (const [amplitude, frequency, phase] of waves) {
      offset += amplitude * Math.sin((x / LAYER_WIDTH) * Math.PI * 2 * frequency + phase);
    }
    return offset;
  }

  // ------------------------------------------
  // Sky and sun (do not scroll)
  // ------------------------------------------

  /**
   * Narrow strip stretched across the screen; the top half is solid so tall screens stay covered.
   * @param {string[]} [colors] gradient from the top of the screen down to the horizon
   */
  function paintSky(colors = SKY_COLORS) {
    const { canvas, plot, height } = createWrappingCanvas(8, 512);
    const gradientStartY = 256;
    for (let y = 0; y < height; y++) {
      const position = Math.max(0, (y - gradientStartY) / (height - gradientStartY)) * (colors.length - 1);
      const band = Math.min(colors.length - 2, Math.floor(position));
      const blend = position - band;
      for (let x = 0; x < 8; x++) {
        plot(x, y, blend > ditherThreshold(x, y) ? colors[band + 1] : colors[band]);
      }
    }
    return canvas;
  }

  /** Sun disc with a soft, dithered halo. */
  function paintSun() {
    const size = 72;
    const { canvas, plot } = createWrappingCanvas(size, size);
    const center = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const distance = Math.hypot(x + 0.5 - center, y + 0.5 - center);
        if (distance < 9) plot(x, y, '#fffbe6');
        else if (distance < 11) plot(x, y, '#fff0b8');
        else if (distance < 14) plot(x, y, '#ffe49a');
        else if (distance < 16 && (x + y) % 2 === 0) plot(x, y, '#ffe49a');
      }
    }
    return canvas;
  }

  // ------------------------------------------
  // Scrolling layers, far to near
  // ------------------------------------------

  /** Warm golden-hour cloud colours: body, underside, lower shade, sunlit top. */
  const GOLDEN_CLOUD_COLORS = { body: '#f7e9bd', underside: '#c9b88e', shade: '#e2cf9f', top: '#fff6d8' };

  /**
   * Flat-bottomed puffy clouds made of overlapping half-discs.
   * @param {object} [options]
   * @param {number} [options.seed]
   * @param {number} [options.count] clouds across the layer
   * @param {{body:string, underside:string, shade:string, top:string}} [options.colors]
   * @param {number} [options.height] canvas height in pixels
   * @param {number} [options.sizeScale] multiplies cloud widths
   */
  function paintClouds({ seed = 7, count = 6, colors = GOLDEN_CLOUD_COLORS, height: canvasHeight = 64, sizeScale = 1 } = {}) {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, canvasHeight);
    const random = createSeededRandom(seed);
    const cloudCount = count;

    const clouds = [];
    for (let i = 0; i < cloudCount; i++) {
      clouds.push({
        left: i * (LAYER_WIDTH / cloudCount) + random() * 40,
        baseY: 14 + random() * (height - 30),
        width: (34 + random() * 50) * sizeScale
      });
    }

    clouds.forEach(cloud => {
      const puffCount = 3 + Math.floor(random() * 3);
      const puffs = [];
      for (let p = 0; p < puffCount; p++) {
        puffs.push({
          centerX: cloud.left + (p + 0.5) * (cloud.width / puffCount),
          radius: 5 + random() * (cloud.width / puffCount) * 0.55
        });
      }

      for (let x = Math.floor(cloud.left - 4); x < cloud.left + cloud.width + 4; x++) {
        // Highest point of any puff above this column
        let top = Infinity;
        puffs.forEach(({ centerX, radius }) => {
          const dx = x - centerX;
          if (Math.abs(dx) < radius) top = Math.min(top, cloud.baseY - Math.sqrt(radius * radius - dx * dx));
        });
        if (top === Infinity) continue;

        for (let y = Math.floor(top); y <= cloud.baseY; y++) {
          if (y >= height) break;
          let color = colors.body;
          if (y > cloud.baseY - 2) color = colors.underside;
          else if (y > cloud.baseY - 5) color = colors.shade;
          else if (y < top + 2) color = colors.top;
          plot(x, y, color);
        }
      }
    });
    return canvas;
  }

  function paintMountains() {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, 128);
    const waves = [[14, 2, 0.4], [9, 5, 1.9], [4, 11, 0.7], [2, 23, 2.2]];
    for (let x = 0; x < LAYER_WIDTH; x++) {
      const top = Math.round(56 + ridgeOffset(x, waves));
      const nextTop = Math.round(56 + ridgeOffset(x + 1, waves));
      const facesSun = nextTop > top; // slope going down to the right
      for (let y = top; y < height; y++) {
        // Atmospheric haze: lighter and warmer towards the base
        const haze = (y - top) / 60;
        let color = '#5f8879';
        if (haze > 0.66 + ditherThreshold(x, y) * 0.3) color = '#8aa98a';
        else if (haze > 0.25 + ditherThreshold(x, y) * 0.3) color = '#729a85';
        // Sunlit rim on slopes facing right, towards the sun
        if (y < top + 2 && facesSun) color = '#a9c19a';
        plot(x, y, color);
      }
    }
    return canvas;
  }

  const PINE_RIDGE_WAVES = [[5, 3, 1.1], [3, 7, 0.3]];

  function paintPines() {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, 128);
    const random = createSeededRandom(42);
    const bottomRow = height - 1;
    const ridgeTopAt = x => Math.round(86 + ridgeOffset(x, PINE_RIDGE_WAVES));

    // Low rolling ridge under the pines, dithering lighter further down
    for (let x = 0; x < LAYER_WIDTH; x++) {
      const top = ridgeTopAt(x);
      for (let y = top; y < height; y++) {
        const isLowerHaze = y > top + 18 && ditherThreshold(x, y) < (y - top - 18) / 30;
        plot(x, y, isLowerHaze ? '#5b8775' : '#477565');
      }
    }

    const trees = [];
    for (let x = 0; x < LAYER_WIDTH; x += 7 + Math.floor(random() * 9)) {
      trees.push({ x, height: 34 + random() * 46, widthRatio: 0.36 + random() * 0.12 });
    }
    trees.sort((a, b) => a.height - b.height); // short trees behind tall ones

    trees.forEach(tree => {
      const groundY = ridgeTopAt(tree.x) + 4;
      const tipY = groundY - tree.height;
      for (let y = Math.floor(tipY); y < groundY; y++) {
        const progress = (y - tipY) / tree.height; // 0 at the tip, 1 at the ground
        // Stepped tiers give a pixel-art pine silhouette
        const tierProgress = (progress * 5) % 1;
        const halfWidth = Math.max(0.5, progress * tree.height * tree.widthRatio * (0.75 + tierProgress * 0.35));
        const edge = Math.floor(halfWidth);
        for (let dx = -edge; dx <= edge; dx++) {
          let color = '#3a6656';
          if (dx > halfWidth * 0.35) color = '#335c4e';
          if (dx > 0 && dx === edge) color = '#5d8e72'; // sunlit right edge
          plot(tree.x + dx, y, color);
        }
      }
      // Trunk peeking out
      for (let y = groundY; y < Math.min(bottomRow, groundY + 3); y++) plot(tree.x, y, '#2f4c42');
    });
    return canvas;
  }

  function paintMist() {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, 32);
    for (let x = 0; x < LAYER_WIDTH; x++) {
      const top = 10 + ridgeOffset(x, [[4, 4, 0.2], [2.5, 9, 1.4], [1, 19, 0.6]]);
      for (let y = Math.floor(top); y < height; y++) {
        const depth = y - top;
        const isFeatheredEdge = depth >= 0 && (x + y) % 2 === 0;
        if (depth >= 2 || isFeatheredEdge) plot(x, y, depth > 6 ? '#e8edc8' : '#dfe6c0');
      }
    }
    return canvas;
  }

  function paintMidForest() {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, 128);
    const random = createSeededRandom(1337);
    const groundY = height - 10;

    // Forest floor strip
    for (let x = 0; x < LAYER_WIDTH; x++) {
      for (let y = groundY - 2; y < height; y++) plot(x, y, '#203b2f');
    }

    const trees = [];
    for (let x = 0; x < LAYER_WIDTH; x += 38 + Math.floor(random() * 34)) {
      trees.push({ x, trunkHalfWidth: 2 + Math.floor(random() * 3), canopyY: 52 + random() * 26, canopyRadius: 11 + random() * 8 });
    }

    trees.forEach(tree => {
      paintMidForestTrunk(plot, tree, groundY);
      paintMidForestCanopy(plot, tree);
    });
    return canvas;
  }

  /** Trunk with a lit right edge that flares out near the ground. */
  function paintMidForestTrunk(plot, tree, groundY) {
    for (let y = Math.floor(tree.canopyY); y < groundY; y++) {
      const flare = y > groundY - 6 ? groundY - 6 - y : 0; // negative: widens the trunk
      const left = -tree.trunkHalfWidth + flare;
      const right = tree.trunkHalfWidth - flare;
      for (let dx = left; dx <= right; dx++) {
        let color = '#2a3b33';
        if (dx >= right - 1) color = '#3d5144';
        else if (dx < left + 2) color = '#1c2b25';
        plot(tree.x + dx, y, color);
      }
    }
  }

  /** Canopy: a cluster of lumpy discs, lit from the upper right. */
  function paintMidForestCanopy(plot, tree) {
    const r = tree.canopyRadius;
    const blobs = [ // [offsetX, offsetY, radius]
      [0, 0, r],
      [-r * 0.8, r * 0.35, r * 0.7],
      [r * 0.85, r * 0.3, r * 0.72],
      [-r * 0.3, -r * 0.55, r * 0.65],
      [r * 0.4, -r * 0.4, r * 0.6]
    ];
    blobs.forEach(([offsetX, offsetY, blobRadius]) => {
      const centerX = tree.x + offsetX;
      const centerY = tree.canopyY + offsetY;
      for (let dy = -blobRadius; dy <= blobRadius; dy++) {
        for (let dx = -blobRadius; dx <= blobRadius; dx++) {
          const wobble = Math.sin((centerX + dx) * 0.9) * 1.2 + Math.cos((centerY + dy) * 1.3) * 0.8;
          if (Math.hypot(dx, dy) > blobRadius + wobble) continue;
          const normalX = dx / blobRadius;
          const normalY = dy / blobRadius;
          const light = normalX * 0.6 - normalY * 0.8; // sun from the upper right
          let color = '#2b5141';
          if (normalY > 0.45) color = '#213f33';
          else if (light > 0.75) color = '#5d8f62';
          else if (light > 0.35 + ditherThreshold(centerX + dx, centerY + dy) * 0.25) color = '#3c6a50';
          plot(centerX + dx, centerY + dy, color);
        }
      }
    });
  }

  /** Diagonal light shafts, quantised into three dithered alpha steps to stay pixel-crisp. */
  function paintGodRays() {
    const { canvas, ctx, width, height } = createWrappingCanvas(LAYER_WIDTH, 256);
    const random = createSeededRandom(99);
    const image = ctx.createImageData(width, height);
    const RAY_COLOR = [255, 232, 160];
    const slope = 0.45; // rays lean down-left, away from the sun

    const shafts = [];
    for (let i = 0; i < 5; i++) shafts.push({ x: i * (width / 5) + random() * 60, width: 8 + random() * 20 });

    for (let y = 0; y < height; y++) {
      const fadeTowardsGround = Math.pow(1 - y / height, 1.3);
      for (let x = 0; x < width; x++) {
        let strength = 0;
        shafts.forEach(shaft => {
          // Horizontal distance to the shaft's centre line, wrapped to [-width/2, width/2]
          let dx = (((x + y * slope - shaft.x) % width) + width) % width;
          if (dx > width / 2) dx -= width;
          const closeness = 1 - Math.abs(dx) / shaft.width;
          if (closeness > 0) strength = Math.max(strength, closeness);
        });

        const value = strength * fadeTowardsGround;
        let alpha = 0;
        if (value > 0.55) alpha = 1;
        else if (value > 0.25) alpha = 0.6;
        else if (value > 0.06 && ditherThreshold(x, y) < 0.5) alpha = 0.3;
        if (!alpha) continue;

        const index = (y * width + x) * 4;
        image.data[index] = RAY_COLOR[0];
        image.data[index + 1] = RAY_COLOR[1];
        image.data[index + 2] = RAY_COLOR[2];
        image.data[index + 3] = Math.round(alpha * 255);
      }
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  /** Dark foreground bushes and fern fronds. */
  function paintUndergrowth() {
    const { canvas, plot, height } = createWrappingCanvas(LAYER_WIDTH, 64);
    const random = createSeededRandom(2024);
    const COLORS = { base: '#18301f', dark: '#1d3a25', mid: '#2a4d2f', light: '#3e6b3e' };

    for (let x = 0; x < LAYER_WIDTH; x++) {
      const top = Math.round(40 + ridgeOffset(x, [[3, 6, 0.5], [2, 13, 1.7]]));
      for (let y = top; y < height; y++) plot(x, y, COLORS.base);
    }

    // Bushes: squashed discs, lit from above
    for (let i = 0; i < 26; i++) {
      const bushX = random() * LAYER_WIDTH;
      const radius = 6 + random() * 9;
      const bushY = 42 + random() * 4;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius * 1.4; dx <= radius * 1.4; dx++) {
          if (Math.hypot(dx / 1.4, dy) > radius + Math.sin(dx * 1.7) * 1.1) continue;
          const light = (dx / (radius * 1.4)) * 0.5 - dy / radius;
          let color = COLORS.dark;
          if (light > 0.7) color = COLORS.light;
          else if (light > 0.25 + ditherThreshold(bushX + dx, bushY + dy) * 0.3) color = COLORS.mid;
          plot(bushX + dx, bushY + dy, color);
        }
      }
    }

    // Fern fronds: leaning stalks with small leaflets every few pixels
    for (let i = 0; i < 40; i++) {
      const baseX = random() * LAYER_WIDTH;
      const frondHeight = 8 + random() * 12;
      const lean = (random() - 0.5) * 0.8;
      for (let step = 0; step < frondHeight; step++) {
        const x = baseX + lean * step;
        const y = 46 - step;
        plot(x, y, COLORS.mid);
        if (step % 3 === 0 && step > 2) {
          plot(x - 1, y + 1, COLORS.mid);
          plot(x + 1, y + 1, COLORS.light);
        }
      }
    }
    return canvas;
  }

  Forest.BackgroundPainters = {
    LAYER_WIDTH,
    SKY_COLORS,
    // Shared helpers for the other themes' painters (see themePainters.js)
    createWrappingCanvas,
    ditherThreshold,
    ridgeOffset,
    paintSky,
    paintSun,
    paintClouds,
    paintMountains,
    paintPines,
    paintMist,
    paintMidForest,
    paintGodRays,
    paintUndergrowth
  };
})(window.Forest);
