/** "Sprite Gallery" modal showcasing every piece of pixel art in the game. */
(function (Forest) {
  const { scaleCanvas, asciiToCanvas } = Forest.PixelCanvas;
  const Boy = Forest.BoySprites;
  const Mushroom = Forest.MushroomSprites;
  const Environment = Forest.EnvironmentSprites;
  const SkyArt = Forest.SkyCreatureSprites;

  const overlay = document.getElementById('gallery-overlay');
  const content = document.getElementById('gallery-content');
  const openButton = document.getElementById('btn-gallery');
  const closeButton = document.getElementById('btn-gallery-close');

  const ZOOM = 3;
  const SLAM_ZOOM = 2; // slam frames are twice as big, so show them smaller
  const TREE_ZOOM = 2;
  /** One random monster per entry, from gentle to nasty. */
  const MONSTER_POWERS = [1, 2, 3, 4, 6, 8, 10, 12];

  let isPopulated = false;

  function open() {
    overlay.style.display = 'flex';
    if (Forest.Game) Forest.Game.setPaused(true, 'gallery');
    if (!isPopulated) {
      populate();
      isPopulated = true;
    }
  }

  function close() {
    overlay.style.display = 'none';
    if (Forest.Game) Forest.Game.setPaused(false, 'gallery');
  }

  function populate() {
    const slamFrames = Boy.slam.map((frame, index) => ({
      canvas: scaleCanvas(frame.canvas, SLAM_ZOOM),
      caption: `Slam ${index + 1}: ${frame.name}`
    }));

    addSection('THE HERO (SIDE-VIEW PROFILE & 2-HANDED SWORD)', [
      { canvas: scaleCanvas(Boy.idle[0], ZOOM), caption: 'Idle' },
      ...Boy.walk.map((frame, index) => ({
        canvas: scaleCanvas(frame, ZOOM),
        caption: `Walk ${index + 1}/${Boy.walk.length}`
      })),
      { canvas: scaleCanvas(Boy.crouch, ZOOM), caption: 'Crouch / Land' },
      { canvas: scaleCanvas(Boy.jumpRise, ZOOM), caption: 'Jump: Rise' },
      { canvas: scaleCanvas(Boy.jumpApex, ZOOM), caption: 'Jump: Apex' },
      { canvas: scaleCanvas(Boy.fall, ZOOM), caption: 'Fall' },
      { canvas: scaleCanvas(Boy.jumpSpin, ZOOM), caption: 'Double Jump Spin' },
      ...slamFrames,
      ...Boy.airSlash.map(frame => ({ canvas: scaleCanvas(frame.canvas, SLAM_ZOOM), caption: frame.name })),
      { canvas: scaleCanvas(Boy.hitRecoil, ZOOM), caption: 'Hit: Recoil' },
      { canvas: scaleCanvas(Boy.hitStagger, ZOOM), caption: 'Hit: Stagger' },
      { canvas: scaleCanvas(Boy.defeated, ZOOM), caption: 'Defeated' }
    ]);

    addSection('EVIL MUSHROOM', [
      { canvas: asciiToCanvas(Mushroom.walk[0], ZOOM), caption: 'Patrol' },
      { canvas: asciiToCanvas(Mushroom.aggro, ZOOM), caption: 'Aggro (Fangs)' },
      { canvas: asciiToCanvas(Mushroom.squash, ZOOM), caption: 'Hit: Squash' },
      { canvas: asciiToCanvas(Mushroom.dazed, ZOOM), caption: 'Hit: Dazed' }
    ]);

    const skyCreatureFrames = Object.values(SkyArt.creatures).flatMap((creature, tierIndex) =>
      Object.entries(creature.frames).map(([frameName, rows]) => ({
        canvas: asciiToCanvas(rows, ZOOM, creature.palette),
        caption: `T${tierIndex + 1} ${creature.name}: ${frameName}`
      }))
    );
    addSection('LEVEL MONSTERS & BOSSES', [
      ...skyCreatureFrames,
      { canvas: asciiToCanvas(SkyArt.fireball.rows, ZOOM, SkyArt.fireball.palette), caption: 'Golem Fireball' }
    ]);

    addMonsterForgeSection();

    addSection('STATIC FOREST ASSETS', [
      { canvas: scaleCanvas(Environment.createOakTree(), TREE_ZOOM), caption: 'Ancient Oak (64x96)' },
      { canvas: scaleCanvas(Environment.createGrassTile(), ZOOM), caption: 'Grass & Soil Tile' },
      { canvas: scaleCanvas(Environment.createFlowerTuft(), ZOOM), caption: 'Wildflowers' }
    ]);
  }

  /**
   * A fresh batch of random monsters every time; click one to summon it into the forest,
   * or reroll the whole batch. (Forest.MonsterForge loads after this script, so it's looked up lazily.)
   */
  function addMonsterForgeSection() {
    const section = addSection('MONSTER FORGE (RANDOM MUTANTS) - CLICK ONE TO SUMMON IT', []);
    const row = section.querySelector('.sprite-row');

    const rerollButton = createElement('button', 'pixel-btn', '🎲 REROLL MONSTERS');
    rerollButton.style.cssText = 'display:block; margin:12px auto 0; padding:8px 14px; font-size:8px;';
    rerollButton.addEventListener('click', () => fillMonsterRow(row));
    section.appendChild(rerollButton);

    fillMonsterRow(row);
  }

  function fillMonsterRow(row) {
    const Forge = Forest.MonsterForge;
    row.innerHTML = '';
    MONSTER_POWERS.forEach(power => {
      const genome = Forge.generate({ power });
      const box = createElement('div', 'sprite-box');
      box.style.cursor = 'pointer';
      box.title = `${Forge.describe(genome)}\nSeed ${genome.seed}, power ${power}. Click to summon.`;

      const frames = createElement('div', 'monster-frames');
      frames.style.cssText = 'display:flex; gap:6px; align-items:flex-end;';
      frames.appendChild(Forge.paintPreview(genome, 'idle', ZOOM));
      frames.appendChild(Forge.paintPreview(genome, 'attack', ZOOM));
      box.appendChild(frames);

      const abilities = genome.abilities.map(id => Forge.ABILITIES[id].label).join(', ') || 'No abilities';
      const { hp, damage, speed } = genome.stats;
      const latinName = createElement('div', 'sprite-caption', genome.name);
      latinName.style.cssText = "font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-size: 11px; color: #fde68a;";
      box.appendChild(latinName);
      box.appendChild(createElement('div', 'sprite-caption', Forest.MonsterSpecies.forGenome(genome).common.toUpperCase()));
      box.appendChild(createElement('div', 'sprite-caption', `${genome.movement.toUpperCase()} · POWER ${power}`));
      box.appendChild(createElement('div', 'sprite-caption', `HP ${hp} · DMG ${damage} · SPD ${speed.toFixed(2)}`));
      box.appendChild(createElement('div', 'sprite-caption', abilities));

      box.addEventListener('click', () => {
        if (!Forest.Game) return;
        Forest.Game.summonMonster(genome);
        close();
      });
      row.appendChild(box);
    });
  }

  /** @returns {HTMLElement} the section, so callers can add to it */
  function addSection(title, items) {
    const section = createElement('div', 'gallery-section');
    section.appendChild(createElement('div', 'section-name', title));

    const row = createElement('div', 'sprite-row');
    items.forEach(({ canvas, caption }) => {
      const box = createElement('div', 'sprite-box');
      box.appendChild(canvas);
      box.appendChild(createElement('div', 'sprite-caption', caption));
      row.appendChild(box);
    });
    section.appendChild(row);
    content.appendChild(section);
    return section;
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  openButton.addEventListener('click', open);
  closeButton.addEventListener('click', close);
})(window.Forest);
