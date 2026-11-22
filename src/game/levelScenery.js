/**
 * Builds the static scenery of one level: the ground segments with whatever lies beneath them,
 * dark pits between them, floating platforms and themed decorations (oaks and flowers in the
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

  const THEME_STYLE = {
    forest: { fill: '#290f02', edge: '#170800', pit: '#080402' },
    dungeon: { fill: Art.DUNGEON_FILL_COLOR, edge: '#0f0c14', pit: '#030205' },
    treetops: { fill: null, edge: null, pit: null },
    ...WorldArt.WORLD_STYLES
  };

  /** Lava pits: a bright crust on top of a molten glow. */
  const LAVA_COLORS = { crust: '#ffd25e', top: '#ff8a2a', body: '#e0400f' };

  /** Painted once and shared by every level that needs them. */
  let themeTiles = null;
  function getThemeTiles(sprites) {
    if (!themeTiles) {
      themeTiles = {
        forest: sprites.grassTile,
        dungeon: createSprite(Art.createDungeonFloorTile()),
        treetops: createSprite(Art.createBranchTile()),
        leafClump: createSprite(Art.createLeafClump()),
        brazier: createSprite(Art.createBrazier()),
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
      /** Gives every decoration its own depth, so overlapping props never flicker. */
      this.decorationCount = 0;

      const segments = [...level.ground].sort((a, b) => a[0] - b[0]);
      segments.forEach(([left, right], index) => this.addGroundSegment(left, right, index));
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

    /** A strip of tiles exactly `width` wide, its pattern locked to world x so neighbours line up. */
    tiledStrip(tileSprite, left, width) {
      const tileWidth = tileSprite.width * PIXEL_SCALE;
      const tileHeight = tileSprite.height * PIXEL_SCALE;
      const texture = createPixelTexture(tileSprite.canvas, { repeatX: width / tileWidth });
      texture.offset.x = (left / tileWidth) % 1;
      this.ownTextures.push(texture);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, tileHeight),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.05 })
      );
      return this.add(mesh, left + width / 2, GROUND_Y - tileHeight / 2, GROUND_Z);
    }

    addGroundSegment(left, right, index) {
      const width = right - left;
      const tile = this.tiles[this.theme];
      const tileHeight = tile.height * PIXEL_SCALE;
      this.tiledStrip(tile, left, width);

      if (this.style.fill) {
        // Solid earth/stone beneath, with darker cliff edges at both ends
        this.solidRect(this.style.fill, width, FILL_DEPTH, left + width / 2, GROUND_Y - tileHeight - FILL_DEPTH / 2 + PIXEL_SCALE, FILL_Z);
        const edgeHeight = FILL_DEPTH + tileHeight - 0.4;
        const edgeCenterY = GROUND_Y - 0.4 - edgeHeight / 2;
        this.solidRect(this.style.edge, EDGE_WIDTH, edgeHeight, left + EDGE_WIDTH / 2, edgeCenterY, EDGE_Z);
        this.solidRect(this.style.edge, EDGE_WIDTH, edgeHeight, right - EDGE_WIDTH / 2, edgeCenterY, EDGE_Z);
      }

      if (this.theme === 'forest') this.decorateForest(left, right, index);
      else if (this.theme === 'dungeon') this.decorateDungeon(left, right, index);
      else if (this.theme === 'treetops') this.decorateTreetops(left, right, index);
      else this.decorateWorld(left, right, index);
    }

    /** Dark shafts between the ground segments. */
    addPits(segments) {
      for (let i = 0; i < segments.length - 1; i++) {
        const left = segments[i][1];
        const right = segments[i + 1][0];
        if (right <= left) continue;
        const width = right - left + 0.02;
        const centerX = (left + right) / 2;
        if (this.style.pit === 'lava') {
          // Molten lava a little below the rim, glowing up the walls
          this.solidRect(LAVA_COLORS.body, width, FILL_DEPTH, centerX, GROUND_Y - 1.1 - FILL_DEPTH / 2, PIT_Z);
          this.solidRect(LAVA_COLORS.top, width, 0.25, centerX, GROUND_Y - 1.0, PIT_Z + 0.001);
          this.solidRect(LAVA_COLORS.crust, width, 0.1, centerX, GROUND_Y - 0.88, PIT_Z + 0.002);
          this.solidRect('#2a0a05', width, 0.8, centerX, GROUND_Y - 0.4, PIT_Z);
        } else {
          this.solidRect(this.style.pit, width, FILL_DEPTH, centerX, GROUND_Y - FILL_DEPTH / 2 - 0.3, PIT_Z);
        }
      }
    }

    /** Keep the moving platforms' meshes on their terrain surfaces. */
    update() {
      this.movingMeshes.forEach(({ mesh, surface, offsetY }) => {
        mesh.position.x = surface.left + surface.width / 2;
        mesh.position.y = surface.top + offsetY;
      });
    }

    addPlatform({ x, y, width, bouncy }, surface) {
      const widthPixels = Math.round(width / PIXEL_SCALE);
      const painters = { forest: Art.createForestLedge, dungeon: Art.createStoneSlab, treetops: Art.createCloudPlatform, ...WorldArt.platforms };
      const paint = bouncy ? WorldArt.createMarshmallowPad : painters[this.theme];
      const { canvas, surfaceRow } = paint(widthPixels);
      const sprite = createSprite(canvas);
      this.ownTextures.push(sprite.texture);
      const mesh = createSpriteMesh(sprite, PIXEL_SCALE);
      const heightUnits = canvas.height * PIXEL_SCALE;
      const offsetY = surfaceRow * PIXEL_SCALE - heightUnits / 2;
      this.add(mesh, x + width / 2, y + offsetY, PLATFORM_Z);
      if (surface && surface.move) this.movingMeshes.push({ mesh, surface, offsetY });
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
        this.addSprite(this.sprites.oakTree, 1.3 + hash(x) * 0.2, x, GROUND_Y - 0.2, TREE_Z);
      }
      // Wildflower tufts
      for (let x = left + 0.6; x < right - 0.6; x += 3.2 + hash(x * 3) * 2) {
        this.addSprite(this.sprites.flowerTuft, FLOWER_SCALE, x, GROUND_Y - 0.05, FRONT_DECOR_Z);
      }
    }

    decorateDungeon(left, right, index) {
      for (let x = left + 2.5; x < right - 2; x += 12 + hash(index * 17 + x) * 4) {
        this.addSprite(this.tiles.brazier, 1.4, x, GROUND_Y - 0.05, DECOR_Z);
      }
      for (let x = left + 1.5; x < right - 1; x += 7 + hash(x * 5) * 6) {
        if (hash(x * 11) < 0.5) this.addSprite(this.tiles.bones, 1, x, GROUND_Y - 0.05, FRONT_DECOR_Z);
      }
    }

    decorateTreetops(left, right, index) {
      const clump = this.tiles.leafClump;
      // Leaves hide the cut ends of the branch
      this.addSprite(clump, 0.75, left + 0.35, GROUND_Y - 1.4, FRONT_DECOR_Z);
      this.addSprite(clump, 0.75, right - 0.35, GROUND_Y - 1.4, FRONT_DECOR_Z);
      // Small sprigs growing up from the moss, behind the path
      for (let x = left + 1.5; x < right - 1.5; x += 4 + hash(index * 7 + x) * 4) {
        this.addSprite(clump, 0.5, x, GROUND_Y - 0.3, DECOR_Z);
      }
      // Long branches hang from a trunk dropping away into the clouds
      if (right - left > 8) this.addTrunk((left + right) / 2 + (hash(index) - 0.5) * 3);
    }

    /** The later worlds: their own props (cacti, crystals, lollipops...) dotted along the ground. */
    decorateWorld(left, right, index) {
      const props = this.tiles.worldDecor[this.theme];
      for (let x = left + 1.8; x < right - 1.2; x += 4.5 + hash(index * 13 + x) * 4) {
        const prop = props[Math.floor(hash(x * 7) * props.length)];
        this.addSprite(prop, 1.3 + hash(x) * 0.4, x, GROUND_Y - 0.05, hash(x * 3) < 0.6 ? DECOR_Z : FRONT_DECOR_Z);
      }
    }

    addTrunk(x) {
      const TRUNK_WIDTH = 1.4;
      const tileHeight = this.tiles.treetops.height * PIXEL_SCALE;
      this.solidRect('#5a3a25', TRUNK_WIDTH, FILL_DEPTH, x, GROUND_Y - tileHeight - FILL_DEPTH / 2 + 0.3, FILL_Z);
      this.solidRect('#3f2819', TRUNK_WIDTH * 0.3, FILL_DEPTH, x - TRUNK_WIDTH * 0.35, GROUND_Y - tileHeight - FILL_DEPTH / 2 + 0.3, EDGE_Z);
      this.solidRect('#7a5235', TRUNK_WIDTH * 0.15, FILL_DEPTH, x + TRUNK_WIDTH * 0.4, GROUND_Y - tileHeight - FILL_DEPTH / 2 + 0.3, EDGE_Z);
    }
  }

  Forest.LevelScenery = LevelScenery;
})(window.Forest);
