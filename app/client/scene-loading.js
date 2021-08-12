const Phaser = require('phaser');

LoadingScene = new Phaser.Class({
  Extends: Phaser.Scene,

  initialize: function LoadingScene() {
    Phaser.Scene.call(this, { key: 'LoadingScene' });
  },

  init() {
    this.fadeInDuration = 150;
    this.fadeOutDuration = 500;
  },

  preload() {
    this.load.image('logo', 'lemverse.png');
  },

  create(visible = true) {
    if (this.container) return;
    this.background = this.add.graphics({
      x: 0,
      y: 0,
      fillStyle: {
        color: 0x000000,
        alpha: 1,
      },
    });

    this.background.fillRect(-window.innerWidth / 2, -window.innerHeight / 2, window.innerWidth, window.innerHeight);
    this.logo = this.add.sprite(0, -60, 'logo');
    this.text = this.add.text(0, 45, 'Loading lemverse…', { font: '20px Verdana' }).setDepth(99997).setOrigin(0.5, 1);
    this.container = this.add.container(window.innerWidth / 2, window.innerHeight / 2);
    this.container.add([this.background, this.logo, this.text]);
    this.container.visible = visible;
  },

  hide(callback) {
    if (!this.container) this.create(false);

    this.tweens.add({
      targets: this.container,
      alpha: { start: 1, from: 1, to: 0, duration: this.fadeOutDuration, ease: 'Linear' },
      onComplete: () => {
        Session.set('loading', false);
        if (callback) callback();
      },
    });
  },

  show() {
    Session.set('loading', true);
    this.tweens.add({
      targets: this.container,
      alpha: { start: 0, from: 0, to: 1, duration: this.fadeInDuration, ease: 'Linear' },
    });
  },

  setText(levelName) {
    if (!levelName) levelName = 'level';
    this.text?.setText(`Loading ${levelName}…`);
  },
});
