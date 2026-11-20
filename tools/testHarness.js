/**
 * Loads the game's real scripts into Node for the tests in this folder, with everything that
 * draws or plays sound replaced by do-nothing stubs. Not loaded by the game.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

/** Scripts the tests need, in the same order as index.html. */
const SCRIPTS = [
  'src/namespace.js',
  'src/core/config.js',
  'src/core/mathUtils.js',
  'src/core/difficulty.js',
  'src/game/player.js',
  'src/art/mushroomSprites.js',
  'src/game/evilMushroom.js',
  'src/art/skyCreatureSprites.js',
  'src/game/skyCreatures.js',
  'src/monsters/monsterSpecies.js',
  'src/monsters/monsterGenome.js',
  'src/monsters/monsterPainter.js',
  'src/monsters/monsterAbilities.js',
  'src/monsters/monsterForge.js',
  'src/game/waveDirector.js'
];

const noop = () => {};

/** Absorbs any property access, call or `new` (stands in for THREE and canvases). */
const anything = new Proxy(function () {}, {
  get: (_, key) => (key === Symbol.toPrimitive ? () => 0 : anything),
  apply: () => anything,
  construct: () => anything
});

const fakeMesh = () => ({
  position: { set: noop }, scale: { set: noop, x: 1 }, rotation: { z: 0 }, visible: true,
  material: { opacity: 1, color: { setHex: noop } }
});

/**
 * Every sprite looks like a plain box of this many pixels, however it is looked up
 * (sprites.idle, sprites.walk[0], frames.stand.normal, ...).
 */
function fakeSprites(width, height) {
  // `length: 1` lets frame lists (sprites.walk) be looped over as one-frame animations
  const sprite = new Proxy({ width, height, length: 1 }, {
    get: (target, key) => (key in target ? target[key] : key === Symbol.iterator ? undefined : sprite)
  });
  return sprite;
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

/** Number assigned to `const NAME = 1.23` in a game file, so tests follow future tuning. */
function readConstant(relativePath, name) {
  const match = readSource(relativePath).match(new RegExp(`const ${name} = (-?[\\d.]+)`));
  if (!match) throw new Error(`const ${name} not found in ${relativePath}`);
  return Number(match[1]);
}

/** @returns {object} the game's `Forest` namespace */
function loadGame() {
  const context = { console, Math, Object, Array, Number, Boolean, String, Symbol, JSON, Proxy, Error, THREE: anything };
  context.window = context;
  vm.createContext(context);
  const load = relativePath => vm.runInContext(readSource(relativePath), context, { filename: relativePath });

  load(SCRIPTS[0]);
  const Forest = context.Forest;
  // Sprites built from ASCII art keep their real pixel size, so generated monsters are sized correctly
  Forest.Graphics = {
    createSpriteMesh: fakeMesh, setMeshSprite: noop, removeMesh: noop, createPixelTexture: () => anything,
    createSprite: canvas => ({ width: canvas.width, height: canvas.height, texture: { dispose: noop } })
  };
  Forest.PixelCanvas = {
    createPixelCanvas: () => ({ canvas: anything, ctx: anything }),
    asciiToCanvas: rows => ({ width: rows[0].length, height: rows.length }),
    createWhiteSilhouette: canvas => canvas
  };
  Forest.SoundEffects = new Proxy({}, { get: () => noop });
  Forest.BoySprites = { FRAME_SIZE: 24, SLAM_CANVAS_SIZE: { width: 48, height: 44 }, SLAM_BODY_ORIGIN: { x: 8, y: 20 } };
  SCRIPTS.slice(1).forEach(load);
  return Forest;
}

/** Shared game systems for constructing real enemies and the player. */
function createWorld(input = { horizontalDirection: () => 0, isPressingLeftOrRight: () => false }) {
  const spawned = [];
  return {
    spawned,
    scene: { add: noop, remove: noop },
    input,
    sprites: { boy: fakeSprites(24, 24), mushroom: fakeSprites(20, 18), skyCreatures: new Proxy({}, { get: () => fakeSprites(16, 16) }) },
    particles: { burst: noop },
    effects: { spawnRing: noop, spawnDisc: noop },
    hitStop: { trigger: noop },
    cameraController: { shake: noop },
    projectiles: { launchFireball: noop },
    spawnEnemy: enemy => spawned.push(enemy)
  };
}

/** Tiny test runner: check(name, condition, detail) and a summary with exit code. */
function createChecker() {
  const failures = [];
  let passed = 0;
  return {
    check(name, condition, detail = '') {
      if (condition) passed++;
      else failures.push(`${name}${detail ? ` -- ${detail}` : ''}`);
    },
    finish() {
      failures.forEach(failure => console.log(`FAIL  ${failure}`));
      console.log(`\n${passed} passed, ${failures.length} failed`);
      process.exitCode = failures.length ? 1 : 0;
    }
  };
}

module.exports = { ROOT, loadGame, createWorld, createChecker, readSource, readConstant, noop };
