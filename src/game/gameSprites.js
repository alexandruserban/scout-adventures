/** Converts all painted art into GPU-ready sprites ({ texture, canvas, width, height }) once at startup. */
(function (Forest) {
  const { createSprite } = Forest.Graphics;
  const { asciiToCanvas, createWhiteSilhouette } = Forest.PixelCanvas;
  const Boy = Forest.BoySprites;
  const Mushroom = Forest.MushroomSprites;
  const Environment = Forest.EnvironmentSprites;
  const SkyArt = Forest.SkyCreatureSprites;

  /**
   * Every frame of one sky creature, each with a white "just got hit" twin.
   * @returns {Object<string, {normal: object, flash: object}>} frame name -> sprites
   */
  function loadCreatureFrames({ palette, frames }) {
    const result = {};
    Object.entries(frames).forEach(([frameName, rows]) => {
      const canvas = asciiToCanvas(rows, 1, palette);
      result[frameName] = { normal: createSprite(canvas), flash: createSprite(createWhiteSilhouette(canvas)) };
    });
    return result;
  }

  function loadGameSprites() {
    const mushroomSquashCanvas = asciiToCanvas(Mushroom.squash);

    return {
      boy: {
        idle: Boy.idle.map(createSprite),
        walk: Boy.walk.map(createSprite),
        crouch: createSprite(Boy.crouch),
        jumpRise: createSprite(Boy.jumpRise),
        jumpApex: createSprite(Boy.jumpApex),
        fall: createSprite(Boy.fall),
        jumpSpin: createSprite(Boy.jumpSpin),
        hitRecoil: createSprite(Boy.hitRecoil),
        hitRecoilFlash: createSprite(Boy.hitRecoilFlash),
        hitStagger: createSprite(Boy.hitStagger),
        defeated: createSprite(Boy.defeated),
        // Slam frames keep their timing and event data alongside the texture
        slam: Boy.slam.map(frame => ({ ...frame, ...createSprite(frame.canvas) })),
        airSlash: Boy.airSlash.map(frame => ({ ...frame, ...createSprite(frame.canvas) }))
      },
      mushroom: {
        walk: Mushroom.walk.map(rows => createSprite(asciiToCanvas(rows))),
        aggro: createSprite(asciiToCanvas(Mushroom.aggro)),
        squash: createSprite(mushroomSquashCanvas),
        squashFlash: createSprite(createWhiteSilhouette(mushroomSquashCanvas)),
        dazed: createSprite(asciiToCanvas(Mushroom.dazed))
      },
      /** kind (nutling, thornback, ...) -> frame name -> { normal, flash } */
      skyCreatures: Object.fromEntries(
        Object.entries(SkyArt.creatures).map(([kind, art]) => [kind, loadCreatureFrames(art)])
      ),
      fireball: createSprite(asciiToCanvas(SkyArt.fireball.rows, 1, SkyArt.fireball.palette)),
      oakTree: createSprite(Environment.createOakTree()),
      grassTile: createSprite(Environment.createGrassTile()),
      flowerTuft: createSprite(Environment.createFlowerTuft())
    };
  }

  Forest.loadGameSprites = loadGameSprites;
})(window.Forest);
