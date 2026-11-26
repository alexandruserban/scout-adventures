/**
 * The story that ties the adventure together. The worlds come in a random order, so the story is
 * built from pieces that fit any order:
 *   - chapter beats tied to how far into the adventure the boy is (prologue, the Night Weaver
 *     closing in, the finale), so the plot always moves forward;
 *   - a line for leaving the world before and one for arriving in this one, so every pair of
 *     worlds joins up;
 *   - what the shard did to each world (start of the level) and how the world heals once its
 *     guardian is beaten (end of the level), naming whichever boss guarded it.
 *
 * Story so far: the Night Weaver smashed the Heart Star, the lantern that holds the worlds
 * together, into one shard per world. Each shard turned a gentle creature into a monster (the
 * boss). Scott follows Grandpa's compass from world to world to bring every shard home.
 */
(function (Forest) {
  /** The hero's name, used all through the story. */
  const HERO = 'Scott';

  // ==========================================
  // Each world
  // ==========================================
  /** Leaving a world, at the start of the next level (the compass opens the way on). */
  const DEPARTURES = {
    forest: 'Behind him the Whispering Forest hummed goodbye as the compass cut a door between two old oaks.',
    dungeon: 'He climbed out of the Sunken Dungeon by torchlight, and the compass burned a doorway into the last stone wall.',
    treetops: 'From the highest branch of the Cloud Canopy he jumped straight into the compass\'s portal, cloud fluff still in his hair.',
    desert: 'The last sandstorm of the Scorching Dunes spun itself into a door, and he shook the sand out of his boots as he stepped through.',
    ice: 'The aurora folded itself into a shimmering door, and he slid through on the last patch of Frozen Peaks ice.',
    volcano: 'A geyser of sparks blasted him out of the Molten Core, straight into the compass\'s glowing portal.',
    candy: 'He stuffed one last gumdrop in his pocket and hopped through a doorway of spun sugar.',
    moon: 'He floated out of a crater on the Silent Moon, and the compass pulled him through a door full of stars.',
    neon: 'Every sign in Neon Spell City flickered GOODBYE as he dived through a portal of humming light.',
    crystal: 'The crystal caves sang one last note, and their glow opened a door in the rock.',
    clockwork: 'Every clock in the Sky Citadel struck at once, and a brass door swung open in the air.',
    atlantis: 'A bubble as big as a house carried him up out of Techno-Atlantis and popped him through a portal.',
    fae: 'The hologram fairies spun a ring of light around him, and the Fae Garden blinked away.',
    mechKeep: 'The Mech Dragon Keep\'s drawbridge crashed down, and on the far side was not a moat but a portal.',
    rift: 'He stepped through one of the Quantum Rift\'s own tears in time, trusting the compass to know where it led.',
    station: 'He leapt from the Starwizard Station\'s airlock with nothing but the compass to steer by.',
    noir: 'The Silent Film ran out with a flap-flap-flap, and colour came flooding back as he tumbled through the portal.',
    mothership: 'A tractor beam spat him out of the Alien Mothership and right into the compass\'s portal.',
    rainbow: 'He slid down the end of the Rainbow of Webs, still picking silk out of his scarf, and dropped through the portal at the bottom.',
    rising: 'He let himself fall up into the sky of the World That Falls Up, and the sky opened like a door.',
    kitchen: 'He jumped off the edge of the giant\'s table, and the compass caught him halfway to the floor.',
    concert: 'The crowd lifted him up and passed him over their heads, all the way across the stage and into the compass\'s portal.'
  };

  /** Arriving in a world. */
  const ARRIVALS = {
    forest: 'He tumbled out under trees so old they whisper to each other: the Whispering Forest.',
    dungeon: 'He landed with a splash in a dark, dripping hall: the Sunken Dungeon.',
    treetops: 'He woke up on a branch so high the clouds were below him: the Cloud Canopy.',
    desert: 'Hot sand, a blinding sun and a wind that never stops: the Scorching Dunes.',
    ice: 'His breath turned to frost the moment he arrived. Snow, stars and the green glow of the aurora: the Frozen Peaks.',
    volcano: 'The air shimmered with heat, and rivers of lava rolled below him: the Molten Core.',
    candy: 'He landed face first in a marshmallow, and everything smelled of sugar: the Candy Kingdom.',
    moon: 'He bounced, and bounced, and kept on bouncing. Far above him hung the Earth: the Silent Moon.',
    neon: 'Buzzing signs, flying carpets with headlights and a pink sun that never sets: Neon Spell City.',
    crystal: 'Deep underground, crystals glowed in every colour, wired together like a giant machine: the Circuit Crystal Caves.',
    clockwork: 'Tick, tock, hiss! Gears as big as houses turned all around him: the Clockwork Sky Citadel.',
    atlantis: 'Glass domes, fish swimming past the windows, and every jump floating like a dream: Techno-Atlantis.',
    fae: 'Glowing mushrooms, tiny laughing lights and grass that sparkled: the Holo Fae Garden.',
    mechKeep: 'Steel walls, smoking chimneys and metal dragons circling the towers: the Mech Dragon Keep.',
    rift: 'Islands of rock hung in nothing at all, and time stuttered like a skipping record: the Quantum Rift.',
    station: 'Stars in every window, and decks polished as slick as glass: the Starwizard Station.',
    noir: 'Everything turned black and white, and a piano started playing out of nowhere: the Silent Film.',
    mothership: 'Humming metal, blinking lights and a lot of clicking in the dark: the Alien Mothership.',
    rainbow: 'He landed on something soft and bright, a rainbow strung across the sky with silk: the Rainbow of Webs.',
    rising: 'A cow drifted past him. Then a house. Then a whole hill. Everything here was falling upwards: the World That Falls Up.',
    kitchen: 'All of a sudden he was the size of a crumb, standing on a giant\'s table: the Giant\'s Kitchen.',
    concert: 'A wall of sound hit him: lights, smoke, and an octopus playing eight guitars at once. The Octopus Rock Concert!'
  };

  /** What the shard has done to the world (the level's task). */
  const TROUBLES = {
    forest: 'The shard had made the whole forest grumpy. Mushrooms snarled, and the trees whispered about a monster in the clearing.',
    dungeon: 'Somewhere below, the shard glowed red-hot, and something big was smouldering around it.',
    treetops: 'The birds had gone quiet. Something with enormous wings had made the shard its nest.',
    desert: 'The shard was buried somewhere in the sand, and the storm grew wilder the closer he got.',
    ice: 'The shard had frozen the aurora still. Under the snow, something huge was waking up.',
    volcano: 'The shard had made the volcano furious. Lava bombs were raining from a smoking sky!',
    candy: 'The shard had turned every sweet sour, and the candy had grown teeth.',
    moon: 'In the silence, the shard pulsed like a heartbeat, and something was feeding on its light.',
    neon: 'The shard\'s power had leaked into every wire, and the city\'s spells had gone haywire.',
    crystal: 'The shard had overloaded the ancient circuits, and the caves\' old guardian was booting up.',
    clockwork: 'The shard had jammed the great clock, and the citadel\'s machines had forgotten who built them.',
    atlantis: 'Someone had plugged the shard into the city\'s power core. The lights flickered, and something stung in the deep.',
    fae: 'The fairies were hiding in the mushroom caps. The shard had turned their queen\'s light cold.',
    mechKeep: 'The shard burned in the Keep\'s furnace, and the dragon drones guarded it day and night.',
    rift: 'The shard was tearing holes in time, and things were stepping through them.',
    station: 'The station\'s wizard-machine had swallowed the shard, and now it cast spells all on its own.',
    noir: 'The shard had spilled ink all over the film, and the ink was getting up and walking around.',
    mothership: 'The aliens had beamed the shard aboard, and their crawlers swarmed to protect it.',
    rainbow: 'The shard had tangled the rainbow in sticky silk. The spiders spit web, and the webs on the ground slow you down!',
    rising: 'The shard had stolen this world\'s gravity, and it was looking for more. Hold on tight!',
    kitchen: 'The shard had dropped into the giant\'s dessert, and the dessert had started to wobble all by itself.',
    concert: 'The shard was stuck in the lead singer\'s guitar, and the music had grown loud enough to shake the stars.'
  };

  /** The world healing once its guardian ({boss}) is beaten and the shard is free. */
  const HEALINGS = {
    forest: '{boss} shrank back into something small and friendly, and the trees went back to whispering happy gossip.',
    dungeon: '{boss} cooled into a pile of harmless stones, and the torches of the Sunken Dungeon burned a gentle gold.',
    treetops: '{boss} drifted away like a feather on the breeze, and the birdsong came back all at once.',
    desert: '{boss} burrowed off to sleep, and the sandstorm settled into a soft, warm breeze.',
    ice: '{boss} melted into a tiny snow flurry, and the aurora began to dance again.',
    volcano: '{boss} sank into the lava with a sleepy gurgle, and the volcano let out one long, calm puff of smoke.',
    candy: '{boss} went back to being plain old candy, and the whole kingdom tasted sweet again.',
    moon: '{boss} faded into stardust, and the Moon was peacefully silent once more.',
    neon: '{boss} fizzled out like a spent sparkler, and every sign in the city lit up to cheer.',
    crystal: '{boss} powered down, and the crystals settled into a soft, steady glow.',
    clockwork: '{boss} unwound with a long creak, and the great clock started ticking in time again.',
    atlantis: '{boss} drifted off as a harmless little jellyfish, and the domes lit up from end to end.',
    fae: '{boss} folded its wings and turned back into a tiny glowing moth. The fairies came out of hiding to dance.',
    mechKeep: '{boss} clanked to a stop, and the dragon drones curled up on the towers like sleeping cats.',
    rift: '{boss} stepped back through its portal, and the tears in time stitched themselves shut.',
    station: '{boss} rebooted as a polite little wizard-bot, which bowed and offered him a cup of star tea.',
    noir: '{boss} splashed back into an inkpot, and the film played on to a happy ending.',
    mothership: '{boss} scuttled off, and the aliens beamed down a thank-you note written in blinking lights.',
    rainbow: '{boss} curled up in a silk hammock and fell fast asleep, and the rainbow shone bright through the webs.',
    rising: '{boss} let go of the gravity it had stolen, and everything floated gently back down where it belonged.',
    kitchen: '{boss} wobbled one last time and went still, just in time for the giant\'s dessert.',
    concert: '{boss} took a bow, the crowd went wild, and the band played an encore just for {hero}.'
  };

  // ==========================================
  // The plot, by how far into the adventure he is
  // ==========================================
  const PROLOGUE = [
    'Every scout in the village knows the old story. High above the clouds hangs the Heart Star, the lantern that holds all the worlds together.',
    'Last night it went dark. The Night Weaver smashed it into {total} shards and flung them across {total} worlds, and every shard turned a gentle creature into a monster.',
    '{hero} grabbed Grandpa\'s old brass compass, the one that always points to whatever is lost. Its needle spun, and a door tore open in the air...'
  ];

  /**
   * Extra lines at the start of a level, by its position in the adventure (0 = first).
   * 'secondLast' and 'last' are the final two levels, however long the adventure is.
   */
  const CHAPTER_STARTS = {
    3: 'A whisper followed him through the portal, soft as spider silk: "Turn back, little scout. The shards are mine." {hero} gripped the compass tighter and kept going.',
    6: 'Every world he set free made the compass glow brighter, and every portal felt a little less scary.',
    9: 'He could feel the Night Weaver watching now: a shadow at the corner of his eye, a cold thread brushing the back of his neck.',
    12: 'The Weaver was sending bigger monsters now. {hero} remembered what Grandpa always said: "A scout leaves every place better than he found it."',
    15: 'Some of the creatures he had freed had started following him through the portals, cheering him on from the edges of each world.',
    18: 'The sky itself had begun to crack. Through the cracks he could see the Heart Star, dark and broken, waiting for its shards.',
    secondLast: 'Only two shards left. The Night Weaver\'s threads were everywhere now, and the portal behind him snapped shut like a trap.',
    last: 'The last shard! The compass pulled so hard it nearly flew out of his hand. Here the Night Weaver had hidden it best of all, with his fiercest guardian to watch over it.'
  };

  /** Extra lines at the end of a level, by its position ('halfway' = the level that completes half the shards). */
  const CHAPTER_ENDS = {
    0: 'One shard down! The compass glowed a little brighter, almost as if it was proud of him.',
    4: 'That night, by the light of five shards, he saw a shadow in the sky: thin black threads, reaching for the shards he carried. The Night Weaver knew he was coming.',
    halfway: 'Halfway home! For the first time, the shards in his satchel began to hum together: the same tune Grandpa used to whistle by the campfire.',
    16: 'Far away, the Night Weaver\'s laughter echoed through the portal. It didn\'t sound quite so sure of itself any more.'
  };

  /** Closing lines for the levels with no chapter ending, taken in turn. */
  const ONWARDS = [
    'The compass needle twitched. Another shard was calling.',
    'He tucked the shard into his satchel with the others. It was getting heavy, in a good way.',
    'The compass hummed, already pointing somewhere new.',
    'Somewhere far away, the Night Weaver hissed. Another shard was gone.',
    'He took a deep breath. The next door was already opening.',
    'The shard felt warm in his hand, like holding a little piece of sunshine.'
  ];

  const FINALE = [
    'The last shard leapt from his hand and shot into the sky. One by one, all {total} shards rose to meet it, and the Heart Star burst back into light.',
    'The Night Weaver\'s threads frayed, then snapped, and with a wail like wind through a keyhole he unravelled into nothing at all.',
    'The compass gave one last happy spin and opened a door to a very familiar place: home. The village, his own bed, and Grandpa waiting by the fire.',
    '"Well?" asked Grandpa. "Did you leave every place better than you found it?" {hero} grinned. He had.'
  ];

  // ==========================================
  // Putting it together
  // ==========================================
  /** "THE GREAT SPIKY CYBER-BIGHEAD" -> "The Great Spiky Cyber-Bighead" (boss names are in capitals for the banners). */
  function titleCase(name) {
    return name.toLowerCase().replace(/(^|[\s-])(\S)/g, (match, gap, letter) => gap + letter.toUpperCase());
  }

  function fill(text, { total, bossName = 'The guardian' }) {
    return text
      .replace(/\{hero\}/g, HERO)
      .replace(/\{total\}/g, String(total))
      .replace(/\{boss\}/g, bossName);
  }

  function chapterKey(position, total) {
    if (position === total - 1) return 'last';
    if (position === total - 2) return 'secondLast';
    return position;
  }

  /**
   * Story paragraphs for the start of a level.
   * @param {{position:number, total:number, worldId:string, previousWorldId?:string}} where
   *   position 0 is the first level; previousWorldId is the world played just before
   * @returns {string[]}
   */
  function levelStart({ position, total, worldId, previousWorldId }) {
    const paragraphs = [];
    if (position === 0) {
      paragraphs.push(...PROLOGUE, ARRIVALS[worldId]);
    } else {
      const beat = CHAPTER_STARTS[chapterKey(position, total)];
      if (beat) paragraphs.push(beat);
      paragraphs.push(`${DEPARTURES[previousWorldId] || ''} ${ARRIVALS[worldId]}`.trim());
    }
    paragraphs.push(TROUBLES[worldId]);
    return paragraphs.filter(Boolean).map(text => fill(text, { total }));
  }

  /**
   * Story paragraphs for the end of a level, once its boss is beaten.
   * @param {{position:number, total:number, worldId:string, bossName:string}} where bossName as in the banners
   * @returns {string[]}
   */
  function levelEnd({ position, total, worldId, bossName }) {
    const values = { total, bossName: bossName ? titleCase(bossName) : undefined };
    const paragraphs = [HEALINGS[worldId]];
    if (position === total - 1) {
      paragraphs.push(...FINALE);
    } else {
      const halfway = Math.ceil(total / 2) - 1;
      const beat = position === halfway ? CHAPTER_ENDS.halfway : CHAPTER_ENDS[position];
      paragraphs.push(beat || ONWARDS[position % ONWARDS.length]);
    }
    return paragraphs.filter(Boolean).map(text => fill(text, values));
  }

  Forest.Story = { HERO, levelStart, levelEnd };
})(window.Forest);
