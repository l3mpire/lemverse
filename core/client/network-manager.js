const userInterpolationInterval = 200;

const networkManager = {
  throttledSendPlayerState: undefined,
  lastUserUpdate: new Date(),

  init() {
    this.throttledSendPlayerState = throttle(this._sendPlayerNewState.bind(this), userInterpolationInterval, { leading: false });
  },

  onSleep() {
    this.throttledSendPlayerState?.cancel();
  },

  update() {
    this.interpolateCharacterPositions();
  },

  /**
   * Basic interpolation:
   * - No rubber banding
   * - No extrapolation
   *
   * Later we could add multiple states to predict positions, ….
   * But since we work in tcp and on a simple simulation it doesn't seem necessary to me right now.
   */
  interpolateCharacterPositions() {
    const now = Date.now();
    const controlledCharacter = userManager.getControlledCharacter();

    Object.values(userManager.characters).forEach(character => {
      if (character === controlledCharacter) return;

      if (!character.lwTargetDate) {
        character.setAnimationPaused(true);
        return;
      }

      character.playAnimation('run', character.direction);

      if (character.lwTargetDate <= now) {
        character.x = character.lwTargetX;
        character.y = character.lwTargetY;
        character.setDepthFromPosition();
        delete character.lwTargetDate;
        return;
      }

      const elapsedTime = (now - character.lwOriginDate) / (character.lwTargetDate - character.lwOriginDate);
      character.x = character.lwOriginX + (character.lwTargetX - character.lwOriginX) * elapsedTime;
      character.y = character.lwOriginY + (character.lwTargetY - character.lwOriginY) * elapsedTime;
      character.setDepthFromPosition();
    });
  },

  onCharacterStateReceived(state) {
    const character = userManager.getCharacter(state.userId);
    if (!character) return;

    if (state.direction) character.direction = state.direction;
    character.lwOriginX = character.x;
    character.lwOriginY = character.y;
    character.lwOriginDate = Date.now();
    character.lwTargetX = state.x;
    character.lwTargetY = state.y;
    character.lwTargetDate = character.lwOriginDate + userInterpolationInterval;

    this.lastUserUpdate = character.lwOriginDate;
  },

  // A simple wrapper: later we will use something else than peerjs
  async sendData(userIds, data) {
    return peer.sendData(userIds, data);
  },

  sendPlayerNewState(state) {
    this.throttledSendPlayerState(state);
  },

  _sendPlayerNewState(state) {
    if (!state) return;

    // No need to check that the userId really belongs to the user, Meteor does the check during the update
    Meteor.users.update(state.getData('userId'), {
      $set: {
        'profile.x': state.x,
        'profile.y': state.y,
        'profile.direction': state.direction,
      },
    });
  },
};

export default networkManager;
