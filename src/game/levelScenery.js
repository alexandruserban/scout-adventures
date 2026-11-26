/**
 * Builds the static scenery of one level: the ground segments (hills drawn at their height, with
 * cliff faces down to the lower ground beside them) with whatever lies beneath them, dark pits
 * between them, floating platforms (cracked ones crumble and fall) and themed decorations (oaks and flowers in the
 * forest, braziers and bones in the dungeon, leaf clumps and trunks in the treetops).
 *
 * Everything goes into one THREE.Group so a level can be torn down in one go (see dispose).
 */
(function (Forest) {
  const { PIXEL_SCALE, GROUND_Y } = Forest.Config;
  const { createSprite, createSpriteMesh, createPixelTexture } = Forest.Graphics;
  const Art = Forest.LevelSprites;
  const WorldArt = Forest.WorldSprites;

  // Depth (z) of each scenery layer; characters sit between 0.25 and 0.3
  const TREE_Z = -0.2;
  const DECOR_Z = -0.1;
  const PIT_Z = 0.02;
  const FILL_Z = 0.05;
  const GROUND_Z = 0.1;
  const EDGE_Z = 0.11;
  const PLATFORM_Z = 0.12;
  const FRONT_DECOR_Z = 0.15;

  /** How far below the grass the fills and pits reach, so tall screens never see their bottom. */
  const FILL_DEPTH = 30;
  const EDGE_WIDTH = 0.12;
  const FLOWER_SCALE = 1.1;
  /** Each decoration sits this much in front of the previous one (see decorationCount). */
  const DECORATION_DEPTH_STEP = 0.0003;
  /** About how long each brazier flame frame shows. */
  const BRAZIER_FRAME_SECONDS = 0.12;
  /** Props in the rising world float this high (units) before reappearing on the ground, at about this speed. */
  const FLOAT_HEIGHT = 9;
  const FLOAT_SPEED = 0.9;
  /** A crumbling ledge rattles this far side to side, then falls (units/s²) and fades out over this long. */
  const CRUMBLE_SHAKE = 0.06;
  const CRUMBLE_FALL_GRAVITY = 18;
  const CRUMBLE_FADE_SECONDS = 0.7;
  /** Coming back, it fades in over this long. */
  const CRUMBLE_RETURN_FADE_SECONDS = 0.4;
  const CRACK_COLOR = 'rgba(25, 12, 6, 0.8)';
  /** A sky island's slab of earth under its surface, then two narrower steps tapering away below. */
  const ISLAND_DEPTH = 0.8;
  const ISLAND_TAPERS = [[0.78, 0.35], [0.5, 0.3]];

  const THEME_STYLE = {
    forest: { fill: '#290f02', edge: '#170800', pit: '#080402' },
    dungeon: { fill: Art.DUNGEON_FILL_COLOR, edge: '#0f0c14', pit: '#030205' },
    treetops: { fill: null, edge: null, pit: null },
    ...WorldArt.WORLD_STYLES
  };

  /** Lava pits: a bright crust on top of a molten glow. */
  const LAVA_COLORS = { crust: '#ffd25e', top: '#ff8a2a', body: '#e0400f', rim: '#2a0a05' };
  /** Glowing alien goo in the mothership's pits. */
  const GOO_COLORS = { crust: '#e8ff9a', top: '#9aff4a', body: '#2f9a1a', rim: '#06200a' };
  const MOLTEN_PITS = { lava: LAVA_COLORS, goo: GOO_COLORS };

  /** Painted once and shared by every level that needs them. */
  let themeTiles = null;
  function getThemeTiles(sprites) {
    if (!themeTiles) {
      themeTiles = {
        forest: sprites.grassTile,
        dungeon: createSprite(Art.createDungeonFloorTile()),
        treetops: createSprite(Art.createBranchTile()),
        leafClump: createSprite(Art.createLeafClump()),
        brazier: Array.from({ length: Art.BRAZIER_FRAME_COUNT }, (_, frame) => createSprite(Art.createBrazier(frame))),
        bones: createSprite(Art.createBones())
      };
      Object.entries(WorldArt.tiles).forEach(([theme, paint]) => { themeTiles[theme] = createSprite(paint()); });
      themeTiles.worldDecor = Object.fromEntries(Object.entries(WorldArt.decorations)
        .map(([theme, painters]) => [theme, painters.map(paint => createSprite(paint()))]));
    }
    return themeTiles;
  }

  /** Deterministic pseudo-random number in [0, 1) for decoration placement. */
  function hash(n) {
    const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  }

  /** Scratch jagged cracks down from the walking surface of a painted ledge (a crumbling one). */
  function crackCanvas(canvas, surfaceRow) {
    const context = canvas.getContext('2d');
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const isPainted = (x, y) => x >= 0 && x < canvas.width && y >= 0 && y < canvas.height && data[(y * canvas.width + x) * 4 + 3] > 0;
    context.fillStyle = CRACK_COLOR;
    for (let startX = 3; startX < canvas.width - 2; startX += 5 + Math.floor(hash(startX) * 3)) {
      let x = startX;
      for (let y = surfaceRow; y < Math.min(canvas.height, surfaceRow + 6); y++) {
        if (isPainted(x, y)) context.fillRect(x, y, 1, 1);
        x += hash(startX * 31 + y) < 0.5 ? -1 : 1;
      }
    }
  }

  class LevelScenery {
    /**
     * @param {THREE.Scene} scene
     * @param {object} sprites result of Forest.loadGameSprites()
     * @param {object} level an entry of Forest.Levels
     * @param {Forest.Terrain} terrain the level's terrain (moving platforms follow it)
     */
    constructor(scene, sprites, level, terrain) {
      this.scene = scene;
      this.sprites = sprites;
      this.tiles = getThemeTiles(sprites);
      this.theme = level.theme;
      this.style = THEME_STYLE[level.theme];
      this.group = new THREE.Group();
      /** Textures made for this level only (shared sprite textures are not disposed). */
      this.ownTextures = [];
      /** Meshes of moving platforms, with the terrain surface each one follows. */
      this.movingMeshes = [];
      /** Meshes of crumbling ledges, with their terrain surface and resting spot. */
      this.crumblingMeshes = [];
      /** Height of the ground segment being decorated. */
      this.groundTop = GROUND_Y;
      /** Brazier meshes whose flames flicker, each on its own clock. */
      this.braziers = [];
      /** Props that float up off the ground (the rising world). */
      this.floaters = [];
      /** Gives every decoration its own depth, so overlapping props never flicker. */
      this.decorationCount = 0;
      /** Sticky spider webs on the ground (the rainbow): { left, right, top, bottom } in world units. */
      this.stickyWebs = [];
      /** Worlds without a pad of their own get marshmallows if they're bouncy, trampolines otherwise. */
      this.defaultBouncePad = level.layout && level.layout.bouncy ? WorldArt.createMarshmallowPad : WorldArt.createTrampoline;

      const segments = [...level.ground].sort((a, b) => a[0] - b[0]);
      segments.forEach((segment, index) => this.addGroundSegment(segment, index, segments));
      if (this.style.pit) this.addPits(segments);
      level.platforms.forEach((platform, index) => this.addPlatform(platform, terrain.platforms[index]));
      scene.add(this.group);
    }

    /** Remove everything from the scene and free what was made for this level. */
    dispose() {
      this.scene.remove(this.group);
      this.group.traverse(object => {
        if (!object.isMesh) return;
        object.geometry.dispose();
        object.material.dispose();
      });
      this.ownTextures.forEach(texture => texture.dispose());
    }

    add(mesh, x, y, z) {
      mesh.position.set(x, y, z);
      this.group.add(mesh);
      return mesh;
    }

    solidRect(color, width, height, centerX, centerY, z) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color }));
      return this.add(mesh, centerX, centerY, z);
    }

    /** A strip of tiles exactly `width` wide with its top at `top`, its pattern locked to world x so neighbours line up. */
    tiledStrip(tileSprite, left, width, top = GROUND_Y) {
      const tileWidth = tileSprite.width * PIXEL_SCALE;
      const tileHeight = tileSprite.height * PIXEL_SCALE;
      const texture = createPixelTexture(tileSprite.canvas, { repeatX: width / tileWidth });
      texture.offset.x = (left / tileWidth) % 1;
      this.ownTextures.push(texture);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, tileHeight),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.05 })
      );
      return this.add(mesh, left + width / 2, top - tileHeight / 2, GROUND_Z);
    }

    /**
     * @param {[number, number, number?]} segment [left, right, height] (see Forest.Levels)
     * @param {number} index
     * @param {Array} segments all of them, sorted, to find the ones touching this one
     */
    addGroundSegment([left, right, height = 0], index, segments) {
      const width = right - left;
      const top = GROUND_Y + height;
      const tile = this.tiles[this.theme];
      const tileHeight = tile.height * PIXEL_SCALE;
      this.tiledStrip(tile, left, width, top);

      if (this.style.fill) {
        // Solid earth/stone beneath, with darker cliff edges at both ends
        this.solidRect(this.style.fill, width, FILL_DEPTH, left + width / 2, top - tileHeight - FILL_DEPTH / 2 + PIXEL_SCALE, FILL_Z);
        const neighbourHeight = edgeX => {
          const neighbour = segments.find((other, otherIndex) => otherIndex !== index
            && (Math.abs(other[1] - edgeX) < 0.01 || Math.abs(other[0] - edgeX) < 0.01));
          return neighbour ? neighbour[2] || 0 : null;
        };
        [[left, left + EDGE_WIDTH / 2], [right, right - EDGE_WIDTH / 2]].forEach(([edgeX, centerX]) => {
          const besideHeight = neighbourHeight(edgeX);
          // Next to a pit the edge runs all the way down; beside lower ground it is a cliff face
          // down to that ground's grass, and beside higher ground there is none
          const bottom = besideHeight === null ? top - tileHeight - FILL_DEPTH : GROUND_Y + besideHeight;
          const edgeHeight = top - 0.4 - bottom;
          if (edgeHeight <= 0) return;
          this.solidRect(this.style.edge, EDGE_WIDTH, edgeHeight, centerX, top - 0.4 - edgeHeight / 2, EDGE_Z);
        });
      }

      this.groundTop = top;

      if (this.theme === 'forest') this.decorateForest(left, right, index);
      else if (this.theme === 'dungeon') this.decorateDungeon(left, right, index);
      else if (this.theme === 'treetops') this.decorateTreetops(left, right, index);
      else this.decorateWorld(left, right, index);
    }

    /** Dark shafts between the ground segments (starting below the lower rim). */
    addPits(segments) {
      for (let i = 0; i < segments.length - 1; i++) {
        const left = segments[i][1];
        const right = segments[i + 1][0];
        if (right <= left + 0.01) continue;
        const rim = GROUND_Y + Math.min(segments[i][2] || 0, segments[i + 1][2] || 0);
        const width = right - left + 0.02;
        const centerX = (left + right) / 2;
        const molten = MOLTEN_PITS[this.style.pit];
        if (molten) {
          // Molten lava a little below the rim, glowing up the walls
          this.solidRect(molten.body, width, FILL_DEPTH, centerX, rim - 1.1 - FILL_DEPTH / 2, PIT_Z);
          this.solidRect(molten.top, width, 0.25, centerX, rim - 1.0, PIT_Z + 0.001);
          this.solidRect(molten.crust, width, 0.1, centerX, rim - 0.88, PIT_Z + 0.002);
          this.solidRect(molten.rim, width, 0.8, centerX, rim - 0.4, PIT_Z);
        } else {
          this.solidRect(this.style.pit, width, FILL_DEPTH, centerX, rim - FILL_DEPTH / 2 - 0.3, PIT_Z);
        }
      }
    }

    /** Keep the moving platforms' meshes on their terrain surfaces, crumble ledges and flicker the brazier flames. */
    update(deltaSeconds = 0) {
      this.movingMeshes.forEach(({ mesh, surface, offsetY }) => {
        mesh.position.x = surface.left + surface.width / 2;
        mesh.position.y = surface.top + offsetY;
      });
      this.crumblingMeshes.forEach(({ mesh, surface, restX, restY }) => {
        const seconds = surface.stateSeconds;
        let x = restX;
        let y = restY;
        let opacity = 1;
        if (surface.crumbleState === 'shaking') {
          x += Math.sin(seconds * 70) * CRUMBLE_SHAKE;
          y -= seconds * 0.1;
        } else if (surface.crumbleState === 'fallen') {
          y -= 0.05 + 0.5 * CRUMBLE_FALL_GRAVITY * seconds * seconds;
          opacity = Math.max(0, 1 - seconds / CRUMBLE_FADE_SECONDS);
        } else {
          opacity = Math.min(1, seconds / CRUMBLE_RETURN_FADE_SECONDS);
        }
        mesh.position.x = x;
        mesh.position.y = y;
        mesh.material.opacity = opacity;
        mesh.visible = opacity > 0;
      });
      const frames = this.tiles.brazier;
      this.braziers.forEach(brazier => {
        brazier.timer -= deltaSeconds;
        if (brazier.timer > 0) return;
        // Random hold time and never the same frame twice, so the fire looks alive, not looped
        brazier.timer = BRAZIER_FRAME_SECONDS * (0.7 + Math.random() * 0.6);
        brazier.frame = (brazier.frame + 1 + Math.floor(Math.random() * (frames.length - 1))) % frames.length;
        brazier.mesh.material.map = frames[brazier.frame].texture;
      });
      this.floaters.forEach(floater => {
        floater.climbed = (floater.climbed + floater.speed * deltaSeconds) % FLOAT_HEIGHT;
        const t = floater.climbed / FLOAT_HEIGHT;
        floater.mesh.position.y = floater.baseY + floater.climbed;
        floater.mesh.rotation.z = Math.sin(floater.climbed * 1.3) * 0.25;
        // Fade in as it lifts off and out as it reaches the clouds
        floater.mesh.material.opacity = Math.min(1, t * 8, (1 - t) * 4);
      });
    }

    addPlatform({ x, y, width, bouncy, crumble, island }, surface) {
      if (island) {
        this.addSkyIsland(x, y, width);
        return;
      }
      const widthPixels = Math.round(width / PIXEL_SCALE);
      const painters = { forest: Art.createForestLedge, dungeon: Art.createStoneSlab, treetops: Art.createCloudPlatform, ...WorldArt.platforms };
      const bouncePad = (WorldArt.bouncePads && WorldArt.bouncePads[this.theme]) || this.defaultBouncePad;
      const paint = bouncy ? bouncePad : painters[this.theme];
      const { canvas, surfaceRow } = paint(widthPixels);
      if (crumble) crackCanvas(canvas, surfaceRow);
      const sprite = createSprite(canvas);
      this.ownTextures.push(sprite.texture);
      const mesh = createSpriteMesh(sprite, PIXEL_SCALE);
      const heightUnits = canvas.height * PIXEL_SCALE;
      const offsetY = surfaceRow * PIXEL_SCALE - heightUnits / 2;
      this.add(mesh, x + width / 2, y + offsetY, PLATFORM_Z);
      if (surface && surface.move) this.movingMeshes.push({ mesh, surface, offsetY });
      else if (surface && surface.isCrumbly) this.crumblingMeshes.push({ mesh, surface, restX: mesh.position.x, restY: mesh.position.y });
    }

    /**
     * A huge island in the sky that looks like a piece of the ground: the world's own surface on a
     * slab of earth tapering away underneath (just the surface where the ground floats anyway),
     * with the world's trees and props on top.
     */
    addSkyIsland(left, top, width) {
      const tile = this.tiles[this.theme];
      const tileHeight = tile.height * PIXEL_SCALE;
      const centerX = left + width / 2;
      this.tiledStrip(tile, left, width, top);
      if (this.style.fill) {
        let bottom = top - tileHeight + PIXEL_SCALE;
        this.solidRect(this.style.fill, width, ISLAND_DEPTH, centerX, bottom - ISLAND_DEPTH / 2, FILL_Z);
        this.solidRect(this.style.edge, EDGE_WIDTH, ISLAND_DEPTH + tileHeight - 0.4, left + EDGE_WIDTH / 2, top - 0.4 - (ISLAND_DEPTH + tileHeight - 0.4) / 2, EDGE_Z);
        this.solidRect(this.style.edge, EDGE_WIDTH, ISLAND_DEPTH + tileHeight - 0.4, left + width - EDGE_WIDTH / 2, top - 0.4 - (ISLAND_DEPTH + tileHeight - 0.4) / 2, EDGE_Z);
        bottom -= ISLAND_DEPTH;
        let stepWidth = width;
        ISLAND_TAPERS.forEach(([share, depth]) => {
          // A dark rim under each step, then the narrower step below it
          this.solidRect(this.style.edge, stepWidth, EDGE_WIDTH, centerX, bottom + EDGE_WIDTH / 2, EDGE_Z);
          stepWidth = width * share;
          this.solidRect(this.style.fill, stepWidth, depth, centerX, bottom - depth / 2, FILL_Z);
          bottom -= depth;
        });
        this.solidRect(this.style.edge, stepWidth, EDGE_WIDTH, centerX, bottom + EDGE_WIDTH / 2, EDGE_Z);
      }
      this.groundTop = top;
      const index = Math.round(left * 10);
      if (this.theme === 'forest') this.decorateForest(left, left + width, index);
      else if (this.theme === 'dungeon') this.decorateDungeon(left, left + width, index);
      else if (this.theme === 'treetops') this.decorateTreetops(left, left + width, index);
      else this.decorateWorld(left, left + width, index);
    }

    // ==========================================
    // Decorations
    // ==========================================
    addSprite(sprite, scale, x, bottomY, z) {
      const mesh = createSpriteMesh(sprite, PIXEL_SCALE * scale);
      const height = sprite.height * PIXEL_SCALE * scale;
      this.decorationCount++;
      return this.add(mesh, x, bottomY + height / 2, z + this.decorationCount * DECORATION_DEPTH_STEP);
    }

    decorateForest(left, right, index) {
      // Oaks behind the path on the longer stretches
      for (let x = left + 3; x < right - 2; x += 10 + hash(index * 31 + x) * 4) {
        this.addSprite(this.sprites.oakTree, 1.3 + hash(x) * 0.2, x, this.groundTop - 0.2, TREE_Z);
      }
      // Wildflower tufts
      for (let x = left + 0.6; x < right - 0.6; x += 3.2 + hash(x * 3) * 2) {
        this.addSprite(this.sprites.flowerTuft, FLOWER_SCALE, x, this.groundTop - 0.05, FRONT_DECOR_Z);
      }
    }

    decorateDungeon(left, right, index) {
      for (let x = left + 2.5; x < right - 2; x += 12 + hash(index * 17 + x) * 4) {
        const frame = Math.floor(hash(x * 13) * this.tiles.brazier.length);
        const mesh = this.addSprite(this.tiles.brazier[frame], 1.4, x, this.groundTop - 0.05, DECOR_Z);
        this.braziers.push({ mesh, frame, timer: hash(x * 19) * BRAZIER_FRAME_SECONDS });
      }
      for (let x = left + 1.5; x < right - 1; x += 7 + hash(x * 5) * 6) {
        if (hash(x * 11) < 0.5) this.addSprite(this.tiles.bones, 1, x, this.groundTop - 0.05, FRONT_DECOR_Z);
      }
    }

    decorateTreetops(left, right, index) {
      const clump = this.tiles.leafClump;
      // Leaves hide the cut ends of the branch
      this.addSprite(clump, 0.75, left + 0.35, this.groundTop - 1.4, FRONT_DECOR_Z);
      this.addSprite(clump, 0.75, right - 0.35, this.groundTop - 1.4, FRONT_DECOR_Z);
      // Small sprigs growing up from the moss, behind the path
      for (let x = left + 1.5; x < right - 1.5; x += 4 + hash(index * 7 + x) * 4) {
        this.addSprite(clump, 0.5, x, this.groundTop - 0.3, DECOR_Z);
      }
      // Long branches hang from a trunk dropping away into the clouds
      if (right - left > 8) this.addTrunk((left + right) / 2 + (hash(index) - 0.5) * 3);
    }

    /** The later worlds: their own props (cacti, crystals, lollipops...) dotted along the ground. */
    decorateWorld(left, right, index) {
      const props = this.tiles.worldDecor[this.theme];
      for (let x = left + 1.8; x < right - 1.2; x += 4.5 + hash(index * 13 + x) * 4) {
        const prop = props[Math.floor(hash(x * 7) * props.length)];
        const scale = 1.3 + hash(x) * 0.4;
        const mesh = this.addSprite(prop, scale, x, this.groundTop - 0.05, hash(x * 3) < 0.6 ? DECOR_Z : FRONT_DECOR_Z);
        if (prop.canvas.isStickyWeb) {
          // The silk between the twigs (a little narrower than the whole picture)
          const halfWidth = prop.width * PIXEL_SCALE * scale * 0.4;
          this.stickyWebs.push({
            left: x - halfWidth, right: x + halfWidth,
            top: this.groundTop - 0.05 + prop.height * PIXEL_SCALE * scale, bottom: this.groundTop - 0.3
          });
        }
        // In the world that falls up, the props drift off the ground into the sky, over and over
        if (this.theme === 'rising') this.floaters.push({ mesh, baseY: mesh.position.y, climbed: hash(x * 23) * FLOAT_HEIGHT, speed: FLOAT_SPEED * (0.7 + hash(x * 29) * 0.6) });
      }
    }

    addTrunk(x) {
      const TRUNK_WIDTH = 1.4;
      const tileHeight = this.tiles.treetops.height * PIXEL_SCALE;
      this.solidRect('#5a3a25', TRUNK_WIDTH, FILL_DEPTH, x, this.groundTop - tileHeight - FILL_DEPTH / 2 + 0.3, FILL_Z);
      this.solidRect('#3f2819', TRUNK_WIDTH * 0.3, FILL_DEPTH, x - TRUNK_WIDTH * 0.35, this.groundTop - tileHeight - FILL_DEPTH / 2 + 0.3, EDGE_Z);
      this.solidRect('#7a5235', TRUNK_WIDTH * 0.15, FILL_DEPTH, x + TRUNK_WIDTH * 0.4, this.groundTop - tileHeight - FILL_DEPTH / 2 + 0.3, EDGE_Z);
    }
  }

  /** True when a world's ground is solid all the way down (it can have hills), not floating branches or clouds. */
  LevelScenery.hasSolidGround = themeId => Boolean(THEME_STYLE[themeId] && THEME_STYLE[themeId].fill);

  Forest.LevelScenery = LevelScenery;
})(window.Forest);
