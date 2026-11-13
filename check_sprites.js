const fs = require('fs');
const c = fs.readFileSync('C:/Users/alexa/.gemini/antigravity/scratch/forest-pixel-adventure/src/sprites.js', 'utf8');
const lines = c.split('\n');
let inAttack = false, name = '', row = 0;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.match(/const BOY_ATTACK_\d/)) {
    inAttack = true;
    name = l.match(/BOY_ATTACK_\d/)[0];
    row = 0;
  }
  if (inAttack && l.includes('"')) {
    const m = l.match(/"([^"]*)"/);
    if (m) {
      const s = m[1];
      if (s.length !== 24) {
        console.log(name + ' row ' + row + ' len=' + s.length + ': ' + s);
      }
      row++;
    }
  }
  if (inAttack && l.includes('];')) {
    console.log(name + ': ' + row + ' rows');
    inAttack = false;
  }
}
console.log('Done');
