/**
 * Training: practise against creatures picked from the scrapbook.
 *
 * For each species the boy has met, the player can tick it for training and choose how many
 * to fight and at which difficulty (Easy / Normal / Hard). The picks are remembered between
 * visits. buildSession() turns them into one custom wave for Forest.WaveDirector.startCustom.
 *
 * Training never changes the scrapbook's counts or the high scores.
 */
(function (Forest) {
  const { MonsterSpecies, Difficulty } = Forest;

  const STORAGE_KEY = 'forest-pixel-adventure.training';
  const SAVE_VERSION = 1;

  const MIN_COUNT = 1;
  const MAX_COUNT = 10;
  const DEFAULT_COUNT = 3;
  const LEVEL_IDS = ['EASY', 'NORMAL', 'HARD'];

  /** Seconds between creatures falling during training. */
  const SPAWN_INTERVAL = 1.4;
  /** How strong freshly generated monsters of a random species are, by difficulty. */
  const MONSTER_POWER = { EASY: 2, NORMAL: 4, HARD: 7 };
  /** Evil mushrooms normally fall to one blow; training can make them tougher. */
  const MUSHROOM_HP = { EASY: 1, NORMAL: 2, HARD: 3 };
  const MUSHROOM_DAMAGE = 1;
  /** Tries at rolling a monster of the wanted species (each try hits it about 1 time in 20). */
  const MAX_SPECIES_ROLLS = 400;

  /** @type {Object<string, {selected:boolean, count:number, level:string}>} */
  let picks = load();
  const listeners = [];

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.version === SAVE_VERSION && saved.picks) {
        return Object.fromEntries(Object.entries(saved.picks)
          .filter(([id, pick]) => MonsterSpecies.get(id) && pick && LEVEL_IDS.includes(pick.level))
          .map(([id, pick]) => [id, { selected: Boolean(pick.selected), count: clampCount(pick.count), level: pick.level }]));
      }
    } catch (error) {
      // Unreadable or blocked storage: start with nothing picked
    }
    return {};
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SAVE_VERSION, picks }));
    } catch (error) {
      // Storage unavailable: the picks just last until the page closes
    }
    listeners.forEach(listener => listener());
  }

  function clampCount(count) {
    const number = Math.round(Number(count));
    return Number.isFinite(number) ? Math.max(MIN_COUNT, Math.min(MAX_COUNT, number)) : DEFAULT_COUNT;
  }

  /** Only species already in the scrapbook can be trained against. */
  function isDiscovered(speciesId) {
    return !Forest.Scrapbook || Boolean(Forest.Scrapbook.entryFor(speciesId));
  }

  /** The pick for a species, created with defaults (not selected) the first time it's touched. */
  function pickFor(speciesId) {
    if (!picks[speciesId]) {
      picks[speciesId] = { selected: false, count: DEFAULT_COUNT, level: Difficulty.current.id };
    }
    return picks[speciesId];
  }

  /** Selected species that can actually be trained against, in scrapbook order. */
  function selectedPicks() {
    return MonsterSpecies.ALL
      .filter(species => picks[species.id] && picks[species.id].selected && isDiscovered(species.id))
      .map(species => ({ species, ...picks[species.id] }));
  }

  // ==========================================
  // Building the session
  // ==========================================
  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  /** A fresh random monster of exactly this species (body shape and headgear decide the species). */
  function genomeOfSpecies(speciesId, power) {
    const [movement, shape, headgear, cyberTag] = speciesId.split('-');
    const cyber = cyberTag === 'cyber';
    let genome = null;
    for (let i = 0; i < MAX_SPECIES_ROLLS; i++) {
      genome = Forest.MonsterForge.generate({ power, movement, cyber });
      if (genome.species === speciesId) return genome;
    }
    // Astronomically unlikely: just reshape the last roll into the right species
    genome = { ...genome, appearance: { ...genome.appearance, shape, headgear }, species: speciesId };
    return { ...genome, name: MonsterSpecies.individualName(genome) };
  }

  /** One wave-queue entry for a creature of `species` at difficulty `level`. */
  function entryFor(species, level) {
    if (species.id === 'mushroom') {
      return { kind: 'mushroom', stats: { hp: MUSHROOM_HP[level.id], damage: MUSHROOM_DAMAGE, speed: level.creatureSpeed } };
    }
    if (species.isNative) {
      return { kind: species.id, stats: Forest.WaveDirector.creatureStats(species.id, level) };
    }
    const genome = genomeOfSpecies(species.id, MONSTER_POWER[level.id]);
    return { kind: 'mutant', genome, stats: Forest.MonsterForge.statsFor(genome, level) };
  }

  /**
   * The selected creatures as one custom wave, or null when nothing is selected.
   * @returns {{name:string, flavor:string, spawnInterval:number, queue:object[], total:number}|null}
   */
  function buildSession() {
    const selected = selectedPicks();
    if (selected.length === 0) return null;

    const queue = shuffle(selected.flatMap(({ species, count, level }) =>
      Array.from({ length: count }, () => entryFor(species, Difficulty.LEVELS[level]))));
    const flavor = selected
      .map(({ species, count, level }) => `${count}x ${species.common} (${Difficulty.LEVELS[level].label})`)
      .join(', ');
    return { name: 'TRAINING', flavor, spawnInterval: SPAWN_INTERVAL, queue, total: queue.length };
  }

  Forest.Training = {
    MIN_COUNT,
    MAX_COUNT,
    LEVEL_IDS,

    /** @returns {{selected:boolean, count:number, level:string}} a copy of the species' pick */
    pickFor(speciesId) {
      return { ...pickFor(speciesId) };
    },

    setSelected(speciesId, selected) {
      if (!isDiscovered(speciesId)) return;
      pickFor(speciesId).selected = Boolean(selected);
      save();
    },

    setCount(speciesId, count) {
      pickFor(speciesId).count = clampCount(count);
      save();
    },

    setLevel(speciesId, levelId) {
      if (!LEVEL_IDS.includes(levelId)) return;
      pickFor(speciesId).level = levelId;
      save();
    },

    /** Untick everything (counts and difficulties are kept for next time). */
    clearSelection() {
      Object.values(picks).forEach(pick => { pick.selected = false; });
      save();
    },

    /** Number of species ticked for training. */
    get selectedSpeciesCount() {
      return selectedPicks().length;
    },

    /** Number of creatures a session would contain. */
    get selectedCreatureCount() {
      return selectedPicks().reduce((total, pick) => total + pick.count, 0);
    },

    buildSession,

    /** @param {() => void} listener called whenever the picks change */
    onChange(listener) {
      listeners.push(listener);
    }
  };
})(window.Forest);
