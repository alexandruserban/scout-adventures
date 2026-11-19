/**
 * Pixel art for the creatures that rain down from the sky in the endless waves.
 *
 * Unlike the boy and the mushrooms, each creature carries its own little palette, so the same
 * letter can mean different colours for different creatures. '.' is always transparent.
 * Symmetrical creatures are drawn as their left half only and mirrored at load time.
 */
(function (Forest) {
  /** Complete each half-row with its own mirror image. */
  function mirror(halfRows) {
    return halfRows.map(row => row + [...row].reverse().join(''));
  }

  // ==========================================
  // Tier 1: Nutling - an acorn that cracks open into a biting, hopping imp
  // ==========================================
  const NUTLING_TOP = [
    '......s',
    '....gKs',
    '...KKKK',
    '..KcCxC',
    '.KcCxCx',
    '.Kxcxcx',
    '.KKKKKK'
  ];

  const nutling = {
    name: 'Nutling',
    palette: {
      K: '#2a1a0e', // outline
      c: '#5e3b1c', // cap
      C: '#8f6140', // cap light
      x: '#3d2612', // cap crosshatch
      s: '#3b2a14', // stem
      g: '#7bc043', // sprout leaf
      b: '#c98a3e', // nut body
      B: '#e8b062', // nut body highlight
      d: '#94602a', // nut body shadow
      W: '#fff6d5', // eye white
      r: '#ff3b3b', // angry red pupil
      E: '#120c08', // brows / closed eyes
      m: '#5a1010', // mouth
      T: '#ffffff' // fang
    },
    frames: {
      /** Still a sleepy acorn while it falls. */
      acorn: mirror([
        ...NUTLING_TOP,
        '..KbBBB',
        '..KbBEb',
        '..Kbbbb',
        '..Kdbbb',
        '...Kdbb',
        '...Kddb',
        '....Kdd',
        '.....Kd',
        '......K'
      ]),
      /** Awake: angry brows, red eyes, fangs, stubby legs on the ground. */
      hop1: mirror([
        ...NUTLING_TOP,
        '..KbEEB',
        '..KWrBb',
        '..Kbbmm',
        '..KdbTm',
        '...Kdbb',
        '...Kddb',
        '....Kdd',
        '....KK.',
        '....KK.'
      ]),
      /** Mid-hop: legs kicked out. */
      hop2: mirror([
        ...NUTLING_TOP,
        '..KbEEB',
        '..KWrBb',
        '..Kbbmm',
        '..KdbTm',
        '...Kdbb',
        '...Kddb',
        '....Kdd',
        '...KK..',
        '..KK...'
      ])
    }
  };

  // ==========================================
  // Tier 2: Thornback - an armoured bramble beetle that charges (drawn facing right)
  // ==========================================
  const THORNBACK_BODY = [
    '.....t...t...t......',
    '....tT..tT..tT......',
    '...KKKKKKKKKKKK.....',
    '..KaAAhhAAAhhAAK....',
    '.KaAAhhAAAAhhAAAK..o',
    '.KaAAAAAAAAAAAAAKKoO',
    'KaaAAAAAAAAAAAAAKsoK',
    'KaaaAAAAAAAAAAAKsseK',
    'KaaaaaaaaaaaaaaKsssK',
    '.KKKKKKKKKKKKKKKKKK.'
  ];

  const thornback = {
    name: 'Thornback',
    palette: {
      K: '#120d16', // outline
      a: '#2e1a40', // shell shadow
      A: '#55307a', // shell
      h: '#8e57c2', // shell shine
      t: '#c7f464', // thorn tip
      T: '#7ea83a', // thorn base
      s: '#3a2d45', // head
      o: '#e8dcc4', // horn
      O: '#a89a80', // horn shadow
      e: '#ff3b3b', // eye
      l: '#2a1f30' // legs
    },
    frames: {
      walk1: [
        ...THORNBACK_BODY,
        '..l..l...l..l..l....',
        '.l..l...l..l..l.....'
      ],
      walk2: [
        ...THORNBACK_BODY,
        '...l..l...l..l..l...',
        '...l..l...l..l..l...'
      ]
    }
  };

  // ==========================================
  // Tier 3: Gloomwing - a spore moth that circles overhead and dive-bombs
  // ==========================================
  const gloomwing = {
    name: 'Gloomwing',
    palette: {
      K: '#140a1f', // outline
      w: '#3d1e5c', // wing shadow
      W: '#6a35a0', // wing
      v: '#a66be0', // wing highlight
      p: '#ff9de2', // wing eye-spot
      y: '#ffe066', // glowing spore centre
      b: '#24142e', // body
      B: '#4a2f5c', // body highlight
      e: '#7dfbff', // eyes
      f: '#d9c7ff' // antennae
    },
    frames: {
      /** Wings raised (also the tucked dive pose). */
      up: mirror([
        '.........f.',
        '.KKK......f',
        'KvWWKK...KK',
        'KWvWWWK.KbB',
        'KWWpWWWKKeb',
        'KWpypWWWKbb',
        '.KWpWWwwKBb',
        '..KWWwwwKbB',
        '...KKwwKKbb',
        '..KwwwKK.Kb',
        '..KwvwK...K',
        '...KKK.....'
      ]),
      /** Wings swept down. */
      down: mirror([
        '.........f.',
        '..........f',
        '.........KK',
        '........KbB',
        '..KKKKKKKeb',
        '.KWWWWpWKbb',
        'KWvWWpypKBb',
        'KWWWWWpWKbB',
        'KwWWWwwwKbb',
        '.KwwwwwKK.K',
        '..KwvwwK...',
        '...KKKK....'
      ])
    }
  };

  // ==========================================
  // Tier 4: Thunder Jelly - a storm-cloud slime whose landings send lightning along the grass
  // ==========================================
  const jelly = {
    name: 'Thunder Jelly',
    palette: {
      K: '#0b2236', // outline
      j: '#1f7a9e', // jelly shadow
      J: '#35b6d6', // jelly
      L: '#8ff0ff', // jelly light
      S: '#ffffff', // shine
      z: '#ffe14d', // lightning core
      Z: '#fff7b3', // lightning glow
      E: '#061018', // eyes / mouth
      m: '#ff6fa8' // cheeks
    },
    frames: {
      idle: mirror([
        '......KKK',
        '....KKLLL',
        '...KLLSSJ',
        '..KLSSJJJ',
        '.KJLSJJJz',
        '.KJJJJJzJ',
        'KJJEEJJzZ',
        'KJJEEJzZJ',
        'KJJJJJJzJ',
        'KjJmJJJJJ',
        'KjJJJJJEE',
        'KjjJJJJJJ',
        '.KjjJJJJJ',
        '.KjjjjJJJ',
        '..KKjjjjj',
        '....KKKKK'
      ]),
      /** Squashed flat, charging up a jump. */
      squash: mirror([
        '.........',
        '.........',
        '.........',
        '.........',
        '....KKKKK',
        '..KKLLSSJ',
        '.KLSSJJJz',
        'KJJEEJJzZ',
        'KJJEEJzZJ',
        'KjJmJJJzJ',
        'KjJJJJJEE',
        'KjjJJJJJJ',
        'KjjjJJJJJ',
        'KjjjjjjJJ',
        '.KKjjjjjj',
        '..KKKKKKK'
      ])
    }
  };

  // ==========================================
  // Tier 5: Cinder Golem - a molten rock giant that crashes down like a meteor and hurls fire
  // ==========================================
  const GOLEM_LEGS = [
    '......KRrRK.',
    '.....KRRRRK.',
    '.....KlLRRK.',
    '.....KKKKKK.'
  ];

  const golem = {
    name: 'Cinder Golem',
    palette: {
      K: '#120806', // outline
      r: '#3a2620', // rock shadow
      R: '#5c3d33', // rock
      s: '#7d564a', // rock highlight
      l: '#ff5a1f', // lava
      L: '#ffb347', // bright lava
      y: '#fff3a0', // white-hot core
      E: '#ff2a00', // eye rim
      e: '#ffef5c' // eye glow
    },
    frames: {
      stand: mirror([
        '............',
        '........KKKK',
        '.......KRRsR',
        '......KRsRRR',
        '......KREeRR',
        '......KRRRRl',
        '..KKKKKRrlLL',
        '.KRsRRKKRRRR',
        'KRsRRRRKRlRR',
        'KRRlRRRKRLlR',
        'KRlLRRRRKRly',
        'KRRlRRRRKRLy',
        'KRRRRKKRKRlL',
        '.KRRK.KRRRRR',
        '.KlRK.KRRrRR',
        '.KLLK.KRrrRR',
        'KRLyRK.KRRK.',
        'KRRRRK.KRRK.',
        '.KKKK.KRRRK.',
        ...GOLEM_LEGS
      ]),
      /** Glowing fists raised overhead, about to hurl fireballs. */
      throw: mirror([
        'KKK.........',
        'KLyK....KKKK',
        'KLLK...KRRsR',
        'KlRK..KRsRRR',
        '.KRK..KREeRR',
        '.KRK..KRRRRl',
        '.KRKKKKRrLyL',
        '.KRsRRKKRlyl',
        '..KRRRRKRlRR',
        '..KRRRRKRLlR',
        '..KRRRRRKRly',
        '..KRRRRRKRLy',
        '..KKRKKRKRlL',
        '....K.KRRRRR',
        '......KRRrRR',
        '......KRrrRR',
        '.......KRRK.',
        '.......KRRK.',
        '......KRRRK.',
        ...GOLEM_LEGS
      ])
    }
  };

  // ==========================================
  // The golem's fireball (8x8)
  // ==========================================
  const fireball = {
    palette: {
      r: '#b3200b',
      l: '#ff5a1f',
      L: '#ffb347',
      y: '#fff3a0'
    },
    rows: mirror([
      '..rl',
      '.rlL',
      'rlLy',
      'rLyy',
      'rLyy',
      'rlLy',
      '.rlL',
      '..rl'
    ])
  };

  Forest.SkyCreatureSprites = Object.freeze({
    /** In the order the waves introduce them, weakest first. */
    creatures: { nutling, thornback, gloomwing, jelly, golem },
    fireball
  });
})(window.Forest);
