/** Short-lived square particles: dust, sparks, spores. They fly out, fall and shrink away. */
(function (Forest) {
  const { removeMesh } = Forest.Graphics;
  const { randomBetween } = Forest.MathUtils;

  const PARTICLE_SIZE = 0.12;
  const PARTICLE_GRAVITY = -5.0;
  const PARTICLE_Z = 0.5;
  /** Particles start within this distance of the burst point. */
  const SPAWN_JITTER = 0.4;
  /** Extra upward kick so bursts fountain up rather than spraying evenly. */
  const UPWARD_BIAS = 0.8;

  class ParticleSystem {
    constructor(scene) {
      this.scene = scene;
      this.particles = [];
      this.geometry = new THREE.PlaneGeometry(PARTICLE_SIZE, PARTICLE_SIZE);
    }

    /**
     * Spray particles in random directions from a point.
     * @param {number} x
     * @param {number} y
     * @param {number} count
     * @param {string} color CSS colour
     * @param {number} [spread] multiplies particle speed
     * @param {number} [lifetime] average seconds before a particle disappears
     */
    burst(x, y, count, color, spread = 1.0, lifetime = 0.5) {
      for (let i = 0; i < count; i++) {
        const mesh = new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial({ color, transparent: true }));
        mesh.position.set(
          x + (Math.random() - 0.5) * SPAWN_JITTER,
          y + (Math.random() - 0.5) * SPAWN_JITTER,
          PARTICLE_Z
        );
        this.scene.add(mesh);

        const angle = Math.random() * Math.PI * 2;
        const speed = randomBetween(0.5, 2.3) * spread;
        this.particles.push({
          mesh,
          velocityX: Math.cos(angle) * speed,
          velocityY: Math.sin(angle) * speed + UPWARD_BIAS,
          remainingLife: lifetime * randomBetween(0.8, 1.2),
          lifetime,
          size: randomBetween(0.8, 1.3)
        });
      }
    }

    update(deltaSeconds) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const particle = this.particles[i];
        particle.remainingLife -= deltaSeconds;
        if (particle.remainingLife <= 0) {
          removeMesh(this.scene, particle.mesh);
          this.particles.splice(i, 1);
          continue;
        }
        particle.velocityY += PARTICLE_GRAVITY * deltaSeconds;
        particle.mesh.position.x += particle.velocityX * deltaSeconds;
        particle.mesh.position.y += particle.velocityY * deltaSeconds;
        particle.mesh.scale.setScalar((particle.remainingLife / particle.lifetime) * particle.size);
      }
    }
  }

  Forest.ParticleSystem = ParticleSystem;
})(window.Forest);
