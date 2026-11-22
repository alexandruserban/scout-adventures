/**
 * The eight side-scrolling levels (plus a flat training ground). Each world looks different, and the
 * later ones each add a rule of their own: `physics` (slippery ice, low gravity), `hazard` (sandstorm
 * wind, falling lava bombs) or bouncy platforms.
 *
 * Positions are in world units: x along the level, y up from the grass line (0).
 *  - ground:    [left, right] solid segments; the spaces between them are bottomless pits
 *  - platforms: one-way ledges { x: left edge, y: top, width }
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

  // ==========================================
  // Level 1: the forest
  // ==========================================
  const forestPlatforms = {
    first: { x: 10, y: 1.5, width: 3 },
    stepLow: { x: 31, y: 1.5, width: 3 },
    stepHigh: { x: 35.5, y: 3.0, width: 3 },
    stepping: { x: 62.2, y: 1.2, width: 1.8 },
    stair1: { x: 70, y: 1.5, width: 2.5 },
    stair2: { x: 73.5, y: 3.0, width: 2.5 },
    stair3: { x: 77, y: 4.5, width: 3 },
    long: { x: 108, y: 1.6, width: 4 },
    perch: { x: 114, y: 2.6, width: 3 },
    lateLow: { x: 129, y: 1.5, width: 3 },
    lateHigh: { x: 134, y: 3.0, width: 3 }
  };

  const FOREST = {
    id: 'forest',
    number: 1,
    name: 'THE WHISPERING FOREST',
    icon: '🌲',
    flavor: 'Hop the gaps, grab the coins, and find out what rules these woods!',
    theme: 'forest',
    playerStartX: 2,
    routes: [{ x: 14, height: 6, length: 16, climb: 'tower' }],
    ground: [[-8, 24], [27, 44], [47, 60], [66, 84], [87.5, 100], [104, 122], [125, 184]],
    platforms: Object.values(forestPlatforms),
    coins: [
      ...coinRow(4, GROUND_COIN_Y, 5),
      ...coinsOn(forestPlatforms.first, 4),
      ...coinArc(23.2, 27.8, 0.8, 1.6, 5),
      ...coinsOn(forestPlatforms.stepLow, 3),
      ...coinsOn(forestPlatforms.stepHigh, 4),
      ...coinArc(43.2, 47.8, 0.8, 1.6, 5),
      ...coinRow(50, GROUND_COIN_Y, 6),
      ...coinsOn(forestPlatforms.stepping, 2),
      ...coinsOn(forestPlatforms.stair1, 3),
      ...coinsOn(forestPlatforms.stair2, 3),
      ...coinsOn(forestPlatforms.stair3, 4),
      ...coinArc(83.4, 88.1, 0.8, 1.7, 5),
      ...coinRow(90, GROUND_COIN_Y, 5),
      ...coinArc(99.4, 104.6, 1.0, 2.6, 6),
      ...coinsOn(forestPlatforms.long, 5),
      ...coinsOn(forestPlatforms.perch, 3),
      ...coinArc(121.4, 125.6, 0.8, 1.6, 5),
      ...coinsOn(forestPlatforms.lateLow, 3),
      ...coinsOn(forestPlatforms.lateHigh, 4),
      ...coinRow(140, GROUND_COIN_Y, 6)
    ],
    enemies: [
      { kind: 'mushroom', x: 16 },
      { kind: 'mutant', x: 34, power: 1 },
      { kind: 'nutling', x: 41 },
      { kind: 'mutant', x: 52, power: 1 },
      { kind: 'mutant', x: 57, power: 2 },
      { kind: 'mutant', x: 72, power: 2 },
      { kind: 'mushroom', x: 80 },
      { kind: 'mutant', x: 93, power: 2 },
      { kind: 'gloomwing', x: 97 },
      { kind: 'mutant', x: 112, power: 2 },
      { kind: 'mutant', x: 119, power: 3 },
      { kind: 'thornback', x: 131 },
      { kind: 'mutant', x: 137, power: 3 },
      { kind: 'mutant', x: 143, power: 3 }
    ],
    arena: { start: 150, end: 176 },
    boss: {
      kind: 'jelly',
      name: 'KING THUNDER JELLY',
      flavor: 'A giant jelly crackling with lightning! Jump when it lands!',
      x: 167,
      hp: 10,
      sizeScale: 1.7
    }
  };

  // ==========================================
  // Level 2: the dungeon
  // ==========================================
  const dungeonPlatforms = {
    entry1: { x: 8, y: 1.5, width: 3 },
    entry2: { x: 12.5, y: 3.0, width: 3 },
    gapA: { x: 31, y: 1.4, width: 2 },
    ledgeA: { x: 37, y: 2.0, width: 2.5 },
    gapB: { x: 43, y: 1.6, width: 2 },
    zig1: { x: 58, y: 1.5, width: 2.5 },
    zig2: { x: 62, y: 3.0, width: 2.5 },
    zig3: { x: 66, y: 1.5, width: 2.5 },
    shelf: { x: 75, y: 2.2, width: 3 },
    gapC: { x: 81, y: 1.5, width: 2 },
    vault1: { x: 88, y: 1.6, width: 3 },
    vault2: { x: 92.5, y: 3.1, width: 3 },
    gapD: { x: 105, y: 1.8, width: 2 },
    hall1: { x: 112, y: 1.5, width: 3 },
    hall2: { x: 117, y: 3.0, width: 3 },
    gapE: { x: 125, y: 1.5, width: 2 },
    gapF: { x: 135, y: 1.6, width: 2 },
    last1: { x: 142, y: 1.5, width: 3 },
    last2: { x: 147, y: 3.0, width: 3 }
  };

  const DUNGEON = {
    id: 'dungeon',
    number: 2,
    name: 'THE SUNKEN DUNGEON',
    icon: '🏰',
    flavor: 'Torchlit halls and bottomless pits. Something big is smouldering below...',
    theme: 'dungeon',
    playerStartX: 2,
    routes: [{ x: 109, height: 10, length: 16, climb: 'lift' }],
    ground: [[-8, 18], [21, 30], [34, 42], [46, 52], [55, 70], [74, 80], [84, 98], [102, 104], [108, 124], [128, 134], [138, 192]],
    platforms: Object.values(dungeonPlatforms),
    coins: [
      ...coinRow(3.5, GROUND_COIN_Y, 4),
      ...coinsOn(dungeonPlatforms.entry1, 3),
      ...coinsOn(dungeonPlatforms.entry2, 4),
      ...coinArc(17.4, 21.6, 0.8, 1.6, 5),
      ...coinsOn(dungeonPlatforms.gapA, 2),
      ...coinsOn(dungeonPlatforms.ledgeA, 3),
      ...coinsOn(dungeonPlatforms.gapB, 2),
      ...coinRow(47, GROUND_COIN_Y, 6),
      ...coinsOn(dungeonPlatforms.zig1, 3),
      ...coinsOn(dungeonPlatforms.zig2, 3),
      ...coinsOn(dungeonPlatforms.zig3, 3),
      ...coinsOn(dungeonPlatforms.shelf, 4),
      ...coinsOn(dungeonPlatforms.gapC, 2),
      ...coinsOn(dungeonPlatforms.vault1, 3),
      ...coinsOn(dungeonPlatforms.vault2, 4),
      ...coinArc(97.4, 102.6, 1.0, 2.4, 6),
      ...coinsOn(dungeonPlatforms.gapD, 2),
      ...coinsOn(dungeonPlatforms.hall1, 3),
      ...coinsOn(dungeonPlatforms.hall2, 4),
      ...coinsOn(dungeonPlatforms.gapE, 2),
      ...coinRow(129, GROUND_COIN_Y, 6),
      ...coinsOn(dungeonPlatforms.gapF, 2),
      ...coinsOn(dungeonPlatforms.last1, 3),
      ...coinsOn(dungeonPlatforms.last2, 4)
    ],
    enemies: [
      { kind: 'mutant', x: 15, power: 3 },
      { kind: 'nutling', x: 26 },
      { kind: 'mutant', x: 39, power: 3 },
      { kind: 'mutant', x: 49, power: 3 },
      { kind: 'thornback', x: 61 },
      { kind: 'mutant', x: 66, power: 4 },
      { kind: 'mutant', x: 77, power: 4 },
      { kind: 'jelly', x: 90 },
      { kind: 'mutant', x: 95, power: 4 },
      { kind: 'mutant', x: 114, power: 4 },
      { kind: 'mutant', x: 121, power: 5 },
      { kind: 'gloomwing', x: 131 },
      { kind: 'mutant', x: 144, power: 5 },
      { kind: 'mutant', x: 151, power: 5 }
    ],
    arena: { start: 158, end: 184 },
    boss: {
      kind: 'golem',
      name: 'THE CINDER GOLEM',
      flavor: 'A blazing giant crashes down! Smash its fireballs!',
      x: 175,
      hp: 12,
      sizeScale: 1
    }
  };

  // ==========================================
  // Level 3: the treetops
  // ==========================================
  const treetopPlatforms = {
    cloudA: { x: 15, y: 1.2, width: 2 },
    lookout: { x: 21, y: 2.2, width: 2.5 },
    cloudB: { x: 27.2, y: 1.6, width: 1.6 },
    cloudC: { x: 37.5, y: 1.0, width: 2.2 },
    hop1: { x: 43.5, y: 2.0, width: 2.5 },
    cloudD: { x: 49, y: 1.5, width: 2 },
    cloudE: { x: 61.5, y: 1.2, width: 2 },
    cloudF: { x: 73.5, y: 1.6, width: 2 },
    puffLow: { x: 83, y: 1.0, width: 1.6 },
    puffHigh: { x: 85.2, y: 2.4, width: 1.6 },
    bonus1: { x: 90, y: 2.0, width: 2.5 },
    bonus2: { x: 93, y: 3.6, width: 2.5 },
    cloudG: { x: 97.5, y: 1.4, width: 2 },
    cloudH: { x: 109.5, y: 1.2, width: 2 },
    nest: { x: 115, y: 1.8, width: 3 },
    cloudI: { x: 121.5, y: 1.6, width: 2 },
    cloudJ: { x: 133.5, y: 1.2, width: 2 },
    summit1: { x: 148, y: 1.6, width: 3 },
    summit2: { x: 153, y: 3.2, width: 3 }
  };

  const TREETOPS = {
    id: 'treetops',
    number: 3,
    name: 'THE CLOUD CANOPY',
    icon: '☁️',
    flavor: 'High above the forest, branch to branch and cloud to cloud. Don\'t look down!',
    theme: 'treetops',
    playerStartX: 2,
    routes: [{ x: 53, height: 7, length: 16, climb: 'tower' }],
    ground: [[-8, 14], [18, 26], [30, 36], [41, 48], [52, 60], [65, 72], [77, 82], [87, 96], [101, 108], [113, 120], [125, 132], [137, 198]],
    platforms: Object.values(treetopPlatforms),
    coins: [
      ...coinRow(4, GROUND_COIN_Y, 5),
      ...coinsOn(treetopPlatforms.cloudA, 2),
      ...coinsOn(treetopPlatforms.lookout, 3),
      ...coinsOn(treetopPlatforms.cloudB, 2),
      ...coinRow(31.5, GROUND_COIN_Y, 4),
      ...coinsOn(treetopPlatforms.cloudC, 3),
      ...coinsOn(treetopPlatforms.hop1, 3),
      ...coinsOn(treetopPlatforms.cloudD, 2),
      ...coinRow(54, GROUND_COIN_Y, 5),
      ...coinsOn(treetopPlatforms.cloudE, 2),
      ...coinsOn(treetopPlatforms.cloudF, 2),
      ...coinsOn(treetopPlatforms.puffLow, 2),
      ...coinsOn(treetopPlatforms.puffHigh, 2),
      ...coinsOn(treetopPlatforms.bonus1, 3),
      ...coinsOn(treetopPlatforms.bonus2, 4),
      ...coinsOn(treetopPlatforms.cloudG, 2),
      ...coinsOn(treetopPlatforms.cloudH, 2),
      ...coinsOn(treetopPlatforms.nest, 4),
      ...coinsOn(treetopPlatforms.cloudI, 2),
      ...coinRow(127, GROUND_COIN_Y, 5),
      ...coinsOn(treetopPlatforms.cloudJ, 2),
      ...coinsOn(treetopPlatforms.summit1, 3),
      ...coinsOn(treetopPlatforms.summit2, 4)
    ],
    enemies: [
      { kind: 'mutant', x: 10, power: 5 },
      { kind: 'gloomwing', x: 23 },
      { kind: 'mutant', x: 33, power: 5 },
      { kind: 'mutant', x: 45, power: 5 },
      { kind: 'mutant', x: 56, power: 6 },
      { kind: 'jelly', x: 69 },
      { kind: 'mutant', x: 80, power: 6 },
      { kind: 'mutant', x: 90, power: 6 },
      { kind: 'thornback', x: 94 },
      { kind: 'mutant', x: 105, power: 6 },
      { kind: 'mutant', x: 117, power: 7 },
      { kind: 'mutant', x: 129, power: 7 },
      { kind: 'nutling', x: 145 },
      { kind: 'mutant', x: 150, power: 7 },
      { kind: 'mutant', x: 157, power: 7 }
    ],
    arena: { start: 166, end: 192 },
    boss: {
      kind: 'gloomwing',
      name: 'THE GLOOMWING QUEEN',
      flavor: 'The mother of all moths rules the sky! Strike as she dives!',
      x: 182,
      hp: 14,
      sizeScale: 2.2
    }
  };

  // ==========================================
  // Helpers for the later worlds
  // ==========================================
  const FOE_CODES = { mu: 'mushroom', nut: 'nutling', tb: 'thornback', gw: 'gloomwing', je: 'jelly' };

  /**
   * Enemies from a compact list: "m5 12, nut 26" is a power-5 mutant at x 12 and a nutling at x 26.
   * Codes: m<power> mutant, mu mushroom, nut nutling, tb thornback, gw gloomwing, je jelly.
   */
  function foes(spec) {
    return spec.split(',').map(item => {
      const [code, x] = item.trim().split(/\s+/);
      if (/^m\d+$/.test(code)) return { kind: 'mutant', power: Number(code.slice(1)), x: Number(x) };
      return { kind: FOE_CODES[code], x: Number(x) };
    });
  }

  /** Platforms from [x, y, width] (add 'b' as a fourth item for a bouncy marshmallow pad). */
  function ledges(list) {
    return list.map(([x, y, width, flag]) => ({ x, y, width, bouncy: flag === 'b' }));
  }

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

  /** Mark a level's coins to be laid out automatically (see finishLevel). */
  function withCoins(level) {
    return { ...level, autoCoins: true };
  }

  // ==========================================
  // Shaping every level: narrower pits and high routes
  // ==========================================
  /** Pits are shrunk to this fraction of their drawn width (never below MIN_PIT_WIDTH). */
  const PIT_SCALE = 0.65;
  const MIN_PIT_WIDTH = 1.6;

  /** Shrink every pit around its middle by widening the ground on both sides. */
  function narrowPits(ground) {
    const segments = ground.map(([left, right]) => [left, right]).sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < segments.length - 1; i++) {
      const gap = segments[i + 1][0] - segments[i][1];
      const shrink = gap - Math.max(MIN_PIT_WIDTH, gap * PIT_SCALE);
      if (shrink <= 0) continue;
      segments[i][1] += shrink / 2;
      segments[i + 1][0] -= shrink / 2;
    }
    return segments;
  }

  /**
   * A route high above the level: a way up (a zig-zag tower of ledges, or a lift), then a run of
   * ledges of all sizes and ferries gliding back and forth, ending in a stash of coins. Fall off and
   * you drop back down into whatever is below.
   * @param {{x:number, height:number, length:number, climb:'tower'|'lift'}} route
   * @param {number} jumpScale how much higher and further he jumps here (low gravity)
   * @param {number} limitX the route must end before this x (the boss arena)
   * @returns {{platforms:object[], coins:object[]}}
   */
  function buildHighRoute({ x, height, length, climb }, jumpScale, limitX) {
    const random = Forest.MathUtils.createSeededRandom(Math.round(x * 31 + height * 7));
    const platforms = [];
    const coins = [];

    // The way up
    let startX;
    if (climb === 'lift') {
      const lift = { x, y: 0.6, width: 2.4, move: { dx: 0, dy: height - 0.6, period: 7 } };
      platforms.push(lift);
      coins.push(...coinRow(x + 0.85, height + 1.4, 2));
      startX = x + 3.6;
    } else {
      const rise = 1.4 * jumpScale;
      let step = 0;
      for (let y = 1.5; y < height - 0.01; y += rise, step++) {
        platforms.push({ x: x + (step % 2) * 2.4, y, width: 2.0 });
      }
      platforms.push({ x: x + (step % 2) * 2.4, y: height, width: 2.0 });
      startX = x + 2.4 * ((step % 2) + 1) + 0.6;
    }

    // The route across
    let cursor = startX;
    let previousY = height;
    const endX = Math.min(startX + length, limitX - 4);
    while (cursor < endX) {
      const isFerry = platforms.length > 2 && random() < 0.25;
      if (isFerry) {
        const travel = 2.6 * jumpScale;
        platforms.push({ x: cursor, y: previousY, width: 2.0, move: { dx: travel, dy: 0, period: 3.6 } });
        coins.push({ x: cursor + 1 + travel / 2, y: previousY + 1.2 });
        cursor += 2.0 + travel;
      } else {
        const width = 2.0 + random() * 1.8;
        const y = Math.max(height - 1.2, Math.min(height + 1.2, previousY + (random() - 0.5) * 1.8));
        const ledge = { x: cursor, y, width };
        platforms.push(ledge);
        coins.push(...coinsOn(ledge, width > 2.6 ? 3 : 2));
        previousY = y;
        cursor += width;
      }
      cursor += (1.1 + random() * 1.3) * jumpScale;
    }

    // The stash at the end
    const stash = { x: cursor, y: previousY, width: 3.6 };
    platforms.push(stash);
    coins.push(...coinsOn(stash, 4), ...coinRow(stash.x + 0.75, stash.y + 1.35, 4));
    return { platforms, coins };
  }

  /** Apply the shaping to a level: narrow its pits, add its high routes and lay out its coins. */
  function finishLevel(level) {
    const gravityScale = (level.physics && level.physics.gravityScale) || 1;
    const jumpScale = Math.min(1.8, 1 / gravityScale);
    const ground = narrowPits(level.ground);
    const platforms = [...level.platforms];
    const routeCoins = [];
    (level.routes || []).forEach(route => {
      const built = buildHighRoute(route, jumpScale, level.arena.start);
      platforms.push(...built.platforms);
      routeCoins.push(...built.coins);
    });
    const shaped = { ...level, ground, platforms };
    const baseCoins = level.autoCoins ? autoCoins({ ...shaped, platforms: level.platforms }, jumpScale) : level.coins;
    return Object.freeze({ ...shaped, coins: [...baseCoins, ...routeCoins] });
  }

  // ==========================================
  // Level 4: the desert (sandstorm gusts)
  // ==========================================
  const DESERT = withCoins({
    id: 'desert',
    number: 4,
    name: 'THE SCORCHING DUNES',
    icon: '🏜️',
    flavor: 'Blazing sun and howling sandstorms. Watch the gusts when you jump!',
    theme: 'desert',
    hazard: 'wind',
    playerStartX: 2,
    routes: [{ x: 108, height: 10, length: 16, climb: 'lift' }],
    ground: [[-8, 20], [23, 38], [41.5, 52], [55, 61], [64, 80], [83.5, 96], [99, 104], [107, 122], [125.5, 140], [143, 190]],
    platforms: ledges([[14, 1.5, 3], [30, 1.6, 3], [34, 3.1, 3], [68, 1.5, 3], [72, 3.0, 3], [76, 4.5, 2.5], [88, 1.6, 3],
      [92, 3.1, 2.5], [111, 1.5, 3], [115.5, 3.0, 3], [130, 1.6, 3], [135, 3.0, 2.5], [147, 1.5, 3]]),
    enemies: foes('m4 16, tb 28, m4 35, m4 47, nut 58, m5 70, gw 78, m5 90, m5 110, tb 118, m5 130, m6 137, m6 148'),
    arena: { start: 156, end: 182 },
    boss: {
      kind: 'thornback',
      name: 'THE DUNE THORNBACK',
      flavor: 'A colossal beetle bursts from the sand! Jump its charge!',
      x: 173,
      hp: 14,
      sizeScale: 2.0
    }
  });

  // ==========================================
  // Level 5: the ice (slippery)
  // ==========================================
  const ICE = withCoins({
    id: 'ice',
    number: 5,
    name: 'THE FROZEN PEAKS',
    icon: '❄️',
    flavor: 'A silent night under the aurora. The ice is slippery: you can\'t stop on a dime!',
    theme: 'ice',
    physics: { slippery: true },
    playerStartX: 2,
    routes: [{ x: 22, height: 7, length: 16, climb: 'tower' }],
    ground: [[-8, 18], [21, 34], [37, 46], [49.5, 58], [61, 74], [77.5, 86], [89, 100], [103.5, 112], [115, 128], [131, 138], [141, 192]],
    platforms: ledges([[9, 1.5, 3], [25, 1.5, 3], [29, 3.0, 3], [40, 1.8, 3], [51, 1.6, 3], [64, 1.5, 2.5], [67.5, 3.0, 2.5],
      [71, 4.5, 2.5], [80, 1.8, 3], [92, 1.5, 3], [96, 3.0, 2.5], [106, 1.6, 3], [118, 1.5, 3], [122.5, 3.0, 3],
      [133, 1.8, 2.5], [146, 1.5, 3], [150.5, 3.0, 3]]),
    enemies: foes('m5 12, nut 27, m5 42, m5 54, tb 66, m6 72, gw 83, m6 95, je 108, m6 120, m6 134, m7 148, m7 154'),
    arena: { start: 160, end: 186 },
    boss: {
      kind: 'mutant',
      power: 8,
      movement: 'walker',
      seed: 4242,
      name: 'THE FROST BEHEMOTH',
      flavor: 'Something enormous wakes beneath the snow!',
      x: 177,
      hp: 16,
      sizeScale: 1.8
    }
  });

  // ==========================================
  // Level 6: the volcano (lava bombs)
  // ==========================================
  const VOLCANO = withCoins({
    id: 'volcano',
    number: 6,
    name: 'THE MOLTEN CORE',
    icon: '🌋',
    flavor: 'Rivers of lava and fire raining from the sky. Smash the lava bombs!',
    theme: 'volcano',
    hazard: 'lavaBombs',
    playerStartX: 2,
    routes: [{ x: 104, height: 10, length: 16, climb: 'lift' }],
    ground: [[-8, 16], [19.5, 28], [31, 40], [43.5, 50], [53, 66], [69.5, 76], [79, 90], [93.5, 100], [103, 114], [117.5, 124], [127, 136], [139, 190]],
    platforms: ledges([[10, 1.5, 3], [23, 1.8, 3], [34, 1.5, 3], [41, 1.6, 2], [58, 1.5, 3], [62, 3.0, 3], [72, 1.8, 2.5],
      [76.7, 1.5, 1.6], [83, 1.6, 3], [87, 3.1, 2.5], [91, 1.5, 2], [106, 1.5, 3], [110, 3.0, 3], [115, 1.6, 2],
      [130, 1.8, 3], [144, 1.5, 3], [148.5, 3.0, 3]]),
    enemies: foes('m5 12, m6 25, tb 36, m6 47, m6 60, je 64, m6 74, m7 85, gw 97, m7 108, m7 121, tb 132, m7 146, m8 152'),
    arena: { start: 158, end: 184 },
    boss: {
      kind: 'golem',
      name: 'THE MAGMA GOLEM',
      flavor: 'The heart of the volcano rises, bigger and angrier than ever!',
      x: 175,
      hp: 18,
      sizeScale: 1.35
    }
  });

  // ==========================================
  // Level 7: the candy kingdom (bouncy marshmallows)
  // ==========================================
  const CANDY = withCoins({
    id: 'candy',
    number: 7,
    name: 'THE CANDY KINGDOM',
    icon: '🍭',
    flavor: 'Sweet as can be... and full of teeth. Bounce on the marshmallows!',
    theme: 'candy',
    playerStartX: 2,
    routes: [{ x: 25, height: 7, length: 16, climb: 'tower' }],
    ground: [[-8, 20], [24, 36], [40, 52], [57, 66], [70, 84], [89, 98], [102, 116], [121, 130], [134, 190]],
    platforms: ledges([[21, 0.6, 2, 'b'], [28, 1.5, 3], [32, 3.0, 3], [37, 0.6, 2, 'b'], [44, 4.4, 3], [47, 1.6, 3],
      [53, 0.6, 2.5, 'b'], [60, 1.5, 3], [74, 1.5, 3], [78, 3.0, 3], [85, 0.6, 2.5, 'b'], [92, 1.8, 3], [106, 1.5, 3],
      [110, 3.0, 3], [117, 0.6, 2.5, 'b'], [124, 1.8, 3], [138, 1.5, 3], [142, 3.0, 3], [147, 0.4, 2, 'b'], [150.5, 4.4, 3]]),
    enemies: foes('mu 14, m6 30, nut 46, m6 50, m6 62, je 76, m7 80, gw 93, m7 108, m7 112, nut 126, m7 140, m8 152'),
    arena: { start: 160, end: 186 },
    boss: {
      kind: 'nutling',
      name: 'THE JAWBREAKER',
      flavor: 'A giant candied nut with a mean bite! Watch its hops!',
      x: 177,
      hp: 14,
      sizeScale: 2.6
    }
  });

  // ==========================================
  // Level 8: the moon (low gravity)
  // ==========================================
  const MOON = withCoins({
    id: 'moon',
    number: 8,
    name: 'THE SILENT MOON',
    icon: '🌙',
    flavor: 'The Earth hangs overhead. Gravity is weak here: float across the craters!',
    theme: 'moon',
    physics: { gravityScale: 0.55 },
    playerStartX: 2,
    routes: [{ x: 119, height: 13, length: 16, climb: 'lift' }],
    ground: [[-8, 16], [22, 30], [36, 44], [50, 56], [62, 72], [78, 84], [90, 100], [106, 112], [118, 128], [134, 140], [146, 196]],
    platforms: ledges([[8, 2.5, 3], [24, 3.0, 3], [38, 2.0, 2.5], [40.5, 4.5, 2.5], [52, 3.0, 2.5], [58, 2.0, 2], [65, 2.5, 3],
      [68.5, 5.0, 3], [80, 2.8, 2.5], [93, 2.5, 3], [97, 5.0, 2.5], [108, 3.0, 2.5], [113.5, 2.0, 2], [121, 2.5, 3],
      [124.5, 5.0, 3], [136, 3.0, 2.5], [150, 2.5, 3], [154, 5.0, 3]]),
    enemies: foes('m7 12, gw 26, m7 40, m7 53, m8 66, je 70, m8 81, m8 95, gw 109, m8 122, m9 137, m9 150, m9 157'),
    arena: { start: 164, end: 190 },
    boss: {
      kind: 'mutant',
      power: 10,
      movement: 'flyer',
      seed: 9001,
      name: 'THE STAR DEVOURER',
      flavor: 'A monster from beyond the stars! The final battle!',
      x: 181,
      hp: 20,
      sizeScale: 2.0
    }
  });

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
    list: [FOREST, DUNGEON, TREETOPS, DESERT, ICE, VOLCANO, CANDY, MOON].map(finishLevel),
    training: TRAINING_GROUND
  });
})(window.Forest);
