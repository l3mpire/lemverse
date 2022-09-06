import Phaser from 'phaser';

const nameStyle = {
  fontFamily: 'Verdana, "Times New Roman", Tahoma, serif',
  fontSize: 18,
  stroke: '#000',
  strokeThickness: 3,
};

const baselineStyle = {
  ...nameStyle,
  fontSize: 12,
};

const defaultTint = 0xFFFFFF;
const baselineOffset = 20;

class CharacterNameText extends Phaser.GameObjects.Container {
  constructor(scene, name, baseline, tintName) {
    super(scene);
    this.name = this.createText(name, nameStyle);
    this.setBaseline(baseline)
      .setTintFromName(tintName)
      .setDepth(99999);
    scene.add.existing(this);
  }

  createText(message, style) {
    const text = new Phaser.GameObjects.Text(this.scene, 0, 0, message, style);
    text.setOrigin(0.5);
    this.add(text);
    return text;
  }

  setBaseline(text) {
    if (!text) return this.destroyBaseline();
    if (!this.baseline) {
      this.baseline = this.createText(text, baselineStyle);
      this.name.setPosition(0, -baselineOffset);
    }
    this.baseline.setText(text);
    return this;
  }

  destroyBaseline() {
    if (this.baseline) {
      this.name.setPosition(0, 0);
      this.baseline.destroy();
      this.baseline = undefined;
    }
    return this;
  }

  setTintFromName(tintName) {
    const colors = Meteor.settings.public.character.nameColors;
    if (!colors) return this;

    const color = colors[tintName] || [defaultTint];
    this.name.setTint(...color);
    if (this.baseline) this.baseline.setTint(...color);
    return this;
  }

  setText(name, baseline) {
    this.name.setText(name);
    this.setBaseline(baseline);
    return this;
  }
}

export default CharacterNameText;
