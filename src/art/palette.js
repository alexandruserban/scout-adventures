/**
 * Colour palette shared by all ASCII pixel art.
 * Each single character in a sprite string maps to one colour here; '.' is transparent.
 */
(function (Forest) {
  Forest.PALETTE = Object.freeze({
    // Transparency
    '.': 'transparent',

    // Boy Palette
    'H': '#2e1a07', // Hair dark shadow
    'h': '#59321f', // Hair base brown
    'j': '#804c2b', // Hair light highlight
    'C': '#4c1d7a', // Cap dark purple
    'c': '#7b3fc4', // Cap vibrant purple
    'v': '#a879e8', // Cap highlight
    'S': '#d6946e', // Skin shadow & solid defined nose tip
    's': '#fcd5b5', // Skin base peach
    'b': '#f59e8b', // Skin blush
    'E': '#181b22', // Profile eye dark pupil
    'W': '#ffffff', // White (eyes, teeth, highlights)
    'q': '#931215', // Mouth open in pain / grit teeth
    'J': '#1c2e4a', // Jacket dark navy
    'k': '#2d4b75', // Jacket blue
    'l': '#466fa8', // Jacket light blue
    'F': '#d1b000', // Scarf yellow
    'f': '#ffe94d', // Scarf light
    'P': '#5e432f', // Pants dark khaki
    'p': '#8c684a', // Pants khaki
    'B': '#2a1a11', // Boots dark
    'd': '#543623', // Boots leather

    // Two-Handed Sword Palette
    '-': '#475569', // Steel blade shadow
    '+': '#94a3b8', // Steel blade mid
    '*': '#ffffff', // Steel blade edge shine
    'i': '#d97706', // Hilt pommel & crossguard gold
    'I': '#fde047', // Crossguard highlight
    'o': '#451a03', // Two-handed leather grip wrap
    'O': '#290f02', // Grip shadow
    'L': '#ffeaa7', // Slash energy / arc trail

    // Hit Flash
    'X': '#ffffff', // Full white flash
    'Y': '#ff595e', // Red flash

    // Mushroom Palette
    'M': '#660708', // Mushroom cap deep shadow
    'm': '#a4161a', // Mushroom cap dark red
    'R': '#e5383b', // Mushroom cap vibrant crimson
    'r': '#f47074', // Mushroom cap highlight
    'U': '#2b1029', // Under-cap gills dark
    'u': '#562a52', // Under-cap gills
    'T': '#e0d1be', // Stem light cream
    't': '#a89884', // Stem shadow
    'Z': '#ffe49e', // Poison yellow wart
    'z': '#ffd166', // Poison yellow wart shadow
    'N': '#7209b7', // Poison purple spot
    'n': '#9d4edd', // Poison light purple
    'e': '#ffbe0b', // Evil eye amber glow
    'D': '#131114', // Evil eye pupil / mouth cavity

    // Environment Palette
    'g': '#2b580c', // Foliage darkest
    'G': '#42781a', // Foliage shadow
    'A': '#68a329', // Foliage mid
    'a': '#99cc33', // Foliage light
    'w': '#c2e85a', // Foliage highlight
    'K': '#281a10', // Bark darkest
    '8': '#6b452c', // Bark mid
    '9': '#8f6140', // Bark light
    '1': '#192b11', // Dirt deep
    '2': '#312015', // Dirt dark
    '3': '#4f3523', // Dirt mid
    '4': '#6e4c34', // Dirt light
    '7': '#8d6849', // Dirt surface
    '#': '#1b4d1b', // Grass dark
    '$': '#2f7a28', // Grass mid
    '%': '#4fb835', // Grass bright
    '^': '#8ae35a', // Grass tip highlight
  });
})(window.Forest);
