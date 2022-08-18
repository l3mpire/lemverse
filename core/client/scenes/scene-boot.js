import Phaser from 'phaser';

const assetsRoute = 'assets/images';
const filesRoute = Meteor.settings.public.files.route;

BootScene = new Phaser.Class({
  Extends: Phaser.Scene,

  initialize: function BootScene() {
    Phaser.Scene.call(this, { key: 'BootScene' });
  },

  preload() {
    this.load.image('circle', `${assetsRoute}/circle_white.png`);

    // load pixel as base64 to avoid potential loading issue
    const pixelImage = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=';
    this.textures.once(Phaser.Loader.Events.ADD, () => this.add.image(1, 1, 'pixel'), this);
    this.textures.addBase64('pixel', pixelImage);

    Tilesets.find().forEach(tileset => this.load.image(tileset.fileId, `${filesRoute}/${tileset.fileId}`));

    const { frameHeight, frameWidth } = Meteor.settings.public.assets.character;
    Characters.find().forEach(character => {
      this.load.spritesheet(character._id, `${filesRoute}/${character.fileId}`, {
        frameWidth: frameWidth || 16,
        frameHeight: frameHeight || 32,
      });
    });
    this.loadAssetsAtRuntime(Assets.find().fetch());
  },

  create() {
    this.scene.add('LoadingScene', LoadingScene, true);
    this.scene.add('WorldScene', WorldScene, true);
    this.scene.add('UIScene', UIScene, true);
    this.scene.add('EditorScene', EditorScene, true);
    this.scene.moveAbove('WorldScene', 'EditorScene');
    this.scene.moveAbove('WorldScene', 'UIScene');
    this.scene.bringToTop('LoadingScene');

    this.loadCharacterAnimations(Characters.find().fetch());
  },

  loadCharacterAnimations(characters) {
    const { formats } = Meteor.settings.public.assets.character;
    characters.forEach(character => {
      if (!character.category) return;

      const { animations } = formats[`w-${character.width}`];
      Object.entries(animations).forEach(([animationName, animation]) => {
        Object.entries(animation).forEach(([key, direction]) => {
          this.anims.create({
            key: `${animationName}-${key}-${character._id}`,
            frames: this.anims.generateFrameNumbers(character._id, { frames: direction.frames }),
            frameRate: direction.frameRate,
            repeat: direction.repeat,
          });
        });
      });
    });
  },

  unloadCharacterAnimations(characters) {
    const { formats } = Meteor.settings.public.assets.character;
    characters.forEach(character => {
      if (!character.category) return;

      const { animations } = formats[`w-${character.width}`];
      Object.entries(animations).forEach(([animationName, animation]) => {
        Object.entries(animation).forEach(([key]) => {
          this.anims.remove(`${animationName}-${key}-${character._id}`);
        });
      });
    });
  },

  loadImagesAtRuntime(images, onComplete = () => {}) {
    let imageLoadedCount = 0;
    images.forEach(image => {
      const key = image.fileId || image.key;
      if (!key || this.textures.exists(key)) return;

      let { path } = image;
      if (!path) {
        if (!image.fileId) return;
        path = `${filesRoute}/${image.fileId}`;
      }

      if (image.frameWidth || image.frameHeight) {
        this.load.spritesheet(key, path, {
          frameWidth: image.frameWidth || 16,
          frameHeight: image.frameHeight || 32,
        });
      } else this.load.image(key, path);

      imageLoadedCount++;
    });

    if (!imageLoadedCount) onComplete(images);
    else {
      this.load.once(Phaser.Loader.Events.COMPLETE, () => onComplete(images));
      this.load.start();
    }
  },

  loadAssetsAtRuntime(assets, onComplete = () => {}) {
    let assetsLoadedCount = 0;
    assets.forEach(asset => {
      if (asset.type === 'spritesheet') this.load.multiatlas(asset._id, `${filesRoute}/${asset.fileId}`, filesRoute);
      assetsLoadedCount++;
    });

    if (assetsLoadedCount) {
      this.load.once(Phaser.Loader.Events.COMPLETE, () => onComplete(assets));
      this.load.start();
    }
  },
});
