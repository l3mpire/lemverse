import Phaser from 'phaser';

const style = {
  font: 'Verdana, "Times New Roman", Tahoma, serif',
  fontSize: 18,
  strokeColor: '#000',
  strokeSize: 3,
};

const defaultTint = 0xFFFFFF;

class CharacterNameText extends Phaser.GameObjects.Text {
  constructor(scene, text, tintName) {
    super(scene, 0, 0, text);

    this.setFontFamily(style.font)
      .setFontSize(style.fontSize)
      .setStroke(style.strokeColor, style.strokeSize)
      .setDepth(99999)
      .setOrigin(0.5)
      .setTintFromName(tintName);

    this.scene.add.existing(this);
  }

  setTintFromName(tintName) {
    const colors = Meteor.settings.public.character.nameColors;
    if (!colors) return this;

    const color = colors[tintName] || [defaultTint];
    return this.setTint(...color);
  }
}

export default CharacterNameText;
