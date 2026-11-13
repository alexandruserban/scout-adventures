/**
 * Three.js helpers for pixel art: crisp (unfiltered) textures and flat sprite meshes.
 *
 * A "sprite" in this codebase is a plain object: { texture, canvas, width, height },
 * where width/height are measured in sprite pixels.
 */
(function (Forest) {
  /**
   * Wrap a canvas in a texture that keeps hard pixel edges when scaled.
   * @param {HTMLCanvasElement} canvas
   * @param {object} [options]
   * @param {number} [options.repeatX] tile the texture horizontally this many times
   * @param {boolean} [options.exactColors] mark the texture as sRGB so painted colours show unchanged
   */
  function createPixelTexture(canvas, { repeatX, exactColors = false } = {}) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    if (exactColors) {
      texture.encoding = THREE.sRGBEncoding;
    }
    if (repeatX !== undefined) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.repeat.x = repeatX;
    }
    return texture;
  }

  /** Turn a pre-drawn canvas into a sprite object. */
  function createSprite(canvas) {
    return {
      texture: createPixelTexture(canvas),
      canvas,
      width: canvas.width,
      height: canvas.height
    };
  }

  /**
   * Create a flat, transparent mesh sized so one sprite pixel covers `worldUnitsPerPixel` world units.
   * The mesh is centred on its origin.
   */
  function createSpriteMesh(sprite, worldUnitsPerPixel) {
    const geometry = new THREE.PlaneGeometry(
      sprite.width * worldUnitsPerPixel,
      sprite.height * worldUnitsPerPixel
    );
    const material = new THREE.MeshBasicMaterial({
      map: sprite.texture,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide
    });
    return new THREE.Mesh(geometry, material);
  }

  /** Swap the image shown on a sprite mesh. */
  function setMeshSprite(mesh, sprite) {
    mesh.material.map = sprite.texture;
    mesh.material.needsUpdate = true;
  }

  /** Remove a mesh from the scene and free its GPU material. */
  function removeMesh(scene, mesh, { disposeGeometry = false } = {}) {
    scene.remove(mesh);
    mesh.material.dispose();
    if (disposeGeometry) {
      mesh.geometry.dispose();
    }
  }

  Forest.Graphics = {
    createPixelTexture,
    createSprite,
    createSpriteMesh,
    setMeshSprite,
    removeMesh
  };
})(window.Forest);
