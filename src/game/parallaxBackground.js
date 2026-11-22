/**
 * Assembles the painted background layers into the Three.js scene and scrolls them
 * at different speeds to fake depth (parallax), plus glowing motes drifting between layers.
 *
 * Each level has its own theme (forest, dungeon, neon city...); setTheme swaps every layer.
 */
(function (Forest) {
  const Painters = Forest.BackgroundPainters;
  const Theme = Forest.ThemePainters;
  const World = Forest.WorldPainters;
  const { createPixelTexture } = Forest.Graphics;
  const { createSeededRandom } = Forest.MathUtils;

  /** Extra width so screen shake never reveals the layer edges. */
  const SHAKE_MARGIN = 4;

  // Render order (more negative = further back); scrolling layers count up from FIRST_LAYER_DEPTH
  const SKY_DEPTH = -40;
  const SUN_DEPTH = -39;
  const FIRST_LAYER_DEPTH = -38;
  const MOTE_DEPTH = -31;

  /**
   * Layer options:
   *   follow  how much the layer moves with the camera (1 = infinitely far, 0 = part of the world)
   *   bottomY world height of the layer's bottom edge when the camera is at rest
   *   drift   constant scroll in pixels per second
   *   windDrift scroll in pixels per second for each unit of the level's wind (see setWind)
   *   breathe opacity slowly pulses (light shafts); flicker: it flickers quickly (torchlight)
   */
  const THEMES = {
    forest: {
      skyColors: Painters.SKY_COLORS,
      clearColor: Painters.SKY_COLORS[0],
      hasSun: true,
      layers: () => [
        { canvas: Painters.paintClouds(), follow: 0.96, bottomY: 3.6, opacity: 0.85, drift: -2.5 },
        { canvas: Painters.paintMountains(), follow: 0.9, bottomY: 0.4 },
        { canvas: Painters.paintPines(), follow: 0.78, bottomY: -2.2 },
        { canvas: Painters.paintMist(), follow: 0.7, bottomY: -0.2, opacity: 0.35, drift: 3 },
        { canvas: Painters.paintMidForest(), follow: 0.55, bottomY: -1.0 },
        { canvas: Painters.paintGodRays(), follow: 0.45, bottomY: -1.0, opacity: 0.22, additive: true, breathe: true },
        { canvas: Painters.paintUndergrowth(), follow: 0.3, bottomY: -1.6 }
      ],
      motes: { count: 28, colors: ['#fff3a0', '#c8ff9a'], rise: 0 }
    },
    dungeon: {
      skyColors: Theme.DUNGEON_SKY_COLORS,
      clearColor: Theme.DUNGEON_SKY_COLORS[0],
      hasSun: false,
      layers: () => [
        { canvas: Theme.paintDungeonWall(), follow: 0.92, bottomY: -2.0 },
        { canvas: Theme.paintDungeonPillars(), follow: 0.75, bottomY: -1.5 },
        { canvas: Theme.paintTorchGlow(), follow: 0.75, bottomY: -1.5, opacity: 0.28, additive: true, flicker: true },
        { canvas: Theme.paintChains(), follow: 0.55, bottomY: 4.0 },
        { canvas: Theme.paintRubble(), follow: 0.3, bottomY: -1.6 }
      ],
      motes: { count: 20, colors: ['#ff9a3c', '#ffd27a'], rise: 0.35 }
    },
    treetops: {
      skyColors: Theme.TREETOP_SKY_COLORS,
      clearColor: '#dbe8f6',
      hasSun: true,
      layers: () => [
        {
          canvas: Painters.paintClouds({ seed: 11, count: 5, colors: Theme.WHITE_CLOUD_COLORS, height: 80, sizeScale: 1.3 }),
          follow: 0.96, bottomY: 3.2, opacity: 0.95, drift: -2.5
        },
        { canvas: Theme.paintDistantCanopy(), follow: 0.9, bottomY: -3.4 },
        { canvas: Theme.paintCloudSea(), follow: 0.82, bottomY: -4.4 },
        {
          canvas: Painters.paintClouds({ seed: 23, count: 7, colors: Theme.FAR_CLOUD_COLORS, sizeScale: 0.7 }),
          follow: 0.7, bottomY: 0.8, opacity: 0.9, drift: 4
        },
        { canvas: Theme.paintNearCanopy(), follow: 0.4, bottomY: -5.6 }
      ],
      motes: { count: 14, colors: ['#ffffff', '#fff7c2'], rise: 0.1 }
    },
    desert: {
      skyColors: World.DESERT_SKY_COLORS,
      clearColor: World.DESERT_SKY_COLORS[0],
      hasSun: true,
      layers: () => [
        { canvas: World.paintMesas(), follow: 0.92, bottomY: -1.0 },
        { canvas: World.paintFarDunes(), follow: 0.82, bottomY: -2.0 },
        { canvas: World.paintPyramids(), follow: 0.75, bottomY: -0.6 },
        { canvas: Painters.paintMist(), follow: 0.65, bottomY: -0.4, opacity: 0.25, windDrift: 8 },
        { canvas: World.paintCactusRow(), follow: 0.5, bottomY: -1.2 },
        { canvas: World.paintNearDunes(), follow: 0.35, bottomY: -2.2 }
      ],
      motes: { count: 24, colors: ['#f6d89a', '#ffffff'], rise: 0.05 }
    },
    ice: {
      skyColors: World.ICE_SKY_COLORS,
      clearColor: World.ICE_SKY_COLORS[0],
      celestial: () => World.paintDisc({ size: 40, colors: { light: '#ffffff', mid: '#e3ecf7', dark: '#b9c8dc' }, craters: [[14, 16, 3, '#ccd8e8'], [24, 25, 2, '#ccd8e8']] }),
      layers: () => [
        { canvas: World.paintStars({ seed: 8, count: 160 }), follow: 0.99, bottomY: -1.0 },
        { canvas: World.paintAurora(), follow: 0.97, bottomY: 3.5, opacity: 0.45, additive: true, breathe: true },
        { canvas: World.paintIcePeaks(), follow: 0.88, bottomY: -1.6 },
        { canvas: World.paintSnowyPines(), follow: 0.6, bottomY: -1.4 },
        { canvas: World.paintSnowDrifts(), follow: 0.35, bottomY: -2.0 }
      ],
      motes: { count: 16, colors: ['#bff3ff', '#e8d6ff'], rise: 0 }
    },
    volcano: {
      skyColors: World.VOLCANO_SKY_COLORS,
      clearColor: World.VOLCANO_SKY_COLORS[0],
      hasSun: false,
      layers: () => [
        { canvas: Painters.paintClouds({ seed: 31, count: 5, colors: World.ASH_CLOUD_COLORS, height: 80, sizeScale: 1.5 }), follow: 0.96, bottomY: 3.6, opacity: 0.9, drift: -1.5 },
        { canvas: World.paintVolcano(), follow: 0.9, bottomY: -1.8 },
        { canvas: World.paintBasaltColumns(), follow: 0.65, bottomY: -2.0 },
        { canvas: World.paintLavaGlow(), follow: 0.5, bottomY: -3.0, opacity: 0.35, additive: true, flicker: true },
        { canvas: World.paintVolcanicRocks(), follow: 0.35, bottomY: -2.0 }
      ],
      motes: { count: 30, colors: ['#ff8a2a', '#ffd25e'], rise: 0.6 }
    },
    candy: {
      skyColors: World.CANDY_SKY_COLORS,
      clearColor: World.CANDY_SKY_COLORS[0],
      hasSun: true,
      layers: () => [
        { canvas: Painters.paintClouds({ seed: 41, count: 6, colors: World.COTTON_CANDY_COLORS, height: 80, sizeScale: 1.2 }), follow: 0.95, bottomY: 3.0, drift: -2 },
        { canvas: World.paintCandyHills(), follow: 0.85, bottomY: -1.8 },
        { canvas: World.paintLollipops(), follow: 0.6, bottomY: -1.4 },
        { canvas: World.paintGumdrops(), follow: 0.35, bottomY: -2.2 }
      ],
      motes: { count: 26, colors: ['#ff6fae', '#7fd6ff'], rise: -0.2 }
    },
    moon: {
      skyColors: World.SPACE_SKY_COLORS,
      clearColor: '#000000',
      celestial: () => World.paintDisc({ size: 56, colors: { light: '#7fd0ff', mid: '#2f7fd6', dark: '#1b4d9a' }, craters: [[20, 18, 6, '#4caf50'], [32, 30, 5, '#4caf50'], [16, 32, 3, '#e8f4ff']] }),
      layers: () => [
        { canvas: World.paintStars({ seed: 12, count: 260 }), follow: 0.995, bottomY: -1.0 },
        { canvas: World.paintNebula(), follow: 0.98, bottomY: -0.5, opacity: 0.5, additive: true },
        { canvas: World.paintMoonHills({ height: 112, baseY: 62, waves: [[10, 3, 0.4], [5, 8, 1.2]], colors: { body: '#5a5a66', shade: '#474752', light: '#7a7a88' }, seed: 1 }), follow: 0.88, bottomY: -1.6 },
        { canvas: World.paintMoonHills({ height: 64, baseY: 40, waves: [[4, 4, 1.9], [2, 11, 0.6]], colors: { body: '#3a3a44', shade: '#2c2c34', light: '#55555f' }, seed: 2 }), follow: 0.4, bottomY: -2.0 }
      ],
      motes: { count: 20, colors: ['#ffffff', '#cfe3ff'], rise: 0 }
    },
    // The future-meets-fantasy worlds (see futurePainters.js)
    ...Forest.FutureThemes
  };

  class ParallaxBackground {
    /**
     * @param {THREE.Scene} scene
     * @param {object} options
     * @param {number} options.pixelScale world units per game pixel
     * @param {number} options.viewWidthUnits visible width of the camera, in world units
     * @param {number} options.cameraRestY camera height the layers are laid out for
     * @param {string} [options.theme] forest | dungeon | treetops
     */
    constructor(scene, { pixelScale, viewWidthUnits, cameraRestY, theme = 'forest' }) {
      this.scene = scene;
      this.pixelScale = pixelScale;
      this.viewWidthUnits = viewWidthUnits;
      this.cameraRestY = cameraRestY;
      this.planeWidth = viewWidthUnits + SHAKE_MARGIN;
      this.elapsed = 0;
      /** The level's wind (negative blows left), which pushes windDrift layers along. */
      this.wind = 0;
      /** theme name -> painted layer list, so revisiting a level doesn't repaint it. */
      this.paintedLayers = {};
      this.meshes = [];
      this.themeName = null;
      this.setTheme(theme);
    }

    /** Blowing haze follows the wind: `speed` in world units per second, negative = to the left. */
    setWind(speed) {
      this.wind = speed;
    }

    /** Colour behind everything (the scene's clear colour) for the current theme. */
    get topColor() {
      return THEMES[this.themeName].clearColor;
    }

    /** Replace every layer with the given theme's. */
    setTheme(themeName) {
      if (themeName === this.themeName) return;
      this.clear();
      this.themeName = themeName;
      const theme = THEMES[themeName];

      this.layers = [];
      this.sky = this.createStaticPlane(Painters.paintSky(theme.skyColors), this.planeWidth + 2, SKY_DEPTH, false);
      this.skyBaseY = -1.5 + (this.sky.geometry.parameters.height) / 2;
      this.sun = null;
      // The sun, or another body hanging in the sky (a moon, the Earth)
      if (theme.hasSun || theme.celestial) {
        const sunCanvas = theme.celestial ? theme.celestial() : Painters.paintSun();
        this.sun = this.createStaticPlane(sunCanvas, sunCanvas.width * this.pixelScale, SUN_DEPTH, true);
      }

      if (!this.paintedLayers[themeName]) this.paintedLayers[themeName] = theme.layers();
      this.paintedLayers[themeName].forEach((layer, index) => this.addLayer({ ...layer, renderOrder: FIRST_LAYER_DEPTH + index }));
      this.createMotes(theme.motes);
      this.update(0, this.cameraRestY, 0);
    }

    /** Remove the current theme's meshes from the scene and free their GPU resources. */
    clear() {
      this.meshes.forEach(mesh => {
        this.scene.remove(mesh);
        if (mesh.material.map) mesh.material.map.dispose();
        mesh.material.dispose();
        mesh.geometry.dispose();
      });
      this.meshes = [];
    }

    addMesh(mesh) {
      this.scene.add(mesh);
      this.meshes.push(mesh);
      return mesh;
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
      return this.addMesh(mesh);
    }

    addLayer({ canvas, follow, bottomY, renderOrder, opacity = 1, additive = false, drift = 0, windDrift = 0, breathe = false, flicker = false }) {
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
      const mesh = this.addMesh(new THREE.Mesh(new THREE.PlaneGeometry(this.planeWidth, heightUnits), material));
      mesh.renderOrder = renderOrder;

      this.layers.push({
        mesh,
        texture,
        follow,
        baseY: bottomY + heightUnits / 2,
        z: renderOrder,
        drift,
        windDrift,
        driftedPixels: 0,
        baseOpacity: opacity,
        breathe,
        flicker
      });
    }

    /** Glowing motes (fireflies, embers, pollen) that wander with their own parallax and wrap around the view. */
    createMotes({ count, colors, rise }) {
      const geometry = new THREE.PlaneGeometry(this.pixelScale * 2, this.pixelScale * 2);
      const random = createSeededRandom(5);
      this.motes = [];
      this.moteRise = rise;

      for (let i = 0; i < count; i++) {
        const material = new THREE.MeshBasicMaterial({
          color: random() > 0.3 ? colors[0] : colors[1],
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        });
        // Each mote gets its own geometry reference count via the shared one; dispose it only once
        const mesh = new THREE.Mesh(i === 0 ? geometry : geometry.clone(), material);
        mesh.renderOrder = MOTE_DEPTH;
        this.addMesh(mesh);
        this.motes.push({
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

      this.sky.position.set(cameraX, this.skyBaseY + cameraRise * 0.97, SKY_DEPTH);
      if (this.sun) this.sun.position.set(cameraX - this.viewWidthUnits * 0.04, this.snapToPixel(6.0 + cameraRise * 0.95), SUN_DEPTH);

      this.layers.forEach(layer => {
        layer.driftedPixels += (layer.drift + layer.windDrift * this.wind) * deltaSeconds;
        // Scroll the texture (in whole pixels) instead of moving the mesh, so it tiles forever
        const scrollPixels = Math.round((cameraX * (1 - layer.follow)) / this.pixelScale + layer.driftedPixels);
        layer.texture.offset.x = scrollPixels / Painters.LAYER_WIDTH;
        layer.mesh.position.set(cameraX, layer.baseY + cameraRise * layer.follow, layer.z);

        if (layer.breathe) {
          layer.mesh.material.opacity = layer.baseOpacity * (0.75 + 0.25 * Math.sin(this.elapsed * 0.6));
        } else if (layer.flicker) {
          const flicker = Math.sin(this.elapsed * 9) * 0.5 + Math.sin(this.elapsed * 23.7) * 0.3;
          layer.mesh.material.opacity = layer.baseOpacity * (0.85 + 0.15 * flicker);
        }
      });

      this.updateMotes(cameraX, cameraRise, deltaSeconds);
    }

    updateMotes(cameraX, cameraRise, deltaSeconds) {
      const wrapSpan = this.planeWidth + 4;
      const RISE_SPAN = 6;
      this.motes.forEach(mote => {
        mote.offsetX += mote.driftSpeed * deltaSeconds;
        if (this.moteRise) mote.baseY = 0.2 + ((((mote.baseY - 0.2 + this.moteRise * deltaSeconds) % RISE_SPAN) + RISE_SPAN) % RISE_SPAN);
        let x = mote.offsetX - cameraX * 0.6;
        x = ((x % wrapSpan) + wrapSpan * 1.5) % wrapSpan - wrapSpan / 2;
        const y = mote.baseY + Math.sin(this.elapsed * mote.bobSpeed + mote.phase) * 0.25;
        mote.mesh.position.set(cameraX + x, y + cameraRise * 0.4, MOTE_DEPTH);

        const glow = 0.5 + 0.5 * Math.sin(this.elapsed * mote.bobSpeed * 2.2 + mote.phase * 3);
        mote.mesh.material.opacity = glow * glow;
      });
    }
  }

  Forest.ParallaxBackground = ParallaxBackground;
})(window.Forest);
