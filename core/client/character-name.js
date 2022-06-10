import Phaser from 'phaser';

characterNameColors = {
  white: ['0xffffff', '0xffffff', '0xffffff', '0xffffff'],
  orange: ['0xfc9729', '0xfc9729', '0xf69831', '0xf69831'],
  red: ['0xf15739', '0xf15739', '0xee5c3b', '0xee5c3b'],
  yellow: ['0xf4c918', '0xf4c918', '0xdbb92a', '0xdbb92a'],
  beige: ['0xedc993', '0xedc993', '0xe5bf8a', '0xe5bf8a'],
  green: ['0xabdf3a', '0xabdf3a', '0xa1cb44', '0xa1cb44'],
  lightGreen: ['0x52d8a2', '0x52d8a2', '0x57cfa0', '0x57cfa0'],
  blue: ['0x2394d9', '0x2394d9', '0x3199da', '0x3199da'],
  lightBlue: ['0xa4e2fb', '0xa4e2fb', '0xa5dbf0', '0xa5dbf0'],
  pink: ['0xe584e1', '0xe584e1', '0xf291f0', '0xf291f0'],
  purple: ['0xb558e1', '0xb558e1', '0xfa8ff8', '0xfa8ff8'],
};

const style = {
  font: 'Verdana, "Times New Roman", Tahoma, serif',
  fontSize: 18,
  strokeColor: '#000',
  strokeSize: 3,
};

const offset = -85;

CharacterNameText = new Phaser.Class({
  Extends: Phaser.GameObjects.Text,

  initialize: function CharacterNameText(scene, player, text, color) {
    Phaser.GameObjects.Text.call(this, scene);
    scene.add.existing(this);

    this.setText(text)
      .setFontFamily(style.font)
      .setFontSize(style.fontSize)
      .setStroke(style.strokeColor, style.strokeSize)
      .setDepth(99999)
      .setOrigin(0.5)
      .setColorFromName(color);

    this.player = player;
  },

  setColor(color) {
    if (!Array.isArray(color) || color.length !== 4) { log('Invalid color', color); return this; }
    return this.setTint(color[0], color[1], color[2], color[3]);
  },

  setColorFromName(colorName) {
    return this.setColor(characterNameColors[colorName] || characterNameColors.white);
  },

  updatePosition(x, y) {
    this.setPosition(x, y + offset);
  },
});
