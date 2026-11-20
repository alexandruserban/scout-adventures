/**
 * Headless jump-over test. Loads the game's real Player physics and the real enemy isTouching()
 * checks (graphics/audio stubbed, see testHarness.js), then sweeps jump timings to see which
 * enemies a normal jump or a double jump can clear. Not loaded by the game.
 *
 * Usage (from the project folder): node tools/jumptest.js
 * Exits with code 1 if any enemy doesn't behave as intended (see `expect` in ENEMIES).
 */
const { loadGame, createWorld, readSource, readConstant: constant } = require('./testHarness');

const F = loadGame();
const read = readSource;
const noop = () => {};

// Constants read straight from the game files, so the test follows future tuning
const PIXEL_SCALE = F.Config.PIXEL_SCALE;
const MUSHROOM_CHASE_SPEED = constant('src/game/evilMushroom.js', 'CHASE_SPEED');
const MUSHROOM_SCALE = constant('src/game/evilMushroom.js', 'SPRITE_SCALE');
const GOLEM_WALK_SPEED = constant('src/game/skyCreatures.js', 'GOLEM_WALK_SPEED');
const GOLEM_STOP_DISTANCE = constant('src/game/skyCreatures.js', 'GOLEM_STOP_DISTANCE');
const BEETLE_CHARGE_SPEED = constant('src/game/skyCreatures.js', 'BEETLE_CHARGE_SPEED');
const scaleOf = cls => read('src/game/skyCreatures.js').match(new RegExp(`class ${cls}[\\s\\S]*?spriteScale: ([^,]+),`))[1].match(/[\d.]+/g).map(Number);

// ---------- Enemies: real prototypes (real isTouching), sized from the real sprite art ----------
const Sky = F.SkyCreatures;
const art = F.SkyCreatureSprites.creatures;
const frameSize = (rows, scale) => ({ width: rows[0].length * PIXEL_SCALE * scale, height: rows.length * PIXEL_SCALE * scale });

function makeEnemy(proto, size, extra = {}) {
  return Object.assign(Object.create(proto), { x: 0, y: 0, ...size, ...extra });
}
const jellyScales = scaleOf('ThunderJelly'); // [mini, big] from "isMini ? 0.6 : 1.05"
const ENEMIES = [
  { name: 'Mushroom (standing)', make: () => makeEnemy(F.EvilMushroom.prototype, frameSize(F.MushroomSprites.walk[0], MUSHROOM_SCALE)), expect: 'normal' },
  { name: 'Mushroom (chasing)', make: () => makeEnemy(F.EvilMushroom.prototype, frameSize(F.MushroomSprites.walk[0], MUSHROOM_SCALE)), move: 'chase', speed: MUSHROOM_CHASE_SPEED, expect: 'normal' },
  { name: 'Nutling', make: () => makeEnemy(Sky.nutling.prototype, frameSize(art.nutling.frames.acorn, scaleOf('Nutling')[0])), expect: 'normal' },
  { name: 'Thornback (walking)', make: () => makeEnemy(Sky.thornback.prototype, frameSize(art.thornback.frames.walk1, scaleOf('Thornback')[0])), expect: 'normal' },
  { name: 'Thornback (charging)', make: () => makeEnemy(Sky.thornback.prototype, frameSize(art.thornback.frames.walk1, scaleOf('Thornback')[0])), move: 'charge', speed: BEETLE_CHARGE_SPEED, expect: 'normal' },
  { name: 'Small jelly', make: () => makeEnemy(Sky.jelly.prototype, frameSize(art.jelly.frames.idle, jellyScales[0]), { isMini: true }), expect: 'normal' },
  { name: 'Big jelly', make: () => makeEnemy(Sky.jelly.prototype, frameSize(art.jelly.frames.idle, jellyScales[1]), { isMini: false }), expect: 'double' },
  { name: 'Cinder Golem (walking)', make: () => makeEnemy(Sky.golem.prototype, frameSize(art.golem.frames.stand, scaleOf('CinderGolem')[0])), move: 'chase', speed: GOLEM_WALK_SPEED, stop: GOLEM_STOP_DISTANCE, expect: 'double' },
  { name: 'Cinder Golem (enraged, fast wave)', make: () => makeEnemy(Sky.golem.prototype, frameSize(art.golem.frames.stand, scaleOf('CinderGolem')[0])), move: 'chase', speed: GOLEM_WALK_SPEED * 1.6 * 1.6, stop: GOLEM_STOP_DISTANCE, expect: 'double' }
];

