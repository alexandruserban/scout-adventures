/**
 * "Game feel" effects for heavy impacts:
 *  - HitStop: freezes gameplay for a few frames
 *  - EffectsSystem: expanding flashes / shockwave rings / smoke puffs, and physical debris
 *    from sprites that shatter into their own pixels
 */
(function (Forest) {
  const { GROUND_Y } = Forest.Config;
  const { removeMesh, createPixelTexture } = Forest.Graphics;
  const { createPixelCanvas, paletteColor } = Forest.PixelCanvas;
  const { easeOutCubic, randomBetween } = Forest.MathUtils;

  // ==========================================
  // Hit-stop
  // ==========================================
  class HitStop {
    constructor() {
      this.remainingSeconds = 0;
    }

    /** Freeze for at least `seconds` (overlapping requests don't stack). */
    trigger(seconds) {
      this.remainingSeconds = Math.max(this.remainingSeconds, seconds);
    }

    /**
     * Convert real elapsed time into game time: 0 while frozen.
     * @param {number} realDeltaSeconds
     */
    consume(realDeltaSeconds) {
      if (this.remainingSeconds > 0) {
        this.remainingSeconds -= realDeltaSeconds;
        return 0;
      }
      return realDeltaSeconds;
    }

    reset() {
      this.remainingSeconds = 0;
    }
  }

  // ==========================================
  // Flashes, rings, smoke and debris
  // ==========================================
  const ROUND_TEXTURE_SIZE = 24;
  const DEBRIS_GRAVITY = 20;
  const DEBRIS_Z = 0.55;
  /** Debris is built from square chunks of this many sprite pixels per side. */
  const DEBRIS_CHUNK = 2;
  const DEBRIS_FADE_SECONDS = 0.4;

  /** Small pixel-art disc (or ring) texture used for flashes and shockwaves. */
  function createRoundTexture(isRing) {
    const size = ROUND_TEXTURE_SIZE;
    const { canvas, ctx } = createPixelCanvas(size, size);
    ctx.fillStyle = '#ffffff';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const distance = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2);
        const isInside = isRing ? distance > 9.5 && distance < 11.5 : distance < 11.5;
        if (isInside) ctx.fillRect(x, y, 1, 1);
      }
    }
    return createPixelTexture(canvas);
  }

  /** First opaque palette colour inside a square block of ASCII art, or null if it's all transparent. */
  function firstColorInBlock(rows, left, top, blockSize) {
    for (let y = top; y < top + blockSize; y++) {
      for (let x = left; x < left + blockSize; x++) {
        const color = paletteColor((rows[y] || '')[x]);
        if (color) return color;
      }
    }
    return null;
  }

  /** CSS colour of the first opaque pixel inside a square block of RGBA canvas data, or null. */
  function firstOpaquePixelInBlock(pixels, width, height, left, top, blockSize) {
    for (let y = top; y < Math.min(top + blockSize, height); y++) {
      for (let x = left; x < Math.min(left + blockSize, width); x++) {
        const i = (y * width + x) * 4;
        if (pixels[i + 3] > 128) return `rgb(${pixels[i]}, ${pixels[i + 1]}, ${pixels[i + 2]})`;
      }
    }
    return null;
  }

  class EffectsSystem {
    constructor(scene) {
      this.scene = scene;
      this.discTexture = createRoundTexture(false);
      this.ringTexture = createRoundTexture(true);
      this.debrisGeometry = new THREE.PlaneGeometry(1, 1);
      this.fadingSprites = [];
      this.debris = [];
      this.beams = [];
    }

    /** Solid disc that grows and fades: flashes and smoke puffs. */
    spawnDisc(options) {
      this.spawnFadingSprite(this.discTexture, options);
    }

    /** Hollow ring that grows and fades: shockwaves. */
    spawnRing(options) {
      this.spawnFadingSprite(this.ringTexture, options);
    }

    /**
     * @param {THREE.Texture} texture
     * @param {object} options
     * @param {string} options.color
     * @param {number} options.x
     * @param {number} options.y
     * @param {number} options.fromScale size in world units at spawn
     * @param {number} options.toScale size in world units when it vanishes
     * @param {number} options.lifetime seconds
     * @param {number} [options.z]
     * @param {number} [options.riseSpeed] upward drift in units per second
     * @param {number} [options.opacity] starting opacity
     */
    spawnFadingSprite(texture, { color, x, y, fromScale, toScale, lifetime, z = 0.6, riseSpeed = 0, opacity = 1 }) {
      const material = new THREE.MeshBasicMaterial({ map: texture, color, transparent: true, alphaTest: 0.05, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(fromScale);
      this.scene.add(mesh);
      this.fadingSprites.push({ mesh, remainingLife: lifetime, lifetime, fromScale, toScale, riseSpeed, startOpacity: opacity });
    }

    /**
     * Break ASCII sprite art into chunks of its own pixels and blow them outward from its centre.
     * @param {string[]} rows the sprite's ASCII art
     * @param {number} centerX world position of the sprite's centre
     * @param {number} centerY
     * @param {number} worldUnitsPerPixel how big one sprite pixel is on screen
     */
    shatterSprite(rows, centerX, centerY, worldUnitsPerPixel) {
      const width = rows[0].length;
      const height = rows.length;

      for (let top = 0; top < height; top += DEBRIS_CHUNK) {
        for (let left = 0; left < width; left += DEBRIS_CHUNK) {
          const color = firstColorInBlock(rows, left, top, DEBRIS_CHUNK);
          if (!color) continue;

          const x = centerX + (left + DEBRIS_CHUNK / 2 - width / 2) * worldUnitsPerPixel;
          const y = centerY + (height / 2 - top - DEBRIS_CHUNK / 2) * worldUnitsPerPixel;
          this.spawnDebrisChunk(color, x, y, x - centerX, y - centerY, worldUnitsPerPixel);
        }
      }
    }

    /**
     * Like shatterSprite, but for art that's only available as a painted canvas
     * (e.g. sprites drawn with their own palette).
     */
    shatterCanvas(canvas, centerX, centerY, worldUnitsPerPixel) {
      const { width, height } = canvas;
      const pixels = canvas.getContext('2d').getImageData(0, 0, width, height).data;

      for (let top = 0; top < height; top += DEBRIS_CHUNK) {
        for (let left = 0; left < width; left += DEBRIS_CHUNK) {
          const color = firstOpaquePixelInBlock(pixels, width, height, left, top, DEBRIS_CHUNK);
          if (!color) continue;

          const x = centerX + (left + DEBRIS_CHUNK / 2 - width / 2) * worldUnitsPerPixel;
          const y = centerY + (height / 2 - top - DEBRIS_CHUNK / 2) * worldUnitsPerPixel;
          this.spawnDebrisChunk(color, x, y, x - centerX, y - centerY, worldUnitsPerPixel);
        }
      }
    }

    spawnDebrisChunk(color, x, y, offsetX, offsetY, worldUnitsPerPixel) {
      const distanceFromCenter = Math.hypot(offsetX, offsetY) || 1;
      const power = randomBetween(3.5, 8.0);
      const size = worldUnitsPerPixel * DEBRIS_CHUNK * randomBetween(0.8, 1.3);

      const mesh = new THREE.Mesh(this.debrisGeometry, new THREE.MeshBasicMaterial({ color, transparent: true }));
      mesh.scale.set(size, size, 1);
      mesh.position.set(x, y, DEBRIS_Z);
      this.scene.add(mesh);

      this.debris.push({
        mesh,
        size,
        velocityX: (offsetX / distanceFromCenter) * power + (Math.random() - 0.5) * 1.5,
        velocityY: (offsetY / distanceFromCenter) * power * 0.6 + randomBetween(3.5, 7.0),
        spinSpeed: (Math.random() - 0.5) * 20,
        remainingLife: randomBetween(1.1, 2.0)
      });
    }

    update(deltaSeconds) {
      this.updateFadingSprites(deltaSeconds);
      this.updateDebris(deltaSeconds);
      this.updateBeams(deltaSeconds);
    }

    /**
     * A straight beam of light from one point to another that thins out and fades (lasers).
     * @param {{color:string, fromX:number, fromY:number, toX:number, toY:number, thickness:number,
     *   lifetime:number, opacity?:number, z?:number}} options
     */
    spawnBeam({ color, fromX, fromY, toX, toY, thickness, lifetime, opacity = 1, z = 0.62 }) {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
      mesh.position.set((fromX + toX) / 2, (fromY + toY) / 2, z);
      mesh.scale.set(Math.hypot(toX - fromX, toY - fromY), thickness, 1);
      mesh.rotation.z = Math.atan2(toY - fromY, toX - fromX);
      this.scene.add(mesh);
      this.beams.push({ mesh, remainingLife: lifetime, lifetime, thickness, startOpacity: opacity });
    }

    updateBeams(deltaSeconds) {
      for (let i = this.beams.length - 1; i >= 0; i--) {
        const beam = this.beams[i];
        beam.remainingLife -= deltaSeconds;
        if (beam.remainingLife <= 0) {
          removeMesh(this.scene, beam.mesh, { disposeGeometry: true });
          this.beams.splice(i, 1);
          continue;
        }
        const life = beam.remainingLife / beam.lifetime;
        beam.mesh.scale.y = beam.thickness * (0.4 + 0.6 * life);
        beam.mesh.material.opacity = beam.startOpacity * life;
      }
    }

    updateFadingSprites(deltaSeconds) {
      for (let i = this.fadingSprites.length - 1; i >= 0; i--) {
        const sprite = this.fadingSprites[i];
        sprite.remainingLife -= deltaSeconds;
        if (sprite.remainingLife <= 0) {
          removeMesh(this.scene, sprite.mesh, { disposeGeometry: true });
          this.fadingSprites.splice(i, 1);
          continue;
        }
        const progress = 1 - sprite.remainingLife / sprite.lifetime; // 0 -> 1
        sprite.mesh.scale.setScalar(sprite.fromScale + (sprite.toScale - sprite.fromScale) * easeOutCubic(progress));
        sprite.mesh.position.y += sprite.riseSpeed * deltaSeconds;
        sprite.mesh.material.opacity = sprite.startOpacity * (1 - progress);
      }
    }

    updateDebris(deltaSeconds) {
      for (let i = this.debris.length - 1; i >= 0; i--) {
        const chunk = this.debris[i];
        chunk.remainingLife -= deltaSeconds;
        if (chunk.remainingLife <= 0) {
          removeMesh(this.scene, chunk.mesh);
          this.debris.splice(i, 1);
          continue;
        }
        chunk.velocityY -= DEBRIS_GRAVITY * deltaSeconds;
        chunk.mesh.position.x += chunk.velocityX * deltaSeconds;
        chunk.mesh.position.y += chunk.velocityY * deltaSeconds;
        chunk.mesh.rotation.z += chunk.spinSpeed * deltaSeconds;

        // Bounce and skid on the grass
        const restingY = GROUND_Y + chunk.size / 2;
        const isOverPit = this.terrain && !this.terrain.groundAt(chunk.mesh.position.x);
        if (!isOverPit && chunk.mesh.position.y < restingY) {
          chunk.mesh.position.y = restingY;
          chunk.velocityY = Math.abs(chunk.velocityY) > 1 ? -chunk.velocityY * 0.35 : 0;
          chunk.velocityX *= 0.6;
          chunk.spinSpeed *= 0.5;
        }
        if (chunk.remainingLife < DEBRIS_FADE_SECONDS) {
          chunk.mesh.material.opacity = chunk.remainingLife / DEBRIS_FADE_SECONDS;
        }
      }
    }

    /** Remove every active effect immediately (used on restart). */
    clear() {
      this.fadingSprites.forEach(sprite => removeMesh(this.scene, sprite.mesh, { disposeGeometry: true }));
      this.debris.forEach(chunk => removeMesh(this.scene, chunk.mesh));
      this.beams.forEach(beam => removeMesh(this.scene, beam.mesh, { disposeGeometry: true }));
      this.fadingSprites.length = 0;
      this.debris.length = 0;
      this.beams.length = 0;
    }
  }

  Forest.HitStop = HitStop;
  Forest.EffectsSystem = EffectsSystem;
})(window.Forest);
