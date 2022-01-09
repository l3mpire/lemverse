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
    Tilesets.find().forEach(tileset => this.load.image(tileset.fileId, `/api/files/${tileset.fileId}`));

    const { frameHeight, frameWidth } = Meteor.settings.public.assets.character;
    Characters.find().forEach(character => {
      this.load.spritesheet(character.fileId, `/api/files/${character.fileId}`, {
        frameWidth: frameWidth || 16,
        frameHeight: frameHeight || 32,
      });
    });
  },

  create() {
    const levelId = extractLevelIdFromURL();
    if (levelId) Meteor.call('teleportUserInLevel', levelId);

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
      _.each(animations, (animation, animationName) => {
        _.each(animation, (direction, key) => {
          this.anims.create({
            key: `${animationName}-${key}-${character._id}`,
            frames: this.anims.generateFrameNumbers(character.fileId, { frames: direction.frames }),
            frameRate: direction.frameRate,
            repeat: direction.repeat,
          });
        });
      });
    });
  },

  loadCharactersAtRuntime(characters) {
    const { frameHeight, frameWidth } = Meteor.settings.public.assets.character;

    let imageLoadedCount = 0;
    _.each(characters, character => {
      if (this.textures.exists(character.fileId)) return;
      imageLoadedCount++;
      this.load.spritesheet(character.fileId, `/api/files/${character.fileId}`, {
        frameWidth: frameWidth || 16,
        frameHeight: frameHeight || 32,
      });
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
