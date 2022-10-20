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
const iconMargin = 3;

class CharacterNameText extends Phaser.GameObjects.Container {
  constructor(scene, name, baseline, tintName) {
    super(scene);
    this.name = this.createText(name, nameStyle);
    this.nameContainer = new Phaser.GameObjects.Container(scene, 0, 0, [this.name]);
    this.add(this.nameContainer)
      .setBaseline(baseline)
      .setTintFromName(tintName)
      .setDepth(99999);
    scene.add.existing(this);
  }

  createText(message, style) {
    return this.scene.make.text({ text: message, style }).setOrigin(0.5);
  }

  setBaseline(text) {
    if (!text) return this.destroyBaseline();
    if (!this.baseline) {
      this.baseline = this.createText(text, baselineStyle);
      this.add(this.baseline);
      this.nameContainer.setY(-baselineOffset);
    }
    this.baseline.setText(text);
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
    this.updateIconPosition();
    return this;
  }

  updateIconPosition() {
    if (this.icon) this.icon.setX(-(this.name.width + this.icon.displayWidth) / 2 - iconMargin);
  }

  setIcon(icon) {
    this.destroyIcon();
    if (icon) {
      game.scene.getScene('BootScene').loadImagesAtRuntime([icon], () => {
        this.destroyIcon();
        this.icon = this.scene.make.sprite({ key: icon.fileId });
        this.icon.displayHeight = icon.height;
        this.icon.displayWidth = icon.width;
        this.updateIconPosition();
        this.nameContainer.add(this.icon);
      });
    }
  }

  destroyBaseline() {
    if (this.baseline) {
      this.nameContainer.setY(0);
      this.baseline.destroy();
      this.baseline = undefined;
    }
    return this;
  }

  destroyIcon() {
    if (this.icon) {
      this.icon.destroy();
      this.icon = undefined;
    }
  }
}

export default CharacterNameText;
