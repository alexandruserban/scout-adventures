/**
 * Monster Forge, part 0: the species catalogue, with very serious scientific names.
 *
 * A random monster's species comes from its body plan:
 *   genus   = how it moves + its body shape   (3 x 4 = 12 genera)
 *   epithet = what grows on its head          (5 epithets)
 * so there are 60 random species to find, each also in a cybernetic version (another 60), plus the
 * 6 hand-made creatures of the forest.
 * Colours, size, eyes and abilities vary between individuals of the same species.
 *
 * Pure data (no canvas, no Three.js), so the scrapbook can list species it has never seen.
 */
(function (Forest) {
  /** Genus by movement, then by body shape. */
  const GENERA = {
    walker: {
      round: { latin: 'Waddlus', common: 'Waddler' },
      boxy: { latin: 'Brickopus', common: 'Brickfoot' },
      pear: { latin: 'Bottomus', common: 'Bottom-Heavy Trudger' },
      bulb: { latin: 'Cranius', common: 'Bighead' }
    },
    hopper: {
      round: { latin: 'Boingus', common: 'Boinger' },
      boxy: { latin: 'Cubiflopus', common: 'Cube Flopper' },
      pear: { latin: 'Squishiformis', common: 'Squishling' },
      bulb: { latin: 'Bobbleheadus', common: 'Bobblehead' }
    },
    flyer: {
      round: { latin: 'Flappus', common: 'Flapper' },
      boxy: { latin: 'Aerobrickus', common: 'Flying Brick' },
      pear: { latin: 'Droopywingus', common: 'Droopwing' },
      bulb: { latin: 'Zeppelinus', common: 'Blimpling' }
    }
  };

  /** Species epithet by headgear. */
  const EPITHETS = {
    none: { latin: 'baldicus', adjective: 'Bald' },
    horns: { latin: 'pokeyhornis', adjective: 'Horned' },
    antennae: { latin: 'wifiensis', adjective: 'Wiggly' },
    spikes: { latin: 'ouchiferus', adjective: 'Spiky' },
    crest: { latin: 'mohawkensis', adjective: 'Mohawked' }
  };

  /** Funny lines for field notes, chosen per species so they never change between visits. */
  const FIELD_NOTES = [
    'Diet: mostly boys, occasionally socks.',
    'Cannot swim. Has never needed to.',
    'Smells faintly of wet moss and bad decisions.',
    'Considered a delicacy by nobody.',
    'Sleeps upside down when no one is looking.',
    'Hums off-key during the mating season.',
    'Allergic to swords, according to every study.',
    'Its natural enemy is the common boy.',
    'Believed to be afraid of butterflies.',
    'Lays eggs that look suspiciously like acorns.',
    'Has been seen arguing with its own shadow.',
    'Mostly harmless. The "mostly" is doing a lot of work.',
    'Its call sounds like a kettle with opinions.',
    'Collects shiny pebbles and refuses to share.',
    'Scientists disagree on whether it has a skeleton.',
    'Known to sulk for days after losing a fight.'
  ];

  const MOVEMENT_NOTES = {
    walker: 'Stomps about on the forest floor.',
    hopper: 'Gets around by enthusiastic bouncing.',
    flyer: 'Flutters overhead, just out of reach.'
  };

  /** The creatures that were here first. Ids match Forest.SkyCreatures kinds (plus the mushroom). */
  const NATIVE_SPECIES = [
    { id: 'mushroom', latin: 'Shroomus nastyii', common: 'Evil Mushroom', note: 'Patrols its patch of grass and takes it very personally.' },
    { id: 'nutling', latin: 'Acornus grumpicus', common: 'Nutling', note: 'Falls from the canopy already in a bad mood.' },
    { id: 'thornback', latin: 'Beetlus stampedius', common: 'Thornback', note: 'Growls before charging. Polite, in its own way.' },
    { id: 'gloomwing', latin: 'Sporewingus divebombus', common: 'Gloomwing', note: 'Circles overhead, then dives without warning.' },
    { id: 'jelly', latin: 'Zappus wobblicus', common: 'Thunder Jelly', note: 'Splits in two when popped. Twice the wobble.' },
    { id: 'golem', latin: 'Rockus flamboyantus', common: 'Cinder Golem', note: 'Arrives by meteor. Leaves in pieces.' },
    { id: 'spider', latin: 'Arachnus prismaticus', common: 'Rainbow Spider', note: 'Abseils in on a silk thread. Eight legs, zero manners.' },
    { id: 'crawler', latin: 'Xenoscuttlus acidicus', common: 'Alien Crawler', note: 'Skitters along spaceship hulls and spits acid. Do not pet.' },
    { id: 'octorocker', latin: 'Octopus shreddicus', common: 'Octo-Rocker', note: 'Plays guitar with four arms and drums with the other four.' },
    // ...and one for each of the other worlds (see Forest.WorldCreatures)
    ...Forest.WorldCreatures.species.map(({ kind, latin, common, note }) => ({ id: kind, latin, common, note }))
  ];

  function hashString(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  /** Field notes for the cybernetically upgraded versions. */
  const CYBER_NOTES = [
    'Runs on batteries and pure spite.',
    'Its warranty expired centuries ago.',
    'Beeps politely before lasering you.',
    'Half monster, half toaster, all trouble.',
    'Downloads a firmware update every full moon.',
    'Its laser eye was a gift from a wizard. Nobody knows which one.',
    'Recharges by sitting in thunderstorms.',
    'Squeaks when it walks. Oil it at your own risk.'
  ];

  const CYBER_SUFFIX = '-cyber';

  function buildRandomSpecies(movement, shape, headgear, isCyber) {
    const genus = GENERA[movement][shape];
    const epithet = EPITHETS[headgear];
    const id = `${movement}-${shape}-${headgear}${isCyber ? CYBER_SUFFIX : ''}`;
    // Cyber genera: "Waddlus" becomes "Cyberwaddlus", the Waddler a Cyber-Waddler
    const genusLatin = isCyber ? `Cyber${genus.latin.toLowerCase()}` : genus.latin;
    const notes = isCyber ? CYBER_NOTES : FIELD_NOTES;
    return {
      id,
      latin: `${genusLatin} ${epithet.latin}`,
      common: `${epithet.adjective} ${isCyber ? 'Cyber-' : ''}${genus.common}`,
      genus: genusLatin,
      isNative: false,
      isCyber,
      note: `${MOVEMENT_NOTES[movement]} ${notes[hashString(id) % notes.length]}`
    };
  }

  /** Every random species of one kind (plain or cyber), grouped by genus. */
  function randomSpecies(isCyber) {
    return Object.keys(GENERA).flatMap(movement =>
      Object.keys(GENERA[movement]).flatMap(shape =>
        Object.keys(EPITHETS).map(headgear => buildRandomSpecies(movement, shape, headgear, isCyber))));
  }

  /** Every species: natives first, then the random ones, then their cyber versions. */
  const ALL_SPECIES = [
    ...NATIVE_SPECIES.map(species => ({ ...species, genus: species.latin.split(' ')[0], isNative: true, isCyber: false })),
    ...randomSpecies(false),
    ...randomSpecies(true)
  ].map(Object.freeze);

  const BY_ID = new Map(ALL_SPECIES.map(species => [species.id, species]));

  /** Species of a random monster's genome. */
  function forGenome(genome) {
    const look = genome.appearance;
    return BY_ID.get(`${genome.movement}-${look.shape}-${look.headgear}${look.cyber ? CYBER_SUFFIX : ''}`);
  }

  /**
   * Full name of one individual: the species, plus a third word for unusually big, old or young ones.
   * @param {object} genome
   */
  function individualName(genome) {
    const species = forGenome(genome);
    if (genome.isMini) return `${species.latin} juvenilis`;
    if (genome.power >= 9) return `${species.latin} maximus`;
    if (genome.power >= 6) return `${species.latin} majoris`;
    return species.latin;
  }

  Forest.MonsterSpecies = Object.freeze({
    ALL: ALL_SPECIES,
    get: id => BY_ID.get(id),
    forGenome,
    individualName
  });
})(window.Forest);
