import Phaser from 'phaser';
import Character from './components/character';
import audioManager from './audio-manager';
import { guestSkin, textDirectionToVector, vectorToTextDirection } from './helpers';

const userInterpolationInterval = 200;
const defaultUserMediaColorError = '0xd21404';
const characterPopInOffset = { x: 0, y: -90 };
const characterInteractionDistance = { x: 32, y: 32 };
const characterCollider = {
  radius: 15,
  offset: { x: -12, y: -30 },
};
const characterAnimations = Object.freeze({
  idle: 'idle',
  run: 'run',
});
const timeBetweenReactionSound = 500;
const rubberBandingDistance = 160;

const messageReceived = {
  duration: 15000,
  style: 'tooltip with-arrow fade-in',
};

savePlayer = player => {
  Meteor.users.update(Meteor.userId(), {
    $set: {
      'profile.x': player.x,
      'profile.y': player.y,
      'profile.direction': player.direction,
    },
  });

  levelManager.markCullingAsDirty();
};

const throttledSavePlayer = throttle(savePlayer, userInterpolationInterval, { leading: false });

userManager = {
  entityFollowed: undefined,
  inputVector: new Phaser.Math.Vector2(),
  player: undefined,
  playerWasMoving: false,
  players: {},
  scene: undefined,
  canPlayReactionSound: true,
  userMediaStates: undefined,
  checkZones: false,

  init(scene) {
    this.entityFollowed = undefined;
    this.inputVector = new Phaser.Math.Vector2();
    this.player = undefined;
    this.players = {};
    this.scene = scene;
    this.userMediaStates = undefined;
  },

  destroy() {
    this.onSleep();
    this.player = undefined;
    this.players = {};
  },

  onSleep() {
    throttledSavePlayer.cancel();
    this.playerWasMoving = false;
    this.entityFollowed = undefined;
  },

  createUser(user) {
    if (this.players[user._id]) return null;

    const { x, y, guest, direction, name, nameColor } = user.profile;

    const character = new Character(this.scene, x, y);
    character.setData('userId', user._id);
    character.direction = direction;
    this.players[user._id] = character;

    if (guest) character.updateSkin(guestSkin()); // init with custom skin
    else character.setName(name, nameColor);

    window.setTimeout(() => this.updateUser(user), 0);

    return character;
  },

  playReaction(player, reaction) {
    clearInterval(player.reactionHandler);
    if (meet.api && this.canPlayReactionSound && audioManager.reactionsSounds[reaction]) {
      const otherUser = Meteor.users.findOne(player.userId);
      if (otherUser && zones.isUserInSameZone(Meteor.user(), otherUser)) audioManager.play(audioManager.reactionsSounds[reaction]);

      // avoid sound spamming
      this.canPlayReactionSound = false;
      setTimeout(() => { this.canPlayReactionSound = true; }, timeBetweenReactionSound);
    }

    const animation = reaction === '❤️' ? 'zigzag' : 'linearUpScaleDown';
    const UIScene = game.scene.getScene('UIScene');
    UIScene.spawnReaction(player, reaction, animation, { randomOffset: 10 });
    player.reactionHandler = setInterval(() => UIScene.spawnReaction(player, reaction, animation, { randomOffset: 10 }), 250);
  },

  _checkForSkinUpdate(character, user, oldUser) {
    const { guest } = user.profile;

    // check for skin updates
    let hasSkinUpdate = !oldUser && !guest;
    if (!hasSkinUpdate && !guest) {
      const charactersPartsKeys = Object.keys(charactersParts);
      charactersPartsKeys.forEach(characterPart => {
        if (user.profile[characterPart] === oldUser.profile[characterPart]) return;
        hasSkinUpdate = true;
      });
    }

    if (hasSkinUpdate) {
      character.updateSkin({
        body: user.profile.body,
        outfit: user.profile.outfit,
        eye: user.profile.eye,
        hair: user.profile.hair,
        accessory: user.profile.accessory,
      });
    }

    if (hasSkinUpdate || user.profile.direction !== oldUser?.profile.direction) {
      const wasAnimationPaused = character.animationPaused;
      character.playAnimation('run', character.direction || 'down', true);
      if (wasAnimationPaused) character.setAnimationPaused(true);
    }
  },

  updateUser(user, oldUser) {
    const player = this.players[user._id];
    if (!player) return;

    const { x, y, direction, reaction, shareAudio, guest, userMediaError, name, nameColor } = user.profile;

    // update character instance
    player.direction = direction;
    player.lwOriginX = player.x;
    player.lwOriginY = player.y;
    player.lwOriginDate = Date.now();
    player.lwTargetX = user.profile.x;
    player.lwTargetY = user.profile.y;
    player.lwTargetDate = player.lwOriginDate + userInterpolationInterval;
    player.showMutedStateIndicator(!guest && !shareAudio);

    // is account transformed from guest to user?
    if (!user.profile.guest && oldUser?.profile.guest) {
      player.toggleMouseInteraction(true);
      player.setName(name, nameColor);
    }

    // show reactions
    if (reaction) this.playReaction(player, reaction);
    else clearInterval(player.reactionHandler);

    // check for skin updates
    this._checkForSkinUpdate(player, user, oldUser);

    // update tint
    if (userMediaError !== oldUser?.profile.userMediaError) {
      if (userMediaError) player.setTint(defaultUserMediaColorError);
      else player.clearTint();
    }

    // update name
    if (!guest && (name !== oldUser?.profile.name || nameColor !== oldUser?.profile.nameColor)) {
      player.setName(name, nameColor);
      if (meet.api) meet.userName(name);
    }

    const userHasMoved = x !== oldUser?.profile.x || y !== oldUser?.profile.y;
    const loggedUser = Meteor.user();
    const shouldCheckDistance = userHasMoved && !guest;

    if (user._id === loggedUser._id) {
      // network rubber banding
      const dist = Math.hypot(player.x - x, player.y - y);
      if (dist >= rubberBandingDistance) {
        player.x = x;
        player.y = y;
      }

      // ensures this.character is assigned to the logged user
      if (player.getData('userId') !== loggedUser._id || !player.body) this.setAsMainPlayer(loggedUser._id);

      if (userHasMoved) this.checkZones = true;

      if (shouldCheckDistance) {
        const otherUsers = Meteor.users.find({ _id: { $ne: loggedUser._id }, 'status.online': true, 'profile.levelId': loggedUser.profile.levelId }).fetch();
        userProximitySensor.checkDistances(loggedUser, otherUsers);
      }
    } else {
      if (shouldCheckDistance) userProximitySensor.checkDistance(loggedUser, user);
      if (!guest && user.profile.shareScreen !== oldUser?.profile.shareScreen) peer.onStreamSettingsChanged(user);
    }
  },

  removeUser(user) {
    const character = this.players[user._id];
    if (!character) return;

    clearInterval(character.reactionHandler);
    delete character.reactionHandler;
    character.destroy();

    if (user._id === Meteor.userId()) this.unsetMainPlayer();

    delete this.players[user._id];
  },

  setAsMainPlayer(userId) {
    if (this.player) this.scene.physics.world.disableBody(this.player);

    const player = this.players[userId];
    if (!player) throw new Error(`Can't set as main player a non spawned character`);
    player.enablePhysics();

    // add character's physic body to layers
    levelManager.layers.forEach(layer => {
      if (layer.playerCollider) this.scene.physics.world.removeCollider(layer.playerCollider);
      layer.playerCollider = this.scene.physics.add.collider(player, layer);
    });

    // ask camera to follow the player
    this.scene.cameras.main.startFollow(player, true, 0.1, 0.1);

    if (Meteor.user().guest) hotkeys.setScope('guest');
    else hotkeys.setScope(scopes.player);

    this.player = player;
  },

  unsetMainPlayer(destroy = false) {
    if (!this.player) return;

    this.scene.physics.world.disableBody(this.player);
    if (destroy) this.player.destroy();

    levelManager.layers.forEach(layer => {
      if (layer.playerCollider) this.scene.physics.world.removeCollider(layer.playerCollider);
    });

    this.scene.cameras.main.stopFollow();
    hotkeys.setScope('guest');

    this.player = undefined;
  },

  interpolatePlayerPositions() {
    const now = Date.now();
    Object.values(this.players).forEach(player => {
      if (player === this.player) return;

      if (!player.lwTargetDate) {
        player.setAnimationPaused(true);
        return;
      }

      player.playAnimation(characterAnimations.run, player.direction);

      if (player.lwTargetDate <= now) {
        player.x = player.lwTargetX;
        player.y = player.lwTargetY;
        player.setDepthFromPosition();
        delete player.lwTargetDate;
        return;
      }

      const elapsedTime = ((now - player.lwOriginDate) / (player.lwTargetDate - player.lwOriginDate));
      player.x = player.lwOriginX + (player.lwTargetX - player.lwOriginX) * elapsedTime;
      player.y = player.lwOriginY + (player.lwTargetY - player.lwOriginY) * elapsedTime;
      player.setDepthFromPosition();
    });
  },

  update() {
    if (this.checkZones) {
      zones.checkDistances(this.player);
      this.checkZones = false;
    }

    this.interpolatePlayerPositions();
  },

  handleUserInputs(keys, nippleMoving, nippleData) {
    this.inputVector.set(0, 0);
    if (isModalOpen()) return false;

    if (nippleMoving) this.inputVector.set(nippleData.vector.x, -nippleData.vector.y);
    else {
      // Horizontal movement
      if (keys.left.isDown || keys.q.isDown || keys.a.isDown) this.inputVector.x = -1;
      else if (keys.right.isDown || keys.d.isDown) this.inputVector.x = 1;

      // Vertical movement
      if (keys.up.isDown || keys.z.isDown || keys.w.isDown) this.inputVector.y = -1;
      else if (keys.down.isDown || keys.s.isDown) this.inputVector.y = 1;
    }

    return this.inputVector.x !== 0 || this.inputVector.y !== 0;
  },

  postUpdate(time, delta) {
    if (!this.player) return;

    const { keys, nippleMoving, nippleData } = this.scene;
    let speed = keys.shift.isDown ? Meteor.settings.public.character.runSpeed : Meteor.settings.public.character.walkSpeed;

    this.player.body.setVelocity(0);

    const inputPressed = this.handleUserInputs(keys, nippleMoving, nippleData);
    if (inputPressed) {
      this.player.body.setVelocity(this.inputVector.x, this.inputVector.y);
      this.follow(undefined); // interrupts the follow action
      Session.set('menu', false);
    } else if (this.entityFollowed) {
      const minimumDistance = Meteor.settings.public.character.sensorNearDistance / 2;
      const diff = { x: this.entityFollowed.x - this.player.x, y: this.entityFollowed.y - this.player.y };

      const distance = Math.hypot(diff.x, diff.y);
      if (distance >= minimumDistance) {
        const { sensorNearDistance, runSpeed, walkSpeed } = Meteor.settings.public.character;
        speed = distance > sensorNearDistance ? runSpeed : walkSpeed;
        this.player.body.setVelocity(diff.x, diff.y);
      }
    }

    this.player.body.velocity.normalize().scale(speed);
    this.player.setDepthFromPosition();

    const direction = vectorToTextDirection(this.player.body.velocity);
    const running = keys.shift.isDown && direction;
    if (!peer.hasActiveStreams()) peer.enableSensor(!running);

    if (direction) this.player.playAnimation(characterAnimations.run, direction);
    else this.player.setAnimationPaused(true);

    const moving = !!direction;
    if (moving || this.playerWasMoving) {
      this.scene.physics.world.update(time, delta);
      throttledSavePlayer(this.player);
    }
    this.playerWasMoving = moving;
  },

  teleportMainUser(x, y) {
    this.player.x = x;
    this.player.y = y;
    savePlayer(this.player);
  },

  interact() {
    entityManager.interactWithNearestEntity();
  },

  getTilesUnderPlayer(player, layers = []) {
    return this.getTilesRelativeToPlayer(player, { x: 0, y: 0 }, layers);
  },

  getTilesInFrontOfPlayer(player, layers = []) {
    if (!player) return undefined;

    const positionOffset = { x: 0, y: 0 };
    if (player.direction) {
      const directionVector = textDirectionToVector(player.direction);
      positionOffset.x = directionVector[0] * characterInteractionDistance.x;
      positionOffset.y = directionVector[1] * characterInteractionDistance.y;
    }

    return this.getTilesRelativeToPlayer(player, positionOffset, layers);
  },

  getPositionInFrontOfPlayer(player, distance = undefined) {
    const directionVector = textDirectionToVector(player.direction);

    return {
      x: player.x + directionVector[0] * (distance || characterInteractionDistance.x),
      y: player.y + characterCollider.offset.y + directionVector[1] * (distance || characterInteractionDistance.y),
    };
  },

  getTilesRelativeToPlayer(player, offset, layers = []) {
    if (!player) return undefined;

    const { map } = levelManager;
    const tileX = map.worldToTileX(player.x + offset.x);
    const tileY = map.worldToTileY(player.y + offset.y);

    const tiles = [];
    if (layers.length === 0) {
      for (let l = map.layers.length; l >= 0; l--) {
        const tile = map.getTileAt(tileX, tileY, false, l);
        if (tile) tiles.push(tile);
      }
    } else {
      layers.forEach(l => {
        const tile = map.getTileAt(tileX, tileY, false, l);
        if (tile) tiles.push(tile);
      });
    }

    return tiles;
  },

  follow(user) {
    if (!user || (user && this.entityFollowed)) {
      if (this.entityFollowed) {
        lp.notif.success(`You no longer follow anyone`);
        peer.unlockCall(this.entityFollowed.userId, true);
      }

      this.entityFollowed = undefined;

      return;
    }

    this.entityFollowed = this.players[user._id];
    lp.notif.success(`You are following ${user.profile.name}`);
    peer.lockCall(user._id, true);
  },

  setUserInDoNotDisturbMode(enable) {
    if (!this.player) return;

    if (enable) {
      this.saveMediaStates();
      setTimeout(() => Meteor.users.update(Meteor.userId(), { $set: {
        'profile.shareVideo': false,
        'profile.shareAudio': false,
        'profile.shareScreen': false,
      } }), 0);
      peer.disable();
    } else {
      peer.enable();
      this.clearMediaStates();
    }

    this.follow(undefined); // interrupts the follow action
    this.player.setTintFromState();
    audioManager.enabled = !enable;
  },

  saveMediaStates() {
    const { shareAudio, shareVideo } = Meteor.user().profile;
    this.userMediaStates = { shareAudio, shareVideo };
  },

  clearMediaStates() {
    if (this.userMediaStates) {
      const { shareAudio, shareVideo } = this.userMediaStates;
      Meteor.users.update(Meteor.userId(), { $set: { 'profile.shareAudio': shareAudio, 'profile.shareVideo': shareVideo } });
    }

    this.userMediaStates = undefined;
  },

  onPeerDataReceived(dataReceived) {
    const { emitter: emitterUserId, type, data } = dataReceived;

    const userEmitter = Meteor.users.findOne(emitterUserId);
    if (!userEmitter) return;

    const meta = {};

    if (type === 'audio') audioManager.playFromChunks(data);
    else if (type === 'followed') {
      peer.lockCall(emitterUserId);
      lp.notif.warning(`${userEmitter.profile.name} is following you 👀`);
    } else if (type === 'unfollowed') {
      peer.unlockCall(emitterUserId);

      if (this.entityFollowed?.userId === emitterUserId) this.follow(undefined);
      else lp.notif.warning(`${userEmitter.profile.name} has finally stopped following you 🎉`);
    } else if (type === 'text') {
      const emitterPlayer = userManager.players[emitterUserId];
      if (!emitterPlayer) return;

      const { zoneMuted } = Meteor.user();
      const userEmitterZoneId = zones.currentZone(userEmitter)?._id;
      if (!zoneMuted || !zoneMuted[userEmitterZoneId]) audioManager.play('text-sound.wav', 0.5);

      const popInIdentifier = `${emitterUserId}-pop-in`;
      meta['pop-in'] = characterPopIns.createOrUpdate(
        popInIdentifier,
        data.content,
        { target: emitterPlayer, className: messageReceived.style, autoClose: messageReceived.duration, parseURL: true, classList: 'copy', offset: characterPopInOffset },
      );

      if (emitterUserId !== Meteor.userId()) notify(userEmitter, `${userEmitter.profile.name}: ${data}`);
    }

    window.dispatchEvent(new CustomEvent(eventTypes.onPeerDataReceived, { detail: { data: dataReceived, userEmitter, meta } }));
  },
};
