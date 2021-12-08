const Phaser = require('phaser');

const characterAnimations = {
  'w-384': {
    run: {
      up: {
        frames: [54, 55, 56, 57, 58, 59],
        frameRate: 10,
        repeat: -1,
      },
      down: {
        frames: [66, 67, 68, 69, 70, 71],
        frameRate: 10,
        repeat: -1,
      },
      left: {
        frames: [60, 61, 62, 63, 64, 65],
        frameRate: 10,
        repeat: -1,
      },
      right: {
        frames: [48, 49, 50, 51, 52, 53],
        frameRate: 10,
        repeat: -1,
      },
    },
  },
  'w-927': {
    run: {
      up: {
        frames: [120, 121, 122, 123, 124, 125],
        frameRate: 10,
        repeat: -1,
      },
      down: {
        frames: [132, 133, 134, 135, 136, 137],
        frameRate: 10,
        repeat: -1,
      },
      left: {
        frames: [126, 127, 128, 129, 130, 131],
        frameRate: 10,
        repeat: -1,
      },
      right: {
        frames: [114, 115, 116, 117, 118, 119],
        frameRate: 10,
        repeat: -1,
      },
    },
  },
};

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
    Tilesets.find().forEach(tileset => this.load.image(tileset.fileId, `/api/files/${tileset.fileId}`));

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

    this.loadCharacterAnimations(Characters.find().fetch());
  },

  loadCharacterAnimations(characters) {
    characters.forEach(character => {
      if (!character.category) return;

      const animations = characterAnimations[`w-${character.width}`];
      _.each(animations, animation => {
        _.each(animation, (direction, key) => {
          this.anims.create({
            key: `${character._id}${key}`,
            frames: this.anims.generateFrameNumbers(character.fileId, { frames: direction.frames }),
            frameRate: direction.frameRate,
            repeat: direction.repeat,
          });
        });
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

    if (!imageLoadedCount) this.loadCharacterAnimations(characters);
    else {
      this.load.on(`complete`, () => this.loadCharacterAnimations(characters));
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