// ---------- The real player ----------
const input = { direction: 1, horizontalDirection() { return this.direction; }, isPressingLeftOrRight() { return this.direction !== 0; } };
const world = createWorld(input);
const player = new F.Player(world, { onHealthChanged: noop, onDefeated: noop, onSlamLanded: noop });
const DT = 1 / 60;

/** Run toward the enemy holding right; jump when `jumpDistance` away, double-jump `doubleDelay` s later. */
function attempt(spec, jumpDistance, doubleDelay) {
  player.reset(0, 5);
  input.direction = 1;
  const enemy = spec.make();
  enemy.x = 8;
  let jumpTime = null;
  for (let t = 0; t < 5; t += DT) {
    if (jumpTime === null && enemy.x - player.x <= jumpDistance) { player.tryJump(); jumpTime = t; }
    if (doubleDelay !== undefined && jumpTime !== null && t - jumpTime >= doubleDelay && t - jumpTime < doubleDelay + DT / 2) player.tryJump();
    player.update(DT);

    if (spec.move === 'chase') {
      const gap = player.x - enemy.x;
      if (Math.abs(gap) > (spec.stop || 0)) enemy.x += Math.sign(gap) * spec.speed * DT;
    } else if (spec.move === 'charge') {
      enemy.x -= spec.speed * DT; // charges left, toward the incoming boy, and keeps going
    }

    if (enemy.isTouching(player)) return false;
    if (jumpTime !== null && !player.isAboveGround && player.x > enemy.x) return true; // landed past it
    if (jumpTime !== null && !player.isAboveGround && player.x <= enemy.x) return false; // landed short
  }
  return false;
}

function sweep(spec, useDouble) {
  let wins = 0;
  let total = 0;
  let best = null;
  for (let d = 0.2; d <= 5; d += 0.05) {
    const delays = useDouble ? Array.from({ length: 40 }, (_, i) => 0.05 + i * 0.015) : [undefined];
    for (const delay of delays) {
      total++;
      if (attempt(spec, d, delay)) { wins++; if (!best) best = { d, delay }; }
    }
  }
  return { wins, total };
}

console.log(`Player box ${player.width.toFixed(3)} x ${player.height.toFixed(3)} units, real Player physics, ${Math.round(1 / DT)} fps\n`);
const rows = [];
let allOk = true;
for (const spec of ENEMIES) {
  const e = spec.make();
  const single = sweep(spec, false);
  const double = sweep(spec, true);
  const normalClears = single.wins > 0;
  const ok = spec.expect === 'normal' ? normalClears : (!normalClears && double.wins > 0);
  allOk = allOk && ok;
  rows.push({
    enemy: spec.name,
    size: `${e.width.toFixed(2)}x${e.height.toFixed(2)}`,
    'normal jump': normalClears ? `YES (${single.wins}/${single.total} timings)` : 'no',
    'double jump': double.wins > 0 ? `YES (${(100 * double.wins / double.total).toFixed(0)}% of timings)` : 'no',
    wanted: spec.expect === 'normal' ? 'normal jump clears' : 'double jump only',
    result: ok ? 'PASS' : 'FAIL'
  });
}
console.table(rows);
console.log(allOk ? '\nAll enemies behave as intended.' : '\nSome enemies do NOT behave as intended.');
process.exitCode = allOk ? 0 : 1;
