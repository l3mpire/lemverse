const Phaser = require('phaser');

const characterUIElementsOffset = -85;

UIScene = new Phaser.Class({
  Extends: Phaser.Scene,

  initialize: function UIScene() {
    Phaser.Scene.call(this, { key: 'UIScene', active: true });
  },

  init() {
    this.characterNamesObjects = {};
    this.preRenderMethod = this.preRender.bind(this);
    this.shutdownMethod = this.shutdown.bind(this);
    this.physics.disableUpdate();
    this.reactionPool = this.add.group({ classType: CharacterReaction });
    this.UIElementsOffset = characterUIElementsOffset;
  },

  create() {
    // cameras
    this.cameras.main.setViewport(0, 0, window.innerWidth, window.innerHeight);
    this.cameras.main.setRoundPixels(false);

    // plugins
    characterPopIns.init(this);
    userChatCircle.init(this);
    userVoiceRecorderAbility.init(this);

    // events
    this.events.on('prerender', this.preRenderMethod, this);
    this.events.once('shutdown', this.shutdownMethod, this);

    characterPopIns.onPopInEvent = e => {
      const { detail: data } = e;
      if (data.userId !== Meteor.userId()) return;

      if (data.type === 'load-level') levelManager.loadLevel(data.levelId);
    };
  },

  update(time, delta) {
    userVoiceRecorderAbility.update(delta);
  },

  preRender() {
    const worldMainCamera = game.scene.getScene('WorldScene').cameras.main;
    this.UIElementsOffset = characterUIElementsOffset * worldMainCamera.zoom;

    _.each(this.characterNamesObjects, text => {
      const { x, y } = this.relativePositionToCamera(text.player);
      text.setPosition(x, y + this.UIElementsOffset);
    });

    const { player } = userManager;
    if (!player) return;

    const relativePlayerPosition = this.relativePositionToCamera(player);
    characterPopIns.update();
    userChatCircle.update(relativePlayerPosition.x, relativePlayerPosition.y);
    userVoiceRecorderAbility.setPosition(relativePlayerPosition.x, relativePlayerPosition.y);
  },

  onLevelUnloaded() {
    characterPopIns.destroy();

    _.each(this.characterNamesObjects, text => text?.destroy());
    this.characterNamesObjects = {};

    _.each(userManager.players, player => {
      clearInterval(player.reactionHandler);
      delete player.reactionHandler;
    });
  },

  shutdown() {
    this.events.removeListener('prerender');
    this.events.off('prerender', this.preRenderMethod, this);

    userChatCircle.destroy();
    userVoiceRecorderAbility.destroy();
    this.onLevelUnloaded();
  },

  relativePositionToCamera(position) {
    const worldScene = game.scene.getScene('WorldScene');
    if (!worldScene) return { x: 0, y: 0 };

    const { zoom } = worldScene.cameras.main;
    const { x, y } = worldScene.cameras.main.worldView;

    return { x: (position.x - x) * zoom, y: (position.y - y) * zoom };
  },

  spawnReaction(player, content, animation, options) {
    const reaction = this.reactionPool.get(this);
    const position = this.relativePositionToCamera(player);
    const computedAnimation = reaction.prepare(content, position.x, position.y + this.UIElementsOffset, animation, options);

    this.tweens.add({
      targets: reaction,
      ...computedAnimation,
      onComplete: () => {
        this.reactionPool.killAndHide(reaction);
        this.tweens.killTweensOf(reaction);
      },
    });
  },

  updateUserName(userId, name, colorName) {
    let textInstance = this.characterNamesObjects[userId];

    if (!textInstance) {
      const player = userManager.players[userId];
      if (!player) return;

      textInstance = new CharacterNameText(this, player, name, colorName);
      this.characterNamesObjects[userId] = textInstance;
    } else if (textInstance) textInstance.setColorFromName(colorName).setText(name);
  },

  destroyUserName(userId) {
    this.characterNamesObjects[userId]?.destroy();
    delete this.characterNamesObjects[userId];
  },
});
