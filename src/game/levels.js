/**
 * The twenty-two side-scrolling worlds (plus a flat training ground), and the generator that lays a
 * fresh course out for each of them every time it is played.
 *
 * A world (an entry of Forest.Levels.themes) only fixes the look, the rules and the boss: `theme`
 * picks the art, `physics` can make it slippery or lower the gravity, `hazard` adds sandstorm wind
 * or falling bombs (`bombStyle` recolours them), `layout.bouncy` scatters bounce pads,
 * `layout.rising` makes the ledges float up, `layout.beat` makes them bob to the music, `natives`
 * fills the world with its own creatures and `screen` gives the whole screen a look (black and white). Forest.Levels.generate() then rolls
 * the course itself: where the ground breaks into pits, the ledges, stairs and stepping stones, the
 * high route, the enemies and the coins. An adventure visits every world once, in a shuffled order
 * (Forest.Levels.createRun), and the monsters and bosses get tougher with each world visited.
 *
 * Positions are in world units: x along the level, y up from the grass line (0).
 *  - ground:    [left, right, height] solid segments; the spaces between them are bottomless pits.
 *               Segments that touch at different heights are hills (their sides are walls)
 *  - platforms: one-way ledges { x: left edge, y: top, width } (bouncy ones launch the boy, moving
 *               ones ferry him across, crumbling ones fall away soon after he lands)
 *  - traps:     spikes { x: left edge, width, period, phase } that pop up out of the ground
 *  - islands:   huge platforms high in the sky (platforms with `island`), a second ground level
 *               reached by the trampoline under their near end, with monsters of their own
 *  - coins:     { x, y } centre of each coin
 *  - specialTraps: where the world's own trap goes (`trap`, see Forest.WorldTraps): { x, height,
 *               left, right } with the ends of the ground it stands on
 *  - featured:  the level's own creature, which makes up a good share of its enemies (a Monster
 *               Forge species with a fixed seed, so it's the same monster each time, or a sky creature)
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
      // Moving stones over a pit leave their coins to the arc over it
      if (platform.move && platform.essential) return;
      if (platform.island) {
        for (let x = platform.x + 1.5; x < platform.x + platform.width - 1.5; x += 3) coins.push(...coinRow(x, platform.y + GROUND_COIN_Y, 2));
        return;
      }
      if (platform.bouncy && platform.essential) {
        // The trampoline up to a sky island: one coin just above it (any higher is inside the island)
        coins.push({ x: platform.x + platform.width / 2, y: platform.y + 1.1 });
        return;
      }
      if (platform.bouncy) {
        coins.push(...coinRow(platform.x + platform.width / 2 - 0.35, platform.y + 3.4, 2));
        return;
      }
      coins.push(...coinsOn(platform, Math.max(2, Math.min(4, Math.round(platform.width / 1.0)))));
    });
    const sorted = [...ground].sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < sorted.length - 1; i++) {
      const [, left, leftHeight = 0] = sorted[i];
      const [right, , rightHeight = 0] = sorted[i + 1];
      const gap = right - left;
      if (gap < 0.5) continue; // the foot of a hill, not a pit
      const count = Math.max(3, Math.min(7, Math.round(gap / 1.2) + 1));
      const baseY = Math.max(leftHeight, rightHeight) + 0.8;
      coins.push(...coinArc(left - 0.5, right + 0.5, baseY, Math.min(2.6, 0.8 + gap * 0.35) * jumpScale, count));
    }
    sorted.forEach(([left, right, height = 0]) => {
      const end = Math.min(right, arena.start) - 2;
      if (end - (left + 2) > 10) coins.push(...coinRow((left + end) / 2 - 1.4, height + GROUND_COIN_Y, 5));
      // A little prize on top of every hill
      else if (height > 0 && right - left >= 2.5) coins.push(...coinRow((left + right) / 2 - 0.7, height + GROUND_COIN_Y, 3));
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
  /** Share of the plain ledges on a high route that crumble. */
  const ROUTE_CRUMBLE_CHANCE = 0.3;

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
        // Some fall away under him: keep moving!
        const ledge = { x: cursor, y, width, crumble: random() < ROUTE_CRUMBLE_CHANCE };
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
  const SEGMENT_LENGTH = [5, 16];
  /** Ledges and stairs only go on stretches of ground at least this long (not on hill tops). */
  const MIN_LEDGE_SEGMENT = 6;
  /** The tricky obstacles and the spikes reach their most common after this many worlds. */
  const CHALLENGE_RAMP_WORLDS = 12;
  /** Each tier of a hill (or cliff) is this much higher: always within a single jump. */
  const HILL_STEP = [0.9, 1.3];
  /** Ground never rises more than this above the grass line. */
  const MAX_GROUND_HEIGHT = 2.6;
  /** Ground lower than this above the grass line is just flat. */
  const MIN_STEP = 0.6;
  /** The pit in front of a cliff going up is narrower, as he has to jump up as well as across. */
  const CLIFF_UP_PIT = [1.4, 2.1];
  /** Pits crossed on a ferry, on two bobbing stones, or on two crumbling stones. */
  const FERRY_PIT_WIDTH = [7, 9];
  const FERRY_WIDTH = 2.4;
  /** The ferry stops this far short of each edge (a step across). */
  const FERRY_EDGE_GAP = 0.3;
  const BOBBING_PIT_WIDTH = [5.5, 7];
  const CRUMBLING_PIT_WIDTH = [5, 6.5];
  /** Spikes: how often a spot on the ground gets them (first world, later worlds), and how wide. */
  const SPIKE_CHANCE = [0.22, 0.5];
  const SPIKE_WIDTH = [1.4, 2.2];
  const SPIKES_FROM_X = 14;
  /** Sky islands: how many (rounded), how wide, how far apart, and never before this x. */
  const ISLAND_COUNT = [2, 3.4];
  const ISLAND_WIDTH = [7, 28];
  const ISLAND_SPACING = 10;
  const ISLANDS_FROM_X = 20;
  /**
   * They float this far above their trampoline (times the jump scale). A bounce alone goes ~4.5,
   * and a double jump at the top of it ~1.7 more, so the highest ones need both.
   */
  const ISLAND_RISE = [2.6, 5.0];
  /**
   * How thick the slab under the surface is (the tapering steps below add 80% more), never so
   * thick that the underside comes closer than ISLAND_HEADROOM to the ground below.
   */
  const ISLAND_THICKNESS = [0.3, 2.2];
  const ISLAND_HEADROOM = 1.7;
  /** Room taken by the surface tiles on top, and the share of the slab the tapering steps add. */
  const ISLAND_SURFACE_DEPTH = 0.5;
  const ISLAND_TAPER_SHARE = 0.8;
  /** And at least this far above any ground under them, so he can walk (and jump) underneath. */
  const ISLAND_CLEARANCE = 2.8;
  const TRAMPOLINE_WIDTH = 2.2;
  /** The trampoline starts this far in under the island's near end. */
  const TRAMPOLINE_INSET = 0.2;
  /** Share of the spots along the ground that get a trampoline (with a high ledge), outside the bouncy worlds. */
  const TRAMPOLINE_CHANCE = 0.14;
  /** The ice world's thin ice: every this-many-th obstacle is thin ice, over a pit this wide. */
  const THIN_ICE_EVERY = 3;
  const THIN_ICE_WIDTH = [2.4, 3.2];
  /** Each world's own trap: how many in a level (first world, later worlds), and how far apart at least. */
  const SPECIAL_TRAP_COUNT = [4, 7];
  const SPECIAL_TRAP_SPACING = 8;
  const SPECIAL_TRAPS_FROM_X = 16;
  /** How much clear ground each trap needs behind (to the left) and ahead (to the right) of its spot. */
  const SPECIAL_TRAP_SPACE = {
    flytrap: [1, 1], pendulum: [2, 2], thundercloud: [1.2, 1.2], quicksand: [0.3, 3.3],
    geyser: [1, 1], jawbreaker: [2.5, 2.5], meteor: [1.5, 1.5], laserGate: [0.8, 0.8],
    crystalArc: [0.6, 3.4], crusher: [1.4, 1.4], seaMine: [1, 1], spider: [1, 1], puffball: [1, 1],
    flamethrower: [3.5, 1], rift: [1, 1], airlockVent: [4, 1], bananaPeel: [0.6, 0.6], boulder: [1, 1],
    stoveBurner: [0.3, 2.5], speaker: [5.5, 1], tractorBeam: [1.2, 1.2]
  };
  /** Traps that are tall or come from above, kept out from under the sky islands (the rest may sit beneath them). */
  const TALL_TRAPS = new Set(['pendulum', 'thundercloud', 'geyser', 'laserGate', 'meteor', 'crusher', 'seaMine', 'spider', 'tractorBeam', 'boulder']);
  /** Monsters on each sky island: one per this many units of it (at least one, two on the bigger ones). */
  const ISLAND_UNITS_PER_MONSTER = 7;
  /** Monster Forge power at the first world, and how much it grows with each world visited. */
  const FIRST_POWER = 1;
  const POWER_PER_LEVEL = 0.55;
  const MAX_POWER = 10;
  const BOSS_FIRST_HP = 10;
  const BOSS_HP_PER_LEVEL = 0.7;
  const SKY_KINDS = ['nutling', 'thornback', 'gloomwing', 'jelly'];
  /** Share of a level's enemies that are its featured creature, and the chance that it's a sky creature (not a mutant species). */
  const FEATURED_SHARE = 0.45;
  const FEATURED_SKY_CHANCE = 0.35;
  /** A featured mutant in the future-tech worlds is usually cyber. */
  const FEATURED_CYBER_CHANCE = 0.7;

  /** How much higher and further the boy jumps in a world (low gravity). */
  function jumpScaleOf(theme) {
    const gravityScale = (theme.physics && theme.physics.gravityScale) || 1;
    return Math.min(1.8, 1 / gravityScale);
  }

  /**
   * The ground up to `until`: flat stretches broken up by obstacles. Plain pits, wide ones with a
   * stepping stone, cliffs (a pit with higher or lower ground across it), hills of one or two tiers
   * (raised islands where the ground isn't solid), and pits crossed only on a ferry, on bobbing
   * stones or on stones that crumble away under him. The tricky ones turn up more in later worlds.
   * @returns {{ground:Array<[number, number, number]>, platforms:object[], right:number}} right: where the ground ends
   */
  function rollGround({ random, between, reach, lift, challenge, solidSides, thinIce, until }) {
    const ground = [];
    const platforms = [];
    let height = 0;
    let right = between(13, 18);
    ground.push([-8, right, 0]);
    /** A segment of ground from `left`, `length` long. */
    const addGround = (left, length, segmentHeight) => {
      ground.push([left, left + length, segmentHeight]);
      right = left + length;
      height = segmentHeight;
    };
    const run = () => between(...SEGMENT_LENGTH);
    const rise = () => between(...HILL_STEP) * lift;
    const weights = {
      pit: 30,
      widePit: 12,
      cliff: 12,
      hill: 18,
      ferry: 7 + 7 * challenge,
      bobbing: 6 + 6 * challenge,
      crumbling: 6 + 8 * challenge
    };
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const pickObstacle = () => {
      let roll = random() * total;
      for (const [kind, weight] of Object.entries(weights)) {
        roll -= weight;
        if (roll < 0) return kind;
      }
      return 'pit';
    };

    const ceiling = MAX_GROUND_HEIGHT * lift;
    let obstacleCount = 0;
    const tallestStep = HILL_STEP[1] * lift;
    while (right < until) {
      obstacleCount++;
      let kind = thinIce && obstacleCount % THIN_ICE_EVERY === 2 ? 'thinIce' : pickObstacle();
      // No room for a hill this high up: step back down instead
      if (kind === 'hill' && height + tallestStep > ceiling) kind = 'cliff';
      if (kind === 'widePit') {
        const pit = between(...WIDE_PIT_WIDTH) * reach;
        platforms.push({ x: right + pit / 2 - 1, y: height + between(1.0, 1.4) * lift, width: 2, essential: true });
        addGround(right + pit, run(), height);
      } else if (kind === 'cliff') {
        // Up when low, down when already high
        const goesUp = height + tallestStep <= ceiling && (height === 0 || random() < 0.5);
        if (goesUp) {
          addGround(right + between(...CLIFF_UP_PIT) * reach, run(), height + rise());
        } else {
          // A step too small to see is levelled off
          const lower = height - rise();
          addGround(right + between(...PIT_WIDTH) * reach, run(), lower < MIN_STEP ? 0 : lower);
        }
      } else if (kind === 'hill') {
        const base = height;
        const twoTiers = base + 2 * tallestStep <= ceiling && random() < 0.35 + 0.3 * challenge;
        const firstRise = rise();
        if (solidSides) {
          // Climb up a tier or two, then down the far side (or leap off it across a pit)
          addGround(right, between(3, 5), base + firstRise);
          if (twoTiers) {
            addGround(right, between(2.5, 4), base + firstRise + rise());
            addGround(right, between(2.5, 4), base + firstRise);
          }
          if (random() < 0.3) addGround(right + between(...PIT_WIDTH) * reach, run(), base);
          else addGround(right, run(), base);
        } else {
          // A raised island with a hop up onto it and a drop off the far side
          addGround(right + between(...CLIFF_UP_PIT) * reach, between(4, 6), base + firstRise);
          addGround(right + between(...PIT_WIDTH) * reach, run(), base);
        }
      } else if (kind === 'ferry') {
        // Too wide to jump: wait for the ferry and ride it over
        const pit = between(...FERRY_PIT_WIDTH) * reach;
        const travel = pit - 2 * FERRY_EDGE_GAP - FERRY_WIDTH;
        platforms.push({
          x: right + FERRY_EDGE_GAP, y: height, width: FERRY_WIDTH, essential: true,
          move: { dx: travel, dy: 0, period: 2.6 + travel * 0.35, phase: random() }
        });
        addGround(right + pit, run(), height);
      } else if (kind === 'bobbing') {
        // Two stones rising and sinking in turn: time each hop
        const pit = between(...BOBBING_PIT_WIDTH) * reach;
        const period = between(2.6, 3.2);
        [1, 2].forEach(step => platforms.push({
          x: right + (pit * step) / 3 - 0.9, y: height - 0.4, width: 1.8, essential: true,
          move: { dx: 0, dy: 1.6 * lift, period, phase: step === 1 ? 0 : 0.5 }
        }));
        addGround(right + pit, run(), height);
      } else if (kind === 'thinIce') {
        // Looks like solid ice, but it cracks and drops away under him: a pit is hiding beneath
        const pit = between(...THIN_ICE_WIDTH) * reach;
        platforms.push({ x: right, y: height, width: pit, essential: true, crumble: true, thinIce: true });
        addGround(right + pit, run(), height);
      } else if (kind === 'crumbling') {
        // Two stones that fall away soon after he lands: keep going!
        const pit = between(...CRUMBLING_PIT_WIDTH) * reach;
        [1, 2].forEach(step => platforms.push({
          x: right + (pit * step) / 3 - 0.75, y: height + 0.7, width: 1.5, essential: true, crumble: true
        }));
        addGround(right + pit, run(), height);
      } else {
        addGround(right + between(...PIT_WIDTH) * reach, run(), height);
      }
    }
    return { ground, platforms, right };
  }

  /**
   * Huge islands floating high above the course, so it feels like a second ground level up there.
   * Each one has a trampoline on the ground under its near end to bounce up onto it, and solid
   * ground under its far end to drop back down to. They keep clear of the high route.
   * @returns {{islands:object[], trampolines:object[]}}
   */
  function rollSkyIslands({ ground, routes, arena, random, between, jumpScale }) {
    const islands = [];
    const trampolines = [];
    const segmentAt = x => ground.find(([l, r]) => x >= l && x <= r);
    const keepClear = routes.map(route => [route.x - 4, route.x + 34]);
    const count = Math.round(between(...ISLAND_COUNT));
    for (let attempt = 0; attempt < 60 && islands.length < count; attempt++) {
      const width = between(...ISLAND_WIDTH);
      const x = between(ISLANDS_FROM_X, arena.start - 8 - width);
      const end = x + width;
      if (keepClear.some(([clearLeft, clearRight]) => end > clearLeft && x < clearRight)) continue;
      if (islands.some(other => end > other.x - ISLAND_SPACING && x < other.x + other.width + ISLAND_SPACING)) continue;
      // Solid ground under the trampoline, and under the drop off the far end
      const padX = x + TRAMPOLINE_INSET;
      const padGround = segmentAt(padX - 0.3);
      if (!padGround || padGround[1] < padX + TRAMPOLINE_WIDTH + 0.3) continue;
      if (!ground.some(([l, r]) => l <= end - 0.5 && r >= end + 2.5)) continue;
      const padTop = (padGround[2] || 0) + 0.6;
      const y = padTop + between(...ISLAND_RISE) * jumpScale;
      const highestBelow = Math.max(0, ...ground.filter(([l, r]) => r > x && l < end).map(([, , h = 0]) => h));
      if (y - highestBelow < ISLAND_CLEARANCE) continue;
      // Thin decks and chunky slabs, as thick as the room underneath allows
      const roomForSlab = (y - highestBelow - ISLAND_SURFACE_DEPTH - ISLAND_HEADROOM) / (1 + ISLAND_TAPER_SHARE);
      const thickness = Math.max(ISLAND_THICKNESS[0], Math.min(roomForSlab, between(...ISLAND_THICKNESS)));
      islands.push({ x, y, width, thickness, island: true, essential: true });
      trampolines.push({ x: padX, y: padTop, width: TRAMPOLINE_WIDTH, bouncy: true, essential: true });
    }
    return { islands, trampolines };
  }

  /**
   * Where the world's own trap goes: spots on the ground with room around them, well apart, never
   * at the start, in the arena or by the high route's way up (nor under a sky island, if it's tall). Banana peels lie
   * a few steps before the edge of a pit (that's where slipping hurts).
   * @returns {Array<{x:number, height:number, left:number, right:number, phase:number}>}
   */
  function rollSpecialTraps({ kind, ground, routes, islands, trampolines, arena, random, between, challenge }) {
    const space = SPECIAL_TRAP_SPACE[kind];
    if (!space) return [];
    const [before, after] = space;
    const keepClear = [
      ...routes.map(route => [route.x - 4, route.x + 8]),
      ...(TALL_TRAPS.has(kind) ? islands.map(island => [island.x - 2, island.x + island.width + 2]) : []),
      ...trampolines.map(pad => [pad.x - 1.5, pad.x + pad.width + 1.5])
    ];
    const isClear = (from, to) => !keepClear.some(([clearLeft, clearRight]) => to > clearLeft && from < clearRight);
    const candidates = [];
    ground.forEach(([left, right, height = 0], index) => {
      const next = ground[index + 1];
      if (kind === 'bananaPeel') {
        const pitAhead = next && next[0] - right > 0.5;
        const x = right - between(2.5, 3.5);
        if (pitAhead && x - before > left && x > SPECIAL_TRAPS_FROM_X && x < arena.start - 6 && isClear(x - before, x + after)) {
          candidates.push({ x, height, left, right });
        }
        return;
      }
      const from = Math.max(left + before + 0.5, SPECIAL_TRAPS_FROM_X);
      const to = Math.min(right - after - 0.5, arena.start - 6);
      for (let x = from + random() * 2; x < to; x += between(3, 5)) {
        if (isClear(x - before, x + after)) candidates.push({ x, height, left, right });
      }
    });
    // Shuffle, then keep as many as wanted that are far enough apart
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const wanted = Math.round(SPECIAL_TRAP_COUNT[0] + (SPECIAL_TRAP_COUNT[1] - SPECIAL_TRAP_COUNT[0]) * challenge);
    const chosen = [];
    candidates.forEach(spot => {
      if (chosen.length >= wanted) return;
      if (chosen.some(other => Math.abs(other.x - spot.x) < SPECIAL_TRAP_SPACING)) return;
      chosen.push({ ...spot, phase: random() });
    });
    return chosen.sort((a, b) => a.x - b.x);
  }

  /**
   * Spikes that pop out of the ground, on the longer flat stretches (never at the very start, by
   * the high route's way up or in the arena). Later worlds have more of them.
   */
  function rollSpikeTraps({ ground, routes, arena, random, between, challenge, keepClear: alsoClear = [] }) {
    const traps = [];
    const chance = SPIKE_CHANCE[0] + (SPIKE_CHANCE[1] - SPIKE_CHANCE[0]) * challenge;
    const keepClear = [...routes.map(route => [route.x - 1.5, route.x + 7]), ...alsoClear];
    ground.forEach(([left, right, height = 0]) => {
      const from = Math.max(left + 2.5, SPIKES_FROM_X);
      const to = Math.min(right - 2.5, arena.start - 4);
      for (let x = from + random() * 3; x + SPIKE_WIDTH[1] < to; x += between(5, 8)) {
        if (random() > chance) continue;
        const width = between(...SPIKE_WIDTH);
        if (keepClear.some(([clearLeft, clearRight]) => x + width > clearLeft && x < clearRight)) continue;
        traps.push({ x, width, height, period: between(2.8, 3.6), phase: random() });
      }
    });
    return traps;
  }

  /**
   * Roll a course: ground with pits, ledges and stairs, a high route, and the enemies.
   * @param {object} theme an entry of THEMES
   * @param {() => number} random
   * @param {number} jumpScale
   * @param {number} position how many worlds came before this one in the adventure
   * @param {boolean} solidSides the ground is solid earth all the way down (false: floating
   *   branches, clouds or rainbows, which only get raised islands, never hills)
   */
  function rollCourse(theme, random, jumpScale, position, solidSides) {
    const between = (low, high) => low + random() * (high - low);
    const pick = list => list[Math.floor(random() * list.length)];
    // Pits widen with the boy's reach (low gravity) and shrink against a headwind
    const reach = theme.hazard === 'wind' ? 0.85 : Math.min(1.35, Math.sqrt(jumpScale));
    // Ledges sit higher where he jumps higher
    const lift = Math.min(1.4, Math.sqrt(jumpScale));
    const arenaTarget = Math.round(between(...ARENA_START_RANGE));

    const challenge = Math.min(1, position / CHALLENGE_RAMP_WORLDS);
    const { ground, platforms, right } = rollGround({
      random, between, reach, lift, challenge, solidSides, thinIce: theme.trap === 'thinIce',
      until: arenaTarget - SEGMENT_LENGTH[1]
    });
    // One more pit, then the flat ground of the arena
    const lastLeft = right + between(PIT_WIDTH[0], 3.0) * reach;
    const arenaStart = Math.max(arenaTarget, lastLeft + 6);
    const arena = { start: arenaStart, end: arenaStart + ARENA_WIDTH };
    ground.push([lastLeft, arena.end + 8, 0]);

    // Ledges, stairs and bounce pads along the longer stretches of ground
    const bouncy = Boolean(theme.layout && theme.layout.bouncy);
    ground.forEach(([segmentLeft, segmentRight, height = 0], index) => {
      if (segmentRight - segmentLeft < MIN_LEDGE_SEGMENT) return;
      // Nothing may hang over the hill rising at the end of this stretch
      const next = ground[index + 1];
      const risesAfter = next && Math.abs(next[0] - segmentRight) < 0.01 && (next[2] || 0) > height;
      const to = Math.min(segmentRight - (risesAfter ? 3 : 0), arena.start - 3);
      let x = Math.max(segmentLeft + 1.2, 7) + random() * 2;
      while (x < to - 3) {
        const roll = random();
        if (roll < (bouncy ? 0.25 : TRAMPOLINE_CHANCE) && x + 7 < to) {
          platforms.push({ x, y: height + 0.6, width: 2.2, bouncy: true });
          platforms.push({ x: x + 3.4, y: height + 4.4 * lift, width: 3 });
          x += 6.4 + between(3, 5);
        } else if (roll < 0.5) {
          const width = between(2.5, 3.5);
          platforms.push({ x, y: height + between(1.4, 1.8) * lift, width });
          x += width + between(3, 6);
        } else if (roll < 0.72 && x + 9 < to + 2) {
          const steps = random() < 0.5 ? 2 : 3;
          for (let step = 0; step < steps; step++) platforms.push({ x: x + step * 3.6, y: height + (1.5 + step * 1.5) * lift, width: 2.5 });
          x += steps * 3.6 + between(3, 5);
        } else {
          x += between(3, 6);
        }
      }
    });

    // One high route, starting from solid ground
    const routes = [];
    const routeGround = ground.filter(([l, r, h = 0]) => h === 0 && r - l >= 7 && l > 8 && r < arena.start - 24);
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

    // Huge islands in the sky; ledges that would crowd them make way
    const { islands, trampolines } = rollSkyIslands({ ground, routes, arena, random, between, jumpScale });
    const skyPlatforms = [...islands, ...trampolines];
    const roomyPlatforms = platforms.filter(platform => platform.essential || !islands.some(island => isCrowding(platform, island)));
    platforms.length = 0;
    platforms.push(...roomyPlatforms, ...skyPlatforms);

    const specialTraps = rollSpecialTraps({ kind: theme.trap, ground, routes, islands, trampolines, arena, random, between, challenge });
    const keepClear = [
      ...trampolines.map(pad => [pad.x - 1, pad.x + pad.width + 1]),
      ...specialTraps.map(spot => {
        const [before, after] = SPECIAL_TRAP_SPACE[theme.trap];
        return [spot.x - before - 1, spot.x + after + 1];
      })
    ];
    const traps = rollSpikeTraps({ ground, routes, arena, random, between, challenge, keepClear });

    // Enemies, only over solid ground, getting stronger towards the arena and with every world
    const enemies = [];
    const basePower = FIRST_POWER + Math.floor(position * POWER_PER_LEVEL);
    // Some worlds are crawling with their own creatures (spiders on the rainbow, crawlers on the ship)
    const natives = theme.natives || null;
    // Every level has a creature of its own that turns up far more than the rest (the worlds
    // with natives already have theirs)
    let featured = null;
    if (!natives) {
      if (random() < FEATURED_SKY_CHANCE) {
        featured = { kind: pick(SKY_KINDS) };
      } else {
        // One species at one power, so every one of them is the same monster
        featured = { kind: 'mutant', seed: Math.floor(random() * 0x7fffffff), power: Math.min(MAX_POWER, basePower + 1) };
        if (theme.future) featured.cyber = random() < FEATURED_CYBER_CHANCE;
      }
    }
    const rollEnemy = x => {
      const roll = random();
      if (natives && random() < natives.share) return { kind: pick(natives.kinds), x };
      if (roll < 0.08) return { kind: 'mushroom', x };
      if (roll < 0.36) return { kind: pick(SKY_KINDS), x };
      return { kind: 'mutant', x, power: Math.min(MAX_POWER, basePower + Math.floor((x / arena.start) * 2.5)) };
    };
    for (let x = between(12, 16); x < arena.start - 4; x += between(6, 9)) {
      if (!ground.some(([l, r]) => x > l + 1 && x < r - 1)) continue;
      const entry = rollEnemy(x);
      // The ones under a sky island stay down on the ground
      if (islands.some(island => x > island.x - 1 && x < island.x + island.width + 1)) entry.allowLedges = false;
      enemies.push(entry);
    }
    // Every sky island has monsters of its own
    islands.forEach(island => {
      const count = Math.max(island.width >= 12 ? 2 : 1, Math.round(island.width / ISLAND_UNITS_PER_MONSTER));
      for (let i = 0; i < count; i++) {
        const x = island.x + 2 + ((island.width - 4) * (i + 0.5)) / count;
        enemies.push({ ...rollEnemy(x), allowLedges: true });
      }
    });
    // Then a fixed share of them, picked at random, become the featured creature (so a level
    // never ends up with just one or two of them by bad luck)
    if (featured) {
      const order = enemies.map((_, index) => index);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      order.slice(0, Math.round(enemies.length * FEATURED_SHARE)).forEach(index => {
        const { x, allowLedges } = enemies[index];
        enemies[index] = { ...featured, x, ...(allowLedges !== undefined ? { allowLedges } : {}) };
      });
    }
    enemies.sort((a, b) => a.x - b.x);

    return { ground, platforms, routes, traps, specialTraps, featured, enemies, arena };
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
    const allPlatforms = [...kept, ...routePlatforms].map(platform => animatePlatform(platform, level.layout, random));
    return Object.freeze({ ...level, platforms: allPlatforms, coins });
  }

  /** Still ledges in the rising world float up (and pop back down); on the concert stage they bob to the beat. */
  const RISE_DISTANCE = 1.4;
  const RISE_PERIOD = [3.5, 5.5];
  const BEAT_BOB_HEIGHT = 0.22;

  function animatePlatform(platform, layout, random) {
    if (!layout || platform.move || platform.bouncy || platform.crumble || platform.island) return platform;
    if (layout.rising) {
      return { ...platform, move: { rise: RISE_DISTANCE, period: RISE_PERIOD[0] + random() * (RISE_PERIOD[1] - RISE_PERIOD[0]), phase: random() } };
    }
    if (layout.beat) {
      // One bob every two beats, alternating ledges moving in opposite directions
      const period = (60 / layout.beat) * 2;
      return { ...platform, y: platform.y - BEAT_BOB_HEIGHT / 2, move: { dx: 0, dy: BEAT_BOB_HEIGHT, period, phase: random() < 0.5 ? 0 : 0.5 } };
    }
    return platform;
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
    const solidSides = !Forest.LevelScenery || Forest.LevelScenery.hasSolidGround(theme.theme);
    const course = rollCourse(theme, random, jumpScaleOf(theme), position, solidSides);
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
      trap: 'flytrap',
      trapHint: 'Snapping flytraps bite anyone who walks into them. Jump over!',
      name: 'THE WHISPERING FOREST',
      icon: '🌲',
      flavor: 'Hop the gaps, grab the coins, and find out what rules these woods!',
      theme: 'forest',
      boss: { kind: 'jelly', name: 'KING THUNDER JELLY', flavor: 'A giant jelly crackling with lightning! Jump when it lands!', sizeScale: 1.7 }
    },
    {
      id: 'dungeon',
      trap: 'pendulum',
      trapHint: 'Giant axes swing from the ceiling. Time your run!',
      name: 'THE SUNKEN DUNGEON',
      icon: '🏰',
      flavor: 'Torchlit halls and bottomless pits. Something big is smouldering below...',
      theme: 'dungeon',
      boss: { kind: 'golem', name: 'THE CINDER GOLEM', flavor: 'A blazing giant crashes down! Smash its fireballs!', sizeScale: 1 }
    },
    {
      id: 'treetops',
      trap: 'thundercloud',
      trapHint: 'Thunderclouds flicker before lightning strikes.',
      name: 'THE CLOUD CANOPY',
      icon: '☁️',
      flavor: 'High above the forest, branch to branch and cloud to cloud. Don\'t look down!',
      theme: 'treetops',
      boss: { kind: 'gloomwing', name: 'THE GLOOMWING QUEEN', flavor: 'The mother of all moths rules the sky! Strike as she dives!', sizeScale: 2.2 }
    },
    {
      id: 'desert',
      trap: 'quicksand',
      trapHint: 'Quicksand slows you down, and pulls you under if you don\'t get out!',
      name: 'THE SCORCHING DUNES',
      icon: '🏜️',
      flavor: 'Blazing sun and howling sandstorms. Watch the gusts when you jump!',
      theme: 'desert',
      hazard: 'wind',
      boss: { kind: 'thornback', name: 'THE DUNE THORNBACK', flavor: 'A colossal beetle bursts from the sand! Jump its charge!', sizeScale: 2.0 }
    },
    {
      id: 'ice',
      trap: 'thinIce',
      trapHint: 'Thin ice cracks under your feet and drops you into the pit below.',
      name: 'THE FROZEN PEAKS',
      icon: '❄️',
      flavor: 'A silent night under the aurora. The ice is slippery: you can\'t stop on a dime!',
      theme: 'ice',
      physics: { slippery: true },
      boss: { kind: 'mutant', power: 8, movement: 'walker', seed: 4242, name: 'THE FROST BEHEMOTH', flavor: 'Something enormous wakes beneath the snow!', sizeScale: 1.8 }
    },
    {
      id: 'volcano',
      trap: 'geyser',
      trapHint: 'Lava geysers bubble, then blast up out of the rock.',
      name: 'THE MOLTEN CORE',
      icon: '🌋',
      flavor: 'Rivers of lava and fire raining from the sky. Smash the lava bombs!',
      theme: 'volcano',
      hazard: 'lavaBombs',
      boss: { kind: 'golem', name: 'THE MAGMA GOLEM', flavor: 'The heart of the volcano rises, bigger and angrier than ever!', sizeScale: 1.35 }
    },
    {
      id: 'candy',
      trap: 'jawbreaker',
      trapHint: 'Giant jawbreakers roll back and forth. Jump over them!',
      name: 'THE CANDY KINGDOM',
      icon: '🍭',
      flavor: 'Sweet as can be... and full of teeth. Bounce on the marshmallows!',
      theme: 'candy',
      layout: { bouncy: true },
      boss: { kind: 'nutling', name: 'THE JAWBREAKER', flavor: 'A giant candied nut with a mean bite! Watch its hops!', sizeScale: 2.6 }
    },
    {
      id: 'moon',
      trap: 'meteor',
      trapHint: 'Meteors fall where the red marks flash. Step aside!',
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
      trap: 'laserGate',
      trapHint: 'Laser gates blink before they switch on.',
      name: 'NEON SPELL CITY',
      icon: '🌃',
      flavor: 'Wizard towers and hover-lights under a synthwave sun. The streets hum with magic!',
      theme: 'neon',
      future: true,
      boss: { kind: 'mutant', power: 7, movement: 'flyer', seed: 7071, cyber: true, name: 'THE NEON WYRM', flavor: 'A glowing dragon made of pure electric spellfire!', sizeScale: 1.9 }
    },
    {
      id: 'crystal',
      trap: 'crystalArc',
      trapHint: 'Electric arcs crackle between the crystals. Hop over them!',
      name: 'THE CIRCUIT CRYSTAL CAVES',
      icon: '💎',
      flavor: 'Enchanted crystals wired with ancient circuits. They hum and glow in the dark.',
      theme: 'crystal',
      future: true,
      boss: { kind: 'golem', name: 'THE CRYSTAL SENTINEL', flavor: 'A guardian of living crystal and fire boots up!', sizeScale: 1.2 }
    },
    {
      id: 'clockwork',
      trap: 'crusher',
      trapHint: 'Pistons shake, then slam down. Run under while they rise!',
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
      trap: 'seaMine',
      trapHint: 'Sea mines bob up and down on their chains. Boom!',
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
      trap: 'puffball',
      trapHint: 'Spore puffballs make you dizzy: left and right swap round!',
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
      trap: 'flamethrower',
      trapHint: 'Flamethrowers fire back along the floor. Jump the flames!',
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
      trap: 'rift',
      trapHint: 'Step into a rift and it throws you back the way you came.',
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
      trap: 'airlockVent',
      trapHint: 'Airlock vents blast you backwards when the lamp flashes.',
      name: 'THE STARWIZARD STATION',
      icon: '🛸',
      flavor: 'An orbital tower of rune engines. The decks are polished slick: careful how you stop!',
      theme: 'station',
      future: true,
      physics: { slippery: true },
      boss: { kind: 'mutant', power: 10, movement: 'flyer', seed: 2077, cyber: true, name: 'THE COSMIC ARCHMAGE', flavor: 'The station\'s mad wizard-machine wakes! Dodge its spells!', sizeScale: 2.0 }
    },
    // --- The strange worlds ---
    {
      id: 'noir',
      trap: 'bananaPeel',
      trapHint: 'Watch out for banana peels!',
      name: 'THE SILENT FILM',
      icon: '🎞️',
      flavor: 'You fell into an old cartoon. Everything is black and white... even you!',
      theme: 'noir',
      screen: 'noir',
      boss: { kind: 'golem', name: 'THE INK BLOT GOLEM', flavor: 'A giant of spilled ink stomps out of the film reel!', sizeScale: 1.25 }
    },
    {
      id: 'mothership',
      trap: 'tractorBeam',
      trapHint: 'Tractor beams lift you up to a zapping saucer. Get out of the light!',
      name: 'THE ALIEN MOTHERSHIP',
      icon: '👽',
      flavor: 'Beamed aboard! The corridors are crawling with acid-spitting crawlers.',
      theme: 'mothership',
      future: true,
      natives: { kinds: ['crawler'], share: 0.55 },
      boss: { kind: 'crawler', name: 'THE HIVE QUEEN', flavor: 'The mother of all crawlers skitters out of the dark! Jump her dash!', sizeScale: 2.6 }
    },
    {
      id: 'rainbow',
      trap: 'spider',
      trapHint: 'Spiders drop down on their threads.',
      name: 'THE RAINBOW OF WEBS',
      icon: '🌈',
      flavor: 'Run along a rainbow above the clouds. Spiders drop in on silk threads!',
      theme: 'rainbow',
      layout: { bouncy: true },
      natives: { kinds: ['spider'], share: 0.55 },
      boss: { kind: 'spider', name: 'THE PRISM WIDOW', flavor: 'A colossal spider spins down from the rainbow! Dodge her pounce!', sizeScale: 2.6 }
    },
    {
      id: 'rising',
      trap: 'boulder',
      trapHint: 'Boulders shoot up out of the cracks in the ground.',
      name: 'THE WORLD THAT FALLS UP',
      icon: '🎈',
      flavor: 'Houses, cows, ledges... everything here is floating up into the sky!',
      theme: 'rising',
      physics: { gravityScale: 0.8 },
      layout: { rising: true },
      boss: { kind: 'mutant', power: 9, movement: 'flyer', seed: 6174, name: 'THE GRAVITY THIEF', flavor: 'It stole the world\'s gravity, and now it wants yours!', sizeScale: 2.0 }
    },
    {
      id: 'kitchen',
      trap: 'stoveBurner',
      trapHint: 'Stove burners glow orange, then red hot. Off you hop!',
      name: 'THE GIANT\'S KITCHEN',
      icon: '🍪',
      flavor: 'You\'ve shrunk to the size of a crumb! Peas are rolling off the giant\'s plate!',
      theme: 'kitchen',
      hazard: 'lavaBombs',
      bombStyle: { colorIndex: 2 },
      layout: { bouncy: true },
      boss: { kind: 'jelly', name: 'THE MIGHTY JELLO', flavor: 'Dessert has come alive! It wobbles, it zaps, it splits!', sizeScale: 2.0 }
    },
    {
      id: 'concert',
      trap: 'speaker',
      trapHint: 'Speakers blast shockwaves along the floor. Jump the beat!',
      name: 'THE OCTOPUS ROCK CONCERT',
      icon: '🐙',
      flavor: 'An octopus band is rocking the stage! Bounce on the speakers and ride the beat!',
      theme: 'concert',
      layout: { bouncy: true, beat: 140 },
      natives: { kinds: ['octorocker'], share: 0.45 },
      boss: { kind: 'octorocker', name: 'THE TENTACLE KING OF ROCK', flavor: 'The lead singer crowd-surfs right at you! Dodge the notes!', sizeScale: 2.2 }
    }
  ].map(theme => Object.freeze(theme));

  // ==========================================
  // The training ground
  // ==========================================
  const TRAINING_WIDTH = 44;
  /** Ledges are scattered between these x positions (the player starts in the middle). */
  const TRAINING_LEDGES_FROM = 2;
  const TRAINING_LEDGES_TO = 41;
  /** Staircases: steps this far apart across and this much higher each. */
  const STAIR_STEP_ACROSS = 2.8;
  const STAIR_STEP_RISE = 1.2;

  /**
   * Pit-free ground for training sessions against scrapbook picks, in the look and with the rules
   * of a chosen world, dotted with fresh random ledges and staircases (and bounce pads where the
   * world has them) every session.
   * @param {object} theme an entry of Forest.Levels.themes
   * @param {object} [options]
   * @param {number} [options.seed] the same seed always gives the same ledges
   */
  function trainingGround(theme, { seed = randomSeed() } = {}) {
    const random = createSeededRandom(seed);
    const between = (low, high) => low + random() * (high - low);
    const lift = Math.min(1.4, Math.sqrt(jumpScaleOf(theme)));
    const bouncy = Boolean(theme.layout && theme.layout.bouncy);
    const platforms = [];
    let x = between(TRAINING_LEDGES_FROM, TRAINING_LEDGES_FROM + 2);
    while (x < TRAINING_LEDGES_TO - 3) {
      const roll = random();
      if (roll < 0.3 && x + 3 * STAIR_STEP_ACROSS < TRAINING_LEDGES_TO) {
        // A staircase climbing to the right or to the left
        const steps = random() < 0.5 ? 2 : 3;
        const climbsRight = random() < 0.5;
        for (let step = 0; step < steps; step++) {
          const level = climbsRight ? step : steps - 1 - step;
          platforms.push({ x: x + step * STAIR_STEP_ACROSS, y: (1.3 + level * STAIR_STEP_RISE) * lift, width: 2.4 });
        }
        x += steps * STAIR_STEP_ACROSS + between(2, 4);
      } else if (bouncy && roll < 0.45 && x + 7 < TRAINING_LEDGES_TO) {
        platforms.push({ x, y: 0.6, width: 2.2, bouncy: true });
        platforms.push({ x: x + 3.4, y: 4.2 * lift, width: 3 });
        x += 6.4 + between(2, 4);
      } else if (roll < 0.8) {
        const width = between(2.5, 4);
        platforms.push({ x, y: between(1.4, 3.2) * lift, width });
        x += width + between(2, 5);
      } else {
        x += between(2, 4);
      }
    }
    return Object.freeze({
      ...theme,
      id: 'training',
      worldId: theme.id,
      number: 0,
      name: 'TRAINING GROUND',
      icon: '🎯',
      seed,
      playerStartX: TRAINING_WIDTH / 2 - 2,
      ground: [[-8, TRAINING_WIDTH + 8]],
      platforms,
      coins: [],
      traps: [],
      specialTraps: [],
      enemies: [],
      routes: [],
      arena: { start: 0, end: TRAINING_WIDTH },
      boss: null
    });
  }

  Forest.Levels = Object.freeze({
    themes: Object.freeze(THEMES),
    generate,
    createRun,
    trainingGround
  });
})(window.Forest);
