const Phaser = require('phaser');

const extractLevelIdFromURL = () => {
  const levelId = FlowRouter.getParam('levelId');
  if (!levelId) return undefined;
  return `lvl_${levelId}`;
};

BootScene = new Phaser.Class({
  Extends: Phaser.Scene,

  initialize: function BootScene() {
    Phaser.Scene.call(this, { key: 'BootScene' });
  },

  preload() {
    // load the resources here
    Tilesets.find().forEach(tileset => {
      this.load.image(tileset.fileId, `/api/files/${tileset.fileId}`);
    });

    Characters.find().forEach(character => {
      this.load.spritesheet(character.fileId, `/api/files/${character.fileId}`, { frameWidth: 16, frameHeight: 32 });
    });
  },

  create() {
    const levelId = extractLevelIdFromURL();
    if (levelId) Meteor.call('teleportUserInLevel', levelId);

    this.scene.add('LoadingScene', LoadingScene, true);
    this.scene.add('WorldScene', WorldScene, true);
    this.scene.add('EditorScene', EditorScene, true);
    this.scene.bringToTop('LoadingScene');

    this.loadAnimations();
  },

  loadAnimations() {
    // load animations
    Characters.find({}).forEach(character => {
      this.anims.create({
        key: `${character._id}right`,
        frames: this.anims.generateFrameNumbers(character.fileId, { frames: [48, 49, 50, 51, 52, 53] }),
        frameRate: 10,
        repeat: -1,
      });
      this.anims.create({
        key: `${character._id}up`,
        frames: this.anims.generateFrameNumbers(character.fileId, { frames: [54, 55, 56, 57, 58, 59] }),
        frameRate: 10,
        repeat: -1,
      });
      this.anims.create({
        key: `${character._id}left`,
        frames: this.anims.generateFrameNumbers(character.fileId, { frames: [60, 61, 62, 63, 64, 65] }),
        frameRate: 10,
        repeat: -1,
      });
      this.anims.create({
        key: `${character._id}down`,
        frames: this.anims.generateFrameNumbers(character.fileId, { frames: [66, 67, 68, 69, 70, 71] }),
        frameRate: 10,
        repeat: -1,
      });
    });
  },

  loadCharactersAtRuntime(characters) {
    let imageLoadedCount = 0;
    _.each(characters, character => {
      if (this.textures.exists(character.fileId)) return;

      imageLoadedCount++;
      this.load.spritesheet(character.fileId, `/api/files/${character.fileId}`, { frameWidth: 16, frameHeight: 32 });
    });

    const addCharacters = () => {
      const animExist = (character, orientation) => this.anims[`${character._id}${character.category}${orientation}`];
      _.each(characters, character => {
        if (!character.category) return;

        if (!animExist('right')) {
          this.anims.create({
            key: `${character._id}right`,
            frames: this.anims.generateFrameNumbers(character.fileId, { frames: [48, 49, 50, 51, 52, 53] }),
            frameRate: 10,
            repeat: -1,
          });
        }
        if (!animExist('up')) {
          this.anims.create({
            key: `${character._id}up`,
            frames: this.anims.generateFrameNumbers(character.fileId, { frames: [54, 55, 56, 57, 58, 59] }),
            frameRate: 10,
            repeat: -1,
          });
        }
        if (!animExist('left')) {
          this.anims.create({
            key: `${character._id}left`,
            frames: this.anims.generateFrameNumbers(character.fileId, { frames: [60, 61, 62, 63, 64, 65] }),
            frameRate: 10,
            repeat: -1,
          });
        }
        if (!animExist('down')) {
          this.anims.create({
            key: `${character._id}down`,
            frames: this.anims.generateFrameNumbers(character.fileId, { frames: [66, 67, 68, 69, 70, 71] }),
            frameRate: 10,
            repeat: -1,
          });
        }
      });
    };

    if (!imageLoadedCount) addCharacters();
    else {
      this.load.on(`complete`, () => addCharacters());
      this.load.start();
    }
  },

  loadTilesetsAtRuntime(tilesets, onComplete) {
    let imageLoadedCount = 0;
    _.each(tilesets, tileset => {
      if (this.textures.exists(tileset.fileId)) return;

      imageLoadedCount++;
      this.load.image(tileset.fileId, `/api/files/${tileset.fileId}`);
    });

    if (!imageLoadedCount) onComplete(tilesets);
    else {
      this.load.on(`complete`, () => onComplete(tilesets));
      this.load.start();
    }
  },
});
