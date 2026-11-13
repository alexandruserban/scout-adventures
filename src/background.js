// Layered Pixel-Art Parallax Background for Forest Pixel Adventure
// Golden-hour forest: dithered sky, sun, drifting clouds, distant mountains,
// pine ridge, rolling mist, mid-forest canopy, god rays, undergrowth and fireflies.
// Every layer is procedurally drawn at 1 texel = 1 game pixel and tiles seamlessly.

(function() {
  const LAYER_W = 512; // texture width in pixels (tiles horizontally)

  // 4x4 Bayer matrix for ordered dithering between colour bands
  const BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];
  const bayer = (x, y) => (BAYER[y & 3][x & 3] + 0.5) / 16;

  // Deterministic RNG so the forest looks the same every load
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    // put() wraps horizontally so shapes crossing the edge tile seamlessly
    const put = (x, y, color) => {
      if (y < 0 || y >= h) return;
      ctx.fillStyle = color;
      ctx.fillRect(((Math.floor(x) % w) + w) % w, Math.floor(y), 1, 1);
    };
    return { c, ctx, put, w, h };
  }

  // Periodic ridge line built from integer-frequency sines (wraps at LAYER_W)
  function ridge(x, waves) {
    let v = 0;
    for (const [amp, freq, phase] of waves) {
      v += amp * Math.sin((x / LAYER_W) * Math.PI * 2 * freq + phase);
    }
    return v;
  }

  // ------------------------------------------
  // Layer painters
  // ------------------------------------------
  const SKY_STOPS = ['#1a2c3d', '#223f4f', '#2e5560', '#3f6d68', '#5e8a6f', '#93a874', '#c9c27e', '#efd58b', '#fbe7a6'];

  function paintSky() {
    // Narrow strip stretched across the screen; top half solid so tall screens stay covered
    const { c, put, h } = makeCanvas(8, 512);
    const gradStart = 256;
    for (let y = 0; y < h; y++) {
      const t = Math.max(0, (y - gradStart) / (h - gradStart)) * (SKY_STOPS.length - 1);
      const i = Math.min(SKY_STOPS.length - 2, Math.floor(t));
      const frac = t - i;
      for (let x = 0; x < 8; x++) {
        put(x, y, frac > bayer(x, y) ? SKY_STOPS[i + 1] : SKY_STOPS[i]);
      }
    }
    return c;
  }

  function paintSun() {
    const size = 72;
    const { c, put } = makeCanvas(size, size);
    const r0 = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x + 0.5 - r0, y + 0.5 - r0);
        if (d < 9) put(x, y, '#fffbe6');
        else if (d < 11) put(x, y, '#fff0b8');
        else if (d < 14) put(x, y, "#ffe49a");
        else if (d < 16 && (x + y) % 2 === 0) put(x, y, "#ffe49a");
      }
    }
    return c;
  }

  function paintClouds() {
    const { c, put, h } = makeCanvas(LAYER_W, 64);
    const r = rng(7);
    const clouds = [];
    for (let i = 0; i < 6; i++) {
      clouds.push({ x: i * (LAYER_W / 6) + r() * 40, y: 14 + r() * 34, w: 34 + r() * 50 });
    }
    clouds.forEach(cl => {
      // Flat-bottomed puffy cloud made of overlapping half-discs
      const puffs = 3 + Math.floor(r() * 3);
      const pts = [];
      for (let p = 0; p < puffs; p++) {
        pts.push({ px: cl.x + (p + 0.5) * (cl.w / puffs), pr: 5 + r() * (cl.w / puffs) * 0.55 });
      }
      for (let x = Math.floor(cl.x - 4); x < cl.x + cl.w + 4; x++) {
        let top = Infinity;
        pts.forEach(({ px, pr }) => {
          const dx = x - px;
          if (Math.abs(dx) < pr) top = Math.min(top, cl.y - Math.sqrt(pr * pr - dx * dx));
        });
        if (top === Infinity) continue;
        for (let y = Math.floor(top); y <= cl.y; y++) {
          if (y >= h) break;
          let col = '#f7e9bd';
          if (y > cl.y - 2) col = '#c9b88e';
          else if (y > cl.y - 5) col = '#e2cf9f';
          else if (y < top + 2) col = '#fff6d8';
          put(x, y, col);
        }
      }
    });
    return c;
  }

  function paintMountains() {
    const { c, put, h } = makeCanvas(LAYER_W, 128);
    const waves = [[14, 2, 0.4], [9, 5, 1.9], [4, 11, 0.7], [2, 23, 2.2]];
    let prev = null;
    for (let x = 0; x < LAYER_W; x++) {
      const top = Math.round(56 + ridge(x, waves));
      const next = Math.round(56 + ridge(x + 1, waves));
      for (let y = top; y < h; y++) {
        // Atmospheric haze: lighter and warmer towards the base
        const haze = (y - top) / 60;
        let col = haze > 0.66 + bayer(x, y) * 0.3 ? '#8aa98a' : haze > 0.25 + bayer(x, y) * 0.3 ? '#729a85' : '#5f8879';
        // Sun-lit rim on slopes facing right (towards the sun)
        if (y < top + 2 && next > top) col = '#a9c19a';
        put(x, y, col);
      }
      prev = top;
    }
    return c;
  }

  function paintPines() {
    const { c, put, h } = makeCanvas(LAYER_W, 128);
    const r = rng(42);
    const base = h - 1;
    // Low rolling ridge under the pines
    for (let x = 0; x < LAYER_W; x++) {
      const top = Math.round(86 + ridge(x, [[5, 3, 1.1], [3, 7, 0.3]]));
      for (let y = top; y < h; y++) put(x, y, y > top + 18 && bayer(x, y) < (y - top - 18) / 30 ? '#5b8775' : '#477565');
    }
    const trees = [];
    for (let x = 0; x < LAYER_W; x += 7 + Math.floor(r() * 9)) {
      trees.push({ x, ht: 34 + r() * 46, w: 0.36 + r() * 0.12 });
    }
    trees.sort((a, b) => a.ht - b.ht);
    trees.forEach(t => {
      const groundY = Math.round(86 + ridge(t.x, [[5, 3, 1.1], [3, 7, 0.3]])) + 4;
      const tipY = groundY - t.ht;
      for (let y = Math.floor(tipY); y < groundY; y++) {
        const p = (y - tipY) / t.ht;
        // Stepped tiers give a pixel-art pine silhouette
        const tier = (p * 5) % 1;
        const halfW = Math.max(0.5, p * t.ht * t.w * (0.75 + tier * 0.35));
        for (let dx = -Math.floor(halfW); dx <= Math.floor(halfW); dx++) {
          let col = '#3a6656';
          if (dx > halfW * 0.35) col = '#335c4e';
          if (dx >= Math.floor(halfW) - 0 && dx > 0) col = '#5d8e72'; // sunlit right edge
          put(t.x + dx, y, col);
        }
      }
      // Trunk peeking out
      for (let y = groundY; y < Math.min(base, groundY + 3); y++) put(t.x, y, '#2f4c42');
    });
    return c;
  }

  function paintMist() {
    const { c, put, h } = makeCanvas(LAYER_W, 32);
    for (let x = 0; x < LAYER_W; x++) {
      const top = 10 + ridge(x, [[4, 4, 0.2], [2.5, 9, 1.4], [1, 19, 0.6]]);
      for (let y = Math.floor(top); y < h; y++) {
        const d = y - top;
        if (d >= 2 || (d >= 0 && (x + y) % 2 === 0)) put(x, y, d > 6 ? "#e8edc8" : "#dfe6c0");
      }
    }
    return c;
  }

  function paintMidForest() {
    const { c, put, h } = makeCanvas(LAYER_W, 128);
    const r = rng(1337);
    const groundY = h - 10;
    // Forest floor strip
    for (let x = 0; x < LAYER_W; x++) {
      for (let y = groundY - 2; y < h; y++) put(x, y, '#203b2f');
    }
    const trees = [];
    for (let x = 0; x < LAYER_W; x += 38 + Math.floor(r() * 34)) {
      trees.push({ x, trunkW: 2 + Math.floor(r() * 3), canopyY: 52 + r() * 26, rad: 11 + r() * 8 });
    }
    trees.forEach(t => {
      // Trunk with a lit right edge
      for (let y = Math.floor(t.canopyY); y < groundY; y++) {
        const flare = y > groundY - 6 ? groundY - 6 - y : 0;
        for (let dx = -t.trunkW + flare; dx <= t.trunkW - flare; dx++) {
          put(t.x + dx, y, dx >= t.trunkW - flare - 1 ? '#3d5144' : dx < -t.trunkW + 2 + flare ? '#1c2b25' : '#2a3b33');
        }
      }
      // Canopy: cluster of lumpy discs, lit from the upper right
      const blobs = [
        [0, 0, t.rad], [-t.rad * 0.8, t.rad * 0.35, t.rad * 0.7], [t.rad * 0.85, t.rad * 0.3, t.rad * 0.72],
        [-t.rad * 0.3, -t.rad * 0.55, t.rad * 0.65], [t.rad * 0.4, -t.rad * 0.4, t.rad * 0.6]
      ];
      blobs.forEach(([bx, by, br]) => {
        const cx = t.x + bx, cy = t.canopyY + by;
        for (let dy = -br; dy <= br; dy++) {
          for (let dx = -br; dx <= br; dx++) {
            const wob = Math.sin((cx + dx) * 0.9) * 1.2 + Math.cos((cy + dy) * 1.3) * 0.8;
            if (Math.hypot(dx, dy) > br + wob) continue;
            const lx = dx / br, ly = dy / br;
            const light = lx * 0.6 - ly * 0.8; // sun from upper right
            let col = '#2b5141';
            if (ly > 0.45) col = '#213f33';
            else if (light > 0.75) col = '#5d8f62';
            else if (light > 0.35 + bayer(cx + dx, cy + dy) * 0.25) col = '#3c6a50';
            put(cx + dx, cy + dy, col);
          }
        }
      });
    });
    return c;
  }

  function paintRays() {
    const { c, ctx, w, h } = makeCanvas(LAYER_W, 256);
    const r = rng(99);
    const img = ctx.createImageData(w, h);
    const shafts = [];
    for (let i = 0; i < 5; i++) shafts.push({ x: i * (w / 5) + r() * 60, width: 8 + r() * 20 });
    const slope = 0.45; // rays lean down-left, away from the sun
    for (let y = 0; y < h; y++) {
      const fade = Math.pow(1 - y / h, 1.3);
      for (let x = 0; x < w; x++) {
        let a = 0;
        shafts.forEach(s => {
          let dx = (((x + y * slope - s.x) % w) + w) % w;
          if (dx > w / 2) dx -= w;
          const edge = 1 - Math.abs(dx) / s.width;
          if (edge > 0) a = Math.max(a, edge);
        });
        // Quantise alpha into three dithered steps to keep it pixel-crisp
        const v = a * fade;
        const step = v > 0.55 ? 1 : v > 0.25 ? 0.6 : v > 0.06 && bayer(x, y) < 0.5 ? 0.3 : 0;
        if (!step) continue;
        const o = (y * w + x) * 4;
        img.data[o] = 255; img.data[o + 1] = 232; img.data[o + 2] = 160; img.data[o + 3] = Math.round(step * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintUndergrowth() {
    const { c, put, h } = makeCanvas(LAYER_W, 64);
    const r = rng(2024);
    for (let x = 0; x < LAYER_W; x++) {
      const top = Math.round(40 + ridge(x, [[3, 6, 0.5], [2, 13, 1.7]]));
      for (let y = top; y < h; y++) put(x, y, '#18301f');
    }
    // Bushes and fern fronds poking up
    for (let i = 0; i < 26; i++) {
      const bx = r() * LAYER_W, br = 6 + r() * 9, by = 42 + r() * 4;
      for (let dy = -br; dy <= br; dy++) {
        for (let dx = -br * 1.4; dx <= br * 1.4; dx++) {
          if (Math.hypot(dx / 1.4, dy) > br + Math.sin(dx * 1.7) * 1.1) continue;
          const light = dx / (br * 1.4) * 0.5 - dy / br;
          put(bx + dx, by + dy, light > 0.7 ? '#3e6b3e' : light > 0.25 + bayer(bx + dx, by + dy) * 0.3 ? '#2a4d2f' : '#1d3a25');
        }
      }
    }
    for (let i = 0; i < 40; i++) {
      const fx = r() * LAYER_W, fh = 8 + r() * 12, lean = (r() - 0.5) * 0.8;
      for (let s = 0; s < fh; s++) {
        const x = fx + lean * s, y = 46 - s;
        put(x, y, '#2a4d2f');
        if (s % 3 === 0 && s > 2) { put(x - 1, y + 1, '#2a4d2f'); put(x + 1, y + 1, '#3e6b3e'); }
      }
    }
    return c;
  }

  // ------------------------------------------
  // Scene assembly
  // ------------------------------------------
  function create(scene, opts) {
    const PS = opts.pixelScale;
    const viewW = opts.viewWidthUnits;
    const camY0 = opts.cameraBaseY;
    const planeW = viewW + 4; // a little margin for screen shake
    const repeatX = planeW / PS / LAYER_W;

    function tex(canvas, repeat) {
      const t = new THREE.CanvasTexture(canvas);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.encoding = THREE.sRGBEncoding; // show the painted colours exactly
      if (repeat) {
        t.wrapS = THREE.RepeatWrapping;
        t.repeat.x = repeatX;
      }
      return t;
    }

    const layers = [];
    // follow: 1 = glued to the camera (infinitely far), 0 = part of the world
    function addLayer(canvas, { follow, bottomY, z, opacity = 1, additive = false, drift = 0 }) {
      const t = tex(canvas, true);
      const mat = new THREE.MeshBasicMaterial({
        map: t,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
      });
      const hUnits = canvas.height * PS;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeW, hUnits), mat);
      mesh.renderOrder = z;
      scene.add(mesh);
      const layer = { mesh, tex: t, follow, baseY: bottomY + hUnits / 2, z, drift, driftPx: 0, opacity };
      layers.push(layer);
      return layer;
    }

    // Sky gradient (glued to the camera, horizon tracks the world slightly)
    const skyCanvas = paintSky();
    const skyMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(planeW + 2, skyCanvas.height * PS),
      new THREE.MeshBasicMaterial({ map: tex(skyCanvas, false), depthWrite: false })
    );
    skyMesh.renderOrder = -40;
    scene.add(skyMesh);
    const skyBaseY = -1.5 + (skyCanvas.height * PS) / 2;

    // Sun disc with dithered halo
    const sunCanvas = paintSun();
    const sunMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(sunCanvas.width * PS, sunCanvas.height * PS),
      new THREE.MeshBasicMaterial({ map: tex(sunCanvas, false), transparent: true, depthWrite: false })
    );
    sunMesh.renderOrder = -39;
    scene.add(sunMesh);

    addLayer(paintClouds(), { follow: 0.96, bottomY: 3.6, z: -38, opacity: 0.85, drift: -2.5 });
    addLayer(paintMountains(), { follow: 0.9, bottomY: 0.4, z: -37 });
    addLayer(paintPines(), { follow: 0.78, bottomY: -2.2, z: -36 });
    addLayer(paintMist(), { follow: 0.7, bottomY: -0.2, z: -35, opacity: 0.35, drift: 3 });
    addLayer(paintMidForest(), { follow: 0.55, bottomY: -1.0, z: -34 });
    const rays = addLayer(paintRays(), { follow: 0.45, bottomY: -1.0, z: -33, opacity: 0.22, additive: true });
    addLayer(paintUndergrowth(), { follow: 0.3, bottomY: -1.6, z: -32 });

    // Fireflies / glowing pollen drifting between the background layers
    const flyGeo = new THREE.PlaneGeometry(PS * 2, PS * 2);
    const flies = [];
    const fr = rng(5);
    for (let i = 0; i < 28; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: fr() > 0.3 ? '#fff3a0' : '#c8ff9a',
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(flyGeo, mat);
      mesh.renderOrder = -31;
      scene.add(mesh);
      flies.push({
        mesh,
        lx: (fr() - 0.5) * (planeW + 4),
        ly: 0.2 + fr() * 5.5,
        vx: (fr() - 0.5) * 0.35,
        phase: fr() * Math.PI * 2,
        speed: 0.6 + fr() * 1.4
      });
    }

    let time = 0;
    const snap = v => Math.round(v / PS) * PS;

    function update(camX, camY, dt) {
      time += dt;
      const dy = camY - camY0;

      skyMesh.position.set(camX, skyBaseY + dy * 0.97, -40);
      sunMesh.position.set(camX - viewW * 0.04, snap(6.0 + dy * 0.95), -39);

      layers.forEach(l => {
        l.driftPx += l.drift * dt;
        // Scroll the texture (in whole pixels) instead of moving the mesh, so it tiles forever
        const scrollPx = Math.round((camX * (1 - l.follow)) / PS + l.driftPx);
        l.tex.offset.x = scrollPx / LAYER_W;
        l.mesh.position.set(camX, l.baseY + dy * l.follow, l.z);
      });

      // God rays breathe slowly
      rays.mesh.material.opacity = rays.opacity * (0.75 + 0.25 * Math.sin(time * 0.6));

      // Fireflies wander with a parallax factor of ~0.4 and wrap around the view
      const span = planeW + 4;
      flies.forEach(f => {
        f.lx += f.vx * dt;
        let x = f.lx - camX * 0.6;
        x = ((x % span) + span * 1.5) % span - span / 2;
        const y = f.ly + Math.sin(time * f.speed + f.phase) * 0.25;
        f.mesh.position.set(camX + x, y + dy * 0.4, -31);
        const glow = 0.5 + 0.5 * Math.sin(time * f.speed * 2.2 + f.phase * 3);
        f.mesh.material.opacity = glow * glow;
      });
    }

    update(0, camY0, 0);
    return { update, topColor: SKY_STOPS[0] };
  }

  window.ForestBackground = { create };
})();
