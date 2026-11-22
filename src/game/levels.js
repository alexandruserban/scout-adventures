/**
 * The three side-scrolling levels (plus a flat training ground).
 *
 * Positions are in world units: x along the level, y up from the grass line (0).
 *  - ground:    [left, right] solid segments; the spaces between them are bottomless pits
 *  - platforms: one-way ledges { x: left edge, y: top, width }
 *  - coins:     { x, y } centre of each coin
 *  - enemies:   { kind, x } each drops in when the boy gets close. kind is 'mushroom', a sky creature
 *               (nutling, thornback, gloomwing, jelly) or 'mutant' (a Monster Forge monster of `power`)
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
      { kind: 'mushroom', x: 34 },
      { kind: 'nutling', x: 41 },
      { kind: 'mushroom', x: 52 },
      { kind: 'thornback', x: 57 },
      { kind: 'nutling', x: 72 },
      { kind: 'mushroom', x: 80 },
      { kind: 'mushroom', x: 93 },
      { kind: 'gloomwing', x: 97 },
      { kind: 'thornback', x: 112 },
      { kind: 'mutant', x: 119, power: 2 },
      { kind: 'mushroom', x: 131 },
      { kind: 'nutling', x: 137 },
      { kind: 'gloomwing', x: 143 }
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
      { kind: 'thornback', x: 15 },
      { kind: 'nutling', x: 26 },
      { kind: 'mutant', x: 39, power: 3 },
      { kind: 'nutling', x: 49 },
      { kind: 'thornback', x: 61 },
      { kind: 'jelly', x: 68 },
      { kind: 'gloomwing', x: 77 },
      { kind: 'mushroom', x: 90 },
      { kind: 'mutant', x: 95, power: 4 },
      { kind: 'thornback', x: 114 },
      { kind: 'jelly', x: 121 },
      { kind: 'nutling', x: 131 },
      { kind: 'gloomwing', x: 144 },
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
      { kind: 'nutling', x: 10 },
      { kind: 'gloomwing', x: 23 },
      { kind: 'nutling', x: 33 },
      { kind: 'thornback', x: 45 },
      { kind: 'gloomwing', x: 56 },
      { kind: 'jelly', x: 69 },
      { kind: 'mutant', x: 80, power: 5 },
      { kind: 'nutling', x: 90 },
      { kind: 'thornback', x: 94 },
      { kind: 'gloomwing', x: 105 },
      { kind: 'jelly', x: 117 },
      { kind: 'mutant', x: 129, power: 6 },
      { kind: 'gloomwing', x: 145 },
      { kind: 'nutling', x: 150 },
      { kind: 'thornback', x: 157 }
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
    list: [FOREST, DUNGEON, TREETOPS],
    training: TRAINING_GROUND
  });
})(window.Forest);
