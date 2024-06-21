import Phaser from 'phaser';

const createConfettiEffect = (scene, x, y) => {
  const particles = scene.add.particles(x, y, 'pixel', {
    quantity: 50,
    speed: { min: 500, max: 700 },
    angle: { min: -100, max: -80 },
    scale: 5,
    alpha: { start: 1, end: 0.3 },
    tint: [0xff0000, 0x00ff00, 0x0000ff, 0xFFFF00, 0xA020F0],
    lifespan: 1200,
    gravityY: 900,
  });
  particles.setDepth(100);

  return particles;
};

const createBloodEffect = (scene, x, y) => {
  const particles = scene.add.particles(x, y, 'circle', {
    quantity: 35,
    speedX: { min: -100, max: 100 },
    speedY: { min: 1350, max: 1950 },
    scale: { min: 0.08, max: 0.12 },
    alpha: { start: 1, end: 0.6 },
    tint: 0xff0000,
    lifespan: 2000,
    gravityY: 1100,
    bounce: 0.35,
    bounds: new Phaser.Geom.Rectangle(x - 500, y - 300, 1000, 300),
  });
  particles.setDepth(100);

  return particles;
};

const createSmokeEffect = (scene, x, y) => {
  const particles = scene.add.particles(x, y, 'circle', {
    maxParticles: 50,
    speedY: { min: -20, max: -80 },
    scale: { start: 0.12, end: 0.01 },
    alpha: { start: 0.85, end: 0.15 },
    tint: 0xe8e7e3,
    lifespan: 450,
    frequency: 75,
  });
  particles.setDepth(100);

  return particles;
};

export {
  createBloodEffect,
  createConfettiEffect,
  createSmokeEffect,
};
