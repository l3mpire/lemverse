const zigzag = (x, y, xOffset) => ({
  alpha: { value: 0, duration: 250, delay: 750, ease: 'Power1' },
  y: { value: y - 70, duration: 1300, ease: 'Power1' },
  x: { value: x + (xOffset * 2), duration: 250, ease: 'Linear', yoyo: true, repeat: -1 },
  scale: { value: 1.2, duration: 175, ease: 'Quad.easeOut', yoyo: true, repeat: -1 },
});

const fadeOut = () => ({
  alpha: { value: 0, duration: 250, delay: 750, ease: 'Power1' },
});

const linearUpYoyo = (_x, y) => ({
  y: { value: y - 70, duration: 1300, ease: 'Power1' },
  alpha: { value: 0, duration: 250, delay: 750, ease: 'Power1' },
  scale: { value: 1.2, duration: 175, ease: 'Quad.easeOut', yoyo: true, repeat: -1 },
});

const linearUpScaleDown = (_x, y) => ({
  y: { value: y - 70, duration: 1300, ease: 'Power1' },
  alpha: { value: 0, duration: 750, delay: 250, ease: 'Power1' },
  scale: { value: 0.9, duration: 1300, ease: 'Quad.easeOut' },
});

export default { zigzag, fadeOut, linearUpYoyo, linearUpScaleDown };
