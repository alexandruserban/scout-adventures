/**
 * "Sprite Gallery" modal showcasing the game's pixel art. The hero and the scenery are always there;
 * each creature's sprites unlock once the boy has met one (it's in the scrapbook), and until then
 * it shows as a dark silhouette. The random mutants shown are the ones he has met.
 */
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
  const SILHOUETTE_COLOR = '#06100d';
  const LOCKED_CAPTION = '??? MEET IT TO UNLOCK';

  /** The scrapbook count the gallery was last built for: it's rebuilt when new species turn up. */
  let builtForCount = -1;

  function open() {
    overlay.style.display = 'flex';
    if (Forest.Game) Forest.Game.setPaused(true, 'gallery');
    const count = Forest.Scrapbook.discoveredCount;
    if (count !== builtForCount) {
      content.innerHTML = '';
      populate();
      builtForCount = count;
    }
    overlay.querySelector('.gallery-card').scrollTop = 0;
  }

  function isMet(speciesId) {
    return Boolean(Forest.Scrapbook.entryFor(speciesId));
  }

  /** The sprite painted solid dark: a creature not met yet. */
  function silhouette(canvas) {
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const context = copy.getContext('2d');
    context.drawImage(canvas, 0, 0);
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = SILHOUETTE_COLOR;
    context.fillRect(0, 0, copy.width, copy.height);
    return copy;
  }

  /** All the frames of a creature that's been met, or just its silhouette. */
  function creatureItems(speciesId, frames) {
    if (isMet(speciesId)) return frames;
    return [{ canvas: silhouette(frames[0].canvas), caption: LOCKED_CAPTION, locked: true }];
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

    addSection(isMet('mushroom') ? 'EVIL MUSHROOM' : '??? (LOCKED)', creatureItems('mushroom', [
      { canvas: asciiToCanvas(Mushroom.walk[0], ZOOM), caption: 'Patrol' },
      { canvas: asciiToCanvas(Mushroom.aggro, ZOOM), caption: 'Aggro (Fangs)' },
      { canvas: asciiToCanvas(Mushroom.squash, ZOOM), caption: 'Hit: Squash' },
      { canvas: asciiToCanvas(Mushroom.dazed, ZOOM), caption: 'Hit: Dazed' }
    ]));

    // The keys of SkyArt.creatures are also their scrapbook species ids
    const skyCreatures = Object.entries(SkyArt.creatures);
    const skyCreatureItems = skyCreatures.flatMap(([speciesId, creature], tierIndex) => {
      const frames = Object.entries(creature.frames).map(([frameName, rows]) => ({
        canvas: asciiToCanvas(rows, ZOOM, creature.palette),
        caption: `T${tierIndex + 1} ${creature.name}: ${frameName}`
      }));
      if (speciesId === 'golem') {
        frames.push({ canvas: asciiToCanvas(SkyArt.fireball.rows, ZOOM, SkyArt.fireball.palette), caption: 'Golem Fireball' });
      }
      return creatureItems(speciesId, frames);
    });
    const metSky = skyCreatures.filter(([speciesId]) => isMet(speciesId)).length;
    addSection(`LEVEL MONSTERS & BOSSES (${metSky}/${skyCreatures.length})`, skyCreatureItems);

    addMonsterForgeSection();

    addSection('STATIC FOREST ASSETS', [
      { canvas: scaleCanvas(Environment.createOakTree(), TREE_ZOOM), caption: 'Ancient Oak (64x96)' },
      { canvas: scaleCanvas(Environment.createGrassTile(), ZOOM), caption: 'Grass & Soil Tile' },
      { canvas: scaleCanvas(Environment.createFlowerTuft(), ZOOM), caption: 'Wildflowers' }
    ]);
  }

  /**
   * The random mutants he has met: the specimen of every mutant species in the scrapbook.
   * (Forest.MonsterForge loads after this script, so it's looked up lazily.)
   */
  function addMonsterForgeSection() {
    const mutantSpecies = Forest.MonsterSpecies.ALL.filter(species => !species.isNative);
    const specimens = mutantSpecies
      .map(species => Forest.Scrapbook.entryFor(species.id))
      .filter(entry => entry && entry.specimen)
      .map(entry => entry.specimen);
    const section = addSection(`MONSTER FORGE MUTANTS (${specimens.length}/${mutantSpecies.length})`, []);
    const row = section.querySelector('.sprite-row');
    if (specimens.length === 0) {
      row.appendChild(createElement('div', 'sprite-caption', 'NONE MET YET: EVERY NEW KIND OF MUTANT YOU MEET SHOWS UP HERE'));
      return;
    }
    fillMonsterRow(row, specimens);
  }

  function fillMonsterRow(row, genomes) {
    const Forge = Forest.MonsterForge;
    genomes.forEach(genome => {
      const power = genome.power;
      const box = createElement('div', 'sprite-box');
      box.title = Forge.describe(genome);

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

      row.appendChild(box);
    });
  }

  /** @returns {HTMLElement} the section, so callers can add to it */
  function addSection(title, items) {
    const section = createElement('div', 'gallery-section');
    section.appendChild(createElement('div', 'section-name', title));

    const row = createElement('div', 'sprite-row');
    items.forEach(({ canvas, caption, locked }) => {
      const box = createElement('div', locked ? 'sprite-box locked' : 'sprite-box');
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
  window.addEventListener('keydown', event => {
    if (event.code === 'Escape' && overlay.style.display === 'flex') close();
  });
})(window.Forest);
