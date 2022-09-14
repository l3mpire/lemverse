const characterInterpolationInterval = 200;

const networkEvents = Object.freeze({
  characterState: 'character:state',
});

const networkManager = {
  currentRoom: undefined,
  userStreamyId: undefined,
  throttledSendCharacterState: undefined,

  init() {
    this.userStreamyId = Streamy.id();
    this.throttledSendCharacterState = throttle(this._sendCharacterNewState.bind(this), characterInterpolationInterval, { leading: false });
    Streamy.on(networkEvents.characterState, this._onCharacterStateReceived.bind(this));
  },

  onSleep() {
    this.throttledSendCharacterState?.cancel();
  },

  update() {
    this.interpolateCharacterPositions();
  },

  joinRoom(roomId) {
    if (this.currentRoom) Streamy.leave(this.currentRoom.identifier);

    Streamy.join(roomId);
    this.currentRoom = Streamy.rooms(roomId);
    this.currentRoom.identifier = roomId;
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

  _onCharacterStateReceived(state) {
    if (state.__from === this.userStreamyId) return;

    const character = userManager.getCharacter(state.userId);
    if (!character) return;

    character.direction = state.direction;
    character.lwOriginX = character.x;
    character.lwOriginY = character.y;
    character.lwOriginDate = Date.now();
    character.lwTargetX = state.x;
    character.lwTargetY = state.y;
    character.lwTargetDate = character.lwOriginDate + characterInterpolationInterval;
  },

  sendCharacterNewState(state) {
    this.throttledSendCharacterState(state);
  },

  _sendCharacterNewState(state) {
    if (!state) return;

    this.currentRoom.emit(networkEvents.characterState, {
      x: state.x,
      y: state.y,
      direction: state.direction,
      userId: state.getData('userId'),
    });
  },

  saveCharacterState(state) {
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
