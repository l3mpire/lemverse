import Phaser from 'phaser';
import CharacterNameText from '../components/character-name-text';

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
    this.updateViewportMethod = mode => updateViewport(this, mode);
    this.reactionPool = this.add.group({ classType: CharacterReaction });
    this.UIElementsOffset = characterUIElementsOffset;
    this.physics.disableUpdate();
    this.scene.setVisible(false);
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
    this.scale.on('resize', this.updateViewportMethod, this);

    characterPopIns.onPopInEvent = e => {
      const { detail: data } = e;
      if (data.userId !== Meteor.userId()) return;

      if (data.type === 'load-level') levelManager.loadLevel(data.levelId);
    };
  },

  update(_time, delta) {
    userVoiceRecorderAbility.update(delta);
  },

  preRender() {
    const worldMainCamera = game.scene.getScene('WorldScene').cameras.main;
    this.UIElementsOffset = characterUIElementsOffset * worldMainCamera.zoom;

    Object.values(this.characterNamesObjects).forEach(text => {
      const { x, y } = relativePositionToCamera(text.player, worldMainCamera);
      text.setPosition(x, y + this.UIElementsOffset);
    });

    const controlledCharacter = userManager.getControlledCharacter();
    if (!controlledCharacter) return;

    const relativePlayerPosition = relativePositionToCamera(controlledCharacter, worldMainCamera);
    characterPopIns.update(worldMainCamera);
    userChatCircle.visible(peer.isEnabled() && !Session.get('menu') && userProximitySensor.nearUsersCount() > 0);
    userChatCircle.update(relativePlayerPosition.x, relativePlayerPosition.y, worldMainCamera);
    userVoiceRecorderAbility.setPosition(relativePlayerPosition.x, relativePlayerPosition.y, worldMainCamera);
  },

  onLevelLoaded() {
    this.scene.setVisible(true);
  },

  onLevelUnloaded() {
    this.scene.setVisible(false);
    characterPopIns.destroy();

    _.each(this.characterNamesObjects, text => text?.destroy());
    this.characterNamesObjects = {};

    _.each(userManager.characters, character => {
      clearInterval(character.reactionHandler);
      delete character.reactionHandler;
    });
  },

  shutdown() {
    this.events.removeListener('prerender');
    this.events.off('prerender', this.preRenderMethod, this);
    this.scale.off('resize', this.updateViewportMethod);

    userChatCircle.destroy();
    userVoiceRecorderAbility.destroy();
    this.onLevelUnloaded();
  },

  spawnReaction(player, content, animation, options) {
    const worldMainCamera = game.scene.getScene('WorldScene').cameras.main;
    const reaction = this.reactionPool.get(this);
    const position = relativePositionToCamera(player, worldMainCamera);
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
      const player = userManager.getCharacter(userId);
      if (!player) return;

      textInstance = new CharacterNameText(this, name, colorName);
      textInstance.player = player;
      this.characterNamesObjects[userId] = textInstance;
    } else if (textInstance) textInstance.setTintFromName(colorName).setText(name);
  },

  destroyUserName(userId) {
    this.characterNamesObjects[userId]?.destroy();
    delete this.characterNamesObjects[userId];
  },
});
