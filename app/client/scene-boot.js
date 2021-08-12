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
    this.scene.add('LoadingScene', LoadingScene, true);
    this.scene.add('WorldScene', WorldScene);
    this.scene.launch('WorldScene');
    this.scene.bringToTop('LoadingScene');
  },
});
