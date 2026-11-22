/**
 * Monster Forge, part 1: the genome.
 *
 * A genome is a plain, serialisable description of one random monster: how it moves, how it looks,
 * its stats and its abilities. It is generated from a seed, so the same seed (and power) always gives
 * the same monster - handy for sharing a favourite or reproducing a bug.
 *
 * Nothing here touches the canvas or Three.js; see monsterPainter.js for the art and
 * monsterForge.js for the in-game behaviour.
 */
(function (Forest) {
  const { createSeededRandom, clamp } = Forest.MathUtils;
  const { MonsterSpecies } = Forest;

  const Movement = Object.freeze({
    /** Walks along the grass towards the boy. */
    WALKER: 'walker',
    /** Bounces at the boy in little hops. */
    HOPPER: 'hopper',
    /** Hovers beside the boy, out of reach of a normal jump. */
    FLYER: 'flyer'
  });

  const ALL_MOVEMENTS = Object.values(Movement);
  const GROUND_MOVEMENTS = [Movement.WALKER, Movement.HOPPER];

  /**
   * Every ability a monster can roll. The behaviour lives in monsterAbilities.js under the same id.
   * `cost` is paid from the monster's power budget, `minPower` keeps nasty ones out of early waves.
   */
  const ABILITIES = Object.freeze({
    // --- Attacks (used one at a time, with a cooldown in between) ---
    charge: { id: 'charge', label: 'Charge', type: 'attack', cost: 2, minPower: 1, movements: [Movement.WALKER] },
    swoop: { id: 'swoop', label: 'Dive Bomb', type: 'attack', cost: 2, minPower: 1, movements: [Movement.FLYER] },
    leap: { id: 'leap', label: 'Quake Leap', type: 'attack', cost: 3, minPower: 2, movements: GROUND_MOVEMENTS },
    spit: { id: 'spit', label: 'Fire Spit', type: 'attack', cost: 3, minPower: 2, movements: ALL_MOVEMENTS },
    nova: { id: 'nova', label: 'Spore Nova', type: 'attack', cost: 3, minPower: 3, movements: ALL_MOVEMENTS },
    brood: { id: 'brood', label: 'Brood', type: 'attack', cost: 4, minPower: 5, movements: ALL_MOVEMENTS },

    // --- Passives (always on) ---
    swift: { id: 'swift', label: 'Swift', type: 'passive', cost: 1, minPower: 1, movements: ALL_MOVEMENTS },
    enrage: { id: 'enrage', label: 'Enrage', type: 'passive', cost: 1, minPower: 2, movements: ALL_MOVEMENTS },
    regenerate: { id: 'regenerate', label: 'Regenerate', type: 'passive', cost: 2, minPower: 3, movements: ALL_MOVEMENTS },
    blink: { id: 'blink', label: 'Blink', type: 'passive', cost: 2, minPower: 3, movements: ALL_MOVEMENTS },
    armored: { id: 'armored', label: 'Armored', type: 'passive', cost: 3, minPower: 4, movements: ALL_MOVEMENTS },
    splitter: { id: 'splitter', label: 'Splitter', type: 'passive', cost: 3, minPower: 4, movements: ALL_MOVEMENTS },

    // --- Cybernetic upgrades (only cyber monsters can roll these) ---
    laser: { id: 'laser', label: 'Laser Beam', type: 'attack', cost: 3, minPower: 2, movements: ALL_MOVEMENTS, cyberOnly: true },
    rockets: { id: 'rockets', label: 'Rocket Salvo', type: 'attack', cost: 3, minPower: 3, movements: ALL_MOVEMENTS, cyberOnly: true },
    shield: { id: 'shield', label: 'Energy Shield', type: 'passive', cost: 2, minPower: 2, movements: ALL_MOVEMENTS, cyberOnly: true }
  });

  /** Cyber monsters start showing up at this power, more often the stronger the wave. */
  const CYBER_MIN_POWER = 2;
  const CYBER_BASE_CHANCE = 0.08;
  const CYBER_CHANCE_PER_POWER = 0.04;
  const CYBER_MAX_CHANCE = 0.5;
  /** How a cyber monster's face is upgraded: a visor band, glowing lenses, or a metal jaw grille. */
  const CYBER_IMPLANTS = ['visor', 'lenses', 'grille'];
  const CYBER_GLOWS = ['#4df2ff', '#ff3b6b', '#7dff6a', '#ffe14d', '#c86bff'];
  /** Salt for the cyber dice, so the rest of a seed's monster looks the same with or without implants. */
  const CYBER_SEED_SALT = 0x5bd1e995;

  /** Abilities a mini monster (from Brood or Splitter) never inherits, so they can't multiply forever. */
  const NO_MINI_ABILITIES = ['brood', 'splitter', 'regenerate', 'shield'];

  const MAX_ABILITIES = 4;

  const SIZES = Object.freeze({
    small: { bodyHalfWidth: [4, 5], bodyHeight: [8, 10], baseHp: 1, hpPerPower: 0.3, speed: 1.15 },
    medium: { bodyHalfWidth: [6, 7], bodyHeight: [10, 12], baseHp: 2, hpPerPower: 0.5, speed: 1 },
    large: { bodyHalfWidth: [8, 10], bodyHeight: [13, 15], baseHp: 3, hpPerPower: 0.8, speed: 0.82 }
  });

  const BODY_SHAPES = ['round', 'boxy', 'pear', 'bulb'];
  const PATTERNS = ['none', 'spots', 'stripes', 'belly', 'belly'];
  const HEADGEAR = ['none', 'horns', 'horns', 'antennae', 'spikes', 'crest'];
  const MOUTHS = ['fangs', 'grin', 'tusks', 'teeth'];
  const EYE_COUNTS = [1, 2, 2, 2, 3, 4];

  /** Random helpers bound to one seeded generator. */
  function createDice(seed) {
    const next = createSeededRandom(seed);
    return {
      next,
      range: (min, max) => min + next() * (max - min),
      int: (min, max) => min + Math.floor(next() * (max - min + 1)),
      chance: probability => next() < probability,
      pick: items => items[Math.floor(next() * items.length)],
      /** @param {Object<string, number>} weights value -> relative weight */
      weighted(weights) {
        const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
        let roll = next() * entries.reduce((sum, [, weight]) => sum + weight, 0);
        for (const [value, weight] of entries) {
          roll -= weight;
          if (roll < 0) return value;
        }
        return entries[entries.length - 1][0];
      }
    };
  }

  function randomSeed() {
    return Math.floor(Math.random() * 0xffffffff) >>> 0;
  }

  /** "#rrggbb" from hue (degrees), saturation and lightness (0..1). */
  function hslToHex(hue, saturation, lightness) {
    const h = ((hue % 360) + 360) % 360;
    const s = clamp(saturation, 0, 1);
    const l = clamp(lightness, 0, 1);
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const channel = n => {
      const value = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return Math.round(value * 255).toString(16).padStart(2, '0');
    };
    return `#${channel(0)}${channel(8)}${channel(4)}`;
  }

  /** All the colours of one monster, keyed by the letters monsterPainter.js paints with. */
  function rollPalette(dice) {
    const hue = dice.range(0, 360);
    const saturation = dice.range(0.45, 0.8);
    // Accent sits roughly opposite on the colour wheel, so spots and wings pop
    const accentHue = hue + dice.range(120, 240);
    const hornIsBone = dice.chance(0.6);
    const glow = dice.pick(['#ff3b3b', '#ffe14d', '#7dff6a', '#4df2ff', '#ff6bf2']);

    return {
      K: hslToHex(hue, 0.5, 0.1), // outline
      d: hslToHex(hue + 8, saturation, 0.3), // body shadow
      b: hslToHex(hue, saturation, 0.47), // body
      h: hslToHex(hue - 8, saturation * 0.9, 0.66), // body highlight
      p: hslToHex(hue + 25, saturation * 0.45, 0.76), // belly
      s: hslToHex(accentHue, 0.75, 0.56), // spots, stripes, antenna bulbs
      n: hornIsBone ? '#e8dcc0' : hslToHex(accentHue, 0.5, 0.42), // horns, spikes, claws
      N: hornIsBone ? '#a89470' : hslToHex(accentHue, 0.5, 0.25), // horn tips
      w: hslToHex(accentHue, saturation * 0.6, 0.36), // wing membrane
      v: hslToHex(accentHue, saturation, 0.6), // wing edge
      W: '#fff6e6', // eye white
      E: '#120c10', // pupil
      r: glow, // angry glowing pupil
      m: '#3a0d12', // mouth
      T: '#ffffff' // teeth
    };
  }

  function rollAppearance(dice, movement, power) {
    const size = dice.weighted({
      small: 3,
      medium: 3 + power * 0.3,
      large: power >= 3 ? 1 + power * 0.35 : 0
    });
    const sizeSpec = SIZES[size];

    return {
      size,
      shape: dice.pick(BODY_SHAPES),
      bodyHalfWidth: dice.int(...sizeSpec.bodyHalfWidth),
      bodyHeight: dice.int(...sizeSpec.bodyHeight),
      pattern: dice.pick(PATTERNS),
      eyes: dice.pick(EYE_COUNTS),
      /** Brows drawn even when calm. */
      isGrumpy: dice.chance(0.5),
      mouth: dice.pick(MOUTHS),
      headgear: dice.pick(HEADGEAR),
      /** Walkers only: 1 or 2 legs on each side. */
      legPairs: movement === Movement.WALKER ? (size === 'large' && dice.chance(0.5) ? 2 : 1) : 0,
      wingSpan: movement === Movement.FLYER ? dice.int(4, 6) : 0,
      wingStyle: dice.pick(['bat', 'leaf']),
      palette: rollPalette(dice),
      /** Seed for the painter's own randomness (spot positions). */
      detailSeed: Math.floor(dice.next() * 0xffffffff) >>> 0
    };
  }

  /** Chance that a random monster of this power comes with cybernetic implants. */
  function cyberChance(power) {
    if (power < CYBER_MIN_POWER) return 0;
    return Math.min(CYBER_MAX_CHANCE, CYBER_BASE_CHANCE + power * CYBER_CHANCE_PER_POWER);
  }

  /**
   * Bolt cybernetics onto an appearance: a face implant, a chest plate with a glowing core, and
   * metal horns, claws, legs and jet wings (by recolouring those parts' palette letters).
   */
  function addCyberImplants(dice, appearance) {
    const glow = dice.pick(CYBER_GLOWS);
    const metalHue = dice.range(190, 230);
    appearance.cyber = {
      implant: dice.pick(CYBER_IMPLANTS),
      /** Chest plate with a glowing power core. */
      hasCore: dice.chance(0.75),
      /** A little antenna mast with a light on top (only on monsters with nothing else on their head). */
      hasMast: appearance.headgear === 'none' && dice.chance(0.7),
      glow
    };
    appearance.palette = {
      ...appearance.palette,
      M: hslToHex(metalHue, 0.12, 0.78), // polished metal
      G: hslToHex(metalHue, 0.14, 0.52), // metal
      O: hslToHex(metalHue, 0.2, 0.26), // dark metal, seams and rivets
      L: glow, // LEDs, visor, power core
      n: hslToHex(metalHue, 0.14, 0.6), // horns, spikes, claws, feet become metal
      N: glow, // ...with glowing tips
      w: hslToHex(metalHue, 0.16, 0.42), // wings become metal jet fins
      v: glow // ...with glowing edges
    };
  }

  /**
   * Spend the power budget: one attack the monster can afford first (if any), then a random mix.
   * Hoppers and walkers can end up with no attack at all; their body is the weapon.
   */
  function rollAbilities(dice, movement, power, isCyber, excluded = []) {
    let budget = 2 + Math.floor(power / 2);
    const affordable = ability => ability.movements.includes(movement) && ability.minPower <= power && ability.cost <= budget
      && (isCyber || !ability.cyberOnly) && !excluded.includes(ability.id);
    const chosen = [];

    const attacks = Object.values(ABILITIES).filter(ability => ability.type === 'attack' && affordable(ability));
    // Cyber monsters always lead with one of their built-in weapons
    const cyberAttacks = attacks.filter(ability => ability.cyberOnly);
    if (isCyber && cyberAttacks.length > 0) {
      const first = dice.pick(cyberAttacks);
      chosen.push(first.id);
      budget -= first.cost;
    } else if (attacks.length > 0) {
      const first = dice.pick(attacks);
      chosen.push(first.id);
      budget -= first.cost;
    }

    while (chosen.length < MAX_ABILITIES) {
      const options = Object.values(ABILITIES).filter(ability => affordable(ability) && !chosen.includes(ability.id));
      // Sometimes keep a little budget unspent, so not every monster is maxed out
      if (options.length === 0 || (chosen.length > 0 && dice.chance(0.25))) break;
      const next = dice.pick(options);
      chosen.push(next.id);
      budget -= next.cost;
    }
    return chosen;
  }

  function rollStats(dice, appearance, abilities, power) {
    const sizeSpec = SIZES[appearance.size];
    let hp = sizeSpec.baseHp + Math.floor(power * sizeSpec.hpPerPower) + dice.int(0, 1);
    if (abilities.includes('armored')) hp += 1 + Math.floor(power / 4);
    if (appearance.cyber) hp += 1; // metal plating

    let speed = sizeSpec.speed * dice.range(0.85, 1.15);
    if (abilities.includes('swift')) speed *= 1.3;

    // Only big, late monsters ever hit for two hearts
    const damage = power >= 8 && appearance.size === 'large' && dice.chance(0.5) ? 2 : 1;

    return { hp, damage, speed: Math.round(speed * 100) / 100 };
  }

  /**
   * Create a random monster genome.
   * @param {object} [options]
   * @param {number} [options.seed] same seed + power = same monster; random when left out
   * @param {number} [options.power] how dangerous it is, roughly the wave number (1 = gentle)
   * @param {string} [options.movement] force a Movement value
   * @param {string[]} [options.abilities] force exactly these ability ids
   * @param {string} [options.name] override the scientific name
   * @param {boolean} [options.cyber] force cybernetic implants on (true) or off (false); when left
   *   out, stronger monsters are more likely to be cyber
   * @param {string} [options.shape] force the body shape and [options.headgear] what grows on its head
   *   (with movement and cyber, that picks the species: e.g. a boss's look-alike helpers)
   * @param {string[]} [options.excludeAbilities] never roll these (e.g. a boss's helpers don't copy its tricks)
   * @returns {object} genome (plain data, safe to JSON.stringify). `species` is an id into
   *   Forest.MonsterSpecies; `name` is the individual's scientific name, e.g. "Boingus mohawkensis majoris".
   */
  function generate({ seed = randomSeed(), power = 1, movement, abilities, name, cyber, shape, headgear, excludeAbilities = [] } = {}) {
    const dice = createDice(seed);
    const level = Math.max(1, power);

    const chosenMovement = movement || dice.weighted({ walker: 4.5, hopper: 3, flyer: 2.5 });
    const appearance = rollAppearance(dice, chosenMovement, level);
    if (shape) appearance.shape = shape;
    if (headgear) appearance.headgear = headgear;
    const cyberDice = createDice((seed ^ CYBER_SEED_SALT) >>> 0);
    const isCyber = cyber !== undefined ? Boolean(cyber) : cyberDice.chance(cyberChance(level));
    if (isCyber) addCyberImplants(cyberDice, appearance);
    const chosenAbilities = abilities
      ? abilities.filter(id => ABILITIES[id])
      : rollAbilities(dice, chosenMovement, level, isCyber, excludeAbilities);
    const stats = rollStats(dice, appearance, chosenAbilities, level);

    const genome = {
      seed,
      power: level,
      name: name || '',
      movement: chosenMovement,
      appearance,
      abilities: chosenAbilities,
      stats,
      isMini: false
    };
    genome.species = MonsterSpecies.forGenome(genome).id;
    if (!name) genome.name = MonsterSpecies.individualName(genome);
    return genome;
  }

  /** The smaller, weaker offspring a Brood or Splitter monster releases. */
  function createMini(genome) {
    return {
      ...genome,
      name: MonsterSpecies.individualName({ ...genome, isMini: true }),
      abilities: genome.abilities.filter(id => !NO_MINI_ABILITIES.includes(id)),
      stats: { ...genome.stats, hp: Math.max(1, Math.ceil(genome.stats.hp / 3)) },
      isMini: true
    };
  }

  /** One-line summary, e.g. "Boingus mohawkensis - HP 4 / DMG 1 / SPD 1.10 - Quake Leap, Swift". */
  function describe(genome) {
    const abilityNames = genome.abilities.map(id => ABILITIES[id].label).join(', ') || 'no abilities';
    const { hp, damage, speed } = genome.stats;
    return `${genome.name} - HP ${hp} / DMG ${damage} / SPD ${speed.toFixed(2)} - ${abilityNames}`;
  }

  Forest.MonsterGenome = Object.freeze({
    Movement,
    ABILITIES,
    generate,
    createMini,
    describe,
    hslToHex
  });
})(window.Forest);
