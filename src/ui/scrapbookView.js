/**
 * The "Scrapbook" modal: a page for every species, filled in once the boy has met one.
 * The game is paused while it's open.
 *
 * Every discovered page can also be ticked for training, with how many to fight and at which
 * difficulty; the bar at the top starts a training session with everything ticked.
 */
(function (Forest) {
  const { asciiToCanvas } = Forest.PixelCanvas;
  const { MonsterSpecies, Scrapbook, Training, Difficulty } = Forest;
  const SkyArt = Forest.SkyCreatureSprites;
  const MushroomArt = Forest.MushroomSprites;

  const overlay = document.getElementById('scrapbook-overlay');
  const content = document.getElementById('scrapbook-content');
  const summary = document.getElementById('scrapbook-summary');
  const trainingBar = document.getElementById('training-bar');
  const openButton = document.getElementById('btn-scrapbook');
  const closeButton = document.getElementById('btn-scrapbook-close');

  /** Same icons as the toolbar's difficulty button. */
  const LEVEL_ICONS = { EASY: '🌱', NORMAL: '⚔️', HARD: '💀' };

  const ZOOM = 3;
  /** The golem is much bigger than everyone else. */
  const NATIVE_ZOOM = { golem: 2, octorocker: 2 };
  /** Which frame of each hand-made creature makes the best portrait. */
  const NATIVE_PORTRAIT_FRAME = { nutling: 'hop1', thornback: 'walk1', gloomwing: 'up', jelly: 'idle', golem: 'stand', spider: 'walk1', crawler: 'walk1', octorocker: 'stand' };

  function open() {
    render();
    overlay.style.display = 'flex';
    if (Forest.Game) Forest.Game.setPaused(true, 'scrapbook');
  }

  function close() {
    overlay.style.display = 'none';
    if (Forest.Game) Forest.Game.setPaused(false, 'scrapbook');
  }

  function isOpen() {
    return overlay.style.display === 'flex';
  }

  function render() {
    const found = Scrapbook.discoveredCount;
    const total = Scrapbook.totalSpecies;
    summary.innerHTML = `
      <div>SPECIES FOUND: <b>${found} / ${total}</b></div>
      <div class="scrapbook-progress"><div style="width:${(found / total) * 100}%"></div></div>`;
    renderTrainingBar();

    content.innerHTML = '';
    MonsterSpecies.ALL.forEach(species => {
      const entry = Scrapbook.entryFor(species.id);
      content.appendChild(entry ? createPage(species, entry) : createBlankPage());
    });
  }

  function createPage(species, entry) {
    const page = createElement('div', 'scrap-card');
    const portrait = createElement('div', 'scrap-portrait');
    const canvas = paintPortrait(species, entry);
    if (canvas) portrait.appendChild(canvas);
    page.appendChild(portrait);

    page.appendChild(createElement('div', 'scrap-latin', species.latin));
    page.appendChild(createElement('div', 'scrap-common', species.common));
    page.appendChild(createElement('div', 'scrap-stats',
      `SEEN ${entry.seen} · DEFEATED ${entry.defeated}<br>FIRST SEEN: ${typeof entry.firstWave === 'string' ? entry.firstWave : (entry.firstWave > 0 ? `WAVE ${entry.firstWave}` : 'THE MUSHROOM PATCH')}`, true));
    page.appendChild(createElement('div', 'scrap-note', species.note));

    if (entry.specimen) {
      const abilities = entry.specimen.abilities.map(id => Forest.MonsterForge.ABILITIES[id].label);
      const text = abilities.length ? `Specimen could: ${abilities.join(', ')}.` : 'Specimen had no special tricks.';
      page.appendChild(createElement('div', 'scrap-note', text));
    }
    page.appendChild(createTrainingControls(species, page));
    return page;
  }

  // ==========================================
  // Training
  // ==========================================

  /** TRAIN tick box, plus how many and how hard once ticked. Redraws itself in place. */
  function createTrainingControls(species, page) {
    const box = createElement('div', 'train-box');

    const draw = () => {
      const pick = Training.pickFor(species.id);
      page.classList.toggle('training-picked', pick.selected);
      box.innerHTML = '';
      box.appendChild(createButton(pick.selected ? '☑ TRAINING' : '☐ TRAIN', 'train-toggle',
        () => change(() => Training.setSelected(species.id, !pick.selected))));
      if (!pick.selected) return;

      const stepper = createElement('div', 'train-stepper');
      stepper.appendChild(createButton('−', 'train-step', () => change(() => Training.setCount(species.id, pick.count - 1)),
        { disabled: pick.count <= Training.MIN_COUNT, title: 'Fewer' }));
      stepper.appendChild(createElement('span', 'train-count', `×${pick.count}`));
      stepper.appendChild(createButton('+', 'train-step', () => change(() => Training.setCount(species.id, pick.count + 1)),
        { disabled: pick.count >= Training.MAX_COUNT, title: 'More' }));
      box.appendChild(stepper);

      const levels = createElement('div', 'train-levels');
      Training.LEVEL_IDS.forEach(levelId => {
        const label = Difficulty.LEVELS[levelId].label;
        levels.appendChild(createButton(LEVEL_ICONS[levelId], `train-level${pick.level === levelId ? ' active' : ''}`,
          () => change(() => Training.setLevel(species.id, levelId)), { title: label, level: levelId }));
      });
      box.appendChild(levels);
      box.appendChild(createElement('div', 'train-level-name', Difficulty.LEVELS[pick.level].label));
    };

    const change = update => {
      update();
      draw();
    };

    draw();
    return box;
  }

  /** Summary of what's ticked, with START / CLEAR (and END while training). */
  function renderTrainingBar() {
    const speciesCount = Training.selectedSpeciesCount;
    const creatureCount = Training.selectedCreatureCount;
    const isTraining = Boolean(Forest.Game && Forest.Game.isTraining);

    trainingBar.innerHTML = '';
    trainingBar.appendChild(createElement('div', 'training-bar-text', speciesCount
      ? `🎯 TRAINING: <b>${creatureCount}</b> ${creatureCount === 1 ? 'CREATURE' : 'CREATURES'} FROM <b>${speciesCount}</b> SPECIES`
      : '🎯 TRAINING: tick <b>☐ TRAIN</b> on any page you have found to practise against it.', true));

    trainingBar.appendChild(createMapPicker());

    const buttons = createElement('div', 'training-bar-buttons');
    buttons.appendChild(createButton(isTraining ? '▶ RESTART TRAINING' : '▶ START TRAINING', 'pixel-btn small-btn start-training',
      startTraining, { disabled: creatureCount === 0 }));
    if (speciesCount > 0) {
      buttons.appendChild(createButton('CLEAR', 'pixel-btn small-btn', () => {
        Training.clearSelection();
        render();
      }));
    }
    if (isTraining) {
      buttons.appendChild(createButton('🌲 END TRAINING', 'pixel-btn small-btn', () => {
        close();
        Forest.Game.endTraining();
      }));
    }
    trainingBar.appendChild(buttons);
  }

  /** ◀ MAP ▶: steps through every world of the adventure, plus a random one. */
  function createMapPicker() {
    const maps = [Training.RANDOM_MAP, ...Forest.Levels.themes.map(theme => theme.id)];
    const labelFor = id => {
      if (id === Training.RANDOM_MAP) return '🎲 RANDOM WORLD';
      const theme = Forest.Levels.themes.find(entry => entry.id === id);
      return `${theme.icon} ${theme.name}`;
    };
    const step = direction => {
      const index = Math.max(0, maps.indexOf(Training.mapId));
      Training.setMap(maps[(index + direction + maps.length) % maps.length]);
      renderTrainingBar();
    };
    const picker = createElement('div', 'training-map');
    picker.appendChild(createElement('span', 'training-map-title', 'MAP:'));
    picker.appendChild(createButton('◀', 'pixel-btn small-btn train-step', () => step(-1), { title: 'Previous map' }));
    picker.appendChild(createElement('span', 'training-map-name', labelFor(Training.mapId)));
    picker.appendChild(createButton('▶', 'pixel-btn small-btn train-step', () => step(1), { title: 'Next map' }));
    return picker;
  }

  function startTraining() {
    if (!Forest.Game) return;
    close();
    Forest.Game.startTraining();
  }

  /**
   * @param {string} text
   * @param {string} className
   * @param {() => void} onClick
   * @param {{disabled?:boolean, title?:string, level?:string}} [options]
   */
  function createButton(text, className, onClick, { disabled = false, title, level } = {}) {
    const button = createElement('button', className, text);
    button.type = 'button';
    button.disabled = disabled;
    if (title) button.title = title;
    if (level) button.dataset.level = level;
    button.addEventListener('click', event => {
      // Don't leave focus on a menu button: SPACE (jump) would press it again after closing
      event.currentTarget.blur();
      onClick();
    });
    return button;
  }

  function createBlankPage() {
    const page = createElement('div', 'scrap-card undiscovered');
    page.appendChild(createElement('div', 'scrap-portrait', '?'));
    page.appendChild(createElement('div', 'scrap-latin', '???'));
    page.appendChild(createElement('div', 'scrap-common', 'Not yet discovered'));
    return page;
  }

  function paintPortrait(species, entry) {
    if (entry.specimen) return Forest.MonsterForge.paintPreview(entry.specimen, 'idle', ZOOM);
    if (species.id === 'mushroom') return asciiToCanvas(MushroomArt.aggro, ZOOM);

    const art = SkyArt.creatures[species.id];
    if (!art) return null;
    const frameName = NATIVE_PORTRAIT_FRAME[species.id] in art.frames ? NATIVE_PORTRAIT_FRAME[species.id] : Object.keys(art.frames)[0];
    return asciiToCanvas(art.frames[frameName], NATIVE_ZOOM[species.id] || ZOOM, art.palette);
  }

  function createElement(tag, className, text, isHtml = false) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) {
      if (isHtml) element.innerHTML = text; else element.textContent = text;
    }
    return element;
  }

  openButton.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  window.addEventListener('keydown', event => {
    if (event.code === 'Escape' && isOpen()) close();
  });
  // Refresh live if something is discovered while it's open
  Scrapbook.onChange(() => {
    if (isOpen()) render();
  });
  Training.onChange(() => {
    if (isOpen()) renderTrainingBar();
  });

  Forest.ScrapbookView = { open, close };
})(window.Forest);
