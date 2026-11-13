/**
 * Assembles the painted background layers into the Three.js scene and scrolls them
 * at different speeds to fake depth (parallax), plus fireflies drifting between layers.
 */
(function (Forest) {
  const Painters = Forest.BackgroundPainters;
  const { createPixelTexture } = Forest.Graphics;
  const { createSeededRandom } = Forest.MathUtils;

  const FIREFLY_COUNT = 28;
  /** Extra width so screen shake never reveals the layer edges. */
  const SHAKE_MARGIN = 4;

  // Render order (more negative = further back)
  const DEPTH = {
    sky: -40,
    sun: -39,
    clouds: -38,
    mountains: -37,
    pines: -36,
    mist: -35,
    midForest: -34,
    godRays: -33,
    undergrowth: -32,
    fireflies: -31
  };

  class ParallaxBackground {
    /**
     * @param {THREE.Scene} scene
     * @param {object} options
     * @param {number} options.pixelScale world units per game pixel
     * @param {number} options.viewWidthUnits visible width of the camera, in world units
     * @param {number} options.cameraRestY camera height the layers are laid out for
     */
    constructor(scene, { pixelScale, viewWidthUnits, cameraRestY }) {
      this.scene = scene;
      this.pixelScale = pixelScale;
      this.viewWidthUnits = viewWidthUnits;
      this.cameraRestY = cameraRestY;
      this.planeWidth = viewWidthUnits + SHAKE_MARGIN;
      this.layers = [];
      this.elapsed = 0;

      /** Colour of the very top of the sky; used as the scene's clear colour. */
      this.topColor = Painters.SKY_COLORS[0];

      this.createSkyAndSun();
      this.createScrollingLayers();
      this.createFireflies();
      this.update(0, cameraRestY, 0);
    }

    createSkyAndSun() {
      const skyCanvas = Painters.paintSky();
      this.sky = this.createStaticPlane(skyCanvas, this.planeWidth + 2, DEPTH.sky, false);
      this.skyBaseY = -1.5 + (skyCanvas.height * this.pixelScale) / 2;

      const sunCanvas = Painters.paintSun();
      this.sun = this.createStaticPlane(sunCanvas, sunCanvas.width * this.pixelScale, DEPTH.sun, true);
    }

    createStaticPlane(canvas, width, renderOrder, transparent) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, canvas.height * this.pixelScale),
        new THREE.MeshBasicMaterial({
          map: createPixelTexture(canvas, { exactColors: true }),
          transparent,
          depthWrite: false
        })
      );
      mesh.renderOrder = renderOrder;
      this.scene.add(mesh);
      return mesh;
    }

    createScrollingLayers() {
      // follow: how much the layer moves with the camera (1 = infinitely far, 0 = part of the world)
      // drift: constant scroll in pixels per second (wind)
      this.addLayer(Painters.paintClouds(), { follow: 0.96, bottomY: 3.6, renderOrder: DEPTH.clouds, opacity: 0.85, drift: -2.5 });
      this.addLayer(Painters.paintMountains(), { follow: 0.9, bottomY: 0.4, renderOrder: DEPTH.mountains });
      this.addLayer(Painters.paintPines(), { follow: 0.78, bottomY: -2.2, renderOrder: DEPTH.pines });
      this.addLayer(Painters.paintMist(), { follow: 0.7, bottomY: -0.2, renderOrder: DEPTH.mist, opacity: 0.35, drift: 3 });
      this.addLayer(Painters.paintMidForest(), { follow: 0.55, bottomY: -1.0, renderOrder: DEPTH.midForest });
      this.godRays = this.addLayer(Painters.paintGodRays(), { follow: 0.45, bottomY: -1.0, renderOrder: DEPTH.godRays, opacity: 0.22, additive: true });
      this.addLayer(Painters.paintUndergrowth(), { follow: 0.3, bottomY: -1.6, renderOrder: DEPTH.undergrowth });
    }

    addLayer(canvas, { follow, bottomY, renderOrder, opacity = 1, additive = false, drift = 0 }) {
      const repeatX = this.planeWidth / this.pixelScale / Painters.LAYER_WIDTH;
      const texture = createPixelTexture(canvas, { repeatX, exactColors: true });
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
      });
      const heightUnits = canvas.height * this.pixelScale;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(this.planeWidth, heightUnits), material);
      mesh.renderOrder = renderOrder;
      this.scene.add(mesh);

      const layer = {
        mesh,
        texture,
        follow,
        baseY: bottomY + heightUnits / 2,
        z: renderOrder,
        drift,
        driftedPixels: 0,
        baseOpacity: opacity
      };
      this.layers.push(layer);
      return layer;
    }

    /** Glowing pollen that wanders with its own parallax factor and wraps around the view. */
    createFireflies() {
      const geometry = new THREE.PlaneGeometry(this.pixelScale * 2, this.pixelScale * 2);
      const random = createSeededRandom(5);
      this.fireflies = [];

      for (let i = 0; i < FIREFLY_COUNT; i++) {
        const material = new THREE.MeshBasicMaterial({
          color: random() > 0.3 ? '#fff3a0' : '#c8ff9a',
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.renderOrder = DEPTH.fireflies;
        this.scene.add(mesh);
        this.fireflies.push({
          mesh,
          offsetX: (random() - 0.5) * (this.planeWidth + 4),
          baseY: 0.2 + random() * 5.5,
          driftSpeed: (random() - 0.5) * 0.35,
          phase: random() * Math.PI * 2,
          bobSpeed: 0.6 + random() * 1.4
        });
      }
    }

    snapToPixel(value) {
      return Math.round(value / this.pixelScale) * this.pixelScale;
    }

    /** Re-position every layer for the current camera position. */
    update(cameraX, cameraY, deltaSeconds) {
      this.elapsed += deltaSeconds;
      const cameraRise = cameraY - this.cameraRestY;

      this.sky.position.set(cameraX, this.skyBaseY + cameraRise * 0.97, DEPTH.sky);
      this.sun.position.set(cameraX - this.viewWidthUnits * 0.04, this.snapToPixel(6.0 + cameraRise * 0.95), DEPTH.sun);

      this.layers.forEach(layer => {
        layer.driftedPixels += layer.drift * deltaSeconds;
        // Scroll the texture (in whole pixels) instead of moving the mesh, so it tiles forever
        const scrollPixels = Math.round((cameraX * (1 - layer.follow)) / this.pixelScale + layer.driftedPixels);
        layer.texture.offset.x = scrollPixels / Painters.LAYER_WIDTH;
        layer.mesh.position.set(cameraX, layer.baseY + cameraRise * layer.follow, layer.z);
      });

      // God rays breathe slowly
      this.godRays.mesh.material.opacity = this.godRays.baseOpacity * (0.75 + 0.25 * Math.sin(this.elapsed * 0.6));

      this.updateFireflies(cameraX, cameraRise, deltaSeconds);
    }

    updateFireflies(cameraX, cameraRise, deltaSeconds) {
      const wrapSpan = this.planeWidth + 4;
      this.fireflies.forEach(fly => {
        fly.offsetX += fly.driftSpeed * deltaSeconds;
        let x = fly.offsetX - cameraX * 0.6;
        x = ((x % wrapSpan) + wrapSpan * 1.5) % wrapSpan - wrapSpan / 2;
        const y = fly.baseY + Math.sin(this.elapsed * fly.bobSpeed + fly.phase) * 0.25;
        fly.mesh.position.set(cameraX + x, y + cameraRise * 0.4, DEPTH.fireflies);

        const glow = 0.5 + 0.5 * Math.sin(this.elapsed * fly.bobSpeed * 2.2 + fly.phase * 3);
        fly.mesh.material.opacity = glow * glow;
      });
    }
  }

  Forest.ParallaxBackground = ParallaxBackground;
})(window.Forest);
