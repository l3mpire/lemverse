import Phaser from 'phaser';

import { allowPhaserMouseInputs } from '../helpers';
import { createConfettiEffect } from '../effects/particles';

const configuration = {
  colliderConfiguration: {
    radius: 15,
    offset: { x: -12, y: -30 },
  },
  colorStates: {
    default: 0xFFFFFF,
    pointerOver: 0xFFAAFF,
    unavailable: 0x888888,
    takeDamage: 0xFF0000,
  },
  interactionConfiguration: {
    hitArea: new Phaser.Geom.Circle(0, -13, 13),
    hitAreaCallback: Phaser.Geom.Circle.Contains,
    cursor: 'pointer',
  },
  sprite: {
    origin: { x: 0.5, y: 1 },
  },
  defaultDirection: 'down',
};

class Character extends Phaser.GameObjects.Container {
  constructor(scene, x = 0, y = 0, children = []) {
    super(scene, x, y, children);

    this.scene = scene;
    this.lwOriginX = x || 0;
    this.lwOriginY = y || 0;
    this.lwTargetX = x || 0;
    this.lwTargetY = y || 0;
    this.direction = configuration.defaultDirection;

    this.skinPartsContainer = this.scene.add.container(0, 0);
    this.skinPartsContainer.setScale(3);
    this.add(this.skinPartsContainer);

    this.shadow = createFakeShadow(this.scene, 0, 7, 0.55, 0.25);
    this.shadow.setOrigin(configuration.sprite.origin.x, configuration.sprite.origin.y);
    this.shadow.setDepth(-1);
    this.add(this.shadow);

    this._initMouseEvents();
    this._createStateIndicator();
    this.setDepthFromPosition();

    this.scene.add.existing(this);

    this.once('destroy', () => {
      game.scene.getScene('UIScene').destroyUserName(this.getData('userId'));
    }, this);
  }

  clearTint() {
    this.setTint(configuration.colorStates.default);
  }

  enablePhysics() {
    this.scene.physics.world.enableBody(this);
    this.body.setImmovable(false);
    this.body.setCollideWorldBounds(true);
    this.body.setCircle(configuration.colliderConfiguration.radius);
    this.body.setOffset(configuration.colliderConfiguration.offset.x, configuration.colliderConfiguration.offset.y);
  }

  flashColor(color) {
    this.setTint(color);

    this.scene.time.addEvent({
      delay: 350,
      callback() { this.clearTint(); },
      callbackScope: this,
    });
  }

  onDamage() {
    this.flashColor(configuration.colorStates.takeDamage);

    const confettiEffect = createConfettiEffect(this.scene, this.x, this.y);
    confettiEffect.emitters.list.forEach(emitter => emitter.explode());
  }

  playAnimation(animationName, direction, forceUpdate = false) {
    this.setAnimationPaused(false);

    const key = animationName + direction;
    if (this.lastAnimationDirection === key && !forceUpdate) return;
    this.lastAnimationDirection = key;
    this.direction = direction;

    this.skinPartsContainer.list.forEach(bodyPart => {
      bodyPart.anims.play(`${animationName}-${direction}-${bodyPart.texture.key}`, true);
    });
  }

  setAnimationPaused(value, forceUpdate = false) {
    if (value === this.animationPaused && !forceUpdate) return;
    this.animationPaused = value;

    if (value) {
      this.skinPartsContainer.list.forEach(skinPart => {
        skinPart.anims.pause();
        if (skinPart.anims.hasStarted) skinPart.anims.setProgress(0.5);
      });
    } else this.skinPartsContainer.list.forEach(skinPart => skinPart.anims.resume());

    delete this.lastAnimationDirection;
  }

  setDepthFromPosition() {
    this.setDepth(this.y);
  }

  setTint(color) {
    this.skinPartsContainer.list.forEach(skinPart => { skinPart.tint = color; });
  }

  setTintFromState() {
    const currentZone = zones.currentZone({ profile: { x: this.x, y: this.y } });
    const color = currentZone?.disableCommunications ? configuration.colorStates.unavailable : configuration.colorStates.default;
    this.setTint(color);
  }

  showMutedStateIndicator(value) {
    this.getByName('stateIndicator').visible = value;
  }

  setName(name, color) {
    game.scene.getScene('UIScene').updateUserName(this.getData('userId'), name, color);
  }

  toggleMouseInteraction(value = true) {
    if (value) this.skinPartsContainer.setInteractive(configuration.interactionConfiguration);
    else this.skinPartsContainer.disableInteractive();
  }

  updateSkin(skinElements) {
    const skinElementKeys = Object.keys(skinElements);

    // update or create sprite
    skinElementKeys.forEach(skinPartName => {
      if (charactersParts[skinPartName] === undefined) return;

      const texture = skinElements[skinPartName];
      if (!texture) return;

      const existingSkinPartSprite = this.skinPartsContainer.getByName(skinPartName);
      if (existingSkinPartSprite) {
        existingSkinPartSprite.setTexture(texture);
        return;
      }

      const skinSprite = this.scene.add.sprite(0, 0, texture);
      skinSprite.name = skinPartName;
      skinSprite.setOrigin(configuration.sprite.origin.x, configuration.sprite.origin.y);
      this.skinPartsContainer.add(skinSprite);
    });

    // remove old skin elements
    const existingParts = this.skinPartsContainer.list.map(skinPart => skinPart.name);
    const skinPartsToRemove = existingParts.filter(x => !skinElementKeys.includes(x) || !skinElements[x]);
    skinPartsToRemove.forEach(skinPart => this.skinPartsContainer.getByName(skinPart).destroy());
  }

  _initMouseEvents() {
    // open radial menu on pointer over
    this.skinPartsContainer.on('pointerover', () => {
      if (!allowPhaserMouseInputs()) return;

      this.setTint(configuration.colorStates.pointerOver);
      Session.set('menu', { userId: this.getData('userId') });
      Session.set('menu-position', relativePositionToCamera({ x: this.x, y: this.y }, this.scene.cameras.main));
    });

    // reset color
    this.skinPartsContainer.on('pointerout', () => this.setTintFromState('not set'));

    // close radial-menu on click
    this.skinPartsContainer.on('pointerup', () => {
      if (Session.get('menu')) Session.set('menu', undefined);
    });

    this.toggleMouseInteraction(true);
  }

  _createStateIndicator() {
    const muteIndicatorMic = this.scene.add.text(0, -40, '🎤', { font: '23px Sans Open' }).setDepth(99996).setOrigin(0.5, 1);
    const muteIndicatorCross = this.scene.add.text(0, -40, '🚫', { font: '23px Sans Open' }).setDepth(99995).setOrigin(0.5, 1).setScale(0.8);

    const userStateIndicator = this.scene.add.container(0, 0);
    userStateIndicator.name = 'stateIndicator';
    userStateIndicator.add([muteIndicatorMic, muteIndicatorCross]);
    this.add(userStateIndicator);
  }
}

export default Character;
