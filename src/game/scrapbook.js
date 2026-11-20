/**
 * The boy's scrapbook: every species he has come across, kept between visits.
 *
 * For each species it remembers how many he has seen and defeated, the wave he first met one,
 * and a "specimen" (the genome of the first random monster of that species) for its portrait.
 * Names and field notes come from Forest.MonsterSpecies, so they're not stored.
 */
(function (Forest) {
  const { MonsterSpecies, Rewards } = Forest;

  const STORAGE_KEY = 'forest-pixel-adventure.scrapbook';
  const SAVE_VERSION = 1;

  /** @type {Object<string, {seen:number, defeated:number, firstWave:number, specimen:object|null}>} */
  let entries = load();
  const listeners = [];

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.version === SAVE_VERSION && saved.entries) {
        // Forget anything that no longer matches a known species
        return Object.fromEntries(Object.entries(saved.entries).filter(([id]) => MonsterSpecies.get(id)));
      }
    } catch (error) {
      // Unreadable or blocked storage: start with an empty scrapbook
    }
    return {};
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SAVE_VERSION, entries }));
    } catch (error) {
      // Storage unavailable: the scrapbook just lasts until the page closes
    }
    listeners.forEach(listener => listener());
  }

  /** Copy of a genome without the bits that only make sense in one run. */
  function specimenOf(genome) {
    return genome ? { ...genome, isMini: false } : null;
  }

  Forest.Scrapbook = {
    /** Total number of species there are to find. */
    get totalSpecies() {
      return MonsterSpecies.ALL.length;
    },

    get discoveredCount() {
      return Object.keys(entries).length;
    },

    /** @returns {{seen:number, defeated:number, firstWave:number, specimen:object|null}|undefined} */
    entryFor(speciesId) {
      return entries[speciesId];
    },

    /**
     * Note that the boy has met `enemy`.
     * @param {object} enemy any foe
     * @param {number} wave current wave number (0 while the mushrooms are still around)
     * @returns {{species:object, isNew:boolean}}
     */
    recordEncounter(enemy, wave) {
      const species = Rewards.speciesOf(enemy);
      const isNew = !entries[species.id];
      if (isNew) {
        entries[species.id] = { seen: 0, defeated: 0, firstWave: wave, specimen: specimenOf(enemy.genome) };
      }
      entries[species.id].seen++;
      save();
      return { species, isNew };
    },

    /** Note that the boy has defeated `enemy`. */
    recordDefeat(enemy) {
      const entry = entries[Rewards.speciesOf(enemy).id];
      if (!entry) return;
      entry.defeated++;
      save();
    },

    /** Tear out every page (start the collection over). */
    clear() {
      entries = {};
      save();
    },

    /** @param {() => void} listener called whenever the scrapbook changes */
    onChange(listener) {
      listeners.push(listener);
    }
  };
})(window.Forest);
