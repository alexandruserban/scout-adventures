/**
 * The "Scrapbook" modal: a page for every species, filled in once the boy has met one.
 * The game is paused while it's open.
 */
(function (Forest) {
  const { asciiToCanvas } = Forest.PixelCanvas;
  const { MonsterSpecies, Scrapbook } = Forest;
  const SkyArt = Forest.SkyCreatureSprites;
  const MushroomArt = Forest.MushroomSprites;

  const overlay = document.getElementById('scrapbook-overlay');
  const content = document.getElementById('scrapbook-content');
  const summary = document.getElementById('scrapbook-summary');
  const openButton = document.getElementById('btn-scrapbook');
  const closeButton = document.getElementById('btn-scrapbook-close');

  const ZOOM = 3;
  /** The golem is much bigger than everyone else. */
  const NATIVE_ZOOM = { golem: 2 };
  /** Which frame of each hand-made creature makes the best portrait. */
  const NATIVE_PORTRAIT_FRAME = { nutling: 'hop1', thornback: 'walk1', gloomwing: 'up', jelly: 'idle', golem: 'stand' };

  function open() {
    render();
    overlay.style.display = 'flex';
    if (Forest.Game) Forest.Game.setPaused(true);
  }

  function close() {
    overlay.style.display = 'none';
    if (Forest.Game) Forest.Game.setPaused(false);
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
      `SEEN ${entry.seen} · DEFEATED ${entry.defeated}<br>FIRST SEEN: ${entry.firstWave > 0 ? `WAVE ${entry.firstWave}` : 'THE MUSHROOM PATCH'}`, true));
    page.appendChild(createElement('div', 'scrap-note', species.note));

    if (entry.specimen) {
      const abilities = entry.specimen.abilities.map(id => Forest.MonsterForge.ABILITIES[id].label);
      const text = abilities.length ? `Specimen could: ${abilities.join(', ')}.` : 'Specimen had no special tricks.';
      page.appendChild(createElement('div', 'scrap-note', text));
    }
    return page;
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

  Forest.ScrapbookView = { open, close };
})(window.Forest);
