/**
 * Monster Forge, part 2: the painter.
 *
 * Turns a genome (see monsterGenome.js) into ASCII pixel art in the same format as the hand-drawn
 * sky creatures: { palette, frames: { idle, move, attack } }, one string per pixel row.
 *
 * Everything is painted on the left half only, measured as "columns out from the centre line",
 * and mirrored at the end, so every monster is symmetrical and can be flipped freely.
 *
 *   idle   - standing / wings up; also shown while falling from the sky
 *   move   - walking stride, airborne hopper, or wings down
 *   attack - same pose as idle with glowing eyes and an open mouth (the wind-up "tell")
 */
(function (Forest) {
  const { createSeededRandom } = Forest.MathUtils;

  const EMPTY = '.';
  const OUTLINE = 'K';

  const HEADGEAR_HEIGHT = { none: 0, horns: 4, antennae: 4, spikes: 2, crest: 3 };
  const LEG_HEIGHT = { walker: 3, hopper: 1, flyer: 2 };
  /** Cyber antenna mast, light included. */
  const MAST_HEIGHT = 4;

  /** Half-width of the body (0..1) at height v (-1 = top, 1 = bottom). */
  const SHAPES = {
    round: v => Math.sqrt(1 - v * v),
    boxy: v => Math.pow(1 - Math.pow(Math.abs(v), 4), 0.25),
    /** Wider towards the bottom. */
    pear: v => Math.sqrt(1 - v * v) * (0.7 + 0.3 * (v + 1) / 2) / 0.85,
    /** Big head, narrower bottom. */
    bulb: v => Math.sqrt(1 - v * v) * (1 - 0.3 * (v + 1) / 2) / 0.85
  };

  /** A half-width grid of palette letters; column 0 touches the centre line. */
  class HalfCanvas {
    constructor(halfWidth, height) {
      this.halfWidth = halfWidth;
      this.height = height;
      this.cells = Array.from({ length: height }, () => new Array(halfWidth).fill(EMPTY));
    }

    isInside(column, row) {
      return column >= 0 && column < this.halfWidth && row >= 0 && row < this.height;
    }

    get(column, row) {
      return this.isInside(column, row) ? this.cells[row][column] : EMPTY;
    }

    set(column, row, letter) {
      if (this.isInside(column, row)) this.cells[row][column] = letter;
    }

    /** Ring every painted shape with a one-pixel outline. */
    addOutline() {
      const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const outlined = [];
      for (let row = 0; row < this.height; row++) {
        for (let column = 0; column < this.halfWidth; column++) {
          if (this.get(column, row) !== EMPTY) continue;
          // Column -1 is the mirror image of column 0, which is this same (empty) cell
          const touchesShape = neighbours.some(([dc, dr]) => this.get(column + dc, row + dr) !== EMPTY);
          if (touchesShape) outlined.push([column, row]);
        }
      }
      outlined.forEach(([column, row]) => this.set(column, row, OUTLINE));
    }

    /** Full-width rows: the left half is the grid read outer-to-centre, the right half its mirror. */
    toRows() {
      return this.cells.map(cells => [...cells].reverse().join('') + cells.join(''));
    }
  }

  /** Measurements shared by every frame of one monster. */
  function measure(genome) {
    const look = genome.appearance;
    const bodyHalfWidth = look.bodyHalfWidth;
    const bodyHeight = look.bodyHeight;
    const wingSpan = look.wingSpan;
    const mastHeight = look.cyber && look.cyber.hasMast ? MAST_HEIGHT : 0;
    const headroom = Math.max(HEADGEAR_HEIGHT[look.headgear], wingSpan, mastHeight);
    const bodyTop = 1 + headroom;
    const legHeight = LEG_HEIGHT[genome.movement];

    // Body half-width of every body row
    const shape = SHAPES[look.shape] || SHAPES.round;
    const rowWidths = Array.from({ length: bodyHeight }, (_, index) => {
      const v = ((index + 0.5) / bodyHeight) * 2 - 1;
      return Math.max(1, Math.min(bodyHalfWidth, Math.round(bodyHalfWidth * shape(v))));
    });

    // First and last body row of every column (for horns on top and legs below)
    const columnTop = [];
    const columnBottom = [];
    for (let column = 0; column < bodyHalfWidth; column++) {
      const rows = rowWidths.map((width, index) => (column < width ? index : -1)).filter(index => index >= 0);
      columnTop[column] = rows.length ? bodyTop + rows[0] : bodyTop + bodyHeight - 1;
      columnBottom[column] = rows.length ? bodyTop + rows[rows.length - 1] : bodyTop + bodyHeight - 1;
    }

    return {
      look,
      bodyHalfWidth,
      bodyHeight,
      bodyTop,
      bodyBottom: bodyTop + bodyHeight - 1,
      rowWidths,
      columnTop,
      columnBottom,
      legHeight,
      wingSpan,
      halfWidth: bodyHalfWidth + 2 + (wingSpan ? wingSpan + 1 : 0),
      height: bodyTop + bodyHeight + legHeight + 1
    };
  }

  // ==========================================
  // Body parts
  // ==========================================
  function isBody(size, column, row) {
    const index = row - size.bodyTop;
    return index >= 0 && index < size.bodyHeight && column < size.rowWidths[index];
  }

  function paintBody(canvas, size, spots) {
    const { look } = size;
    for (let index = 0; index < size.bodyHeight; index++) {
      const row = size.bodyTop + index;
      const v = ((index + 0.5) / size.bodyHeight) * 2 - 1;
      const width = size.rowWidths[index];

      for (let column = 0; column < width; column++) {
        const across = (column + 0.5) / width; // 0 at the centre line, 1 at the edge
        let letter = 'b';
        if (v > 0.6 || (across > 0.85 && v > -0.2)) {
          letter = 'd';
        } else if (v < -0.35 && v > -0.85 && across > 0.3 && across < 0.7) {
          letter = 'h';
        } else if (look.pattern === 'belly' && (across / 0.55) ** 2 + ((v - 0.4) / 0.45) ** 2 < 1) {
          letter = 'p';
        } else if (look.pattern === 'stripes' && index % 4 === 1 && v < 0.5) {
          letter = 's';
        } else if (look.pattern === 'spots' && spots.has(`${column},${index}`)) {
          letter = 's';
        }
        canvas.set(column, row, letter);
      }
    }
  }

  /** Random 2-pixel spots, from the genome's detail seed so they're the same every frame. */
  function rollSpots(size) {
    const random = createSeededRandom(size.look.detailSeed);
    const spots = new Set();
    const count = 2 + Math.floor(random() * 3);
    for (let i = 0; i < count; i++) {
      const index = 1 + Math.floor(random() * Math.max(1, size.bodyHeight - 3));
      const column = Math.floor(random() * Math.max(1, size.rowWidths[index] - 2));
      spots.add(`${column},${index}`);
      spots.add(`${column + 1},${index}`);
      spots.add(`${column},${index + 1}`);
    }
    return spots;
  }

  /** Eye positions as { column, row, width, height }, filled in by paintEyes. */
  function layoutEyes(size) {
    const { look, bodyHalfWidth } = size;
    const row = size.bodyTop + Math.max(1, Math.round(size.bodyHeight * 0.28));
    const bigEyes = bodyHalfWidth >= 7;
    const width = bigEyes ? 3 : 2;
    const pairColumn = Math.max(1, Math.round(bodyHalfWidth * 0.4));

    switch (look.eyes) {
      case 1:
        return [{ column: 0, row, width: bigEyes ? 3 : 2, height: 3, isCentre: true }];
      case 3:
        return [
          { column: 0, row: row - 1, width: 1, height: 2, isCentre: true },
          { column: Math.max(2, pairColumn), row: row + 1, width: 2, height: 2 }
        ];
      case 4:
        if (bodyHalfWidth >= 5) {
          return [
            { column: 1, row, width: 1, height: 2 },
            { column: 3, row: row + 1, width: bigEyes ? 2 : 1, height: 2 }
          ];
        }
        break;
    }
    return [{ column: pairColumn, row, width, height: 2 }];
  }

  function paintEyes(canvas, size, eyes, isAngry) {
    const pupil = isAngry ? 'r' : 'E';
    eyes.forEach(eye => {
      for (let dr = 0; dr < eye.height; dr++) {
        for (let dc = 0; dc < eye.width; dc++) {
          if (isBody(size, eye.column + dc, eye.row + dr)) canvas.set(eye.column + dc, eye.row + dr, 'W');
        }
      }
      // Pupils look down and inwards, which reads as "glaring at you"
      const pupilRow = eye.row + eye.height - 1;
      canvas.set(eye.column, pupilRow, pupil);
      if (eye.isCentre && eye.height >= 3) canvas.set(eye.column, pupilRow - 1, pupil);
      if (isAngry && eye.width >= 3) canvas.set(eye.column + 1, pupilRow, pupil);

      if (isAngry || size.look.isGrumpy) {
        // Brow: low on the inside, high on the outside (only where there's face to draw it on)
        const brow = (column, row) => {
          if (isBody(size, column, row)) canvas.set(column, row, OUTLINE);
        };
        for (let dc = 0; dc < eye.width; dc++) brow(eye.column + dc, eye.row - 1);
        brow(eye.column + eye.width, eye.row - 2);
        if (isAngry && !eye.isCentre) brow(eye.column, eye.row);
      }
    });
  }

  /** Top row of the mouth. */
  function mouthRow(size, eyes) {
    const eyeBottom = Math.max(...eyes.map(eye => eye.row + eye.height - 1));
    return Math.min(eyeBottom + 2, size.bodyBottom - 2);
  }

  function paintMouth(canvas, size, eyes, isOpen) {
    const { look, bodyHalfWidth } = size;
    const row = mouthRow(size, eyes);
    const halfWidth = Math.max(1, Math.round(bodyHalfWidth * 0.4));
    const paint = (column, paintRow, letter) => {
      if (isBody(size, column, paintRow)) canvas.set(column, paintRow, letter);
    };

    const depth = isOpen ? (bodyHalfWidth >= 7 ? 3 : 2) : 1;
    for (let dr = 0; dr < depth; dr++) {
      for (let column = 0; column < halfWidth - (dr > 0 ? 1 : 0); column++) paint(column, row + dr, 'm');
    }

    switch (look.mouth) {
      case 'fangs':
        paint(halfWidth - 1, row + (isOpen ? 0 : 1), 'T');
        break;
      case 'grin':
        paint(halfWidth, row - 1, 'm');
        if (isOpen) paint(halfWidth - 1, row, 'T');
        break;
      case 'tusks':
        paint(halfWidth, row, 'n');
        paint(halfWidth, row - 1, 'n');
        break;
      case 'teeth':
        for (let column = 0; column < halfWidth; column++) {
          if (column % 2 === (isOpen ? 1 : 0)) paint(column, row, 'T');
        }
        break;
    }
  }

  function paintHeadgear(canvas, size) {
    const { look, bodyHalfWidth, columnTop } = size;
    // Cyber monsters: metal stalks and fins with glowing lights
    const stalk = look.cyber ? 'O' : 'd';
    const light = look.cyber ? 'L' : 's';
    const fin = look.cyber ? 'G' : 'h';
    switch (look.headgear) {
      case 'horns': {
        const base = Math.max(1, Math.round(bodyHalfWidth * 0.55));
        const top = columnTop[base];
        canvas.set(base + 1, top - 1, 'n');
        for (let k = 0; k < 4; k++) canvas.set(base + Math.floor(k / 2), top - 1 - k, k === 3 ? 'N' : 'n');
        break;
      }
      case 'antennae': {
        const base = Math.max(1, Math.round(bodyHalfWidth * 0.35));
        const top = columnTop[base];
        for (let k = 0; k < 3; k++) canvas.set(base + Math.floor(k / 2), top - 1 - k, stalk);
        [[1, 3], [2, 3], [1, 4], [2, 4]].forEach(([dc, dr]) => canvas.set(base + dc, top - dr, light));
        break;
      }
      case 'spikes':
        for (let column = 0; column < bodyHalfWidth - 1; column += 2) {
          canvas.set(column, columnTop[column] - 1, 'n');
          if (column % 4 === 0) canvas.set(column, columnTop[column] - 2, 'N');
        }
        break;
      case 'crest':
        for (let k = 1; k <= 3; k++) canvas.set(0, columnTop[0] - k, k % 2 ? light : fin);
        canvas.set(1, columnTop[1] - 1, light);
        canvas.set(1, columnTop[1] - 2, fin);
        break;
    }
  }

  /** Walker legs; `isStriding` spreads them outwards and lifts them a pixel. */
  function paintLegs(canvas, size, isStriding) {
    const { bodyHalfWidth, columnBottom, bodyBottom, legHeight, look } = size;
    const footRow = bodyBottom + legHeight;
    const legColumns = look.legPairs === 2
      ? [Math.round(bodyHalfWidth * 0.2), Math.round(bodyHalfWidth * 0.65)]
      : [Math.max(1, Math.round(bodyHalfWidth * 0.45))];

    legColumns.forEach((baseColumn, legIndex) => {
      // With two pairs, the inner pair lifts while the outer pair spreads
      const spread = isStriding && (look.legPairs === 1 || legIndex === 1) ? 1 : 0;
      const lift = isStriding && (look.legPairs === 1 || legIndex === 0) ? 1 : 0;
      const column = baseColumn + spread;
      const bottom = footRow - lift;
      for (let row = columnBottom[Math.min(column, bodyHalfWidth - 1)] + 1; row <= bottom; row++) {
        const letter = row === bottom ? 'n' : (look.cyber ? (row % 2 ? 'G' : 'O') : 'd');
        canvas.set(column, row, letter);
        canvas.set(column + 1, row, letter);
      }
      canvas.set(column + 2, bottom, 'n'); // toe
    });
  }

  function paintHopperFeet(canvas, size) {
    const column = Math.max(1, Math.round(size.bodyHalfWidth * 0.4));
    const row = size.bodyBottom + 1;
    canvas.set(column, row, 'n');
    canvas.set(column + 1, row, 'n');
  }

  function paintClaws(canvas, size) {
    const column = Math.max(1, Math.round(size.bodyHalfWidth * 0.35));
    canvas.set(column, size.bodyBottom + 1, 'n');
    canvas.set(column, size.bodyBottom + 2, 'N');
  }

  /** Wings stick out from the body's sides; up = raised for a downstroke, down = mid-flap. */
  function paintWings(canvas, size, isUp) {
    const { wingSpan, bodyTop, bodyHeight, rowWidths, look } = size;
    const attachIndex = Math.round(bodyHeight * 0.3);
    const attachRow = bodyTop + attachIndex;
    const edge = rowWidths[attachIndex];

    for (let i = 0; i < wingSpan; i++) {
      const column = edge + i;
      const top = isUp ? attachRow - Math.round(i * 0.8) : attachRow + Math.round(i * 0.35);
      const bottom = isUp
        ? attachRow + Math.max(1, Math.round((wingSpan - i) * 0.6))
        : attachRow + 2 + Math.round(i * 0.8);
      for (let row = top; row <= bottom; row++) {
        // Bat wings get a scalloped trailing edge
        if (look.wingStyle === 'bat' && row === bottom && i % 2 === 1 && bottom > top) continue;
        const isEdge = i === wingSpan - 1 || row === top;
        canvas.set(column, row, isEdge ? 'v' : 'w');
      }
    }
  }

  // ==========================================
  // Cybernetics
  // ==========================================
  /**
   * Implants on top of the finished body: a face upgrade (visor, lenses or jaw grille), panel seams
   * with rivets, a chest plate with a glowing power core, an antenna mast and, on flyers, a jet
   * thruster. Glowing parts turn the angry colour in the attack frame.
   */
  function paintCyberware(canvas, size, eyes, frameName) {
    const { look, bodyTop, bodyHeight, rowWidths } = size;
    const cyber = look.cyber;
    const isAngry = frameName === 'attack';
    const lit = isAngry ? 'r' : 'L';
    const onBody = (column, row, letter) => {
      if (isBody(size, column, row)) canvas.set(column, row, letter);
    };

    // Panel seams down the sides, riveted every few rows
    for (let index = Math.round(bodyHeight * 0.3); index < Math.round(bodyHeight * 0.75); index++) {
      const column = rowWidths[index] - 2;
      if (column >= 2) onBody(column, bodyTop + index, index % 3 === 0 ? 'M' : 'O');
    }

    // Face
    const eyeTop = Math.min(...eyes.map(eye => eye.row));
    const eyeBottom = Math.max(...eyes.map(eye => eye.row + eye.height - 1));
    const eyeReach = Math.max(...eyes.map(eye => eye.column + eye.width));
    if (cyber.implant === 'visor') {
      // One glowing band across every eye, in a metal frame
      for (let column = 0; column <= eyeReach; column++) {
        onBody(column, eyeTop - 1, 'O');
        for (let row = eyeTop; row <= eyeBottom; row++) onBody(column, row, column === eyeReach ? 'O' : lit);
        onBody(column, eyeBottom + 1, 'O');
      }
      // A brighter scanning dot that hops along the band from frame to frame
      const scan = { idle: 0, move: Math.max(0, eyeReach - 2), attack: 1 }[frameName];
      onBody(scan, eyeTop, 'M');
    } else if (cyber.implant === 'lenses') {
      // Eyes become metal sockets with glowing lenses
      eyes.forEach(eye => {
        for (let dr = 0; dr < eye.height; dr++) {
          for (let dc = 0; dc < eye.width; dc++) {
            const column = eye.column + dc;
            const row = eye.row + dr;
            const letter = canvas.get(column, row);
            if (letter === 'W') onBody(column, row, 'G');
            else if (letter === 'E' || letter === 'r') onBody(column, row, lit);
          }
        }
        onBody(eye.column + eye.width, eye.row, 'O');
      });
    } else {
      // Jaw grille: the mouth becomes metal slats, glowing between them when it attacks
      const top = mouthRow(size, eyes);
      for (let row = top - 1; row <= top + 3; row++) {
        for (let column = 0; column < size.bodyHalfWidth; column++) {
          const letter = canvas.get(column, row);
          if (letter === 'm' || letter === 'T') onBody(column, row, column % 2 ? 'O' : (isAngry ? lit : 'G'));
        }
      }
    }

    // Chest plate with a power core, below the mouth
    if (cyber.hasCore) {
      const top = Math.max(mouthRow(size, eyes) + 3, bodyTop + Math.round(bodyHeight * 0.6));
      const bottom = size.bodyBottom - 1;
      if (bottom - top >= 1) {
        for (let row = top; row <= bottom; row++) {
          const plateHalf = Math.max(2, Math.round(rowWidths[row - bodyTop] * 0.55));
          for (let column = 0; column < plateHalf; column++) {
            onBody(column, row, row === top ? 'M' : (column === plateHalf - 1 ? 'O' : 'G'));
          }
        }
        const coreRow = Math.min(bottom, top + 1);
        onBody(0, coreRow, lit);
        if (bottom - top >= 2) onBody(0, coreRow + 1, frameName === 'move' ? 'M' : lit);
      }
    }

    // Antenna mast with a light on top
    if (cyber.hasMast) {
      const top = size.columnTop[0];
      for (let k = 1; k < MAST_HEIGHT; k++) canvas.set(0, top - k, 'O');
      canvas.set(0, top - MAST_HEIGHT, frameName === 'move' ? 'M' : lit);
    }

    // Flyers: a jet thruster under the body, firing while they fly
    if (size.wingSpan) {
      canvas.set(0, size.bodyBottom + 1, 'O');
      canvas.set(0, size.bodyBottom + 2, frameName === 'idle' ? 'M' : lit);
    }
  }

  // ==========================================
  // Frames
  // ==========================================
  function paintFrame(genome, size, spots, eyes, frameName) {
    const canvas = new HalfCanvas(size.halfWidth, size.height);
    const isAngry = frameName === 'attack';
    const isMoving = frameName === 'move';

    if (genome.movement === 'flyer') paintWings(canvas, size, !isMoving);
    if (genome.movement === 'walker') paintLegs(canvas, size, isMoving);
    if (genome.movement === 'hopper' && !isMoving) paintHopperFeet(canvas, size);
    if (genome.movement === 'flyer') paintClaws(canvas, size);

    paintBody(canvas, size, spots);
    paintEyes(canvas, size, eyes, isAngry);
    paintMouth(canvas, size, eyes, isAngry);
    paintHeadgear(canvas, size);
    if (genome.appearance.cyber) paintCyberware(canvas, size, eyes, frameName);
    canvas.addOutline();
    return canvas.toRows();
  }

  /**
   * @param {object} genome from Forest.MonsterGenome.generate
   * @returns {{palette: Object<string,string>, frames: {idle: string[], move: string[], attack: string[]},
   *   bodyWidthPixels: number}}
   */
  function paint(genome) {
    const size = measure(genome);
    const spots = rollSpots(size);
    const eyes = layoutEyes(size);
    return {
      palette: genome.appearance.palette,
      frames: {
        idle: paintFrame(genome, size, spots, eyes, 'idle'),
        move: paintFrame(genome, size, spots, eyes, 'move'),
        attack: paintFrame(genome, size, spots, eyes, 'attack')
      },
      /** Width of the body alone (without wings), for fair collision boxes. */
      bodyWidthPixels: size.bodyHalfWidth * 2 + 2
    };
  }

  Forest.MonsterPainter = Object.freeze({ paint });
})(window.Forest);
