const Phaser = require('phaser');

BootScene = new Phaser.Class({
  Extends: Phaser.Scene,

  initialize: function BootScene() {
    Phaser.Scene.call(this, { key: 'BootScene' });
  },

  preload() {
    // load the resources here
    Tilesets.find().forEach(tileset => {
      this.load.image(tileset._id, `/api/files/${tileset.fileId}`);
    });

    Meteor.settings.public.characterNames.forEach(characterName => {
      this.load.spritesheet(characterName, `/assets/lemverse/characters/${characterName}_run_16x16.png`, { frameWidth: 16, frameHeight: 32 });
    });

    Characters.find().forEach(character => {
      this.load.spritesheet(character._id, `/api/files/${character.fileId}`, { frameWidth: 16, frameHeight: 32 });
    });
  },

  create() {
    this.loadAnimations();
    this.scene.add('LoadingScene', LoadingScene, true);
    this.scene.add('WorldScene', WorldScene);
    this.scene.launch('WorldScene');
    this.scene.bringToTop('LoadingScene');
  },

  loadAnimations() {
    // load animations
    Characters.find({}).forEach(character => {
      this.anims.create({
        key: `${character._id}right`,
        frames: this.anims.generateFrameNumbers(character._id, { frames: [48, 49, 50, 51, 52, 53] }),
        frameRate: 10,
        repeat: -1,
      });
      this.anims.create({
        key: `${character._id}up`,
        frames: this.anims.generateFrameNumbers(character._id, { frames: [54, 55, 56, 57, 58, 59] }),
        frameRate: 10,
        repeat: -1,
      });
      this.anims.create({
        key: `${character._id}left`,
        frames: this.anims.generateFrameNumbers(character._id, { frames: [60, 61, 62, 63, 64, 65] }),
        frameRate: 10,
        repeat: -1,
      });
      this.anims.create({
        key: `${character._id}down`,
        frames: this.anims.generateFrameNumbers(character._id, { frames: [66, 67, 68, 69, 70, 71] }),
        frameRate: 10,
        repeat: -1,
      });
    });

    // load default animations
    Meteor.settings.public.characterNames.forEach(characterName => {
      this.anims.create({
        key: `${characterName}right`,
        frames: this.anims.generateFrameNumbers(characterName, { frames: [0, 1, 2, 3, 4, 5] }),
        frameRate: 10,
        repeat: -1,
      });
      this.anims.create({
        key: `${characterName}up`,
        frames: this.anims.generateFrameNumbers(characterName, { frames: [6, 7, 8, 9, 10, 11] }),
        frameRate: 10,
        repeat: -1,
      });
      this.anims.create({
        key: `${characterName}left`,
        frames: this.anims.generateFrameNumbers(characterName, { frames: [12, 13, 14, 15, 16, 17] }),
        frameRate: 10,
        repeat: -1,
      });
      this.anims.create({
        key: `${characterName}down`,
        frames: this.anims.generateFrameNumbers(characterName, { frames: [18, 19, 20, 21, 22, 23] }),
        frameRate: 10,
        repeat: -1,
      });
    });
  },
});
