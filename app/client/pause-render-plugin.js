import Phaser from 'phaser';

const { PRE_STEP, STEP, POST_STEP, PRE_RENDER, POST_RENDER, DESTROY } = Phaser.Core.Events;

const origStep = Phaser.Game.prototype.step;

let timeOut;

const step = (time, delta) => {
  const { game } = this;
  if (game.pendingDestroy) return game.runDestroy();

  const { events, renderer, renderingPaused } = game;

  events.emit(PRE_STEP, time, delta);
  events.emit(STEP, time, delta);
  game.scene.update(time, delta);
  events.emit(POST_STEP, time, delta);

  if (renderingPaused) return null;

  renderer.preRender();
  events.emit(PRE_RENDER, renderer, time, delta);
  game.scene.render(renderer);
  renderer.postRender();
  events.emit(POST_RENDER, renderer, time, delta);

  return null;
};

export default class PauseRenderPlugin extends Phaser.Plugins.BasePlugin {
  init(data) {
    this.autoPauseDelay = 2000;
    this.game.renderingPaused = data ? data.paused : false;
  }

  start() {
    this.game.events.once(DESTROY, this.destroy, this);
    this.game.step = step.bind(this);
    this.resume();
  }

  stop() {
    this.resume();
    this.game.step = origStep;
  }

  destroy() {
    this.stop();
    super.destroy();
  }

  pause() {
    this.game.renderingPaused = true;
  }

  resume() {
    this.game.renderingPaused = false;

    if (this.autoPauseDelay > 0) {
      clearTimeout(timeOut);
      timeOut = setTimeout(this.pause.bind(this), this.autoPauseDelay);
    }
  }

  isPaused() {
    return this.game.renderingPaused;
  }

  autoPauseAfterDelay(delay) {
    this.autoPauseDelay = delay;
  }
}
