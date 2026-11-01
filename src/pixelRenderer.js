// Pixel Art Renderer and Texture Utility for Three.js
// Converts ASCII / Matrix pixel art into crisp Three.js NearestFilter textures

class PixelRenderer {
  constructor() {
    this.textureCache = new Map();
  }

  /**
   * Render an ASCII grid to an HTML Canvas
   * @param {string[]} rows Array of strings, each character maps to a color key
   * @param {Object} palette Object mapping character keys to hex color strings or null
   * @param {number} scale Optional pixel scaling factor (defaults to 1 for 1:1 pixel fidelity)
   * @returns {HTMLCanvasElement}
   */
  renderAsciiToCanvas(rows, palette, scale = 1) {
    const height = rows.length;
    const width = rows[0].length;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    for (let y = 0; y < height; y++) {
      const row = rows[y];
      for (let x = 0; x < width; x++) {
        const char = row[x];
        const color = palette[char];
        if (color && color !== 'transparent') {
          ctx.fillStyle = color;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
    return canvas;
  }

  /**
   * Create a THREE.CanvasTexture from an ASCII grid
   */
  createTexture(rows, palette, cacheKey = null, scale = 1) {
    if (cacheKey && this.textureCache.has(cacheKey)) {
      return this.textureCache.get(cacheKey);
    }

    const canvas = this.renderAsciiToCanvas(rows, palette, scale);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    if (cacheKey) {
      this.textureCache.set(cacheKey, texture);
    }
    return { texture, canvas, width: canvas.width / scale, height: canvas.height / scale };
  }

  /**
   * Creates a flash/silhouette hit frame from an existing ASCII grid
   */
  createHitFlashRows(rows, flashChar = 'F') {
    return rows.map(row => {
      let newRow = '';
      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '.' || char === ' ') {
          newRow += '.';
        } else {
          newRow += flashChar;
        }
      }
      return newRow;
    });
  }

  /**
   * Create a sprite mesh with exact pixel-ratio dimensions
   */
  createSpriteMesh(texInfo, pixelToWorld = 1 / 16) {
    const geometry = new THREE.PlaneGeometry(
      texInfo.width * pixelToWorld,
      texInfo.height * pixelToWorld
    );
    const material = new THREE.MeshBasicMaterial({
      map: texInfo.texture,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
  }
}

window.PixelRenderer = new PixelRenderer();
