/** Leaves drifting down across the whole level, purely decorative. */
(function (Forest) {
  const { GROUND_Y, LEVEL_START_X, LEVEL_END_X } = Forest.Config;
  const { randomBetween } = Forest.MathUtils;

  const LEAF_COUNT = 48;
  const LEAF_Z = 0.8;
  const MIN_HEIGHT = 1.0;
  const MAX_HEIGHT = 8.0;
  /** How far past the level edge a leaf travels before wrapping to the other side. */
  const WRAP_MARGIN = 5;
  /** Leaves live within this distance either side of the camera. */
  const VIEW_SPAN = 14;

  function randomLeafHeight() {
    return GROUND_Y + randomBetween(MIN_HEIGHT, MAX_HEIGHT);
  }

  class AmbientLeaves {
    constructor(scene) {
      this.leaves = [];
      for (let i = 0; i < LEAF_COUNT; i++) {
        const material = new THREE.MeshBasicMaterial({
          color: Math.random() > 0.4 ? '#86d66e' : '#ffd166', // mostly green, some golden
          transparent: true,
          opacity: 0.75
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.09), material);
        mesh.position.set(randomBetween(LEVEL_START_X, LEVEL_END_X), randomLeafHeight(), LEAF_Z);
        scene.add(mesh);

        this.leaves.push({
          mesh,
          velocityX: -randomBetween(0.4, 1.0),
          velocityY: -randomBetween(0.2, 0.5),
          wobblePhase: Math.random() * Math.PI * 2,
          wobbleSpeed: randomBetween(2.0, 4.5)
        });
      }
    }

    /** Recolour the leaves for a level's theme (e.g. grey dust in the dungeon) or hide them. */
    setColors(colors) {
      this.leaves.forEach((leaf, index) => {
        leaf.mesh.visible = colors.length > 0;
        if (colors.length) leaf.mesh.material.color.set(colors[index % colors.length]);
      });
    }

    /** Extra sideways speed for every leaf (a sandstorm gust); 0 for calm air. */
    setWind(speed) {
      this.wind = speed;
    }

    /** @param {number} [cameraX] leaves wrap around the camera, so they're everywhere in a long level */
    update(deltaSeconds, cameraX = 0) {
      this.leaves.forEach(leaf => {
        const position = leaf.mesh.position;
        leaf.wobblePhase += leaf.wobbleSpeed * deltaSeconds;
        const wobble = Math.sin(leaf.wobblePhase);

        position.x += (leaf.velocityX + (this.wind || 0) * 2.5) * deltaSeconds;
        position.y += leaf.velocityY * deltaSeconds + wobble * 0.008;
        leaf.mesh.rotation.z = wobble * 0.4;

        // Blown off the left edge: re-enter from the right
        if (position.x < cameraX - VIEW_SPAN) {
          position.x = cameraX + VIEW_SPAN;
          position.y = randomLeafHeight();
        } else if (position.x > cameraX + VIEW_SPAN + WRAP_MARGIN) {
          // The camera jumped back (a new level): bring the leaf into view
          position.x = cameraX + randomBetween(-VIEW_SPAN, VIEW_SPAN);
          position.y = randomLeafHeight();
        }
        // Reached the ground: start again from the top
        if (position.y < GROUND_Y) {
          position.y = GROUND_Y + 7.0;
        }
      });
    }
  }

  Forest.AmbientLeaves = AmbientLeaves;
})(window.Forest);
