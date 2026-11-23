/**
 * Pixel art for the creatures of the strange worlds: the rainbow spider, the alien crawler and the
 * octopus rock star. They join Forest.SkyCreatureSprites.creatures, so they load, shatter, show up
 * in the sprite gallery and get scrapbook portraits like the original five.
 *
 * Long legs and tentacles are fiddly to type as letter art, so these are drawn with a few shape
 * helpers (ellipses, lines) onto a letter grid, then outlined. The result is the same rows-of-letters
 * format as every other creature: one letter per pixel, '.' transparent, colours from the palette.
 */
(function (Forest) {
  const SkyArt = Forest.SkyCreatureSprites;

  // ==========================================
  // A tiny letter-grid painter
  // ==========================================
  function createGrid(width, height) {
    const cells = Array.from({ length: height }, () => new Array(width).fill('.'));
    const set = (x, y, letter) => {
      x = Math.round(x);
      y = Math.round(y);
      if (x >= 0 && x < width && y >= 0 && y < height) cells[y][x] = letter;
    };
    const get = (x, y) => (x >= 0 && x < width && y >= 0 && y < height ? cells[y][x] : '.');
    return { width, height, cells, set, get };
  }

  function ellipse(grid, cx, cy, rx, ry, letter) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) grid.set(x, y, letter);
      }
    }
  }

  function line(grid, x0, y0, x1, y1, letter) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      grid.set(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, letter);
    }
  }

  /** A leg from hip to knee to foot. */
  function leg(grid, hip, knee, foot, letter) {
    line(grid, hip[0], hip[1], knee[0], knee[1], letter);
    line(grid, knee[0], knee[1], foot[0], foot[1], letter);
  }

  /** Ring every pixel of `letters` with an outline wherever it touches empty space. */
  function outline(grid, letters, outlineLetter = 'K') {
    const toMark = [];
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (grid.get(x, y) !== '.') continue;
        const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => letters.includes(grid.get(x + dx, y + dy)));
        if (touches) toMark.push([x, y]);
      }
    }
    toMark.forEach(([x, y]) => grid.set(x, y, outlineLetter));
  }

  const toRows = grid => grid.cells.map(row => row.join(''));

  // ==========================================
  // Rainbow Spider - drops in on a silk thread, scuttles and pounces (front view, symmetric)
  // ==========================================
  /**
   * @param {{feet:number, knees:number, curl?:boolean}} pose feet shift (walk cycle), knee lift,
   *   and curled legs for hanging on the thread
   */
  function paintSpider({ feet = 0, knees = 0, curl = false }) {
    const W = 26;
    const H = 17;
    const grid = createGrid(W, H);
    const cx = 12.5;
    // Four legs a side: hips along the body, knees high and wide, feet on the floor
    for (let i = 0; i < 4; i++) {
      const shift = (i % 2 === 0 ? feet : -feet);
      [-1, 1].forEach(side => {
        const hip = [cx + side * 4, 6 + i * 1.2];
        const knee = curl
          ? [cx + side * (6 + i * 0.6), 2 + i * 1.4]
          : [cx + side * (7 + i * 1.6), 1 + i * 0.8 - knees];
        const foot = curl
          ? [cx + side * (5 + i * 0.5), 9 + i]
          : [cx + side * (9 + i * 1.1) + side * shift, H - 1];
        leg(grid, hip, knee, foot, i % 2 ? 'l' : 'L');
      });
    }
    // Fuzzy body with rainbow stripes, and a head with eight eyes
    ellipse(grid, cx, 6.5, 5.2, 4.6, 'A');
    for (let x = 0; x < W; x++) {
      for (let y = 3; y <= 9; y++) {
        if (grid.get(x, y) !== 'A') continue;
        const stripe = ['r', 'o', 'y', 'g', 'b', 'v'][Math.floor((y - 3 + x * 0.15) % 6)];
        if ((x + y) % 4 === 0) grid.set(x, y, stripe);
      }
    }
    grid.set(cx - 2, 3, 'h');
    grid.set(cx - 3, 4, 'h');
    ellipse(grid, cx, 11, 3.4, 2.4, 's');
    [[-1.5, 10], [1.5, 10], [-2.5, 11], [2.5, 11]].forEach(([dx, y]) => grid.set(cx + dx, y, 'e'));
    [[-0.5, 10], [0.5, 10]].forEach(([dx, y]) => grid.set(cx + dx, y, 'E'));
    grid.set(cx - 1, 13, 'f');
    grid.set(cx + 1, 13, 'f');
    outline(grid, ['A', 's', 'h', 'r', 'o', 'y', 'g', 'b', 'v', 'e', 'E', 'f']);
    return toRows(grid);
  }

  const spider = {
    name: 'Rainbow Spider',
    palette: {
      K: '#120a1c', // outline
      A: '#2a1640', // fuzz
      h: '#7a5ab0', // shine
      s: '#3a2258', // head
      e: '#ff4fd8', // eyes
      E: '#7dfbff', // big eyes
      f: '#f0e6ff', // fangs
      L: '#1c0f2c', // legs
      l: '#3a2258', // back legs
      r: '#ff5a5a', o: '#ffa64d', y: '#ffe14d', g: '#5fe07a', b: '#4fb6ff', v: '#b77aff'
    },
    frames: {
      walk1: paintSpider({ feet: 0 }),
      walk2: paintSpider({ feet: 1.4, knees: 1 }),
      hang: paintSpider({ curl: true }),
      /** Crouched, about to pounce. */
      crouch: paintSpider({ feet: -1, knees: -2 })
    }
  };

  // ==========================================
  // Alien Crawler - a many-legged hull-skitterer that spits acid (side view, facing right)
  // ==========================================
  function paintCrawler({ step = 0, rear = false }) {
    const W = 30;
    const H = 14;
    const grid = createGrid(W, H);
    const lift = rear ? -2 : 0;
    // Six pairs of jointed legs under the segments, alternating in the walk cycle
    for (let i = 0; i < 6; i++) {
      const hipX = 6 + i * 3.4;
      const phase = (i % 2 === 0 ? step : -step);
      leg(grid, [hipX, 8 + lift], [hipX - 1 + phase, 9.5 + lift * 0.5], [hipX - 2 + phase * 2, H - 1], i % 2 ? 'l' : 'L');
    }
    // Three armoured segments, a tail stinger and a big-eyed head with mandibles
    ellipse(grid, 8, 7 + lift * 0.3, 4.5, 3.2, 'A');
    ellipse(grid, 14.5, 6.5 + lift * 0.6, 4.5, 3.6, 'B');
    ellipse(grid, 21, 6 + lift, 4.2, 3.4, 'A');
    line(grid, 4, 6, 1, 3, 't');
    grid.set(1, 2, 'T');
    grid.set(0, 2, 'T');
    // Glowing spots along the back
    [[8, 5], [14, 4], [20, 4 + lift]].forEach(([x, y]) => grid.set(x, y + Math.round(lift * 0.4), 'g'));
    ellipse(grid, 25.5, 6.5 + lift, 2.6, 2.4, 'h');
    grid.set(26, 5.5 + lift, 'E');
    grid.set(27, 5.5 + lift, 'E');
    grid.set(26, 6.5 + lift, 'E');
    grid.set(27, 6.5 + lift, 'e');
    line(grid, 27, 8 + lift, 29, 9.5 + lift, 'm');
    line(grid, 26, 8.5 + lift, 27, 10 + lift, 'm');
    outline(grid, ['A', 'B', 'h', 'g', 'E', 'e', 't', 'T']);
    return toRows(grid);
  }

  const crawler = {
    name: 'Alien Crawler',
    palette: {
      K: '#06120a', // outline
      A: '#3f7a2a', // shell
      B: '#5fae38', // middle shell
      g: '#d4ff5a', // glowing spots
      h: '#2c4d22', // head
      E: '#ff3b6b', // eye
      e: '#ffd0dc', // eye shine
      m: '#c8e8a0', // mandibles
      t: '#2c4d22', // tail
      T: '#d4ff5a', // stinger
      L: '#1a2e14', // legs
      l: '#2c4d22' // far legs
    },
    frames: {
      walk1: paintCrawler({ step: 0 }),
      walk2: paintCrawler({ step: 1 }),
      /** Reared up to spit. */
      rear: paintCrawler({ step: 0.5, rear: true })
    }
  };

  // ==========================================
  // Octo-Rocker - an octopus rock star with shades and a V guitar (front view)
  // ==========================================
  function paintOctopus({ strum = 0, sway = 0, guitar = true }) {
    const W = 30;
    const H = 30;
    const grid = createGrid(W, H);
    const cx = 15;
    // Eight curling tentacles, fanning out and thinning towards the tips
    for (let i = 0; i < 8; i++) {
      const baseX = cx - 7 + i * 2;
      for (let y = 17; y < H; y++) {
        const t = (y - 17) / (H - 17);
        const x = baseX + (i - 3.5) * t * 3.2 + Math.sin(t * 5 + i + sway) * 1.2;
        grid.set(x, y, y % 3 === 0 && t < 0.7 ? 'u' : 'T');
        if (t < 0.35) grid.set(x + 1, y, 'T');
      }
    }
    // Big round head, mohawk fin, and very cool shades
    ellipse(grid, cx, 10, 8.5, 8.5, 'A');
    ellipse(grid, cx - 3, 6, 2.5, 2.5, 'h');
    for (let i = 0; i < 6; i++) line(grid, cx - 4 + i * 1.6, 2, cx - 5 + i * 1.8, -2, 'M');
    for (let x = cx - 6; x <= cx + 6; x++) grid.set(x, 10, 'S');
    ellipse(grid, cx - 3.2, 11.5, 2.4, 1.6, 'S');
    ellipse(grid, cx + 3.2, 11.5, 2.4, 1.6, 'S');
    grid.set(cx - 4, 11, 'w');
    grid.set(cx + 2, 11, 'w');
    // A big grin
    for (let x = cx - 3; x <= cx + 3; x++) grid.set(x, 15 + (Math.abs(x - cx) < 2 ? 1 : 0), 'k');
    outline(grid, ['A', 'h', 'M', 'S', 'w', 'T', 'u', 'k']);
    if (guitar) {
      // Pointy guitar slung across the body (drawn on top, with its own outline); one tentacle strums
      line(grid, 11, 22, 25, 13, 'n');
      line(grid, 11, 23, 25, 14, 'n');
      line(grid, 25, 13, 28, 11, 'N');
      line(grid, 25, 14, 28, 12, 'N');
      ellipse(grid, 9, 23.5, 4, 2.8, 'G');
      line(grid, 5, 20, 8, 22, 'G');
      line(grid, 4, 26, 7, 25, 'G');
      line(grid, 7, 23, 11, 23, 'g');
      grid.set(9, 22, 'g');
      grid.set(9, 24, 'g');
      line(grid, 17, 17, 9 + strum * 1.5, 21 - strum, 'T');
      outline(grid, ['G', 'g', 'n', 'N']);
    }
    return toRows(grid);
  }

  const octorocker = {
    name: 'Octo-Rocker',
    palette: {
      K: '#14061e', // outline
      A: '#d23c8a', // skin
      h: '#ff8cc6', // shine
      M: '#4fe8ff', // mohawk fin
      S: '#14061e', // shades
      w: '#ffffff', // shine on the shades
      k: '#5a0e30', // grin
      T: '#b02c72', // tentacles
      u: '#ffc0e0', // suckers
      G: '#ffd23f', // guitar body
      g: '#ff5a1f', // guitar pickup
      n: '#6a3a1a', // neck
      N: '#3a1f0a' // headstock
    },
    frames: {
      stand: paintOctopus({ strum: 0 }),
      strum: paintOctopus({ strum: 2, sway: 1.2 }),
      jump: paintOctopus({ strum: 1, sway: 2.6 })
    }
  };

  // ==========================================
  // Projectiles: a music note and a web ball (8x8, like the fireball)
  // ==========================================
  const musicNote = {
    palette: { K: '#14061e', n: '#ffe14d', N: '#fff7b3' },
    rows: [
      '...KKKK.',
      '...KnNK.',
      '...KnKnK',
      '...Kn.K.',
      '.KKKn...',
      'KnNnK...',
      'KnnnK...',
      '.KKK....'
    ]
  };

  const webBall = {
    palette: { w: '#ffffff', s: '#cfd8ff', K: '#6a6a90' },
    rows: [
      '..KwwK..',
      '.wsKswK.',
      'KsKwwKsK',
      'wKwsswKw',
      'wKwsswKw',
      'KsKwwKsK',
      '.wsKswK.',
      '..KwwK..'
    ]
  };

  Object.assign(SkyArt.creatures, { spider, crawler, octorocker });
  Forest.StrangeCreatureSprites = Object.freeze({
    musicNote,
    webBall,
    /** The octopus drawing, for the band on the concert's background stage. */
    paintOctopus,
    octopusPalette: octorocker.palette
  });
})(window.Forest);
