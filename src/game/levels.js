/**
 * The sixteen side-scrolling worlds (plus a flat training ground), and the generator that lays a
 * fresh course out for each of them every time it is played.
 *
 * A world (an entry of Forest.Levels.themes) only fixes the look, the rules and the boss: `theme`
 * picks the art, `physics` can make it slippery or lower the gravity, `hazard` adds sandstorm wind
 * or falling bombs, and `layout.bouncy` scatters bounce pads. Forest.Levels.generate() then rolls
 * the course itself: where the ground breaks into pits, the ledges, stairs and stepping stones, the
 * high route, the enemies and the coins. An adventure visits every world once, in a shuffled order
 * (Forest.Levels.createRun), and the monsters and bosses get tougher with each world visited.
 *
 * Positions are in world units: x along the level, y up from the grass line (0).
 *  - ground:    [left, right] solid segments; the spaces between them are bottomless pits
 *  - platforms: one-way ledges { x: left edge, y: top, width } (bouncy ones launch the boy)
 *  - coins:     { x, y } centre of each coin
 *  - enemies:   { kind, x } each drops in when the boy gets close. kind is 'mushroom', a sky creature
 *               (nutling, thornback, gloomwing, jelly) or 'mutant': a freshly rolled Monster Forge monster
 *               of `power`, so every run can turn up scrapbook species not met before
 *  - routes:    high routes reached by a tower of ledges or a lift (see buildHighRoute)
 *  - arena:     the boss fight at the end. Walking in locks the camera and drops the boss
 *
 * Jump reach, for laying out gaps and ledges: a single jump peaks ~1.7 high and clears ~3.4 across,
 * a double jump peaks ~3.4 high and clears ~5.5 across.
 */
