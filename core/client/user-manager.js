import Phaser from 'phaser';
import Character from './components/character';
import audioManager from './audio-manager';
import networkManager from './network-manager';
import meetingRoom from './meeting-room';
import { textDirectionToVector, vectorToTextDirection } from './helpers';
import { guestAllowed, permissionTypes } from '../lib/misc';

const defaultUserMediaColorError = '0xd21404';
const characterPopInOffset = { x: 0, y: -90 };
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

userManager = {
  inputVector: undefined,
  characters: {},
  controlledCharacter: undefined,
  scene: undefined,
  canPlayReactionSound: true,
  userMediaStates: undefined,
  checkZones: false,

  init(scene) {
    this.inputVector = Phaser.Math.Vector2.ZERO;
    this.controlledCharacter = undefined;
    this.characters = {};
    this.scene = scene;
    this.userMediaStates = undefined;
  },

  destroy() {
    this.characters = {};
    this.controlledCharacter = undefined;
  },

  onDocumentAdded(user) {
    if (this.characters[user._id]) return null;

    const { x, y, guest, direction } = user.profile;

    const character = new Character(this.scene, x, y);
    character.setData('userId', user._id);
    character.direction = direction;
    this.characters[user._id] = character;

    if (guest) {
      character.playAnimation(characterAnimations.run, 'down', true);
    }

    window.setTimeout(() => this.onDocumentUpdated(user), 0);

    return character;
  },

  playReaction(player, reaction) {
    clearInterval(player.reactionHandler);

    if (this.canPlayReactionSound && meetingRoom.getMeetingRoomService()?.isOpen() && audioManager.reactionsSounds[reaction]) {
      const otherUser = Meteor.users.findOne(player.userId);
      if (otherUser && zoneManager.isUserInSameZone(Meteor.user(), otherUser)) audioManager.play(audioManager.reactionsSounds[reaction]);

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
    // check for skin updates
    const hasSkinUpdate = !oldUser || Object.keys(charactersParts).some(part => user.profile[part] !== oldUser.profile[part]);
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

  onDocumentUpdated(user, oldUser) {
    const character = this.characters[user._id];
    if (!character) return;

    const { x, y, direction, reaction, shareAudio, userMediaError, name, baseline, nameColor } = user.profile;
    const showMutedIndicator = user.profile.guest ? guestAllowed(permissionTypes.talkToUsers) : !shareAudio;

    // update character instance
    networkManager.onCharacterStateReceived({ userId: user._id, x, y, direction });
    character.showMutedStateIndicator(showMutedIndicator);

    // is account transformed from guest to user?
    if (!user.profile.guest && oldUser?.profile.guest) {
      character.toggleMouseInteraction(true);
      character.setName(name, baseline, nameColor);
      if (user.guildId) {
        const guildIcon = Guilds.findOne({ _id: user.guildId })?.icon;
        if (guildIcon) character.setIcon(guildIcon);
      }
    }

    // show reactions
    if (reaction) this.playReaction(character, reaction);
    else clearInterval(character.reactionHandler);

    // check for skin updates
    this._checkForSkinUpdate(character, user, oldUser);

    // update tint
    if (userMediaError !== oldUser?.profile.userMediaError) {
      if (userMediaError) character.setTint(defaultUserMediaColorError);
      else character.clearTint();
    }

    // update name
    const nameUpdated = (name !== oldUser?.profile.name || baseline !== oldUser?.profile.baseline || nameColor !== oldUser?.profile.nameColor);
    if (nameUpdated) character.setName(name || 'Guest', baseline, nameColor);

    // update guild icon
    if (user.guildId !== oldUser?.guildId) character.setIcon(Guilds.findOne({ _id: user.guildId })?.icon);

    const userHasMoved = x !== oldUser?.profile.x || y !== oldUser?.profile.y;
    const loggedUser = Meteor.user();
    const shouldCheckDistance = userHasMoved;

    if (user._id === loggedUser._id) {
      // network rubber banding
      const dist = Math.hypot(character.x - x, character.y - y);
      if (dist >= rubberBandingDistance) {
        character.x = x;
        character.y = y;
      }

      // ensures this.character is assigned to the logged user
      if (character.getData('userId') !== loggedUser._id || !character.body) this.setAsControlled(loggedUser._id);

      if (userHasMoved) this.checkZones = true;

      const meetingRoomService = meetingRoom.getMeetingRoomService();
      if (nameUpdated && meetingRoomService?.isOpen()) meetingRoomService.userName(name);

      if (shouldCheckDistance) {
        const otherUsers = Meteor.users.find({ _id: { $ne: loggedUser._id }, 'status.online': true, 'profile.levelId': loggedUser.profile.levelId }).fetch();
        userProximitySensor.checkDistances(loggedUser, otherUsers);
      }
    } else {
      if (shouldCheckDistance) userProximitySensor.checkDistance(loggedUser, user);
      if (user.profile.shareScreen !== oldUser?.profile.shareScreen) peer.onStreamSettingsChanged(user);
    }
  },

  onDocumentRemoved(user) {
    const character = this.characters[user._id];
    if (!character) return;

    if (user._id === Meteor.userId()) this.setAsControlled();

    clearInterval(character.reactionHandler);
    delete character.reactionHandler;
    character.destroy();

    delete this.characters[user._id];
  },

  setAsControlled(userId) {
    // reset
    this.controlledCharacter?.enablePhysics(false);
    this.controlledCharacter?.enableEffects(false);
    this.controlledCharacter = undefined;

    if (this.scene) {
      this.scene.cameras.main.stopFollow();
      levelManager.layers.forEach(layer => {
        if (layer.playerCollider) this.scene.physics.world.removeCollider(layer.playerCollider);
      });
    }

    if (userId) {
      const character = this.characters[userId];
      if (!character) throw new Error(`Can't set as main player a non spawned character`);
      character.enablePhysics();

      levelManager.layers.forEach(layer => {
        layer.playerCollider = this.scene.physics.add.collider(character, layer);
      });

      this.scene.cameras.main.startFollow(character, true, 0.1, 0.1);

      hotkeys.setScope(scopes.player);
      this.controlledCharacter = character;
      this.controlledCharacter.enableEffects(true);
    }
  },

  update() {
    if (this.checkZones) {
      zoneManager.checkDistances(this.controlledCharacter);
      this.checkZones = false;
    }

    this.controlledCharacter?.updateStep();
  },

  handleUserInputs() {
    this.inputVector.set(0, 0);
    if (isModalOpen()) return false;

    const { keys, nippleMoving, nippleData } = this.scene;

    if (nippleMoving) this.inputVector.set(nippleData.vector.x, -nippleData.vector.y);
    else {
      // Horizontal movement
      if (keys.left.isDown || keys.q.isDown || keys.a.isDown) this.inputVector.x = -1;
      else if (keys.right.isDown || keys.d.isDown) this.inputVector.x = 1;

      // Vertical movement
      if (keys.up.isDown || keys.z.isDown || keys.w.isDown) this.inputVector.y = -1;
      else if (keys.down.isDown || keys.s.isDown) this.inputVector.y = 1;
    }

    const moving = this.inputVector.x !== 0 || this.inputVector.y !== 0;
    if (moving) {
      Session.set('menu', false);
      this.follow(undefined); // interrupts the follow action
    }

    return moving;
  },

  postUpdate(time, delta) {
    if (!this.controlledCharacter) return;

    this.handleUserInputs();
    this.controlledCharacter.running = this.scene.keys.shift.isDown;
    this.controlledCharacter.moveDirection = this.inputVector;

    if (peer.isEnabled() && !Session.get('menu')) {
      const nearUsersCount = guestAllowed(permissionTypes.talkToUsers) ? userProximitySensor.nearUsersCount() : userProximitySensor.nearNonGuestUsers().length;
      this.controlledCharacter.enableChatCircle(nearUsersCount > 0);
    } else this.controlledCharacter.enableChatCircle(false);

    const newVelocity = this.controlledCharacter.physicsStep();
    const moving = Math.abs(newVelocity.x) > 0.1 || Math.abs(newVelocity.y) > 0.1;

    if (moving) {
      const direction = vectorToTextDirection(this.controlledCharacter.body.velocity);
      if (direction) this.controlledCharacter.playAnimation(characterAnimations.run, direction);
    } else this.controlledCharacter.setAnimationPaused(true);

    if (moving || this.controlledCharacter.wasMoving) {
      this.scene.physics.world.update(time, delta);
      networkManager.sendPlayerNewState(this.controlledCharacter);
      this.stopInteracting();
    }

    if (!peer.hasActiveStreams()) peer.enableSensor(!(this.controlledCharacter.running && moving));
    this.controlledCharacter.wasMoving = moving;
    this.controlledCharacter?.postUpdateStep();
  },

  teleportMainUser(x, y) {
    this.controlledCharacter.x = x;
    this.controlledCharacter.y = y;
    networkManager.sendPlayerNewState(this.controlledCharacter);
  },

  interact() {
    entityManager.interactWithNearestEntity();
  },

  stopInteracting() {
    entityManager.stopInteracting();
  },

  getPositionInFrontOfCharacter(character, distance = 0) {
    const directionVector = textDirectionToVector(character.direction);
    return { x: character.x + directionVector.x * distance, y: character.y + directionVector.y * distance };
  },

  follow(user) {
    if (!user || (user && this.controlledCharacter.followedGameObject)) {
      if (this.controlledCharacter.followedGameObject) {
        lp.notif.success(`You no longer follow anyone`);
        peer.unlockCall(this.controlledCharacter.followedGameObject.getData('userId'), true);
      }

      this.controlledCharacter.stopFollow();

      return;
    }

    this.controlledCharacter.follow(this.getCharacter(user._id));

    lp.notif.success(`You are following ${user.profile.name}`);
    peer.lockCall(user._id, true);
  },

  setUserInDoNotDisturbMode(enable) {
    if (!this.controlledCharacter) return;

    if (enable) {
      this.saveMediaStates();
      setTimeout(() => Meteor.users.update(Meteor.userId(), { $set: {
        'profile.shareVideo': false,
        'profile.shareAudio': false,
        'profile.shareScreen': false,
      } }), 0);
      Meteor.call('user-status-idle');
    } else {
      this.clearMediaStates();
      Meteor.call('user-status-active');
    }

    this.follow(undefined); // interrupts the follow action
    this.controlledCharacter.setTintFromState();
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

      const followedUserId = this.controlledCharacter.followedGameObject?.getData('userId');
      if (followedUserId === emitterUserId) this.controlledCharacter.stopFollow();
      else lp.notif.warning(`${userEmitter.profile.name} has finally stopped following you 🎉`);
    } else if (type === 'text') {
      const emitterPlayer = this.getCharacter(emitterUserId);
      if (!emitterPlayer) return;
      if (!data.content) return;

      const { zoneLastSeenDates = [], zoneMuted = [] } = Meteor.user({ fields: { zoneMuted: 1, zoneLastSeenDates: 1 } });
      const userEmitterZoneId = zoneManager.currentZone(userEmitter)?._id;
      if (zoneLastSeenDates[userEmitterZoneId] && !zoneMuted[userEmitterZoneId]) audioManager.play('text-sound.wav', 0.5);

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

  getCharacter(userId) {
    return this.characters[userId];
  },

  getControlledCharacter() {
    return this.controlledCharacter;
  },
};
