const Phaser = require('phaser');

const style = {
  font: 'Verdana, "Times New Roman", Tahoma, serif',
  fontSize: 18,
  strokeColor: '#000',
  strokeSize: 3,
};

const offset = -85;

CharacterNameText = new Phaser.Class({
  Extends: Phaser.GameObjects.Text,

  initialize: function CharacterNameText(scene, player, text) {
    Phaser.GameObjects.Text.call(this, scene);
    scene.add.existing(this);

    this.setText(text)
      .setFontFamily(style.font)
      .setFontSize(style.fontSize)
      .setOrigin(0.5)
      .setStroke(style.strokeColor, style.strokeSize)
      .setDepth(99999);

    this.player = player;
  },

  updatePosition() {
    this.setPosition(this.player.x, this.player.y + offset);
  },
});
