import Phaser from 'phaser';
import { getSimulationSize, filesURL } from '../helpers';

LoadingScene = new Phaser.Class({
  Extends: Phaser.Scene,

  initialize: function LoadingScene() {
    Phaser.Scene.call(this, { key: 'LoadingScene' });
  },

  init() {
    this.backgroundSpeed = 0.05;
    this.fadeInDuration = 150;
    this.fadeOutDuration = 500;
  },

  preload() {
    const { logoURL } = Meteor.settings.public.lp;

    this.load.setBaseURL('/');
    this.load.image('logo', logoURL ? `${filesURL}logo` : null || 'lemverse.png');
    this.load.image('scene-loader-background', 'assets/images/scene-loader-background.png');
  },

  create(visible = true) {
    if (this.container) return;

    const { width, height } = getSimulationSize();

    this.background = this.add.rectangle(0, 0, width, height, 0x222222);
    this.background.setOrigin(0, 0);
    this.background_characters = this.add.tileSprite(0, 0, width, height, 'scene-loader-background');
    this.background_characters.setOrigin(0, 0);
    this.background_characters.setAlpha(0.1);

    this.logo = this.add.sprite(0, -60, 'logo');
    this.text = this.add.text(0, 45, `Loading ${Meteor.settings.public.lp.product}…`, { font: '20px Verdana' }).setDepth(99997).setOrigin(0.5, 1);
    this.container = this.add.container(0, 0);
    this.container.add([this.background, this.background_characters, this.logo, this.text]);
    this.container.visible = visible;

    this.refreshSizeAndPosition();
  },

  refreshSizeAndPosition() {
    const { width, height } = getSimulationSize();

    this.background.setSize(width, height);
    this.background_characters.setSize(width, height);
    this.logo.setPosition(width / 2.0, height / 2.0 - 60);
    this.text.setPosition(width / 2.0, height / 2.0 + 45);
  },

  hide(callback = undefined) {
    if (!Session.get('loading')) return;
    if (!this.container) this.create(false);

    this.tweens.add({
      targets: this.container,
      alpha: { start: 1, from: 1, to: 0, duration: this.fadeOutDuration, ease: 'Linear' },
      onComplete: () => {
        Session.set('loading', false);
        this.scene.sleep();
        if (callback) callback();
      },
    });
  },

  show(callback = undefined) {
    if (Session.get('loading')) return;

    Session.set('loading', true);
    this.refreshSizeAndPosition();
    this.scene.wake();
    this.tweens.add({
      targets: this.container,
      alpha: { start: 0, from: 0, to: 1, duration: this.fadeInDuration, ease: 'Linear' },
      onComplete: () => {
        if (callback) callback();
      },
    });
  },

  setText(levelName) {
    if (!levelName) levelName = 'level';
    this.text?.setText(`Loading ${levelName}…`);
  },

  update(_time, delta) {
    this.background_characters.tilePositionX += this.backgroundSpeed * delta;
    this.background_characters.tilePositionY += this.backgroundSpeed * delta;
  },
});
