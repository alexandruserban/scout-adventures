/**
 * Pixel art for the hand-made creatures of the worlds that had none of their own (the forest's
 * Mossling, the dungeon's Bone Rattler, the moon's Crater Bunny...). Each has two moving frames
 * (walk1 / walk2: steps, hops or wing beats) and an `attack` pose. They join
 * Forest.SkyCreatureSprites.creatures, so they load, shatter, show up in the sprite gallery and get
 * scrapbook portraits like every other creature. All face right (the game mirrors them).
 *
 * They're painted with the shared letter-grid helpers (Forest.LetterGrid): ellipses and lines on a
 * grid of palette letters, then outlined.
 */
(function (Forest) {
  const SkyArt = Forest.SkyCreatureSprites;
  const { createGrid, ellipse, line, outline, toRows } = Forest.LetterGrid;

  /** Paint the three frames of a creature with `paint(pose)`, pose being 0 / 1 (moving) or 'attack'. */
  function framesOf(paint) {
    return { walk1: paint(0), walk2: paint(1), attack: paint('attack') };
  }

  /** Two little legs under a body, stepping with the pose. */
  function legs(grid, xs, top, bottom, pose, letter) {
    xs.forEach((x, i) => {
      const shift = pose === 1 ? (i % 2 ? 1 : -1) : 0;
      line(grid, x, top, x + shift, bottom, letter);
    });
  }

  // ==========================================
  // Forest: Mossling - a mossy hedgehog that curls up and rolls at you
  // ==========================================
  function paintMossling(pose) {
    const grid = createGrid(20, 16);
    if (pose === 'attack') {
      ellipse(grid, 10, 9, 6.5, 6.5, 'G');
      for (let a = 0; a < 6.3; a += 0.9) grid.set(10 + Math.cos(a) * 4.5, 9 + Math.sin(a) * 4.5, 'g');
      line(grid, 7, 7, 13, 11, 'g');
      grid.set(12, 7, 'w');
      outline(grid, ['G', 'g', 'w']);
      return toRows(grid);
    }
    ellipse(grid, 9, 9, 7, 5, 'G');
    for (let x = 3; x <= 14; x += 2) grid.set(x, 5 + (x % 4 === 1 ? 0 : 1), 'g');
    grid.set(6, 8, 'g'); grid.set(10, 7, 'g'); grid.set(8, 11, 'g');
    ellipse(grid, 15, 10, 3, 2.6, 'F');
    grid.set(16, 9, 'k'); grid.set(18, 11, 'n');
    grid.set(9, 3, 'P'); grid.set(10, 3, 'p'); grid.set(9, 4, 'p');
    legs(grid, [6, 12], 13, 15, pose, 'L');
    outline(grid, ['G', 'g', 'F', 'k', 'n', 'P', 'p', 'L']);
    return toRows(grid);
  }

  // ==========================================
  // Dungeon: Bone Rattler - a skeleton rat that throws bones
  // ==========================================
  function paintBoneRattler(pose) {
    const grid = createGrid(22, 16);
    line(grid, 0, 8 + (pose === 1 ? 1 : 0), 5, 10, 'b');
    ellipse(grid, 10, 10, 5, 3, 'B');
    for (let x = 7; x <= 13; x += 2) line(grid, x, 8, x, 12, 'd');
    ellipse(grid, 16, 8, 3.2, 2.6, 'B');
    line(grid, 18, 8, 21, 9, 'B');
    grid.set(17, 7, 'r');
    grid.set(16, 5, 'B'); grid.set(15, 5, 'B');
    legs(grid, [8, 12], 13, 15, pose, 'b');
    if (pose === 'attack') {
      line(grid, 14, 9, 14, 3, 'b');
      line(grid, 12, 2, 16, 2, 'B');
      grid.set(12, 1, 'B'); grid.set(16, 1, 'B');
    }
    outline(grid, ['B', 'b', 'd', 'r']);
    return toRows(grid);
  }

  // ==========================================
  // Cloud canopy: Puffwing - a fluffy cloud bird that swoops
  // ==========================================
  function paintPuffwing(pose) {
    const grid = createGrid(22, 18);
    const dive = pose === 'attack';
    ellipse(grid, 10, 10, 6, dive ? 3.5 : 5, 'W');
    ellipse(grid, 7, 9, 3, 3, 'W');
    ellipse(grid, 12, 12, 3, 2, 'c');
    ellipse(grid, 16, 8 + (dive ? 2 : 0), 3, 2.6, 'W');
    line(grid, 19, 8 + (dive ? 2 : 0), 21, 9 + (dive ? 2 : 0), 'y');
    grid.set(17, 7 + (dive ? 2 : 0), 'k');
    if (pose === 0) { ellipse(grid, 9, 4, 4, 2, 'b'); line(grid, 6, 3, 4, 1, 'b'); }
    else if (pose === 1) { ellipse(grid, 9, 14, 4, 2, 'b'); line(grid, 6, 15, 4, 17, 'b'); }
    else { line(grid, 4, 8, 12, 8, 'b'); line(grid, 4, 9, 12, 9, 'b'); }
    line(grid, 2, 10, 4, 11, 'c');
    outline(grid, ['W', 'c', 'y', 'k', 'b']);
    return toRows(grid);
  }

  // ==========================================
  // Scorching dunes: Tumblecritter - a ball of tangled twigs with eyes, bouncing about
  // ==========================================
  function paintTumblecritter(pose) {
    const grid = createGrid(18, 18);
    const turn = pose === 1 ? 0.6 : (pose === 'attack' ? 1.2 : 0);
    for (let i = 0; i < 9; i++) {
      const a = turn + i * 0.7;
      line(grid, 9 + Math.cos(a) * 7, 9 + Math.sin(a) * 7, 9 + Math.cos(a + 2.4) * 7, 9 + Math.sin(a + 2.4) * 7, i % 2 ? 'T' : 't');
    }
    ellipse(grid, 10, 9, 3, 2.4, 'D');
    grid.set(10, 8, 'w'); grid.set(12, 8, 'w'); grid.set(10, 9, 'k'); grid.set(12, 9, 'k');
    if (pose === 'attack') { grid.set(9, 7, 'k'); grid.set(13, 7, 'k'); }
    outline(grid, ['T', 't', 'D', 'w', 'k']);
    return toRows(grid);
  }

  // ==========================================
  // Frozen peaks: Frostbite Penguin - waddles, then belly-slides at you
  // ==========================================
  function paintPenguin(pose) {
    if (pose === 'attack') {
      const grid = createGrid(22, 12);
      ellipse(grid, 10, 7, 9, 3.5, 'N');
      ellipse(grid, 10, 8.5, 7, 2, 'W');
      ellipse(grid, 18, 6, 2.6, 2.4, 'N');
      line(grid, 20, 6, 21, 7, 'y');
      grid.set(18, 5, 'w'); line(grid, 15, 4, 17, 4, 'r');
      line(grid, 0, 6, 2, 7, 'o');
      outline(grid, ['N', 'W', 'y', 'w', 'r', 'o']);
      return toRows(grid);
    }
    const grid = createGrid(16, 20);
    const lean = pose === 1 ? 1 : 0;
    ellipse(grid, 8, 11, 5, 7, 'N');
    ellipse(grid, 9 + lean, 12, 3.4, 5.5, 'W');
    ellipse(grid, 9 + lean, 4, 3.5, 3, 'N');
    grid.set(10 + lean, 3, 'w'); grid.set(11 + lean, 3, 'k');
    line(grid, 12 + lean, 4, 14 + lean, 5, 'y');
    line(grid, 5, 7, 12, 7, 'r'); line(grid, 5, 8, 6, 11, 'r');
    line(grid, 3, 9, 2, 13 - lean, 'N');
    line(grid, 6 - lean, 18, 8 - lean, 18, 'o'); line(grid, 9 + lean, 18, 11 + lean, 18, 'o');
    outline(grid, ['N', 'W', 'y', 'w', 'k', 'r', 'o']);
    return toRows(grid);
  }

  // ==========================================
  // Molten core: Ember Imp - a little fire devil on bat wings, dropping fireballs
  // ==========================================
  function paintEmberImp(pose) {
    const grid = createGrid(22, 18);
    const up = pose === 0;
    line(grid, 9, 9, 2, up ? 3 : 14, 'D'); line(grid, 9, 10, 3, up ? 5 : 15, 'D'); line(grid, 4, up ? 4 : 14, 6, up ? 7 : 12, 'D');
    ellipse(grid, 11, 9, 4, 4.5, 'R');
    ellipse(grid, 12, 9.5, 2.4, 3, 'o');
    grid.set(10, 6, 'y'); grid.set(13, 6, 'y'); grid.set(10, 7, 'k'); grid.set(13, 7, 'k');
    line(grid, 9, 4, 8, 2, 'h'); line(grid, 14, 4, 15, 2, 'h');
    line(grid, 11, 14, 13, 17, 'R'); grid.set(14, 17, 'f'); grid.set(14, 16, 'y');
    if (pose === 'attack') { ellipse(grid, 17, 13, 2.2, 2.2, 'f'); grid.set(17, 13, 'y'); line(grid, 14, 10, 16, 12, 'R'); }
    outline(grid, ['D', 'R', 'o', 'y', 'k', 'h', 'f']);
    return toRows(grid);
  }

  // ==========================================
  // Candy kingdom: Gummy Bear - a wobbly gummy that bounces at you
  // ==========================================
  function paintGummy(pose) {
    const grid = createGrid(16, 18);
    const squash = pose === 1 ? 1.15 : (pose === 'attack' ? 0.8 : 1);
    ellipse(grid, 8, 12.5, 5 / squash, 4.5 * squash, 'G');
    ellipse(grid, 8, 5.5 + (1 - squash) * 4, 4, 3.6, 'G');
    ellipse(grid, 5, 2.5 + (1 - squash) * 4, 1.4, 1.4, 'G');
    ellipse(grid, 11, 2.5 + (1 - squash) * 4, 1.4, 1.4, 'G');
    grid.set(9, 5 + Math.round((1 - squash) * 4), 'k'); grid.set(11, 5 + Math.round((1 - squash) * 4), 'k');
    grid.set(10, 7 + Math.round((1 - squash) * 4), 'g');
    ellipse(grid, 6, 11, 1.2, 2, 'h'); grid.set(5, 4 + Math.round((1 - squash) * 4), 'h');
    line(grid, 4, 16, 6, 17, 'g'); line(grid, 10, 17, 12, 16, 'g');
    outline(grid, ['G', 'k', 'g', 'h']);
    return toRows(grid);
  }

  // ==========================================
  // Silent moon: Crater Bunny - a moon rabbit in a bubble helmet, leaping high
  // ==========================================
  function paintCraterBunny(pose) {
    const grid = createGrid(18, 22);
    const crouch = pose === 'attack' ? 2 : 0;
    const stretch = pose === 1 ? -1 : 0;
    line(grid, 9, 6 + crouch, 8, 0 + crouch, 'W'); line(grid, 10, 6 + crouch, 10, 0 + crouch, 'W');
    line(grid, 12, 6 + crouch, 14, 1 + crouch, 'W'); line(grid, 13, 6 + crouch, 15, 2 + crouch, 'p');
    ellipse(grid, 11, 9 + crouch, 4.5, 4, 'H');
    ellipse(grid, 11, 9 + crouch, 3, 2.6, 'W');
    grid.set(12, 8 + crouch, 'k'); grid.set(13, 10 + crouch, 'p');
    ellipse(grid, 8, 15 + crouch, 4.5, 3.6 + stretch * 0.5, 'W');
    ellipse(grid, 4, 15 + crouch, 1.5, 1.5, 'w');
    line(grid, 6, 19 + crouch + stretch, 12, 19 + crouch + stretch, 'W');
    outline(grid, ['W', 'H', 'k', 'p', 'w']);
    return toRows(grid);
  }

  // ==========================================
  // Neon spell city: Glitch Cat - a neon alley cat that pounces
  // ==========================================
  function paintGlitchCat(pose) {
    const grid = createGrid(22, 16);
    const arch = pose === 'attack' ? -2 : 0;
    ellipse(grid, 10, 9 + arch, 6, 3, 'P');
    for (let x = 6; x <= 14; x += 3) line(grid, x, 7 + arch, x + 1, 11 + arch, 'c');
    line(grid, 4, 9 + arch, 1, 3 + (pose === 1 ? 1 : 0), 'P');
    ellipse(grid, 17, 7, 3, 2.6, 'P');
    line(grid, 15, 5, 15, 3, 'P'); line(grid, 19, 5, 19, 3, 'P');
    grid.set(18, 7, 'y'); grid.set(16, 7, 'y');
    legs(grid, [6, 9, 12, 15], 11 + arch, 15, pose, 'P');
    if (pose === 'attack') { grid.set(21, 4, 'c'); grid.set(20, 2, 'y'); grid.set(2, 1, 'c'); }
    outline(grid, ['P', 'c', 'y']);
    return toRows(grid);
  }

  // ==========================================
  // Circuit crystal caves: Shardback - an armoured armadillo that flings crystal shards
  // ==========================================
  function paintShardback(pose) {
    const grid = createGrid(22, 16);
    ellipse(grid, 10, 10, 7.5, 4, 'S');
    for (let x = 4; x <= 16; x += 3) {
      const glow = pose === 'attack' ? 'c' : 'C';
      line(grid, x, 6, x + 1, 2 + ((x / 3) % 2), glow);
      line(grid, x + 1, 6, x + 1, 3 + ((x / 3) % 2), glow);
    }
    for (let x = 5; x <= 15; x += 2) grid.set(x, 9, 's');
    ellipse(grid, 18, 11, 2.6, 2, 'S');
    grid.set(19, 10, 'c'); line(grid, 20, 12, 21, 12, 's');
    legs(grid, [6, 10, 14], 13, 15, pose, 's');
    outline(grid, ['S', 's', 'C', 'c']);
    return toRows(grid);
  }

  // ==========================================
  // Clockwork citadel: Windup Mouse - a brass mouse that zooms at you
  // ==========================================
  function paintWindupMouse(pose) {
    const grid = createGrid(22, 16);
    line(grid, 0, 10, 4, 11, 'b');
    ellipse(grid, 10, 10, 6, 3.5, 'B');
    line(grid, 6, 9, 14, 9, 'b');
    ellipse(grid, 16, 10, 3, 2.4, 'B');
    line(grid, 18, 10, 21, 11, 'B'); grid.set(21, 11, 'k');
    ellipse(grid, 15, 6, 1.8, 1.8, 'p');
    grid.set(17, 9, 'k');
    // The winding key on its back, turning
    line(grid, 10, 6, 10, 4, 'y');
    if (pose === 'attack' || pose === 1) { line(grid, 7, 3, 13, 3, 'y'); }
    else { line(grid, 10, 1, 10, 3, 'y'); ellipse(grid, 10, 2, 1.5, 1.5, 'y'); }
    ellipse(grid, 7, 14, 1.5, 1.5, 'w'); ellipse(grid, 13, 14, 1.5, 1.5, 'w');
    if (pose === 'attack') { line(grid, 0, 13, 3, 13, 'y'); line(grid, 0, 7, 3, 7, 'y'); }
    outline(grid, ['B', 'b', 'p', 'k', 'y', 'w']);
    return toRows(grid);
  }

  // ==========================================
  // Techno Atlantis: Jet Squid - darts through the water at you
  // ==========================================
  function paintJetSquid(pose) {
    const grid = createGrid(24, 14);
    const dash = pose === 'attack';
    ellipse(grid, 15, 7, dash ? 7 : 6, dash ? 2.6 : 3.4, 'Q');
    line(grid, 21, 7, 23, 7, 'Q'); grid.set(22, 6, 'Q'); grid.set(22, 8, 'Q');
    grid.set(14, 6, 'w'); grid.set(15, 6, 'k');
    for (let i = 0; i < 4; i++) {
      const y = 5 + i * 1.3;
      const wave = pose === 1 ? (i % 2 ? 1 : -1) : (i % 2 ? -1 : 1);
      line(grid, 9, y, 4, y + wave, 'q'); line(grid, 4, y + wave, 0, y + (dash ? 0 : wave * 2), 'q');
    }
    for (let x = 12; x <= 19; x += 3) grid.set(x, 8, 'g');
    outline(grid, ['Q', 'q', 'w', 'k', 'g']);
    return toRows(grid);
  }

  // ==========================================
  // Holo fae garden: Pixie - a glowing fairy flinging sparkles
  // ==========================================
  function paintPixie(pose) {
    const grid = createGrid(18, 18);
    const up = pose !== 1;
    ellipse(grid, 6, up ? 5 : 8, 4, up ? 4 : 2.5, 'v');
    ellipse(grid, 6, up ? 11 : 12, 3, 2, 'V');
    ellipse(grid, 10, 11, 2, 3.5, 'D');
    ellipse(grid, 11, 6, 2.6, 2.6, 'S');
    line(grid, 9, 3, 13, 3, 'Y'); grid.set(13, 2, 'Y');
    grid.set(12, 6, 'k');
    line(grid, 9, 15, 8, 17, 'S'); line(grid, 11, 15, 12, 17, 'S');
    if (pose === 'attack') { line(grid, 12, 10, 15, 7, 'S'); grid.set(16, 6, 'Y'); grid.set(17, 5, 'w'); grid.set(15, 5, 'w'); }
    else line(grid, 12, 10, 14, 12, 'S');
    outline(grid, ['v', 'V', 'D', 'S', 'Y', 'k', 'w']);
    return toRows(grid);
  }

  // ==========================================
  // Mech dragon keep: Drakeling - a little clanking mech dragon that breathes fire
  // ==========================================
  function paintDrakeling(pose) {
    const grid = createGrid(24, 18);
    line(grid, 0, 8, 6, 11, 'M'); line(grid, 0, 7, 1, 7, 'r');
    ellipse(grid, 11, 11, 6, 4, 'M');
    for (let x = 7; x <= 15; x += 2) grid.set(x, 7, 'm');
    line(grid, 9, 8, 6, 3 + (pose === 1 ? 2 : 0), 'm'); line(grid, 6, 3 + (pose === 1 ? 2 : 0), 11, 7, 'm');
    ellipse(grid, 18, 8, 3.4, 2.6, 'M');
    grid.set(19, 7, 'r');
    if (pose === 'attack') {
      line(grid, 20, 9, 23, 11, 'M'); line(grid, 21, 8, 23, 7, 'M');
      grid.set(23, 9, 'f'); grid.set(22, 9, 'y');
    } else line(grid, 20, 9, 23, 9, 'M');
    legs(grid, [8, 14], 14, 17, pose, 'm');
    outline(grid, ['M', 'm', 'r', 'f', 'y']);
    return toRows(grid);
  }

  // ==========================================
  // Quantum rift: Blinkwisp - a one-eyed quantum blob that blinks from place to place
  // ==========================================
  function paintBlinkwisp(pose) {
    const grid = createGrid(16, 18);
    const fading = pose === 'attack';
    ellipse(grid, 8, 8, 6, 6, 'Q');
    ellipse(grid, 9, 7, 3, 3, 'w');
    ellipse(grid, 10, 7, 1.5, 1.5, 'k');
    for (let i = 0; i < 4; i++) line(grid, 4 + i * 2.5, 13, 3 + i * 2.5 + (pose === 1 ? 1 : 0), 17, 'q');
    if (fading) {
      // Breaking up into dots as it's about to blink away
      for (let y = 0; y < 18; y++) for (let x = (y % 2); x < 16; x += 2) if (grid.get(x, y) === 'Q') grid.set(x, y, '.');
    }
    outline(grid, ['Q', 'q', 'w', 'k']);
    return toRows(grid);
  }

  // ==========================================
  // Starwizard station: Drone Bot - a hovering drone that drops bombs
  // ==========================================
  function paintDrone(pose) {
    const grid = createGrid(20, 16);
    if (pose === 1) line(grid, 3, 1, 17, 1, 'p'); else { line(grid, 6, 1, 14, 1, 'p'); grid.set(5, 2, 'p'); grid.set(15, 2, 'p'); }
    line(grid, 10, 2, 10, 4, 'm');
    ellipse(grid, 10, 8, 6, 4, 'M');
    line(grid, 4, 8, 16, 8, 'm');
    ellipse(grid, 13, 8, 1.8, 1.8, 'r'); grid.set(13, 7, 'w');
    if (pose === 'attack') { line(grid, 8, 12, 12, 12, 'k'); ellipse(grid, 10, 14, 1.6, 1.4, 'b'); }
    else line(grid, 7, 12, 13, 12, 'm');
    outline(grid, ['M', 'm', 'p', 'r', 'w', 'k', 'b']);
    return toRows(grid);
  }

  // ==========================================
  // Silent film: Pie Bandit - a moustachioed villain in a top hat, throwing custard pies
  // ==========================================
  function paintPieBandit(pose) {
    const grid = createGrid(18, 24);
    line(grid, 6, 0, 12, 0, 'H'); ellipse(grid, 9, 2, 3, 2, 'H'); line(grid, 4, 4, 14, 4, 'H');
    ellipse(grid, 9, 7, 3.4, 2.8, 'F');
    grid.set(10, 6, 'k'); grid.set(12, 6, 'k');
    line(grid, 8, 9, 14, 9, 'H'); grid.set(7, 8, 'H'); grid.set(15, 8, 'H');
    ellipse(grid, 8, 15, 4.5, 5, 'C');
    line(grid, 9, 11, 9, 19, 'w');
    legs(grid, [7, 11], 20, 23, pose, 'H');
    if (pose === 'attack') { line(grid, 12, 13, 15, 9, 'C'); ellipse(grid, 15, 7, 2.6, 1.4, 'P'); grid.set(15, 6, 'w'); }
    else line(grid, 12, 13, 14, 17, 'C');
    outline(grid, ['H', 'F', 'k', 'C', 'w', 'P']);
    return toRows(grid);
  }

  // ==========================================
  // The world that falls up: Balloon Puffer - a floating pufferfish that swoops
  // ==========================================
  function paintPuffer(pose) {
    const grid = createGrid(20, 20);
    const puffed = pose === 'attack' ? 1.25 : 1;
    ellipse(grid, 10, 10, 6 * puffed, 6 * puffed, 'U');
    ellipse(grid, 10, 12, 4 * puffed, 3 * puffed, 'u');
    for (let a = 0; a < 6.3; a += 0.8) {
      const r = 6 * puffed;
      line(grid, 10 + Math.cos(a) * r, 10 + Math.sin(a) * r, 10 + Math.cos(a) * (r + 2), 10 + Math.sin(a) * (r + 2), 'k');
    }
    grid.set(13, 8, 'w'); grid.set(14, 8, 'k');
    line(grid, 15, 11, 16, 11, 'k');
    line(grid, 3, 10, 1, 8 + (pose === 1 ? 1 : 0), 'U');
    outline(grid, ['U', 'u', 'w', 'k']);
    return toRows(grid);
  }

  // ==========================================
  // Giant's kitchen: Hot Pepper - an angry chilli that hops and scorches the floor
  // ==========================================
  function paintPepper(pose) {
    const grid = createGrid(16, 20);
    const squash = pose === 1 ? 1 : 0;
    for (let y = 5; y < 18; y++) {
      const t = (y - 5) / 13;
      const width = 4 * Math.sin(Math.PI * Math.min(1, t * 1.2 + 0.15));
      line(grid, 8 - width + t * 2, y + squash * (t > 0.5 ? -1 : 0), 8 + width + t * 2, y + squash * (t > 0.5 ? -1 : 0), 'R');
    }
    line(grid, 6, 6, 6, 12, 'h');
    line(grid, 8, 2, 8, 5, 'G'); line(grid, 6, 4, 10, 4, 'G'); grid.set(9, 1, 'G');
    grid.set(9, 8, 'w'); grid.set(11, 8, 'w'); grid.set(9, 9, 'k'); grid.set(11, 9, 'k');
    line(grid, 8, 7, 10, 8, 'k'); line(grid, 12, 7, 10, 8, 'k');
    if (pose === 'attack') { grid.set(13, 2, 'f'); grid.set(14, 1, 'y'); grid.set(3, 2, 'f'); grid.set(2, 1, 'y'); }
    outline(grid, ['R', 'h', 'G', 'w', 'k', 'f', 'y']);
    return toRows(grid);
  }

  const OUTLINE = '#160c10';
  const CREATURES = {
    mossling: { name: 'Mossling', paint: paintMossling, palette: { K: OUTLINE, G: '#4f9a3a', g: '#2f6a24', F: '#c89a6a', k: '#1a0e08', n: '#5a3a2a', P: '#ff6b9a', p: '#ffd0e0', L: '#5a3a2a' } },
    bonerattler: { name: 'Bone Rattler', paint: paintBoneRattler, palette: { K: '#1a1420', B: '#efe8d8', b: '#c8bea8', d: '#5a5060', r: '#ff3b3b' } },
    puffwing: { name: 'Puffwing', paint: paintPuffwing, palette: { K: '#3a4a6a', W: '#ffffff', c: '#d8e8ff', b: '#9fc8ff', y: '#ffb347', k: '#1a2030' } },
    tumblecritter: { name: 'Tumblecritter', paint: paintTumblecritter, palette: { K: '#3a2410', T: '#c8924a', t: '#8a5a2a', D: '#5a3a1a', w: '#ffffff', k: '#1a0e08' } },
    penguin: { name: 'Frostbite Penguin', paint: paintPenguin, palette: { K: '#0a1020', N: '#24345a', W: '#f4f8ff', y: '#ffb347', w: '#ffffff', k: '#0a1020', r: '#e8344a', o: '#ff8a2a' } },
    emberimp: { name: 'Ember Imp', paint: paintEmberImp, palette: { K: '#2a0805', D: '#5a1a14', R: '#e0401f', o: '#ff8a2a', y: '#ffe14d', k: '#2a0805', h: '#3a1a10', f: '#ffb347' } },
    gummy: { name: 'Gummy Bear', paint: paintGummy, palette: { K: '#0e3a14', G: '#5fd06a', g: '#2f8a3a', k: '#0e3a14', h: '#c8ffd0' } },
    craterbunny: { name: 'Crater Bunny', paint: paintCraterBunny, palette: { K: '#2a2a3a', W: '#e8e8f4', H: '#9ff0ff', k: '#1a1a2a', p: '#ff9ac8', w: '#ffffff' } },
    glitchcat: { name: 'Glitch Cat', paint: paintGlitchCat, palette: { K: '#12001e', P: '#ff4fd8', c: '#00f0ff', y: '#ffe14d' } },
    shardback: { name: 'Shardback', paint: paintShardback, palette: { K: '#06141a', S: '#3a6a74', s: '#1f3f48', C: '#2fd8b8', c: '#c0fff4' } },
    windupmouse: { name: 'Windup Mouse', paint: paintWindupMouse, palette: { K: '#2a1808', B: '#d8a040', b: '#9a6a20', p: '#ffb0b0', k: '#1a0e04', y: '#f4e070', w: '#6a707a' } },
    jetsquid: { name: 'Jet Squid', paint: paintJetSquid, palette: { K: '#06202a', Q: '#2fb8c8', q: '#1a7a8a', w: '#ffffff', k: '#06202a', g: '#9ff8ff' } },
    pixie: { name: 'Pixie', paint: paintPixie, palette: { K: '#2a1040', v: '#e8c0ff', V: '#c0f0ff', D: '#b04aff', S: '#ffd8c0', Y: '#ffe14d', k: '#2a1040', w: '#ffffff' } },
    drakeling: { name: 'Drakeling', paint: paintDrakeling, palette: { K: '#0a0c10', M: '#6a7484', m: '#3a404c', r: '#ff3b1f', f: '#ff8a2a', y: '#ffe14d' } },
    blinkwisp: { name: 'Blinkwisp', paint: paintBlinkwisp, palette: { K: '#0a0018', Q: '#b04aff', q: '#ff4fd8', w: '#ffffff', k: '#00f0ff' } },
    drone: { name: 'Drone Bot', paint: paintDrone, palette: { K: '#0a0e14', M: '#c8d0dc', m: '#6a7484', p: '#9aa4b0', r: '#ff3b3b', w: '#ffffff', k: '#1a1e24', b: '#3a3f48' } },
    piebandit: { name: 'Pie Bandit', paint: paintPieBandit, palette: { K: '#000000', H: '#1a1a1a', F: '#d8d8d8', k: '#000000', C: '#4a4a4a', w: '#ffffff', P: '#f0f0d8' } },
    puffer: { name: 'Balloon Puffer', paint: paintPuffer, palette: { K: '#2a1a40', U: '#ffd06a', u: '#fff4d0', w: '#ffffff', k: '#2a1a40' } },
    pepper: { name: 'Hot Pepper', paint: paintPepper, palette: { K: '#2a0505', R: '#e8241f', h: '#ff8a7a', G: '#3a9a2a', w: '#ffffff', k: '#2a0505', f: '#ff8a2a', y: '#ffe14d' } }
  };

  Object.entries(CREATURES).forEach(([kind, { name, paint, palette }]) => {
    SkyArt.creatures[kind] = { name, palette, frames: framesOf(paint) };
  });
})(window.Forest);