(function (Forest) {
  const { createSeededRandom } = Forest.MathUtils;

  // ==========================================
  // Coin helpers
  // ==========================================
  /** `count` coins in a line starting at x. */
  function coinRow(x, y, count, spacing = 0.7) {
    return Array.from({ length: count }, (_, i) => ({ x: x + i * spacing, y }));
  }

  /** `count` coins along an arch from fromX to toX, `height` above baseY at the top. */
  function coinArc(fromX, toX, baseY, height, count) {
    return Array.from({ length: count }, (_, i) => {
      const t = count === 1 ? 0.5 : i / (count - 1);
      return { x: fromX + (toX - fromX) * t, y: baseY + height * 4 * t * (1 - t) };
    });
  }

  /** Coins sitting just above a platform, spread along its middle. */
  function coinsOn(platform, count) {
    const spacing = 0.7;
    const startX = platform.x + platform.width / 2 - ((count - 1) * spacing) / 2;
    return coinRow(startX, platform.y + 0.6, count, spacing);
  }

  const GROUND_COIN_Y = 0.6;

  /**
   * Coins laid out automatically: along every platform (high above bouncy pads), in an arc over
   * every pit, and a row on long stretches of ground before the arena.
   * @param {number} jumpScale how much higher he jumps here (low gravity), for arc heights
   */
  function autoCoins({ ground, platforms, arena }, jumpScale) {
    const coins = [];
    platforms.forEach(platform => {
      if (platform.bouncy) {
        coins.push(...coinRow(platform.x + platform.width / 2 - 0.35, platform.y + 3.4, 2));
        return;
      }
      coins.push(...coinsOn(platform, Math.max(2, Math.min(4, Math.round(platform.width / 1.0)))));
    });
    const sorted = [...ground].sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < sorted.length - 1; i++) {
      const left = sorted[i][1];
      const right = sorted[i + 1][0];
      const gap = right - left;
      const count = Math.max(3, Math.min(5, Math.round(gap / 1.2) + 1));
      coins.push(...coinArc(left - 0.5, right + 0.5, 0.8, Math.min(2.6, 0.8 + gap * 0.35) * jumpScale, count));
    }
    sorted.forEach(([left, right]) => {
      const end = Math.min(right, arena.start) - 2;
      if (end - (left + 2) > 10) coins.push(...coinRow((left + end) / 2 - 1.4, GROUND_COIN_Y, 5));
    });
    return coins;
  }

  // ==========================================
  // High routes
  // ==========================================
  // High route towers: steps start this high, rise about this much each, in two columns this far apart
  const TOWER_FIRST_STEP_Y = 1.5;
  const TOWER_STEP_RISE = 1.4;
  const TOWER_COLUMN_OFFSET = 2.4;
  /** Platforms closer than this across, and this in height, look stacked: the original one is dropped. */
  const CROWDING_MARGIN = 0.4;
  const CROWDING_HEIGHT = 1.8;

  /**
   * A route high above the level: a way up (a zig-zag tower of ledges, or a lift), then a tricky run
   * of narrow ledges at uneven heights, ferries gliding back and forth and ledges bobbing up and down,
   * ending in a stash of coins. Fall off and you drop back down into whatever is below.
   * @param {{x:number, height:number, length:number, climb:'tower'|'lift'}} route
   * @param {number} jumpScale how much higher and further he jumps here (low gravity)
   * @param {number} limitX the route must end before this x (the boss arena)
   * @param {() => number} random the level's random numbers
   * @returns {{platforms:object[], coins:object[]}}
   */
  function buildHighRoute({ x, height, length, climb }, jumpScale, limitX, random) {
    const platforms = [];
    const coins = [];

    // The way up
    let cursor;
    if (climb === 'lift') {
      platforms.push({ x, y: 0.6, width: 2.4, move: { dx: 0, dy: height - 0.6, period: 7 } });
      coins.push(...coinRow(x + 0.85, height + 1.4, 2));
      cursor = x + 2.4;
    } else {
      // Evenly spaced steps in two columns; the top one is the start of the route
      const steps = Math.max(1, Math.ceil((height - TOWER_FIRST_STEP_Y) / (TOWER_STEP_RISE * jumpScale)));
      const rise = (height - TOWER_FIRST_STEP_Y) / steps;
      for (let step = 0; step <= steps; step++) {
        platforms.push({ x: x + (step % 2) * TOWER_COLUMN_OFFSET, y: TOWER_FIRST_STEP_Y + step * rise, width: 2.0 });
      }
      // Start clear of both columns, so no ledge hangs right above a step
      cursor = x + TOWER_COLUMN_OFFSET + 2.0;
    }

    // The route across
    let previousY = height;
    const endX = Math.min(cursor + length, limitX - 4);
    while (true) {
      const gap = (1.6 + random() * 1.0) * jumpScale;
      cursor += gap;
      if (cursor >= endX) break;
      // Long gaps never climb much, so every hop stays possible (with a double jump at worst)
      const maxRise = gap > 2.2 * jumpScale ? 0.5 : 1.0;
      const y = Math.min(previousY + maxRise, Math.max(height - 1.4, Math.min(height + 1.4, previousY + (random() - 0.5) * 2.2)));
      const roll = random();
      if (roll < 0.3) {
        // Ferry: rides back and forth across the next stretch
        const travel = 3.0 * jumpScale;
        platforms.push({ x: cursor, y, width: 1.8, move: { dx: travel, dy: 0, period: 3.2 } });
        coins.push({ x: cursor + 0.9 + travel / 2, y: y + 1.2 });
        cursor += 1.8 + travel;
      } else if (roll < 0.5) {
        // Bobber: rises and sinks, so time the landing
        platforms.push({ x: cursor, y: y - 0.7, width: 1.8, move: { dx: 0, dy: 1.4, period: 3.0 } });
        coins.push({ x: cursor + 0.9, y: y + 1.6 });
        cursor += 1.8;
      } else {
        const width = 1.2 + random() * 1.0;
        const ledge = { x: cursor, y, width };
        platforms.push(ledge);
        coins.push(...coinsOn(ledge, 2));
        cursor += width;
      }
      previousY = y;
    }

    // The stash at the end
    const stash = { x: cursor, y: previousY, width: 3.6 };
    platforms.push(stash);
    coins.push(...coinsOn(stash, 4), ...coinRow(stash.x + 0.75, stash.y + 1.35, 4));
    return { platforms, coins };
  }

  /** The box a platform sweeps through (moving ones cover their whole path). */
  function platformSpan({ x, y, width, move }) {
    const dx = move ? move.dx : 0;
    const dy = move ? move.dy : 0;
    return { left: x + Math.min(0, dx), right: x + width + Math.max(0, dx), bottom: y + Math.min(0, dy), top: y + Math.max(0, dy) };
  }

  /** True when two platforms would look stacked or crowded (overlapping across, close in height). */
  function isCrowding(a, b) {
    const spanA = platformSpan(a);
    const spanB = platformSpan(b);
    const overlapX = Math.min(spanA.right, spanB.right) - Math.max(spanA.left, spanB.left);
    const gapY = Math.max(spanA.bottom, spanB.bottom) - Math.min(spanA.top, spanB.top);
    return overlapX > -CROWDING_MARGIN && gapY < CROWDING_HEIGHT;
  }

  // ==========================================
  // The course generator
  // ==========================================
  /** The boss arena starts somewhere in this range (the level's length). */
  const ARENA_START_RANGE = [148, 166];
  /** One screen wide (the view is 23 units), so the camera holds still and the boss can never get out of sight. */
  const ARENA_WIDTH = 22;
  /** The boss drops in this far into the arena. */
  const BOSS_OFFSET = 15;
  /** Ordinary pits, and the wide ones with a stepping stone in the middle (before reach scaling). */
  const PIT_WIDTH = [1.7, 3.2];
  const WIDE_PIT_WIDTH = [4.6, 6.0];
  const WIDE_PIT_CHANCE = 0.22;
  const SEGMENT_LENGTH = [5, 16];
  /** Monster Forge power at the first world, and how much it grows with each world visited. */
  const FIRST_POWER = 1;
  const POWER_PER_LEVEL = 0.55;
  const MAX_POWER = 10;
  const BOSS_FIRST_HP = 10;
  const BOSS_HP_PER_LEVEL = 0.7;
  const SKY_KINDS = ['nutling', 'thornback', 'gloomwing', 'jelly'];

  /** How much higher and further the boy jumps in a world (low gravity). */
  function jumpScaleOf(theme) {
    const gravityScale = (theme.physics && theme.physics.gravityScale) || 1;
    return Math.min(1.8, 1 / gravityScale);
  }

  /**
   * Roll a course: ground with pits, ledges and stairs, a high route, and the enemies.
   * @param {object} theme an entry of THEMES
   * @param {() => number} random
   * @param {number} jumpScale
   * @param {number} position how many worlds came before this one in the adventure
   */
  function rollCourse(theme, random, jumpScale, position) {
    const between = (low, high) => low + random() * (high - low);
    const pick = list => list[Math.floor(random() * list.length)];
    // Pits widen with the boy's reach (low gravity) and shrink against a headwind
    const reach = theme.hazard === 'wind' ? 0.85 : Math.min(1.35, Math.sqrt(jumpScale));
    // Ledges sit higher where he jumps higher
    const lift = Math.min(1.4, Math.sqrt(jumpScale));
    const arenaTarget = Math.round(between(...ARENA_START_RANGE));

    // Ground broken up by pits; wide ones get a stepping stone in the middle
    const ground = [];
    const platforms = [];
    let left = -8;
    let right = between(13, 18);
    while (right < arenaTarget - SEGMENT_LENGTH[1]) {
      ground.push([left, right]);
      let pit;
      if (random() < WIDE_PIT_CHANCE) {
        pit = between(...WIDE_PIT_WIDTH) * reach;
        platforms.push({ x: right + pit / 2 - 1, y: between(1.0, 1.4) * lift, width: 2, essential: true });
      } else {
        pit = between(...PIT_WIDTH) * reach;
      }
      left = right + pit;
      right = left + between(...SEGMENT_LENGTH);
    }
    ground.push([left, right]);
    const lastLeft = right + between(PIT_WIDTH[0], 3.0) * reach;
    const arenaStart = Math.max(arenaTarget, lastLeft + 6);
    const arena = { start: arenaStart, end: arenaStart + ARENA_WIDTH };
    ground.push([lastLeft, arena.end + 8]);

    // Ledges, stairs and bounce pads along the ground
    const bouncy = Boolean(theme.layout && theme.layout.bouncy);
    ground.forEach(([segmentLeft, segmentRight]) => {
      const to = Math.min(segmentRight, arena.start - 3);
      let x = Math.max(segmentLeft + 1.2, 7) + random() * 2;
      while (x < to - 3) {
        const roll = random();
        if (bouncy && roll < 0.25 && x + 7 < to) {
          platforms.push({ x, y: 0.6, width: 2.2, bouncy: true });
          platforms.push({ x: x + 3.4, y: 4.4 * lift, width: 3 });
          x += 6.4 + between(3, 5);
        } else if (roll < 0.5) {
          const width = between(2.5, 3.5);
          platforms.push({ x, y: between(1.4, 1.8) * lift, width });
          x += width + between(3, 6);
        } else if (roll < 0.72 && x + 9 < to + 2) {
          const steps = random() < 0.5 ? 2 : 3;
          for (let step = 0; step < steps; step++) platforms.push({ x: x + step * 3.6, y: (1.5 + step * 1.5) * lift, width: 2.5 });
          x += steps * 3.6 + between(3, 5);
        } else {
          x += between(3, 6);
        }
      }
    });

    // One high route, starting from solid ground
    const routes = [];
    const routeGround = ground.filter(([l, r]) => r - l >= 7 && l > 8 && r < arena.start - 24);
    if (routeGround.length > 0) {
      const [l, r] = pick(routeGround);
      const climb = random() < 0.5 ? 'tower' : 'lift';
      routes.push({
        x: l + 1 + random() * (r - l - 6.4),
        height: climb === 'lift' ? Math.round(between(9, 11) * lift) : between(6, 7.5) * lift,
        length: 16,
        climb
      });
    }

    // Enemies, only over solid ground, getting stronger towards the arena and with every world
    const enemies = [];
    const basePower = FIRST_POWER + Math.floor(position * POWER_PER_LEVEL);
    for (let x = between(12, 16); x < arena.start - 4; x += between(6, 9)) {
      if (!ground.some(([l, r]) => x > l + 1 && x < r - 1)) continue;
      const roll = random();
      if (roll < 0.08) enemies.push({ kind: 'mushroom', x });
      else if (roll < 0.36) enemies.push({ kind: pick(SKY_KINDS), x });
      else enemies.push({ kind: 'mutant', x, power: Math.min(MAX_POWER, basePower + Math.floor((x / arena.start) * 2.5)) });
    }

    return { ground, platforms, routes, enemies, arena };
  }

  /**
   * Add the high routes (dropping any ledge that would crowd them, never a stepping stone) and lay
   * out the coins.
   */
  function finishLevel(level, random) {
    const jumpScale = jumpScaleOf(level);
    const routePlatforms = [];
    const routeCoins = [];
    level.routes.forEach(route => {
      const built = buildHighRoute(route, jumpScale, level.arena.start, random);
      routePlatforms.push(...built.platforms);
      routeCoins.push(...built.coins);
    });
    const kept = level.platforms.filter(platform => platform.essential || !routePlatforms.some(other => isCrowding(platform, other)));
    const coins = [...autoCoins({ ...level, platforms: kept }, jumpScale), ...routeCoins];
    return Object.freeze({ ...level, platforms: [...kept, ...routePlatforms], coins });
  }

  /** Share of levels guarded by a brand-new random mutant; the rest get a signature boss from any world. */
  const RANDOM_MUTANT_BOSS_CHANCE = 0.6;
  /** Random mutant bosses: power at the first level and growth per level, and their size. */
  const MUTANT_BOSS_FIRST_POWER = 4;
  const MUTANT_BOSS_POWER_PER_LEVEL = 0.45;
  const MUTANT_BOSS_SIZE = [1.7, 2.1];
  /** In the future-tech worlds, random mutant bosses are usually cyber. */
  const FUTURE_CYBER_BOSS_CHANCE = 0.7;
  const MUTANT_BOSS_FLAVORS = [
    'Any monster can grow into a boss. This one ate its vegetables.',
    'The biggest, meanest one in the whole world has found you!',
    'It has been waiting for a worthy opponent. That\'s you.',
    'Its little helpers never leave its side.',
    'Nobody has ever seen one this big. Nobody wanted to.'
  ];

  /**
   * Who guards this level, picked at random: usually a brand-new mutant of any species (named
   * once it is generated, see the game), sometimes one of the signature bosses of any world.
   */
  function pickBoss(theme, random, position) {
    if (random() >= RANDOM_MUTANT_BOSS_CHANCE) {
      const signature = THEMES[Math.floor(random() * THEMES.length)].boss;
      return { ...signature };
    }
    const movements = ['walker', 'walker', 'hopper', 'flyer'];
    return {
      kind: 'mutant',
      power: Math.min(MAX_POWER, MUTANT_BOSS_FIRST_POWER + Math.floor(position * MUTANT_BOSS_POWER_PER_LEVEL)),
      movement: movements[Math.floor(random() * movements.length)],
      seed: Math.floor(random() * 0x7fffffff),
      cyber: theme.future && random() < FUTURE_CYBER_BOSS_CHANCE ? true : undefined,
      name: null,
      flavor: MUTANT_BOSS_FLAVORS[Math.floor(random() * MUTANT_BOSS_FLAVORS.length)],
      sizeScale: MUTANT_BOSS_SIZE[0] + random() * (MUTANT_BOSS_SIZE[1] - MUTANT_BOSS_SIZE[0])
    };
  }

  /** A fresh random seed for a level. */
  function randomSeed() {
    return Math.floor(Math.random() * 0x7fffffff);
  }

  /**
   * Lay out a world as a playable level.
   * @param {object} theme an entry of Forest.Levels.themes
   * @param {object} [options]
   * @param {number} [options.position] how many worlds came before it in this adventure (0 = first)
   * @param {number} [options.seed] the same seed always gives the same course
   */
  function generate(theme, { position = 0, seed = randomSeed() } = {}) {
    const random = createSeededRandom(seed);
    const course = rollCourse(theme, random, jumpScaleOf(theme), position);
    const boss = {
      ...pickBoss(theme, random, position),
      hp: Math.round(BOSS_FIRST_HP + position * BOSS_HP_PER_LEVEL),
      x: course.arena.start + BOSS_OFFSET
    };
    return finishLevel({ ...theme, ...course, number: position + 1, seed, playerStartX: 2, boss }, random);
  }

  /** The worlds in a freshly shuffled order (as indices into themes), for a new adventure. */
  function createRun() {
    const order = THEMES.map((_, index) => index);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }

  // ==========================================
  // The worlds
  // ==========================================
  const THEMES = [
    {
      id: 'forest',
      name: 'THE WHISPERING FOREST',
      icon: '🌲',
      flavor: 'Hop the gaps, grab the coins, and find out what rules these woods!',
      theme: 'forest',
      boss: { kind: 'jelly', name: 'KING THUNDER JELLY', flavor: 'A giant jelly crackling with lightning! Jump when it lands!', sizeScale: 1.7 }
    },
    {
      id: 'dungeon',
      name: 'THE SUNKEN DUNGEON',
      icon: '🏰',
      flavor: 'Torchlit halls and bottomless pits. Something big is smouldering below...',
      theme: 'dungeon',
      boss: { kind: 'golem', name: 'THE CINDER GOLEM', flavor: 'A blazing giant crashes down! Smash its fireballs!', sizeScale: 1 }
    },
    {
      id: 'treetops',
      name: 'THE CLOUD CANOPY',
      icon: '☁️',
      flavor: 'High above the forest, branch to branch and cloud to cloud. Don\'t look down!',
      theme: 'treetops',
      boss: { kind: 'gloomwing', name: 'THE GLOOMWING QUEEN', flavor: 'The mother of all moths rules the sky! Strike as she dives!', sizeScale: 2.2 }
    },
    {
      id: 'desert',
      name: 'THE SCORCHING DUNES',
      icon: '🏜️',
      flavor: 'Blazing sun and howling sandstorms. Watch the gusts when you jump!',
      theme: 'desert',
      hazard: 'wind',
      boss: { kind: 'thornback', name: 'THE DUNE THORNBACK', flavor: 'A colossal beetle bursts from the sand! Jump its charge!', sizeScale: 2.0 }
    },
    {
      id: 'ice',
      name: 'THE FROZEN PEAKS',
      icon: '❄️',
      flavor: 'A silent night under the aurora. The ice is slippery: you can\'t stop on a dime!',
      theme: 'ice',
      physics: { slippery: true },
      boss: { kind: 'mutant', power: 8, movement: 'walker', seed: 4242, name: 'THE FROST BEHEMOTH', flavor: 'Something enormous wakes beneath the snow!', sizeScale: 1.8 }
    },
    {
      id: 'volcano',
      name: 'THE MOLTEN CORE',
      icon: '🌋',
      flavor: 'Rivers of lava and fire raining from the sky. Smash the lava bombs!',
      theme: 'volcano',
      hazard: 'lavaBombs',
      boss: { kind: 'golem', name: 'THE MAGMA GOLEM', flavor: 'The heart of the volcano rises, bigger and angrier than ever!', sizeScale: 1.35 }
    },
    {
      id: 'candy',
      name: 'THE CANDY KINGDOM',
      icon: '🍭',
      flavor: 'Sweet as can be... and full of teeth. Bounce on the marshmallows!',
      theme: 'candy',
      layout: { bouncy: true },
      boss: { kind: 'nutling', name: 'THE JAWBREAKER', flavor: 'A giant candied nut with a mean bite! Watch its hops!', sizeScale: 2.6 }
    },
    {
      id: 'moon',
      name: 'THE SILENT MOON',
      icon: '🌙',
      flavor: 'The Earth hangs overhead. Gravity is weak here: float across the craters!',
      theme: 'moon',
      physics: { gravityScale: 0.55 },
      boss: { kind: 'mutant', power: 10, movement: 'flyer', seed: 9001, name: 'THE STAR DEVOURER', flavor: 'A monster from beyond the stars!', sizeScale: 2.0 }
    },
    // --- Future meets fantasy ---
    {
      id: 'neon',
      name: 'NEON SPELL CITY',
      icon: '🌃',
      flavor: 'Wizard towers and hover-lights under a synthwave sun. The streets hum with magic!',
      theme: 'neon',
      future: true,
      boss: { kind: 'mutant', power: 7, movement: 'flyer', seed: 7071, cyber: true, name: 'THE NEON WYRM', flavor: 'A glowing dragon made of pure electric spellfire!', sizeScale: 1.9 }
    },
    {
      id: 'crystal',
      name: 'THE CIRCUIT CRYSTAL CAVES',
      icon: '💎',
      flavor: 'Enchanted crystals wired with ancient circuits. They hum and glow in the dark.',
      theme: 'crystal',
      future: true,
      boss: { kind: 'golem', name: 'THE CRYSTAL SENTINEL', flavor: 'A guardian of living crystal and fire boots up!', sizeScale: 1.2 }
    },
    {
      id: 'clockwork',
      name: 'THE CLOCKWORK SKY CITADEL',
      icon: '⚙️',
      flavor: 'A brass citadel floating on steam and sorcery. Mind the steam gusts!',
      theme: 'clockwork',
      future: true,
      hazard: 'wind',
      boss: { kind: 'thornback', name: 'THE BRASS BEETLE TITAN', flavor: 'A wind-up war beetle the size of a house! Jump its charge!', sizeScale: 2.1 }
    },
    {
      id: 'atlantis',
      name: 'TECHNO-ATLANTIS',
      icon: '🔱',
      flavor: 'A sunken city of glass domes and sea magic. Down here you float with every jump!',
      theme: 'atlantis',
      future: true,
      physics: { gravityScale: 0.75 },
      boss: { kind: 'jelly', name: 'THE ABYSSAL MEGAJELLY', flavor: 'The city\'s power core has come alive... and it stings!', sizeScale: 1.9 }
    },
    {
      id: 'fae',
      name: 'THE HOLO FAE GARDEN',
      icon: '🍄',
      flavor: 'Glowing mushrooms and hologram fairies. Bounce on the springy caps!',
      theme: 'fae',
      future: true,
      layout: { bouncy: true },
      boss: { kind: 'gloomwing', name: 'THE PIXIE MOTH EMPRESS', flavor: 'Wings of light and a temper to match! Strike as she dives!', sizeScale: 2.3 }
    },
    {
      id: 'mechKeep',
      name: 'THE MECH DRAGON KEEP',
      icon: '🐉',
      flavor: 'A steel castle guarded by dragon drones. Smash the plasma bombs they drop!',
      theme: 'mechKeep',
      future: true,
      hazard: 'lavaBombs',
      boss: { kind: 'golem', name: 'THE DRAGON MECH', flavor: 'Half dragon, half war machine, all fire!', sizeScale: 1.45 }
    },
    {
      id: 'rift',
      name: 'THE QUANTUM RIFT',
      icon: '🌀',
      flavor: 'Floating islands torn from time. Gravity glitches here: soar across the void!',
      theme: 'rift',
      future: true,
      physics: { gravityScale: 0.6 },
      boss: { kind: 'mutant', power: 9, movement: 'walker', seed: 3141, cyber: true, name: 'THE VOID KNIGHT', flavor: 'A warrior from between the worlds steps through the portal!', sizeScale: 1.9 }
    },
    {
      id: 'station',
      name: 'THE STARWIZARD STATION',
      icon: '🛸',
      flavor: 'An orbital tower of rune engines. The decks are polished slick: careful how you stop!',
      theme: 'station',
      future: true,
      physics: { slippery: true },
      boss: { kind: 'mutant', power: 10, movement: 'flyer', seed: 2077, cyber: true, name: 'THE COSMIC ARCHMAGE', flavor: 'The station\'s mad wizard-machine wakes! Dodge its spells!', sizeScale: 2.0 }
    }
  ].map(theme => Object.freeze(theme));

  /** Flat, pit-free ground for training sessions against scrapbook picks. */
  const TRAINING_GROUND = {
    id: 'training',
    number: 0,
    name: 'TRAINING GROUND',
    icon: '🎯',
    flavor: '',
    theme: 'forest',
    playerStartX: 20,
    ground: [[-8, 52]],
    platforms: [],
    coins: [],
    enemies: [],
    arena: { start: 0, end: 44 },
    boss: null
  };

  Forest.Levels = Object.freeze({
    themes: Object.freeze(THEMES),
    generate,
    createRun,
    training: TRAINING_GROUND
  });
})(window.Forest);
