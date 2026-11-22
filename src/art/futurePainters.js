/**
 * Parallax backgrounds for the eight future-meets-fantasy worlds: neon spell city, circuit crystal
 * caves, clockwork sky citadel, techno-Atlantis, holo fae garden, mech dragon keep, quantum rift and
 * the starwizard station. Same rules as the other painters: 1 canvas pixel = 1 game pixel, and
 * scrolling layers are LAYER_WIDTH wide and wrap horizontally.
 *
 * Ends by publishing Forest.FutureThemes: the layer recipes ParallaxBackground merges into its own.
 */
(function (Forest) {
  const Painters = Forest.BackgroundPainters;
  const World = Forest.WorldPainters;
  const { LAYER_WIDTH, createWrappingCanvas, ditherThreshold } = Painters;
  const { paintRidge, paintStars, paintDisc } = World;
  const { createSeededRandom } = Forest.MathUtils;

  /** Repeatable pseudo-noise in [0, 1) for a pair of numbers. */
  function hash2(a, b) {
    const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return value - Math.floor(value);
  }

  /** "#rrggbb" to [r, g, b]. */
  function toRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // ==========================================
  // Shared building blocks
  // ==========================================
  /**
   * Soft additive glow rising from the bottom (or hanging from the top) of the layer.
   * @param {{height?:number, color:string, fromTop?:boolean, ripple?:number}} options
   */
  function paintGlow({ height = 96, color, fromTop = false, ripple = 0.05 }) {
    const { canvas, ctx, width } = createWrappingCanvas(LAYER_WIDTH, height);
    const image = ctx.createImageData(width, height);
    const [r, g, b] = toRgb(color);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const along = fromTop ? 1 - y / height : y / height;
        const value = along * (0.75 + 0.25 * Math.sin((x / width) * Math.PI * 2 * 9 + y * ripple));
        let alpha = 0;
        if (value > 0.72) alpha = 0.75;
        else if (value > 0.48) alpha = 0.45;
        else if (value > 0.22 && ditherThreshold(x, y) < 0.5) alpha = 0.25;
        if (!alpha) continue;
        const index = (y * width + x) * 4;
        image.data[index] = r;
        image.data[index + 1] = g;
        image.data[index + 2] = b;
        image.data[index + 3] = Math.round(alpha * 255);
      }
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  /**
   * A row of towers along the bottom: lit window grids, and on top a wizard spire with a glowing orb,
   * an antenna with a blinking light, or battlements.
   * @param {object} options
   * @param {number} options.seed
   * @param {number} options.height canvas height
   * @param {[number, number]} options.widths min and max tower width
   * @param {[number, number]} options.heights min and max tower height
   * @param {{body:string, edge:string, dark:string, windows:string[], spire?:string, orb?:string}} options.colors
   * @param {number} [options.litChance] share of windows lit
   * @param {number} [options.spireChance] share of towers with a pointed spire
   * @param {boolean} [options.battlements] castle crenellations instead of flat roofs
   * @param {number} [options.gapMax] widest gap between towers
   */
  function paintTowers({ seed, height, widths, heights, colors, litChance = 0.45, spireChance = 0.3, battlements = false, gapMax = 6 }) {
    const { canvas, plot } = createWrappingCanvas(LAYER_WIDTH, height);
    const random = createSeededRandom(seed);
    let x = 0;
    while (x < LAYER_WIDTH) {
      const width = widths[0] + Math.floor(random() * (widths[1] - widths[0]));
      const towerHeight = heights[0] + Math.floor(random() * (heights[1] - heights[0]));
      const top = height - towerHeight;
      const windowColor = colors.windows[Math.floor(random() * colors.windows.length)];
      for (let dx = 0; dx < width; dx++) {
        for (let y = top; y < height; y++) {
          let color = colors.body;
          if (dx === 0) color = colors.dark;
          else if (dx === width - 1) color = colors.edge;
          const column = dx - 2;
          const row = y - top - 3;
          const isWindow = dx > 1 && dx < width - 2 && column % 4 < 2 && row >= 0 && row % 5 < 2;
          if (isWindow) color = hash2(x * 3 + Math.floor(column / 4), seed + Math.floor(row / 5)) < litChance ? windowColor : colors.dark;
          plot(x + dx, y, color);
        }
        if (battlements && Math.floor(dx / 3) % 2 === 0) {
          for (let y = top - 3; y < top; y++) plot(x + dx, y, dx === width - 1 ? colors.edge : colors.body);
        }
      }
      if (!battlements) {
        const center = x + Math.floor(width / 2);
        if (colors.spire && random() < spireChance) {
          // Pointed wizard spire with a glowing orb at its tip
          const spireHeight = Math.floor(width * 0.9);
          for (let step = 0; step < spireHeight; step++) {
            const half = Math.floor((width / 2) * (1 - step / spireHeight));
            for (let dx = -half; dx <= half; dx++) plot(center + dx, top - 1 - step, dx > 0 ? colors.edge : colors.spire);
          }
          const orbY = top - spireHeight - 2;
          [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([ox, oy]) => plot(center + ox, orbY + oy, colors.orb || windowColor));
        } else if (random() < 0.5) {
          // Antenna with a light at the top
          const antenna = 4 + Math.floor(random() * 10);
          for (let y = top - antenna; y < top; y++) plot(center, y, colors.edge);
          plot(center, top - antenna - 1, colors.orb || windowColor);
        }
      }
      x += width + Math.floor(random() * gapMax);
    }
    return canvas;
  }

  /**
   * Toothed gears scattered across the layer (hollow between the spokes).
   * @param {{seed:number, height:number, count:number, radius:[number, number],
   *   colors:{body:string, dark:string, light:string}}} options
   */
  function paintGears({ seed, height, count, radius, colors }) {
    const { canvas, plot } = createWrappingCanvas(LAYER_WIDTH, height);
    const random = createSeededRandom(seed);
    for (let i = 0; i < count; i++) {
      const centerX = (i + random() * 0.6) * (LAYER_WIDTH / count);
      const r = radius[0] + random() * (radius[1] - radius[0]);
      const centerY = r + 4 + random() * Math.max(1, height - r * 2 - 8);
      const teeth = Math.max(6, Math.round(r * 0.7));
      const spokes = 4 + Math.floor(random() * 3);
      const turn = random() * Math.PI;
      for (let dy = -r - 3; dy <= r + 3; dy++) {
        for (let dx = -r - 3; dx <= r + 3; dx++) {
          const distance = Math.hypot(dx, dy);
          const angle = Math.atan2(dy, dx) + turn;
          const isTooth = Math.floor(((angle / (Math.PI * 2)) * teeth * 2 + 100)) % 2 === 0;
          if (distance > (isTooth ? r + 3 : r)) continue;
          if (distance < r * 0.22) continue; // axle hole
          const onSpoke = Math.abs(Math.sin((angle * spokes) / 2)) < 0.22;
          const isRim = distance > r - 4;
          const isHub = distance < r * 0.42;
          if (!isRim && !isHub && !onSpoke) continue;
          const light = (-dx - dy) / (r * 1.4);
          let color = colors.body;
          if (light > 0.35) color = colors.light;
          else if (light < -0.3 + ditherThreshold(centerX + dx, centerY + dy) * 0.2) color = colors.dark;
          plot(centerX + dx, centerY + dy, color);
        }
      }
    }
    return canvas;
  }

  /**
   * Crystal spikes growing up from the bottom (or hanging from the top) with a glowing core line.
   * @param {{seed:number, height:number, count:number, sizes:[number, number], fromTop?:boolean,
   *   colors:{body:string, light:string, dark:string, core:string}}} options
   */
  function paintCrystals({ seed, height, count, sizes, fromTop = false, colors }) {
    const { canvas, plot } = createWrappingCanvas(LAYER_WIDTH, height);
    const random = createSeededRandom(seed);
    for (let i = 0; i < count; i++) {
      const x = Math.floor(random() * LAYER_WIDTH);
      const length = sizes[0] + Math.floor(random() * (sizes[1] - sizes[0]));
      const halfWidth = Math.max(2, Math.floor(length * (0.12 + random() * 0.1)));
      const lean = (random() - 0.5) * 0.4;
      for (let step = 0; step < length; step++) {
        const progress = step / length; // 0 at the base, 1 at the tip
        const half = Math.max(0, Math.round(halfWidth * (progress < 0.75 ? 1 : (1 - progress) / 0.25)));
        const y = fromTop ? step : height - 1 - step;
        const shift = Math.round(lean * step);
        for (let dx = -half; dx <= half; dx++) {
          let color = dx < 0 ? colors.dark : colors.body;
          if (dx > half * 0.5) color = colors.light;
          if (dx === 0 && progress > 0.15 && progress < 0.85) color = colors.core;
          plot(x + dx + shift, y, color);
        }
      }
    }
    return canvas;
  }

  /** Glass domes on stilts with lit portholes (an underwater city). */
  function paintDomes({ seed, height, colors }) {
    const { canvas, plot } = createWrappingCanvas(LAYER_WIDTH, height);
    const random = createSeededRandom(seed);
    for (let x = 20; x < LAYER_WIDTH; x += 70 + Math.floor(random() * 50)) {
      const radius = 16 + Math.floor(random() * 18);
      const baseY = height - 10 - Math.floor(random() * 16);
      // Stilts down to the sea floor
      for (let y = baseY; y < height; y++) {
        [-radius + 4, 0, radius - 4].forEach(dx => { plot(x + dx, y, colors.frame); plot(x + dx + 1, y, colors.dark); });
      }
      for (let dy = -radius; dy <= 0; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const distance = Math.hypot(dx, dy);
          if (distance > radius) continue;
          let color = colors.glass;
          if (distance > radius - 2) color = colors.frame;
          else if (dy === -Math.floor(radius / 2) || dx % 9 === 0) color = colors.frame; // struts
          else if (dx < -radius * 0.3 && dy < -radius * 0.5) color = colors.shine;
          else if (hash2(x + Math.floor(dx / 3), Math.floor(dy / 3)) < 0.12) color = colors.light;
          plot(x + dx, baseY + dy, color);
        }
      }
      for (let dx = -radius - 2; dx <= radius + 2; dx++) plot(x + dx, baseY + 1, colors.dark);
    }
    return canvas;
  }

  /** Swaying strands of kelp rising from the sea floor. */
  function paintKelp({ seed, height, colors }) {
    const { canvas, plot } = createWrappingCanvas(LAYER_WIDTH, height);
    const random = createSeededRandom(seed);
    for (let x = 4; x < LAYER_WIDTH; x += 8 + Math.floor(random() * 14)) {
      const length = 20 + Math.floor(random() * (height - 24));
      const phase = random() * 6;
      for (let step = 0; step < length; step++) {
        const y = height - 1 - step;
        const sway = Math.round(Math.sin(step * 0.18 + phase) * 3);
        plot(x + sway, y, colors.body);
        plot(x + sway + 1, y, colors.light);
        if (step % 7 === 3) { plot(x + sway + 2, y, colors.body); plot(x + sway + 3, y - 1, colors.light); }
        if (step === length - 1 && random() < 0.5) plot(x + sway, y - 1, colors.glow);
      }
    }
    return canvas;
  }

  /** Giant glowing mushrooms with spotted caps. */
  function paintGiantShrooms({ seed, height, colors }) {
    const { canvas, plot } = createWrappingCanvas(LAYER_WIDTH, height);
    const random = createSeededRandom(seed);
    for (let x = 10; x < LAYER_WIDTH; x += 40 + Math.floor(random() * 50)) {
      const capRadius = 10 + Math.floor(random() * 14);
      const stemHeight = 24 + Math.floor(random() * (height - capRadius - 34));
      const capY = height - stemHeight;
      const cap = colors.caps[Math.floor(random() * colors.caps.length)];
      for (let y = capY; y < height; y++) {
        const half = 2 + Math.floor(capRadius * 0.15) + (y > height - 6 ? 2 : 0);
        for (let dx = -half; dx <= half; dx++) plot(x + dx, y, dx > half * 0.4 ? colors.stemLight : colors.stem);
      }
      for (let dy = -capRadius * 0.7; dy <= 2; dy++) {
        for (let dx = -capRadius; dx <= capRadius; dx++) {
          if (Math.hypot(dx / capRadius, dy / (capRadius * 0.7)) > 1) continue;
          let color = dy > 0 ? colors.gill : cap.body;
          if (dy <= 0 && dx > capRadius * 0.45) color = cap.dark;
          if (dy < 0 && hash2(x + Math.floor((dx + 40) / 4), Math.floor((dy + 40) / 3)) < 0.18) color = cap.spot;
          plot(x + dx, capY + dy, color);
        }
      }
    }
    return canvas;
  }

  /** Floating rocks with crystal-studded tops, hanging in the void. */
  function paintIslands({ seed, height, count, colors }) {
    const { canvas, plot } = createWrappingCanvas(LAYER_WIDTH, height);
    const random = createSeededRandom(seed);
    for (let i = 0; i < count; i++) {
      const x = (i + random() * 0.5) * (LAYER_WIDTH / count);
      const halfWidth = 10 + Math.floor(random() * 22);
      const topY = 12 + Math.floor(random() * (height - halfWidth * 1.6 - 16));
      const depth = Math.floor(halfWidth * 1.3);
      for (let dx = -halfWidth; dx <= halfWidth; dx++) {
        const across = 1 - Math.abs(dx) / halfWidth;
        const bottom = topY + Math.round(depth * Math.pow(across, 0.7));
        const top = topY - Math.round(2 * across);
        for (let y = top; y <= bottom; y++) {
          let color = dx > halfWidth * 0.3 ? colors.dark : colors.rock;
          if (y < top + 2) color = colors.top;
          else if (y > bottom - 3 && ditherThreshold(x + dx, y) < 0.5) color = colors.dark;
          plot(x + dx, y, color);
        }
        if (Math.abs(dx) < halfWidth - 3 && hash2(x, dx) < 0.12) {
          for (let k = 1; k < 3 + Math.floor(hash2(dx, x) * 4); k++) plot(x + dx, top - k, colors.crystal);
        }
      }
    }
    return canvas;
  }

  /** Steel trusses of a space station: a beam with X bracing and posts dropping down. */
  function paintTrusses({ height, beamY, colors }) {
    const { canvas, plot } = createWrappingCanvas(LAYER_WIDTH, height);
    const BAY = 32;
    for (let x = 0; x < LAYER_WIDTH; x++) {
      plot(x, beamY, colors.light);
      plot(x, beamY + 1, colors.body);
      plot(x, beamY + 12, colors.body);
      plot(x, beamY + 13, colors.dark);
      const inBay = x % BAY;
      const diagonal = Math.round((inBay / BAY) * 10);
      plot(x, beamY + 2 + diagonal, colors.body);
      plot(x, beamY + 12 - diagonal, colors.dark);
      if (x % (BAY * 4) < 4) for (let y = beamY + 14; y < height; y++) plot(x, y, x % (BAY * 4) < 2 ? colors.body : colors.dark);
      if (x % BAY === 0) for (let y = beamY; y < beamY + 14; y++) plot(x, y, colors.light);
      if (x % (BAY * 2) === 16) plot(x, beamY + 7, colors.lamp);
    }
    return canvas;
  }

  /** Glowing neon grid along the floor of the city. */
  function paintNeonGrid({ height, colors }) {
    const { canvas, plot } = createWrappingCanvas(LAYER_WIDTH, height);
    let row = 0;
    for (let y = 6, spacing = 2; y < height; y += spacing, spacing += 1, row++) {
      for (let x = 0; x < LAYER_WIDTH; x++) plot(x, y, row % 2 ? colors.line : colors.bright);
    }
    for (let x = 0; x < LAYER_WIDTH; x += 16) for (let y = 6; y < height; y++) plot(x, y, colors.line);
    return canvas;
  }

  /** Floating runes (little glowing glyphs) drifting through the air. */
  function paintRunes({ seed, height, count, colors }) {
    const { canvas, plot } = createWrappingCanvas(LAYER_WIDTH, height);
    const random = createSeededRandom(seed);
    const GLYPHS = [
      ['.#.', '###', '.#.', '#.#'],
      ['##.', '#.#', '##.', '#..'],
      ['#.#', '.#.', '#.#', '.#.'],
      ['###', '..#', '.#.', '#..'],
      ['.#.', '#.#', '###', '#.#']
    ];
    for (let i = 0; i < count; i++) {
      const glyph = GLYPHS[Math.floor(random() * GLYPHS.length)];
      const x = Math.floor(random() * LAYER_WIDTH);
      const y = Math.floor(random() * (height - 6));
      const color = colors[Math.floor(random() * colors.length)];
      glyph.forEach((line, gy) => [...line].forEach((cell, gx) => { if (cell === '#') plot(x + gx, y + gy, color); }));
    }
    return canvas;
  }

  /** A swirling portal ring, used as the "sun" of the quantum rift (does not scroll). */
  function paintPortal() {
    const size = 64;
    const { canvas, plot } = createWrappingCanvas(size, size);
    const center = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x + 0.5 - center;
        const dy = y + 0.5 - center;
        const distance = Math.hypot(dx, dy);
        if (distance > 30) continue;
        const swirl = Math.sin(Math.atan2(dy, dx) * 5 + distance * 0.4);
        if (distance < 9) plot(x, y, '#ffffff');
        else if (distance < 13) plot(x, y, '#f0c8ff');
        else if (distance < 22) { if (swirl > -0.2) plot(x, y, swirl > 0.5 ? '#c86bff' : '#7a2fd0'); }
        else if (swirl > 0.6 && ditherThreshold(x, y) < 0.5) plot(x, y, '#4a1a8a');
      }
    }
    return canvas;
  }

  /** A ringed gas giant seen from the station (does not scroll). */
  function paintRingedPlanet() {
    const planet = paintDisc({ size: 60, colors: { light: '#ffd9a8', mid: '#e89a5a', dark: '#a85a3a' }, craters: [] });
    const { canvas, ctx, plot } = createWrappingCanvas(96, 60);
    ctx.drawImage(planet, 18, 0);
    // Bands across the planet, then the ring over the front
    for (let y = 0; y < 60; y++) {
      for (let x = 18; x < 78; x++) {
        if (Math.hypot(x - 48, y - 30) > 27) continue;
        if (y % 9 === 4 || y % 13 === 0) plot(x, y, '#c9784a');
      }
    }
    for (let x = 0; x < 96; x++) {
      const t = (x - 48) / 46;
      if (Math.abs(t) > 1) continue;
      const ringY = Math.round(30 + t * 8);
      const isBehind = Math.abs(t) < 0.55 && ringY < 30;
      if (isBehind) continue;
      plot(x, ringY, '#fff1d0');
      plot(x, ringY + 1, '#d7b98a');
    }
    return canvas;
  }

  // ==========================================
  // Sky colours (top of the screen down to the horizon)
  // ==========================================
  const SKIES = {
    neon: ['#0b0420', '#130630', '#1d0a40', '#2a0d4f', '#3b105c', '#521467', '#6d1a6e', '#8c2170', '#b02b72'],
    crystal: ['#020a0e', '#041117', '#06181f', '#082027', '#0b2830', '#0e3139', '#123b42', '#17464c', '#1d5257'],
    clockwork: ['#3a2350', '#55305a', '#704060', '#8c5060', '#a8625c', '#c47756', '#d98e52', '#e8a852', '#f4c766'],
    atlantis: ['#010a1c', '#021228', '#031a34', '#052340', '#072c4c', '#093758', '#0c4263', '#104e6e', '#155b78'],
    fae: ['#0d0420', '#14072b', '#1b0b36', '#220f40', '#2a144a', '#331a52', '#3c215a', '#462962', '#51326a'],
    mechKeep: ['#1a0406', '#2a070a', '#3b0b0c', '#4d100e', '#601610', '#741d12', '#882614', '#9c3116', '#b03e18'],
    rift: ['#05000c', '#0a0118', '#100223', '#16042e', '#1d0639', '#250944', '#2d0c4f', '#360f5a', '#401365'],
    station: ['#000004', '#01010a', '#020310', '#030516', '#05071c', '#070a22', '#0a0d28', '#0d112e', '#111534']
  };

  // ==========================================
  // Layer recipes (see ParallaxBackground for what the options mean)
  // ==========================================
  const FutureThemes = {
    neon: {
      skyColors: SKIES.neon,
      clearColor: SKIES.neon[0],
      celestial: () => paintDisc({ size: 56, colors: { light: '#fff0a8', mid: '#ff7ad9', dark: '#c02c9a' } }),
      layers: () => [
        { canvas: paintStars({ seed: 21, count: 90, colors: ['#ffffff', '#ffc8f4'] }), follow: 0.99, bottomY: 0 },
        {
          canvas: paintTowers({ seed: 31, height: 160, widths: [14, 30], heights: [60, 140],
            colors: { body: '#241040', edge: '#3a1d5e', dark: '#160a2a', windows: ['#ff4fd8', '#4ff0ff', '#ffe066'], spire: '#2e1450', orb: '#b4ffef' },
            litChance: 0.35, spireChance: 0.35 }),
          follow: 0.88, bottomY: -1.0
        },
        { canvas: paintRunes({ seed: 5, height: 128, count: 40, colors: ['#4ff0ff', '#ff4fd8'] }), follow: 0.75, bottomY: 1.5, opacity: 0.6, additive: true, breathe: true },
        {
          canvas: paintTowers({ seed: 47, height: 128, widths: [18, 34], heights: [40, 110],
            colors: { body: '#130722', edge: '#ff4fd8', dark: '#0a0414', windows: ['#4ff0ff', '#ff9a3c'], spire: '#1c0a30', orb: '#ff4fd8' },
            litChance: 0.5, spireChance: 0.25, gapMax: 10 }),
          follow: 0.62, bottomY: -1.6
        },
        { canvas: paintNeonGrid({ height: 48, colors: { line: '#5a1a8a', bright: '#ff4fd8' } }), follow: 0.35, bottomY: -2.4, opacity: 0.8 }
      ],
      motes: { count: 26, colors: ['#4ff0ff', '#ff4fd8'], rise: 0.15 }
    },
    crystal: {
      skyColors: SKIES.crystal,
      clearColor: SKIES.crystal[0],
      hasSun: false,
      layers: () => [
        { canvas: paintCrystals({ seed: 3, height: 96, count: 34, sizes: [20, 70], fromTop: true, colors: { body: '#123a44', light: '#1d5a64', dark: '#0b2830', core: '#2fd8b8' } }), follow: 0.95, bottomY: 4.2 },
        { canvas: paintRidge({ height: 128, baseY: 64, waves: [[14, 3, 0.4], [7, 8, 1.7]], colors: { body: '#0e2a33', shade: '#0a2028', light: '#16404a' } }), follow: 0.88, bottomY: -1.4 },
        { canvas: paintCrystals({ seed: 9, height: 112, count: 26, sizes: [24, 90], colors: { body: '#2a8f8a', light: '#7fffd4', dark: '#16575a', core: '#e0fff6' } }), follow: 0.7, bottomY: -1.6 },
        { canvas: paintGlow({ height: 96, color: '#2fd8b8' }), follow: 0.6, bottomY: -2.6, opacity: 0.25, additive: true, breathe: true },
        { canvas: paintCrystals({ seed: 15, height: 64, count: 30, sizes: [12, 40], colors: { body: '#6a3fb0', light: '#c79bff', dark: '#3a1f6a', core: '#ffffff' } }), follow: 0.35, bottomY: -2.0 }
      ],
      motes: { count: 24, colors: ['#7fffd4', '#c79bff'], rise: 0.2 }
    },
    clockwork: {
      skyColors: SKIES.clockwork,
      clearColor: SKIES.clockwork[0],
      hasSun: true,
      layers: () => [
        { canvas: Painters.paintClouds({ seed: 61, count: 5, colors: { body: '#f2b97a', underside: '#b86a5a', shade: '#d9906a', top: '#ffe0a8' }, height: 80, sizeScale: 1.4 }), follow: 0.96, bottomY: 3.4, opacity: 0.9, drift: -6 },
        { canvas: paintGears({ seed: 7, height: 128, count: 5, radius: [14, 28], colors: { body: '#8a5a3a', dark: '#6a4030', light: '#a87048' } }), follow: 0.9, bottomY: 0.2, opacity: 0.8 },
        {
          canvas: paintTowers({ seed: 77, height: 144, widths: [16, 28], heights: [50, 120],
            colors: { body: '#7a4a28', edge: '#c8913a', dark: '#4a2c18', windows: ['#ffd25e', '#fff3a0'], spire: '#9a6a30', orb: '#ffe066' },
            litChance: 0.4, spireChance: 0.5, gapMax: 14 }),
          follow: 0.75, bottomY: -1.4
        },
        { canvas: paintGears({ seed: 19, height: 96, count: 7, radius: [8, 18], colors: { body: '#c8913a', dark: '#7a4f1d', light: '#f2c96b' } }), follow: 0.55, bottomY: -2.0 },
        { canvas: Painters.paintMist(), follow: 0.45, bottomY: -1.0, opacity: 0.3, windDrift: 7 }
      ],
      motes: { count: 22, colors: ['#ffd25e', '#ffffff'], rise: 0.3 }
    },
    atlantis: {
      skyColors: SKIES.atlantis,
      clearColor: SKIES.atlantis[0],
      hasSun: false,
      layers: () => [
        { canvas: paintGlow({ height: 160, color: '#5fd8ff', fromTop: true, ripple: 0.2 }), follow: 0.97, bottomY: 1.5, opacity: 0.18, additive: true, breathe: true },
        { canvas: paintRidge({ height: 112, baseY: 60, waves: [[10, 3, 0.9], [6, 7, 0.3]], colors: { body: '#0a3048', shade: '#08263a', light: '#10405a' } }), follow: 0.9, bottomY: -1.6 },
        { canvas: paintDomes({ seed: 13, height: 112, colors: { glass: '#0f5a74', frame: '#2a8fa8', dark: '#062436', shine: '#6fe0ff', light: '#ffe58a' } }), follow: 0.75, bottomY: -1.6 },
        { canvas: paintKelp({ seed: 17, height: 96, colors: { body: '#1f7a5a', light: '#3fb07a', glow: '#b4ffef' } }), follow: 0.55, bottomY: -1.8 },
        { canvas: paintRidge({ height: 64, baseY: 44, waves: [[3, 5, 0.3], [2, 13, 1.2]], colors: { body: '#d9c08a', shade: '#b8a070', light: '#f0dca8' } }), follow: 0.35, bottomY: -2.2 }
      ],
      motes: { count: 34, colors: ['#bff3ff', '#ffffff'], rise: 0.5 }
    },
    fae: {
      skyColors: SKIES.fae,
      clearColor: SKIES.fae[0],
      celestial: () => paintDisc({ size: 40, colors: { light: '#f6e8ff', mid: '#d6b8ff', dark: '#9a7ad8' }, craters: [[14, 15, 3, '#c4a6f0']] }),
      layers: () => [
        { canvas: paintStars({ seed: 44, count: 140, colors: ['#ffffff', '#d6b8ff', '#b4ffef'] }), follow: 0.99, bottomY: 0 },
        { canvas: paintRidge({ height: 128, baseY: 70, waves: [[12, 2, 0.4], [6, 6, 1.1]], colors: { body: '#2a1450', shade: '#1f0e3c', light: '#3a1f68' } }), follow: 0.9, bottomY: -1.6 },
        { canvas: paintGiantShrooms({ seed: 8, height: 128, colors: { stem: '#d8c8f0', stemLight: '#f4ecff', gill: '#8a6ab8', caps: [{ body: '#ff5fc8', dark: '#c02c9a', spot: '#ffe6f8' }, { body: '#4ff0ff', dark: '#1fa8c8', spot: '#e8ffff' }, { body: '#9af08f', dark: '#4fb05a', spot: '#f2fff2' }] } }), follow: 0.7, bottomY: -1.4 },
        { canvas: paintRunes({ seed: 12, height: 112, count: 30, colors: ['#6af0ff', '#ff9cf0'] }), follow: 0.6, bottomY: 1.0, opacity: 0.5, additive: true, breathe: true },
        { canvas: paintRidge({ height: 64, baseY: 42, waves: [[4, 5, 0.6], [2, 12, 2.0]], colors: { body: '#1c0f2e', shade: '#140a22', light: '#2e1a4a', cap: '#b48cff' }, capDepth: 1 }), follow: 0.35, bottomY: -2.2 }
      ],
      motes: { count: 36, colors: ['#b4ffef', '#ff9cf0'], rise: 0.1 }
    },
    mechKeep: {
      skyColors: SKIES.mechKeep,
      clearColor: SKIES.mechKeep[0],
      hasSun: false,
      layers: () => [
        { canvas: Painters.paintClouds({ seed: 71, count: 5, colors: { body: '#3a1214', underside: '#ff5a2a', shade: '#5a1a16', top: '#4a1618' }, height: 80, sizeScale: 1.5 }), follow: 0.96, bottomY: 3.6, opacity: 0.9, drift: -2 },
        { canvas: paintRidge({ height: 112, baseY: 60, waves: [[16, 2, 0.2], [8, 5, 1.4]], colors: { body: '#240a0c', shade: '#1a0608', light: '#3a1214' } }), follow: 0.9, bottomY: -1.4 },
        {
          canvas: paintTowers({ seed: 91, height: 160, widths: [18, 30], heights: [70, 150],
            colors: { body: '#3a3f4c', edge: '#6a7282', dark: '#22252e', windows: ['#ff3b3b', '#ffb347'] },
            litChance: 0.5, battlements: true, gapMax: 22 }),
          follow: 0.75, bottomY: -1.6
        },
        { canvas: paintGlow({ height: 96, color: '#ff4a1f' }), follow: 0.55, bottomY: -3.0, opacity: 0.3, additive: true, flicker: true },
        { canvas: paintRidge({ height: 64, baseY: 40, waves: [[4, 5, 0.3], [3, 11, 1.4]], colors: { body: '#1a1c22', shade: '#101216', light: '#2c3038', cap: '#ff3b3b' }, capDepth: 1 }), follow: 0.35, bottomY: -2.0 }
      ],
      motes: { count: 30, colors: ['#ff6a1f', '#ffd25e'], rise: 0.6 }
    },
    rift: {
      skyColors: SKIES.rift,
      clearColor: SKIES.rift[0],
      celestial: paintPortal,
      layers: () => [
        { canvas: paintStars({ seed: 66, count: 200, colors: ['#ffffff', '#c86bff', '#00f0ff'] }), follow: 0.995, bottomY: 0 },
        { canvas: World.paintNebula(), follow: 0.98, bottomY: -0.5, opacity: 0.55, additive: true, breathe: true },
        { canvas: paintIslands({ seed: 4, height: 128, count: 5, colors: { rock: '#2a1a3d', dark: '#1a0f28', top: '#7a4fb0', crystal: '#00f0ff' } }), follow: 0.85, bottomY: 0.4 },
        { canvas: paintIslands({ seed: 29, height: 112, count: 4, colors: { rock: '#3a2454', dark: '#22143a', top: '#c38cff', crystal: '#ff6bd8' } }), follow: 0.6, bottomY: -1.0 },
        { canvas: paintRunes({ seed: 30, height: 96, count: 26, colors: ['#00f0ff', '#c86bff'] }), follow: 0.45, bottomY: 0.5, opacity: 0.7, additive: true, breathe: true }
      ],
      motes: { count: 28, colors: ['#00f0ff', '#c86bff'], rise: -0.15 }
    },
    station: {
      skyColors: SKIES.station,
      clearColor: '#000000',
      celestial: paintRingedPlanet,
      layers: () => [
        { canvas: paintStars({ seed: 88, count: 240 }), follow: 0.995, bottomY: 0 },
        { canvas: World.paintNebula(), follow: 0.98, bottomY: 0.5, opacity: 0.35, additive: true },
        { canvas: paintTrusses({ height: 64, beamY: 8, colors: { body: '#5e6573', dark: '#3a404c', light: '#9aa3b2', lamp: '#4fc3ff' } }), follow: 0.8, bottomY: 4.5 },
        {
          canvas: paintTowers({ seed: 101, height: 112, widths: [22, 40], heights: [30, 80],
            colors: { body: '#3a404c', edge: '#9aa3b2', dark: '#22262e', windows: ['#4fc3ff', '#b4ffef', '#ffe066'], spire: '#5e6573', orb: '#c86bff' },
            litChance: 0.6, spireChance: 0.3, gapMax: 18 }),
          follow: 0.6, bottomY: -1.8
        },
        { canvas: paintRunes({ seed: 41, height: 80, count: 22, colors: ['#c86bff', '#4fc3ff'] }), follow: 0.45, bottomY: 1.0, opacity: 0.55, additive: true, breathe: true }
      ],
      motes: { count: 18, colors: ['#4fc3ff', '#ffffff'], rise: 0 }
    }
  };

  Forest.FutureThemes = FutureThemes;
})(window.Forest);
