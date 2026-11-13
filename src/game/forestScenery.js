/** Static level scenery: foreground oaks, the grass ground strip with wildflowers, and deep soil. */
(function (Forest) {
  const { PIXEL_SCALE, GROUND_Y, LEVEL_START_X, LEVEL_END_X } = Forest.Config;
  const { createSpriteMesh, createPixelTexture } = Forest.Graphics;
  const { createPixelCanvas } = Forest.PixelCanvas;

  // Depth (z) of each scenery layer; characters sit between 0.25 and 0.3
  const TREE_Z = -0.2;
  const SOIL_Z = 0.05;
  const GROUND_Z = 0.1;
  const FLOWER_Z = 0.15;

  /** How far the ground extends past each end of the level, so the camera never sees its edge. */
  const GROUND_OVERHANG = 10;
  const FLOWER_SCALE = 1.1;
  const SOIL_COLOR = '#290f02';
  const SOIL_DEPTH = 30;

  /**
   * @param {THREE.Scene} scene
   * @param {object} sprites result of Forest.loadGameSprites()
   * @param {Array<{x:number, scale:number}>} treePlacements
   */
  function buildForestScenery(scene, sprites, treePlacements) {
    addForegroundTrees(scene, sprites.oakTree, treePlacements);
    addGroundStrip(scene, sprites.grassTile, sprites.flowerTuft);
    addDeepSoil(scene, sprites.grassTile.height * PIXEL_SCALE);
  }

  function addForegroundTrees(scene, treeSprite, treePlacements) {
    treePlacements.forEach(({ x, scale }) => {
      const mesh = createSpriteMesh(treeSprite, PIXEL_SCALE * scale);
      const treeHeight = treeSprite.height * PIXEL_SCALE * scale;
      // Sink the roots slightly into the ground
      mesh.position.set(x, GROUND_Y + treeHeight / 2 - 0.2, TREE_Z);
      scene.add(mesh);
    });
  }

  function addGroundStrip(scene, tileSprite, flowerSprite) {
    const tileWidth = tileSprite.width * PIXEL_SCALE;
    const tileHeight = tileSprite.height * PIXEL_SCALE;
    const stripWidth = LEVEL_END_X - LEVEL_START_X + 2 * GROUND_OVERHANG;
    const tileCount = Math.ceil(stripWidth / tileWidth);
    const flowerHeight = flowerSprite.height * PIXEL_SCALE * FLOWER_SCALE;

    for (let i = 0; i < tileCount; i++) {
      const tileLeft = LEVEL_START_X - GROUND_OVERHANG + i * tileWidth;
      const tile = createSpriteMesh(tileSprite, PIXEL_SCALE);
      tile.position.set(tileLeft + tileWidth / 2, GROUND_Y - tileHeight / 2, GROUND_Z);
      scene.add(tile);

      // A wildflower tuft on every other tile, at a fixed pseudo-random spot
      if (i % 2 === 0) {
        const flower = createSpriteMesh(flowerSprite, PIXEL_SCALE * FLOWER_SCALE);
        const flowerX = tileLeft + Math.abs(Math.sin(i * 9)) * (tileWidth - 0.6) + 0.3;
        flower.position.set(flowerX, GROUND_Y + flowerHeight / 2 - 0.05, FLOWER_Z);
        scene.add(flower);
      }
    }
  }

  /** Solid soil below the ground tiles, so tall screens never show sky under the floor. */
  function addDeepSoil(scene, tileHeight) {
    const { canvas, ctx } = createPixelCanvas(1, 1);
    ctx.fillStyle = SOIL_COLOR;
    ctx.fillRect(0, 0, 1, 1);

    const soil = new THREE.Mesh(
      new THREE.PlaneGeometry(LEVEL_END_X - LEVEL_START_X + 40, SOIL_DEPTH),
      new THREE.MeshBasicMaterial({ map: createPixelTexture(canvas) })
    );
    soil.position.set(
      (LEVEL_START_X + LEVEL_END_X) / 2,
      GROUND_Y - tileHeight - SOIL_DEPTH / 2 + PIXEL_SCALE,
      SOIL_Z
    );
    scene.add(soil);
  }

  Forest.buildForestScenery = buildForestScenery;
})(window.Forest);
