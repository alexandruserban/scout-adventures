/**
 * Parallax backgrounds for the six strange worlds:
 *   noir        - an old black-and-white cartoon town with a grinning sun
 *   mothership  - inside an alien ship: portholes onto space, specimen pods, alarm lights
 *   rainbow     - giant rainbow arcs over a sea of clouds, webs hanging from the sky
 *   rising      - clouds, islands, houses and cows all floating upwards forever
 *   kitchen     - a giant's kitchen seen by someone very, very small
 *   concert     - an octopus rock band on stage, lights sweeping, crowd jumping to the beat
 *
 * Same rules as the other painters: 1 canvas pixel = 1 game pixel, and scrolling layers are
 * LAYER_WIDTH wide and wrap horizontally. Layers that rise (see ParallaxBackground's `rise`) are
 * 256 tall and also wrap vertically. Ends by publishing Forest.StrangeThemes, the layer recipes
 * ParallaxBackground merges into its own.
 */
(function (Forest) {
  const Painters = Forest.BackgroundPainters;
  const World = Forest.WorldPainters;
  const Theme = Forest.ThemePainters;
  const { LAYER_WIDTH, createWrappingCanvas, ditherThreshold } = Painters;
  const { paintStars, paintDisc } = World;
  const { createSeededRandom } = Forest.MathUtils;
  const { asciiToCanvas } = Forest.PixelCanvas;

  const RAINBOW = ['#ff4d4d', '#ff9a3c', '#ffe14d', '#5fe07a', '#4fb6ff', '#9a6bff'];

  // ==========================================
  // Shape helpers on a wrapping canvas
  // ==========================================
  function fillRect(plot, x, y, width, height, color) {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) plot(x + dx, y + dy, color);
    }
  }

  function fillEllipse(plot, cx, cy, rx, ry, colorAt) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const d = dx * dx + dy * dy;
        if (d <= 1) {
          const color = typeof colorAt === 'function' ? colorAt(x, y, Math.sqrt(d)) : colorAt;
          if (color) plot(x, y, color);
        }
      }
    }
  }

  /** Copy a small canvas onto a wrapping layer (pixel by pixel, so it wraps across the seam). */
  function stamp(target, source, left, top, scale = 1) {
    const ctx = source.getContext('2d');
    const { data } = ctx.getImageData(0, 0, source.width, source.height);
    for (let y = 0; y < source.height; y++) {
      for (let x = 0; x < source.width; x++) {
        const i = (y * source.width + x) * 4;
        if (data[i + 3] < 128) continue;
        const color = `rgb(${data[i]},${data[i + 1]},${data[i + 2]})`;
        fillRect(target.plot, left + x * scale, top + y * scale, scale, scale, color);
      }
    }
  }

  /** Additive light shafts fanning down from points along the top. */
  function paintBeams({ height, count, colors, spread = 0.35, width = 10, seed = 1 }) {
    const layer = createWrappingCanvas(LAYER_WIDTH, height);
    const random = createSeededRandom(seed);
    for (let i = 0; i < count; i++) {
      const originX = (i + 0.5) * (LAYER_WIDTH / count);
      const slope = (random() - 0.5) * 2 * spread;
      const color = colors[i % colors.length];
      for (let y = 0; y < height; y++) {
        const half = 1 + (y / height) * width;
        const centerX = originX + slope * y;
        for (let x = Math.floor(centerX - half); x <= centerX + half; x++) {
          const edge = Math.abs(x - centerX) / half;
          if (edge > 0.7 && ditherThreshold(x, y) < 0.5) continue;
          if (ditherThreshold(x, y) > 1 - y / height * 0.8) layer.plot(x, y, color);
        }
      }
    }
    return layer.canvas;
  }

  // ==========================================
  // Noir: the silent cartoon
  // ==========================================
  const NOIR_SKY_COLORS = ['#2a2a2a', '#3a3a3a', '#4a4a4a', '#5e5e5e', '#727272', '#888888', '#a0a0a0', '#bcbcbc', '#d8d8d8'];
  const GRAY_CLOUD_COLORS = { body: '#e8e8e8', underside: '#9a9a9a', shade: '#c8c8c8', top: '#ffffff' };

  /** A grinning cartoon sun, rays and all. */
  function paintGrinningSun() {
    const size = 64;
    const layer = createWrappingCanvas(size, size);
    const c = size / 2;
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      for (let r = 20; r < 30; r++) layer.plot(c + Math.cos(angle) * r, c + Math.sin(angle) * r, '#f0f0f0');
    }
    fillEllipse(layer.plot, c, c, 17, 17, (x, y, d) => (d > 0.88 ? '#111111' : '#ffffff'));
    fillEllipse(layer.plot, c - 6, c - 4, 2.5, 4, '#111111');
    fillEllipse(layer.plot, c + 6, c - 4, 2.5, 4, '#111111');
    for (let x = -9; x <= 9; x++) {
      const y = Math.round(c + 5 + Math.sqrt(Math.max(0, 81 - x * x)) * 0.5);
      layer.plot(c + x, y, '#111111');
      layer.plot(c + x, y + 1, '#111111');
    }
    return layer.canvas;
  }

  /** Old-town rooftops with lit windows. */
  function paintNoirTown() {
    const layer = createWrappingCanvas(LAYER_WIDTH, 128);
    const random = createSeededRandom(808);
    let x = 0;
    while (x < LAYER_WIDTH) {
      const width = 22 + Math.floor(random() * 26);
      const top = 40 + Math.floor(random() * 50);
      for (let dx = 0; dx < width; dx++) {
        for (let y = top; y < 128; y++) {
          const isEdge = dx === 0 || dx === width - 1 || y === top;
          const isWindow = !isEdge && dx % 6 >= 2 && dx % 6 <= 3 && (y - top) % 9 >= 3 && (y - top) % 9 <= 5;
          let color = '#5a5a5a';
          if (isEdge) color = '#1a1a1a';
          else if (isWindow) color = random() < 0.4 ? '#f0f0f0' : '#2a2a2a';
          layer.plot(x + dx, y, color);
        }
      }
      // A pointy roof on some
      if (random() < 0.5) {
        for (let r = 0; r < width / 2; r++) {
          for (let dx = r; dx < width - r; dx++) layer.plot(x + dx, top - r, r === Math.floor(width / 2) - 1 || dx === r || dx === width - r - 1 ? '#1a1a1a' : '#6a6a6a');
        }
      }
      x += width + Math.floor(random() * 10);
    }
    return layer.canvas;
  }

  /** Bendy rubber-hose cartoon trees on rolling hills, a few with sleepy faces. */
  function paintNoirTrees() {
    const layer = createWrappingCanvas(LAYER_WIDTH, 112);
    const random = createSeededRandom(4040);
    for (let x = 0; x < LAYER_WIDTH; x++) {
      const top = 84 + Math.round(Math.sin((x / LAYER_WIDTH) * Math.PI * 6) * 6);
      for (let y = top; y < 112; y++) layer.plot(x, y, y === top ? '#111111' : ((x + y) % 7 === 0 ? '#6a6a6a' : '#8a8a8a'));
    }
    for (let x = 10; x < LAYER_WIDTH; x += 46 + Math.floor(random() * 30)) {
      const ground = 84 + Math.round(Math.sin((x / LAYER_WIDTH) * Math.PI * 6) * 6);
      const height = 40 + Math.floor(random() * 20);
      const lean = (random() - 0.5) * 0.6;
      for (let y = 0; y < height; y++) {
        const bend = Math.sin((y / height) * Math.PI) * 6 * lean * 4;
        const cx = x + bend;
        layer.plot(cx - 2, ground - y, '#111111');
        layer.plot(cx - 1, ground - y, '#3a3a3a');
        layer.plot(cx, ground - y, '#3a3a3a');
        layer.plot(cx + 1, ground - y, '#111111');
      }
      const headX = x + Math.sin(Math.PI) * 6 * lean * 4;
      const headY = ground - height - 10;
      fillEllipse(layer.plot, headX, headY, 16, 13, (px, py, d) => (d > 0.9 ? '#111111' : ((px + py) % 5 === 0 ? '#9a9a9a' : '#bcbcbc')));
      if (random() < 0.6) {
        // Sleepy face
        for (let dx = -2; dx <= 2; dx++) {
          layer.plot(headX - 5 + dx, headY - 1, '#111111');
          layer.plot(headX + 5 + dx, headY - 1, '#111111');
        }
        for (let dx = -3; dx <= 3; dx++) layer.plot(headX + dx, headY + 5 + (Math.abs(dx) === 3 ? -1 : 0), '#111111');
      }
    }
    return layer.canvas;
  }

  function paintPicketFence() {
    const layer = createWrappingCanvas(LAYER_WIDTH, 40);
    for (let x = 0; x < LAYER_WIDTH; x++) {
      const post = x % 10;
      if (post < 6) {
        const top = post === 0 || post === 5 ? 14 : 12;
        for (let y = top; y < 40; y++) layer.plot(x, y, post === 0 || post === 5 || y === top ? '#111111' : '#f0f0f0');
      }
      if (x % 10 >= 6) {
        layer.plot(x, 20, '#111111');
        layer.plot(x, 21, '#e0e0e0');
        layer.plot(x, 22, '#111111');
        layer.plot(x, 30, '#111111');
        layer.plot(x, 31, '#e0e0e0');
        layer.plot(x, 32, '#111111');
      }
    }
    return layer.canvas;
  }

  // ==========================================
  // Mothership
  // ==========================================
  /** The hull wall with portholes cut through it (space and planets show through them). */
  function paintHullWall() {
    const height = 256;
    const layer = createWrappingCanvas(LAYER_WIDTH, height);
    const PORT_SPACING = 128;
    const PORT_Y = 120;
    const PORT_RADIUS = 30;
    for (let x = 0; x < LAYER_WIDTH; x++) {
      for (let y = 0; y < height; y++) {
        const px = x % PORT_SPACING - PORT_SPACING / 2;
        const r = Math.hypot(px, y - PORT_Y);
        if (r < PORT_RADIUS) continue; // see-through porthole
        let color = (x % 32 < 2) ? '#0e1416' : ((y % 48 < 2) ? '#0e1416' : '#1c2628');
        if (r < PORT_RADIUS + 3) color = '#5a7a80';
        else if (r < PORT_RADIUS + 6) color = '#2a383c';
        else if (x % 32 === 16 && y % 48 === 24) color = '#7dff9a'; // panel lights
        else if (y > height - 40 && (x + y) % 9 === 0) color = '#141c1e';
        layer.plot(x, y, color);
      }
    }
    return layer.canvas;
  }

  /** Cables and ribbed alien tubes hanging from the ceiling. */
  function paintCeilingTubes() {
    const layer = createWrappingCanvas(LAYER_WIDTH, 96);
    const random = createSeededRandom(77);
    for (let x = 0; x < LAYER_WIDTH; x++) for (let y = 0; y < 10; y++) layer.plot(x, y, y === 9 ? '#5a7a80' : '#141c1e');
    for (let i = 0; i < 18; i++) {
      const startX = random() * LAYER_WIDTH;
      const sag = 20 + random() * 60;
      const span = 30 + random() * 70;
      const color = random() < 0.3 ? '#3f7a2a' : '#2a383c';
      for (let t = 0; t <= span; t++) {
        const y = 10 + Math.sin((t / span) * Math.PI) * sag;
        layer.plot(startX + t, y, color);
        layer.plot(startX + t, y + 1, color);
        if (t % 6 === 0) layer.plot(startX + t, y + 2, '#0e1416');
      }
    }
    return layer.canvas;
  }

  /** Glowing specimen pods, each with something curled up inside. */
  function paintSpecimenPods() {
    const height = 112;
    const layer = createWrappingCanvas(LAYER_WIDTH, height);
    const random = createSeededRandom(2001);
    for (let x = 0; x < LAYER_WIDTH; x++) for (let y = height - 14; y < height; y++) layer.plot(x, y, y === height - 14 ? '#5a7a80' : '#141c1e');
    for (let x = 20; x < LAYER_WIDTH; x += 64 + Math.floor(random() * 20)) {
      const podHeight = 60 + Math.floor(random() * 20);
      const top = height - 14 - podHeight;
      const tint = random() < 0.5 ? ['#1f5a3a', '#3fbf6a', '#b4ffd8'] : ['#1f3a5a', '#3f8abf', '#b4e8ff'];
      for (let y = top; y < height - 14; y++) {
        for (let dx = -12; dx <= 12; dx++) {
          let color = tint[0];
          if (Math.abs(dx) >= 11) color = '#5a7a80';
          else if (dx === -8 || dx === -7) color = tint[2];
          else if ((y + Math.floor(dx * 1.5)) % 11 === 0) color = tint[1];
          layer.plot(x + dx, y, color);
        }
      }
      // The silhouette floating inside: a curled crawler or a big-headed alien
      if (random() < 0.5) {
        fillEllipse(layer.plot, x, top + podHeight * 0.45, 6, 8, '#0a1a10');
        fillEllipse(layer.plot, x - 2, top + podHeight * 0.4, 1.5, 2, '#ff3b6b');
        fillEllipse(layer.plot, x + 2, top + podHeight * 0.4, 1.5, 2, '#ff3b6b');
        fillRect(layer.plot, x - 2, top + podHeight * 0.55, 4, 14, '#0a1a10');
      } else {
        fillEllipse(layer.plot, x, top + podHeight * 0.5, 8, 5, '#0a1a10');
        for (let leg = -3; leg <= 3; leg++) fillRect(layer.plot, x + leg * 2, top + podHeight * 0.5 + 4, 1, 4, '#0a1a10');
      }
      fillRect(layer.plot, x - 13, top - 4, 27, 4, '#2a383c');
      fillRect(layer.plot, x - 13, height - 18, 27, 4, '#2a383c');
    }
    return layer.canvas;
  }

  function paintRedGlow() {
    const layer = createWrappingCanvas(LAYER_WIDTH, 96);
    for (let x = 0; x < LAYER_WIDTH; x++) {
      for (let y = 0; y < 96; y++) {
        const pulse = 0.5 + 0.5 * Math.sin((x / LAYER_WIDTH) * Math.PI * 2 * 4);
        if (ditherThreshold(x, y) < (1 - y / 96) * pulse * 0.9) layer.plot(x, y, '#ff2a3a');
      }
    }
    return layer.canvas;
  }

  // ==========================================
  // Rainbow
  // ==========================================
  const RAINBOW_SKY_COLORS = ['#8fd3ff', '#9ad8ff', '#a8ddff', '#b8e2ff', '#c8e6ff', '#d8e8ff', '#e8e6fb', '#f6e2f4', '#ffe0ee'];

  function paintRainbowArcs() {
    const height = 200;
    const layer = createWrappingCanvas(LAYER_WIDTH, height);
    [[128, 180, 7], [400, 150, 5]].forEach(([cx, radius, band]) => {
      for (let x = cx - radius - 2; x <= cx + radius + 2; x++) {
        for (let y = 0; y < height; y++) {
          const r = Math.hypot(x - cx, y - height);
          const index = Math.floor((radius - r) / band);
          if (index < 0 || index >= RAINBOW.length) continue;
          layer.plot(x, y, RAINBOW[index]);
        }
      }
    });
    return layer.canvas;
  }

  /** Big webs in the sky, each with a spider dangling on a thread. */
  function paintSkyWebs() {
    const height = 112;
    const layer = createWrappingCanvas(LAYER_WIDTH, height);
    const random = createSeededRandom(888);
    for (let i = 0; i < 4; i++) {
      const cx = i * 128 + 30 + random() * 60;
      const radius = 30 + random() * 16;
      for (let a = 0; a < 8; a++) {
        const angle = Math.PI * (a / 7);
        for (let r = 0; r < radius; r++) layer.plot(cx + Math.cos(angle) * r, Math.sin(angle) * r, '#ffffff');
      }
      for (let ring = 6; ring < radius; ring += 6) {
        for (let t = 0; t <= 1; t += 0.01) {
          const angle = Math.PI * t;
          layer.plot(cx + Math.cos(angle) * ring, Math.sin(angle) * ring * (0.95 + Math.sin(t * 40) * 0.05), '#f0f0ff');
        }
      }
      // A little spider hanging below
      const threadEnd = radius + 20 + random() * 40;
      for (let y = 0; y < threadEnd; y++) layer.plot(cx, y, '#ffffff');
      fillEllipse(layer.plot, cx, threadEnd + 3, 3, 3, '#2a1640');
      for (let leg = 0; leg < 4; leg++) {
        layer.plot(cx - 4, threadEnd + leg + 1, '#2a1640');
        layer.plot(cx + 4, threadEnd + leg + 1, '#2a1640');
      }
    }
    return layer.canvas;
  }

  // ==========================================
  // Rising: everything floats up (these layers are 256 tall and wrap vertically)
  // ==========================================
  const RISE_HEIGHT = 256;

  function paintRisingClouds() {
    const layer = createWrappingCanvas(LAYER_WIDTH, RISE_HEIGHT);
    const random = createSeededRandom(3131);
    for (let i = 0; i < 14; i++) {
      const cx = random() * LAYER_WIDTH;
      const cy = random() * RISE_HEIGHT;
      const width = 20 + random() * 30;
      for (let p = 0; p < 4; p++) {
        const px = cx + (p - 1.5) * width * 0.35;
        const r = width * (0.25 + random() * 0.15);
        fillEllipse(layer.plot, px, cy, r, r * 0.7, (x, y, d) => (y > cy + r * 0.3 ? '#dbe8f6' : '#ffffff'));
      }
    }
    return layer.canvas;
  }

  function paintRisingIslands() {
    const layer = createWrappingCanvas(LAYER_WIDTH, RISE_HEIGHT);
    const random = createSeededRandom(5150);
    for (let i = 0; i < 7; i++) {
      const cx = (i + random() * 0.6) * (LAYER_WIDTH / 7);
      const top = random() * RISE_HEIGHT;
      const width = 26 + random() * 24;
      const depth = width * 0.8;
      for (let dx = -width; dx <= width; dx++) {
        const bottom = top + depth * Math.sqrt(Math.max(0, 1 - (dx / width) ** 2));
        for (let y = top; y <= bottom; y++) {
          let color = '#5a7fa0';
          if (y < top + 3) color = '#8ac0a0';
          else if (dx > width * 0.3) color = '#4a6a8a';
          layer.plot(cx + dx, y, color);
        }
      }
      // A tiny tree on top
      fillRect(layer.plot, cx - 1, top - 8, 2, 8, '#4a6a8a');
      fillEllipse(layer.plot, cx, top - 10, 6, 5, '#6aa08a');
    }
    return layer.canvas;
  }

  /** Houses, trees, cows, cars and rocks drifting up into the sky. */
  function paintRisingThings() {
    const layer = createWrappingCanvas(LAYER_WIDTH, RISE_HEIGHT);
    const random = createSeededRandom(9999);
    const things = [
      // A little house
      () => asciiToCanvas([
        '....KK....',
        '...KrrK...',
        '..KrrrrK..',
        '.KrrrrrrK.',
        'KKKKKKKKKK',
        '.KwwwwwwK.',
        '.KwbwwbwK.',
        '.KwwwdwwK.',
        '.KwwwdwwK.',
        '.KKKKKKKK.'
      ], 1, { K: '#2a2a3a', r: '#d84a3a', w: '#f4e8d0', b: '#7ab8ff', d: '#7a4a2a' }),
      // A cow, very confused
      () => asciiToCanvas([
        '..........KK.',
        '.KKKKKKKKKwwK',
        'KwwKKwwwKwKwK',
        'KwKKKwwKKwwwK',
        'KwwwwwKKwwpp.',
        '.KKKKKKKKKK..',
        '.Kw.Kw.Kw.Kw.'
      ], 1, { K: '#1a1a1a', w: '#ffffff', p: '#ffb0c0' }),
      // A tree, roots and all
      () => asciiToCanvas([
        '..gggg..',
        '.gGgggg.',
        'ggggGggg',
        'gGgggggg',
        '.gggggg.',
        '...tt...',
        '...tt...',
        '..t..t..',
        '.t....t.'
      ], 1, { g: '#4a9a3a', G: '#7ed957', t: '#6a4a2a' }),
      // A red car
      () => asciiToCanvas([
        '...KKKKK....',
        '..KbbKbbK...',
        'KKKKKKKKKKKK',
        'KrrrrrrrrrrK',
        'KKKKKKKKKKKK',
        '.KoK....KoK.'
      ], 1, { K: '#1a1a2a', b: '#a8d8ff', r: '#e83a3a', o: '#4a4a5a' }),
      // A rock
      () => asciiToCanvas([
        '..KKKK..',
        '.KggggK.',
        'KgGggggK',
        'KggggggK',
        '.KKKKKK.'
      ], 1, { K: '#3a3440', g: '#8a8090', G: '#b0a8b8' })
    ].map(paint => paint());
    for (let i = 0; i < 16; i++) {
      const thing = things[i % things.length];
      stamp(layer, thing, Math.floor(random() * LAYER_WIDTH), Math.floor(random() * (RISE_HEIGHT - 12)), random() < 0.3 ? 2 : 1);
    }
    return layer.canvas;
  }

  function paintRisingSpecks() {
    const layer = createWrappingCanvas(LAYER_WIDTH, RISE_HEIGHT);
    const random = createSeededRandom(42);
    const colors = ['#ffffff', '#d8ffb0', '#fff7c2', '#7ed957'];
    for (let i = 0; i < 90; i++) {
      const x = random() * LAYER_WIDTH;
      const y = random() * RISE_HEIGHT;
      const color = colors[i % colors.length];
      // A short streak, as if rushing upwards
      for (let t = 0; t < 4; t++) layer.plot(x, y + t, color);
    }
    return layer.canvas;
  }

  // ==========================================
  // Kitchen: you are tiny
  // ==========================================
  const KITCHEN_SKY_COLORS = ['#f4efe6', '#f4efe6', '#f2ece2', '#f0e9de', '#eee6da', '#ece3d6', '#eae0d2', '#e8ddce', '#e6dacb'];

  /** Wall tiles the size of houses, a window full of sky and a curtain. */
  function paintKitchenWall() {
    const height = 256;
    const layer = createWrappingCanvas(LAYER_WIDTH, height);
    const TILE = 48;
    for (let x = 0; x < LAYER_WIDTH; x++) {
      for (let y = 0; y < height; y++) {
        const offset = Math.floor(y / TILE) % 2 ? TILE / 2 : 0;
        const isGrout = (x + offset) % TILE < 2 || y % TILE < 2;
        let color = isGrout ? '#c8c0b4' : '#f8f6f2';
        if (!isGrout && (x + offset) % TILE < 6 && y % TILE < 8) color = '#ffffff';
        layer.plot(x, y, color);
      }
    }
    // A window (sky, a cloud, and a checked curtain)
    const winX = 300;
    const winY = 30;
    for (let dx = 0; dx < 140; dx++) {
      for (let dy = 0; dy < 110; dy++) {
        let color = dy < 60 ? '#8fd3ff' : '#b8e2ff';
        if (dx < 6 || dx > 133 || dy < 6 || dy > 103 || Math.abs(dx - 70) < 3) color = '#ffffff';
        else if (dx < 40 && Math.floor(dx / 6 + dy / 6) % 2 === 0) color = '#ff6b6b';
        else if (dx < 40) color = '#ffffff';
        layer.plot(winX + dx, winY + dy, color);
      }
    }
    fillEllipse(layer.plot, winX + 95, winY + 35, 16, 7, '#ffffff');
    return layer.canvas;
  }

  /** Jars and bottles, each the height of a tower, on the far counter. */
  function paintGiantJars() {
    const height = 200;
    const layer = createWrappingCanvas(LAYER_WIDTH, height);
    const random = createSeededRandom(1717);
    const counterTop = height - 14;
    for (let x = 0; x < LAYER_WIDTH; x++) for (let y = counterTop; y < height; y++) layer.plot(x, y, y < counterTop + 3 ? '#e0dce4' : '#b4aebc');
    const kinds = ['jam', 'bottle', 'flour', 'pepper'];
    let x = 10;
    let i = 0;
    while (x < LAYER_WIDTH - 40) {
      const kind = kinds[i++ % kinds.length];
      if (kind === 'jam') {
        const w = 70;
        const h = 90;
        for (let dx = 0; dx < w; dx++) {
          for (let dy = 0; dy < h; dy++) {
            let color = dy < 14 ? (dy % 4 === 0 ? '#c8a020' : '#f0c838') : '#b0102a';
            if (dy >= 14 && (dx === 6 || dx === 7)) color = '#ff8a9a';
            if (dy >= 40 && dy < 64 && dx > 10 && dx < w - 10) color = dy === 40 || dy === 63 ? '#c8a020' : '#fff4dc';
            layer.plot(x + dx, counterTop - h + dy, color);
          }
        }
        fillEllipse(layer.plot, x + w / 2, counterTop - h + 52, 8, 7, '#d8203a'); // a strawberry on the label
        x += w + 18;
      } else if (kind === 'bottle') {
        const w = 44;
        const h = 170;
        for (let dy = 0; dy < h; dy++) {
          const neck = dy < 50 ? 8 + Math.min(14, Math.max(0, dy - 30) * 0.7) : w / 2;
          for (let dx = -neck; dx < neck; dx++) {
            let color = '#8aa83a';
            if (dy < 10) color = '#3a3a3a';
            else if (dx < -neck + 4) color = '#c8e08a';
            if (dy > 80 && dy < 120) color = dy === 80 || dy === 119 ? '#5a6a2a' : '#fff4dc';
            layer.plot(x + w / 2 + dx, counterTop - h + dy, color);
          }
        }
        x += w + 20;
      } else if (kind === 'flour') {
        const w = 80;
        const h = 120;
        for (let dx = 0; dx < w; dx++) {
          for (let dy = 0; dy < h; dy++) {
            let color = '#e8e4ec';
            if (dy < 12) color = '#9aa3b2';
            else if (dx < 8) color = '#ffffff';
            else if (dx > w - 10) color = '#c8c4cc';
            layer.plot(x + dx, counterTop - h + dy, color);
          }
        }
        x += w + 16;
      } else {
        const w = 30;
        const h = 110;
        for (let dx = 0; dx < w; dx++) {
          for (let dy = 0; dy < h; dy++) {
            let color = '#2a2a2a';
            if (dy < 20) color = (dx + dy) % 5 === 0 ? '#5a5a5a' : '#c8d0dc';
            else if (dx < 5) color = '#4a4a4a';
            layer.plot(x + dx, counterTop - h + dy, color);
          }
        }
        x += w + 24;
      }
      x += Math.floor(random() * 20);
    }
    return layer.canvas;
  }

  /** A chrome toaster and a kettle as big as buildings. */
  function paintToasterAndKettle() {
    const height = 160;
    const layer = createWrappingCanvas(LAYER_WIDTH, height);
    // Toaster
    const tx = 60;
    const tw = 130;
    const th = 90;
    for (let dx = 0; dx < tw; dx++) {
      for (let dy = 0; dy < th; dy++) {
        const corner = Math.min(dx, tw - 1 - dx) < 10 && dy < 10 && Math.hypot(10 - Math.min(dx, tw - 1 - dx), 10 - dy) > 10;
        if (corner) continue;
        let color = '#c8d0dc';
        if (dx < 12) color = '#ffffff';
        else if (dx > tw - 16) color = '#7a8494';
        if ((dy === 2 || dy === 3) && ((dx > 20 && dx < 55) || (dx > 75 && dx < 110))) color = '#1a1a20';
        if (dy > th - 8) color = '#3a3a44';
        layer.plot(tx + dx, height - th + dy, color);
      }
    }
    fillRect(layer.plot, tx + tw - 2, height - 50, 12, 6, '#1a1a20'); // the lever
    // Kettle
    const kx = 320;
    fillEllipse(layer.plot, kx, height - 50, 60, 50, (x, y, d) => {
      if (y > height - 4) return null;
      if (d > 0.94) return '#5a1a1a';
      return x < kx - 30 && y < height - 60 ? '#ff9a8a' : '#e0402a';
    });
    for (let t = 0; t < 40; t++) fillRect(layer.plot, kx + 55 + t, height - 70 - t * 0.9, 6, 6, '#c0302a'); // spout
    for (let a = 0; a <= 30; a++) {
      const angle = Math.PI + (a / 30) * Math.PI;
      fillRect(layer.plot, kx + Math.cos(angle) * 40, height - 95 + Math.sin(angle) * 34, 5, 5, '#2a2a2a'); // handle
    }
    return layer.canvas;
  }

  /** Crumbs and spilled sugar along the front edge. */
  function paintCrumbs() {
    const layer = createWrappingCanvas(LAYER_WIDTH, 40);
    const random = createSeededRandom(606);
    for (let i = 0; i < 60; i++) {
      const x = random() * LAYER_WIDTH;
      const size = 2 + random() * 7;
      const color = random() < 0.5 ? '#d8a050' : (random() < 0.5 ? '#ffffff' : '#a8641e');
      fillEllipse(layer.plot, x, 40 - size * 0.6, size, size * 0.6, color);
    }
    return layer.canvas;
  }

  // ==========================================
  // Concert: the octopus band
  // ==========================================
  const CONCERT_SKY_COLORS = ['#05020a', '#08030f', '#0b0414', '#0f0619', '#13081e', '#170a24', '#1c0c2a', '#210e30', '#271136'];

  /** The back wall: an LED screen with a giant octopus logo. */
  function paintLedWall() {
    const height = 256;
    const layer = createWrappingCanvas(LAYER_WIDTH, height);
    for (let x = 0; x < LAYER_WIDTH; x++) {
      for (let y = 0; y < height; y++) {
        const isLed = x % 4 === 1 && y % 4 === 1;
        const band = Math.floor((x + y * 0.5) / 64) % 3;
        const colors = ['#3a0a3a', '#0a2a3a', '#2a0a4a'];
        layer.plot(x, y, isLed ? colors[band] : '#07040c');
      }
    }
    // Giant octopus logo, LEDs lit pink
    [128, 384].forEach(cx => {
      const cy = 90;
      for (let x = cx - 70; x <= cx + 70; x++) {
        for (let y = 20; y < 200; y++) {
          if (x % 4 !== 1 || y % 4 !== 1) continue;
          const head = Math.hypot((x - cx) / 44, (y - cy) / 40) < 1;
          const eye = Math.hypot(x - cx + 16, y - cy - 4) < 8 || Math.hypot(x - cx - 16, y - cy - 4) < 8;
          let tentacle = false;
          for (let t = 0; t < 6; t++) {
            const baseX = cx - 36 + t * 14.4;
            const along = (y - cy - 28) / 80;
            if (along > 0 && along < 1) {
              const tx = baseX + (t - 2.5) * along * 18 + Math.sin(along * 7 + t) * 6;
              if (Math.abs(x - tx) < 5 * (1 - along * 0.6)) tentacle = true;
            }
          }
          if (eye) layer.plot(x, y, '#ffffff');
          else if (head || tentacle) layer.plot(x, y, '#ff4fd8');
        }
      }
    });
    return layer.canvas;
  }

  /** The lighting truss along the top, lamps hanging from it. */
  function paintTruss() {
    const layer = createWrappingCanvas(LAYER_WIDTH, 40);
    for (let x = 0; x < LAYER_WIDTH; x++) {
      layer.plot(x, 4, '#9aa3b2');
      layer.plot(x, 14, '#9aa3b2');
      const zig = x % 20;
      layer.plot(x, 4 + (zig < 10 ? zig : 20 - zig), '#5e6573');
      if (x % 40 >= 16 && x % 40 <= 24) {
        for (let y = 15; y < 30; y++) layer.plot(x, y, y > 26 ? (x % 80 < 40 ? '#ff4fd8' : '#4fe8ff') : '#1a1a20');
      }
    }
    return layer.canvas;
  }

  /** The band on a riser: guitarist, bassist, singer and an eight-armed drummer. */
  function paintBand() {
    const height = 112;
    const layer = createWrappingCanvas(LAYER_WIDTH, height);
    const Art = Forest.StrangeCreatureSprites;
    const riserTop = height - 18;
    for (let x = 0; x < LAYER_WIDTH; x++) {
      for (let y = riserTop; y < height; y++) layer.plot(x, y, y === riserTop ? '#5a4a6a' : (x % 24 === 0 ? '#120c18' : '#22182c'));
    }
    const recolor = (skin, dark, light) => ({ ...Art.octopusPalette, A: skin, T: dark, h: light });
    const members = [
      { x: 40, rows: Art.paintOctopus({ strum: 1 }), palette: recolor('#d23c8a', '#b02c72', '#ff8cc6') },
      { x: 160, rows: Art.paintOctopus({ guitar: false, sway: 1 }), palette: recolor('#3c8ad2', '#2c6ab0', '#8cc6ff'), mic: true },
      { x: 280, rows: Art.paintOctopus({ strum: 2, sway: 2 }), palette: recolor('#7a3cd2', '#5a2cb0', '#c08cff') },
      { x: 400, rows: Art.paintOctopus({ guitar: false, sway: 3 }), palette: recolor('#d2783c', '#b0582c', '#ffc08c'), drums: true }
    ];
    members.forEach(member => {
      const canvas = asciiToCanvas(member.rows, 1, member.palette);
      const top = riserTop - canvas.height * 2 + 4;
      if (member.drums) {
        // Drum kit in front of the drummer: bass drum, toms and cymbals on stands
        stamp(layer, canvas, member.x, top, 2);
        fillEllipse(layer.plot, member.x + 30, riserTop - 14, 18, 14, (x, y, d) => (d > 0.85 ? '#9aa3b2' : (d < 0.4 ? '#ff4fd8' : '#ffffff')));
        fillEllipse(layer.plot, member.x + 4, riserTop - 30, 9, 4, '#c0303a');
        fillEllipse(layer.plot, member.x + 56, riserTop - 30, 9, 4, '#c0303a');
        [-12, 72].forEach(dx => {
          fillRect(layer.plot, member.x + dx, riserTop - 48, 1, 48, '#9aa3b2');
          fillEllipse(layer.plot, member.x + dx, riserTop - 48, 10, 2, '#ffd23f');
        });
      } else {
        stamp(layer, canvas, member.x, top, 2);
        if (member.mic) {
          fillRect(layer.plot, member.x + 30, top + 30, 1, riserTop - top - 30, '#9aa3b2');
          fillEllipse(layer.plot, member.x + 30, top + 30, 3, 4, '#3a3a44');
        }
      }
    });
    return layer.canvas;
  }

  /** The crowd: a sea of heads and waving arms (and tentacles). */
  function paintCrowd() {
    const height = 48;
    const layer = createWrappingCanvas(LAYER_WIDTH, height);
    const random = createSeededRandom(4321);
    for (let x = 0; x < LAYER_WIDTH; x++) for (let y = 30; y < height; y++) layer.plot(x, y, '#000000');
    for (let x = 0; x < LAYER_WIDTH; x += 9 + Math.floor(random() * 6)) {
      const headY = 22 + Math.floor(random() * 8);
      fillEllipse(layer.plot, x, headY, 5, 6, '#000000');
      fillRect(layer.plot, x - 6, headY + 4, 13, height, '#000000');
      if (random() < 0.5) {
        // Arm (or tentacle) in the air, some holding glowing phones
        const side = random() < 0.5 ? -1 : 1;
        for (let t = 0; t < 14; t++) {
          const ax = x + side * (5 + Math.sin(t * 0.4) * (random() < 0.3 ? 3 : 1));
          fillRect(layer.plot, ax, headY - t, 2, 1, '#000000');
        }
        if (random() < 0.3) fillRect(layer.plot, x + side * 5, headY - 18, 3, 4, '#c8f0ff');
      }
    }
    return layer.canvas;
  }

  // ==========================================
  // Layer recipes (see ParallaxBackground for what the options mean)
  // ==========================================
  const StrangeThemes = {
    noir: {
      skyColors: NOIR_SKY_COLORS,
      clearColor: NOIR_SKY_COLORS[0],
      celestial: paintGrinningSun,
      layers: () => [
        { canvas: Painters.paintClouds({ seed: 13, count: 6, colors: GRAY_CLOUD_COLORS, height: 80, sizeScale: 1.2 }), follow: 0.96, bottomY: 3.2, drift: -3 },
        { canvas: paintNoirTown(), follow: 0.88, bottomY: -1.2 },
        { canvas: paintNoirTrees(), follow: 0.65, bottomY: -1.6 },
        { canvas: paintPicketFence(), follow: 0.35, bottomY: -1.4 }
      ],
      motes: { count: 14, colors: ['#ffffff', '#bcbcbc'], rise: 0 }
    },
    mothership: {
      skyColors: World.SPACE_SKY_COLORS,
      clearColor: '#000000',
      celestial: () => paintDisc({ size: 56, colors: { light: '#d4ff5a', mid: '#6ab83a', dark: '#2c5a1a' }, craters: [[18, 20, 5, '#4a8a2a'], [34, 32, 4, '#4a8a2a']] }),
      layers: () => [
        { canvas: paintStars({ seed: 51, count: 220 }), follow: 0.995, bottomY: 0 },
        { canvas: paintHullWall(), follow: 0.9, bottomY: -3.0 },
        { canvas: paintCeilingTubes(), follow: 0.75, bottomY: 5.0 },
        { canvas: paintSpecimenPods(), follow: 0.6, bottomY: -1.8 },
        { canvas: paintRedGlow(), follow: 0.55, bottomY: 3.0, opacity: 0.3, additive: true, flicker: true }
      ],
      motes: { count: 26, colors: ['#7dff9a', '#d4ff5a'], rise: 0.4 }
    },
    rainbow: {
      skyColors: RAINBOW_SKY_COLORS,
      clearColor: RAINBOW_SKY_COLORS[0],
      hasSun: true,
      layers: () => [
        { canvas: paintRainbowArcs(), follow: 0.96, bottomY: -2.0, opacity: 0.85 },
        { canvas: Painters.paintClouds({ seed: 17, count: 6, colors: Theme.WHITE_CLOUD_COLORS, height: 80, sizeScale: 1.3 }), follow: 0.93, bottomY: 2.8, drift: -3 },
        { canvas: paintSkyWebs(), follow: 0.8, bottomY: 5.0, opacity: 0.85 },
        { canvas: Theme.paintCloudSea(), follow: 0.7, bottomY: -4.2 }
      ],
      motes: { count: 34, colors: ['#ffffff', '#ffe14d'], rise: 0.2 }
    },
    rising: {
      skyColors: Theme.TREETOP_SKY_COLORS,
      clearColor: '#dbe8f6',
      hasSun: true,
      layers: () => [
        { canvas: paintRisingClouds(), follow: 0.97, bottomY: -4.0, rise: 6 },
        { canvas: paintRisingIslands(), follow: 0.9, bottomY: -4.0, rise: 11 },
        { canvas: paintRisingThings(), follow: 0.75, bottomY: -4.0, rise: 20 },
        { canvas: paintRisingSpecks(), follow: 0.5, bottomY: -4.0, rise: 55, opacity: 0.7 }
      ],
      motes: { count: 30, colors: ['#ffffff', '#fff7c2'], rise: 1.6 }
    },
    kitchen: {
      skyColors: KITCHEN_SKY_COLORS,
      clearColor: KITCHEN_SKY_COLORS[0],
      hasSun: false,
      layers: () => [
        { canvas: paintKitchenWall(), follow: 0.97, bottomY: -3.0 },
        { canvas: paintBeams({ height: 200, count: 2, colors: ['#fff6d8'], spread: 0.5, width: 24, seed: 3 }), follow: 0.95, bottomY: -1.0, opacity: 0.25, additive: true, breathe: true },
        { canvas: paintGiantJars(), follow: 0.85, bottomY: -1.6 },
        { canvas: paintToasterAndKettle(), follow: 0.65, bottomY: -2.0 },
        { canvas: paintCrumbs(), follow: 0.35, bottomY: -2.6 }
      ],
      motes: { count: 30, colors: ['#fff6d8', '#ffffff'], rise: 0.05 }
    },
    concert: {
      skyColors: CONCERT_SKY_COLORS,
      clearColor: CONCERT_SKY_COLORS[0],
      hasSun: false,
      layers: () => [
        { canvas: paintLedWall(), follow: 0.97, bottomY: -3.0, opacity: 0.9, breathe: true },
        { canvas: paintBeams({ height: 180, count: 8, colors: ['#ff4fd8', '#4fe8ff', '#ffe14d'], spread: 0.6, width: 14, seed: 9 }), follow: 0.9, bottomY: -1.2, opacity: 0.3, additive: true, flicker: true },
        { canvas: paintTruss(), follow: 0.88, bottomY: 6.2 },
        { canvas: paintBand(), follow: 0.8, bottomY: -1.6, pulse: { bpm: 140, pixels: 2 } },
        { canvas: paintCrowd(), follow: 0.3, bottomY: -3.3, pulse: { bpm: 140, pixels: 3, phase: 0.5 } }
      ],
      motes: { count: 40, colors: ['#ff4fd8', '#ffe14d'], rise: -0.6 }
    }
  };

  Forest.StrangeThemes = StrangeThemes;
})(window.Forest);
