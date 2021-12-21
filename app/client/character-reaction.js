const Phaser = require('phaser');

const reactionsAnimations = {
  zigzag: (x, y, xOffset) => ({
    alpha: { value: 0, duration: 250, delay: 750, ease: 'Power1' },
    y: { value: y - 70, duration: 1300, ease: 'Power1' },
    x: { value: x + (xOffset * 2), duration: 250, ease: 'Linear', yoyo: true, repeat: -1 },
    scale: { value: 1.2, duration: 175, ease: 'Quad.easeOut', yoyo: true, repeat: -1 },
  }),
  fadeOut: () => ({
    alpha: { value: 0, duration: 250, delay: 750, ease: 'Power1' },
  }),
  linearUpYoyo: (x, y) => ({
    y: { value: y - 70, duration: 1300, ease: 'Power1' },
    alpha: { value: 0, duration: 250, delay: 750, ease: 'Power1' },
    scale: { value: 1.2, duration: 175, ease: 'Quad.easeOut', yoyo: true, repeat: -1 },
  }),
  linearUpScaleDown: (x, y) => ({
    y: { value: y - 70, duration: 1300, ease: 'Power1' },
    alpha: { value: 0, duration: 750, delay: 250, ease: 'Power1' },
    scale: { value: 0.9, duration: 1300, ease: 'Quad.easeOut' },
  }),
};

const style = {
  font: 'Sans Open',
  fontSize: 32,
};

CharacterReaction = new Phaser.Class({
  Extends: Phaser.GameObjects.Text,

  initialize: function CharacterNameText(scene) {
    Phaser.GameObjects.Text.call(this, scene);
    scene.add.existing(this);

    this.setDepth(99997).setOrigin(0.5, 1).setFontFamily(style.font).setFontSize(style.fontSize);
  },

  prepare(text, x, y, animation, options) {
    this.setVisible(true).setActive(true).setAlpha(1).setScale(1);
    this.setText(text);

    const reactionDiff = animation === 'zigzag' ? 10 : 0;
    const positionX = x - reactionDiff + _.random(-options.randomOffset, options.randomOffset);
    const positionY = y + _.random(-options.randomOffset, options.randomOffset);
    this.setPosition(positionX, positionY);

    return reactionsAnimations[animation](positionX, positionY, reactionDiff);
  },
});
