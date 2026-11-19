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

  let isPopulated = false;

  function open() {
    overlay.style.display = 'flex';
    if (!isPopulated) {
      populate();
      isPopulated = true;
    }
  }

  function close() {
    overlay.style.display = 'none';
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
    addSection('SKY CREATURES (ENDLESS WAVES)', [
      ...skyCreatureFrames,
      { canvas: asciiToCanvas(SkyArt.fireball.rows, ZOOM, SkyArt.fireball.palette), caption: 'Golem Fireball' }
    ]);

    addSection('STATIC FOREST ASSETS', [
      { canvas: scaleCanvas(Environment.createOakTree(), TREE_ZOOM), caption: 'Ancient Oak (64x96)' },
      { canvas: scaleCanvas(Environment.createGrassTile(), ZOOM), caption: 'Grass & Soil Tile' },
      { canvas: scaleCanvas(Environment.createFlowerTuft(), ZOOM), caption: 'Wildflowers' }
    ]);
  }

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
