import Phaser from 'phaser';
import animations from './effects/easing';

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

    return animations[animation](positionX, positionY, reactionDiff);
  },
});
