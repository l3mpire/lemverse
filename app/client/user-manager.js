import Phaser from 'phaser';

const userInterpolationInterval = 200;
const defaultCharacterDirection = 'down';
const defaultUserMediaColorError = '0xd21404';
const characterPopInOffset = { x: 0, y: -90 };
const characterSpritesOrigin = { x: 0.5, y: 1 };
const characterInteractionDistance = { x: 32, y: 32 };
const characterFootOffset = { x: -20, y: -10 };
const characterColliderSize = { x: 38, y: 16 };
const characterInteractionConfiguration = {
  hitArea: new Phaser.Geom.Circle(0, -13, 13),
  hitAreaCallback: Phaser.Geom.Circle.Contains,
  cursor: 'pointer',
};
const unavailablePlayerColor = 0x888888;
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

charactersParts = Object.freeze({
  body: 0,
  outfit: 1,
  eye: 2,
  hair: 3,
  accessory: 4,
});

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

const allowPhaserMouseInputs = () => !Session.get('editor') && !Session.get('console');

userManager = {
  entityFollowed: undefined,
  inputVector: new Phaser.Math.Vector2(),
  player: undefined,
  playerVelocity: new Phaser.Math.Vector2(),
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
    this.playerVelocity = new Phaser.Math.Vector2();
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

  rename(name, color) {
    game.scene.getScene('UIScene')?.updateUserName(this.player.userId, name, color);
    if (meet.api) meet.userName(name);
  },

  computeGuestSkin(user) {
    if (!user.profile.guest) return user;

    if (_.isObject(Meteor.settings.public.skins.guest)) {
      user.profile = {
        ...user.profile,
        ...Meteor.settings.public.skins.guest,
      };
    }

    const level = Levels.findOne(user.profile.levelId);
    if (level?.skins?.guest) {
      user.profile = {
        ...user.profile,
        ...level.skins?.guest,
      };
    }

    return user;
  },

  createUser(user) {
    if (this.players[user._id]) return null;
    if (user.profile.guest) user = this.computeGuestSkin(user);

    const { x, y, shareAudio, guest, body, direction } = user.profile;
    this.players[user._id] = this.scene.add.container(x, y);
    this.players[user._id].userId = user._id;

    const playerParts = this.scene.add.container(0, 0);
    playerParts.setScale(3);
    playerParts.name = 'body';
    playerParts.on('pointerover', () => {
      if (!allowPhaserMouseInputs()) return;

      this.setTint(this.players[user._id], 0xFFAAFF);
      Session.set('menu', { userId: user._id });
      Session.set('menu-position', relativePositionToCamera(this.players[user._id], this.scene.cameras.main));
    });
    playerParts.on('pointerout', () => this.setTintFromState(this.players[user._id]));
    playerParts.on('pointerup', () => {
      if (Session.get('menu')) Session.set('menu', undefined);
      else if (allowPhaserMouseInputs()) Session.set('menu', { userId: user._id });
    });

    playerParts.setInteractive(characterInteractionConfiguration);
    if (guest) playerParts.disableInteractive();

    const shadow = createFakeShadow(this.scene, 0, 7, 0.55, 0.25);
    shadow.setOrigin(characterSpritesOrigin.x, characterSpritesOrigin.y);
    this.players[user._id].add(shadow);

    const bodyPlayer = this.scene.add.sprite(0, 0, body || 'missing_texture');
    bodyPlayer.setOrigin(characterSpritesOrigin.x, characterSpritesOrigin.y);
    bodyPlayer.name = 'body';
    playerParts.add(bodyPlayer);

    Object.keys(charactersParts).filter(part => part !== 'body' && user.profile[part]).forEach(part => {
      const spritePart = this.scene.add.sprite(0, 0, user.profile[part]);
      spritePart.name = part;
      spritePart.setOrigin(characterSpritesOrigin.x, characterSpritesOrigin.y);
      playerParts.add(spritePart);
    });

    this.players[user._id].add(playerParts);

    const userStateIndicator = this.createUserStateIndicator();
    userStateIndicator.visible = !guest && !shareAudio;
    userStateIndicator.name = 'stateIndicator';
    this.players[user._id].add(userStateIndicator);

    this.players[user._id].lwOriginX = x;
    this.players[user._id].lwOriginY = y;
    this.players[user._id].lwTargetX = x;
    this.players[user._id].lwTargetY = y;
    this.players[user._id].direction = direction || defaultCharacterDirection;
    this.players[user._id].setDepth(y);

    window.setTimeout(() => this.updateUser(user), 0);

    return this.players[user._id];
  },

  playReaction(player, reaction) {
    clearInterval(player.reactionHandler);
    if (meet.api && this.canPlayReactionSound && sounds.reactionsSounds[reaction]) {
      const otherUser = Meteor.users.findOne(player.userId);
      if (otherUser && zones.isUserInSameZone(Meteor.user(), otherUser)) sounds.play(sounds.reactionsSounds[reaction]);

      // avoid sound spamming
      this.canPlayReactionSound = false;
      setTimeout(() => { this.canPlayReactionSound = true; }, timeBetweenReactionSound);
    }

    const animation = reaction === '❤️' ? 'zigzag' : 'linearUpScaleDown';
    const UIScene = game.scene.getScene('UIScene');
    UIScene.spawnReaction(player, reaction, animation, { randomOffset: 10 });
    player.reactionHandler = setInterval(() => UIScene.spawnReaction(player, reaction, animation, { randomOffset: 10 }), 250);
  },

  updateUser(user, oldUser) {
    const player = this.players[user._id];
    if (!player) return;
    const { x, y, reaction, shareAudio, guest, userMediaError, name, nameColor } = user.profile;
    const isTransformedAccount = oldUser?.profile.guest && !user.profile.guest;

    // show reactions
    if (reaction) this.playReaction(player, reaction);
    else clearInterval(player.reactionHandler);

    // create missing character body parts or update it
    const characterBodyContainer = player.getByName('body');
    const charactersPartsKeys = Object.keys(charactersParts);

    if (isTransformedAccount) {
      characterBodyContainer.setInteractive();
      game.scene.getScene('UIScene')?.updateUserName(user._id, name, nameColor);
    }

    let hasUpdatedSkin = false;
    charactersPartsKeys.filter(part => user.profile[part]).forEach(part => {
      if (user.profile[part] === oldUser?.profile[part]) return;
      hasUpdatedSkin = true;

      const characterPart = characterBodyContainer.getByName(part);
      if (!characterPart) {
        const missingPart = this.scene.add.sprite(0, 0, user.profile[part]);
        missingPart.name = part;
        missingPart.setOrigin(characterSpritesOrigin.x, characterSpritesOrigin.y);
        characterBodyContainer.add(missingPart);
      } else characterPart.setTexture(user.profile[part]);
    });

    // remove potential item from the user
    charactersPartsKeys.filter(part => !user.profile[part] && part !== 'body').forEach(part => {
      if (!user.profile[part]) characterBodyContainer?.getByName(part)?.destroy();
    });

    if (hasUpdatedSkin || user.profile.direction !== oldUser?.profile.direction) {
      delete player.lastDirection;
      this.updateAnimation(characterAnimations.run, player);
      this.pauseAnimation(player, true, true);
    }

    // update tint
    if (userMediaError !== oldUser?.profile.userMediaError) {
      if (userMediaError) this.setTint(player, defaultUserMediaColorError);
      else this.clearTint(player);
    }
    characterBodyContainer.alpha = guest ? 0.7 : 1.0;

    if (!guest && (name !== oldUser?.profile.name || nameColor !== oldUser?.profile.nameColor)) game.scene.getScene('UIScene')?.updateUserName(user._id, name, nameColor);

    let hasMoved = false;
    if (oldUser) {
      const { x: oldX, y: oldY } = oldUser.profile;
      hasMoved = x !== oldX || y !== oldY;
    }
    const loggedUser = Meteor.user();
    const shouldCheckDistance = hasMoved && !guest;

    if (user._id === loggedUser._id) {
      // network rubber banding
      const dist = Math.hypot(player.x - x, player.y - y);
      if (dist >= rubberBandingDistance) {
        player.x = x;
        player.y = y;
      }

      // ensures this.player is assigned to the logged user
      if (this.player?.userId !== loggedUser._id || !this.player.body) this.setAsMainPlayer(loggedUser._id);

      if (hasMoved) this.checkZones = true;

      if (shouldCheckDistance) {
        const otherUsers = Meteor.users.find({ _id: { $ne: loggedUser._id }, 'status.online': true, 'profile.levelId': loggedUser.profile.levelId }).fetch();
        userProximitySensor.checkDistances(loggedUser, otherUsers);
      }
    } else {
      if (hasMoved) {
        player.lwOriginX = player.x;
        player.lwOriginY = player.y;
        player.lwOriginDate = Date.now();
        player.lwTargetX = user.profile.x;
        player.lwTargetY = user.profile.y;
        player.lwTargetDate = player.lwOriginDate + userInterpolationInterval;
        if (shouldCheckDistance) userProximitySensor.checkDistance(loggedUser, user);
      }

      if (!guest && user.profile.shareScreen !== oldUser?.profile.shareScreen) peer.onStreamSettingsChanged(user);
    }

    player.getByName('stateIndicator').visible = !guest && !shareAudio;
  },

  removeUser(user) {
    if (!user || !this.players[user._id]) return;

    clearInterval(this.players[user._id].reactionHandler);
    delete this.players[user._id].reactionHandler;

    this.players[user._id].destroy();
    game.scene.getScene('UIScene').destroyUserName(user._id);

    if (user._id === Meteor.userId()) this.unsetMainPlayer();

    delete this.players[user._id];
  },

  pauseAnimation(player, value, forceUpdate = false) {
    player = player ?? this.player;

    if (!player || (value === player.paused && !forceUpdate)) return;
    player.paused = value;

    const playerBodyParts = player.getByName('body');
    playerBodyParts.list.forEach(bodyPart => {
      if (value) {
        bodyPart.anims.pause();
        if (bodyPart.anims.hasStarted) bodyPart.anims.setProgress(0.5);
      } else bodyPart.anims.resume();
    });
  },

  updateAnimation(animation, player, direction) {
    let user = Meteor.users.findOne(player.userId);
    if (!user) return;
    direction = direction ?? (user.profile.direction || defaultCharacterDirection);
    if (player.lastDirection === direction) return;
    player.lastDirection = direction;
    if (user.profile.guest) user = this.computeGuestSkin(user);

    const playerBodyParts = player.getByName('body');
    playerBodyParts.list.forEach(bodyPart => {
      const element = user.profile[bodyPart.name];
      if (element) bodyPart.anims.play(`${animation}-${direction}-${element}`, true);
    });
  },

  setAsMainPlayer(userId) {
    if (this.player) this.scene.physics.world.disableBody(this.player);

    const player = this.players[userId];
    if (!player) throw new Error(`Can't set as main player a non spawned character`);

    const user = Meteor.users.findOne(userId);
    const level = Levels.findOne(user.profile.levelId);
    // enable collisions for the user only, each client has its own physics simulation and there isn't collision between characters
    this.scene.physics.world.enableBody(player);
    player.body.setImmovable(true);
    player.body.setCollideWorldBounds(true);
    player.body.setSize(characterColliderSize.x, characterColliderSize.y);
    player.body.setOffset(characterFootOffset.x, characterFootOffset.y);

    // add character's physic body to layers
    levelManager.layers.forEach(layer => {
      if (layer.playerCollider) this.scene.physics.world.removeCollider(layer.playerCollider);
      if (!level?.godMode) layer.playerCollider = this.scene.physics.add.collider(player, layer);
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

  createUserStateIndicator() {
    const muteIndicatorMic = this.scene.add.text(0, -40, '🎤', { font: '23px Sans Open' }).setDepth(99996).setOrigin(0.5, 1);
    const muteIndicatorCross = this.scene.add.text(0, -40, '🚫', { font: '23px Sans Open' }).setDepth(99995).setOrigin(0.5, 1).setScale(0.8);

    const userStateIndicatorContainer = this.scene.add.container(0, 0);
    userStateIndicatorContainer.add([muteIndicatorMic, muteIndicatorCross]);

    return userStateIndicatorContainer;
  },

  interpolatePlayerPositions() {
    const now = Date.now();
    Object.values(this.players).forEach(player => {
      if (player.userId === this.player?.userId) return;

      if (!player.lwTargetDate) {
        this.pauseAnimation(player, true);
        return;
      }

      this.pauseAnimation(player, false);
      this.updateAnimation(characterAnimations.run, player);

      if (player.lwTargetDate <= now) {
        player.x = player.lwTargetX;
        player.y = player.lwTargetY;
        player.setDepth(player.y);
        delete player.lwTargetDate;
        return;
      }

      const elapsedTime = ((now - player.lwOriginDate) / (player.lwTargetDate - player.lwOriginDate));
      player.x = player.lwOriginX + (player.lwTargetX - player.lwOriginX) * elapsedTime;
      player.y = player.lwOriginY + (player.lwTargetY - player.lwOriginY) * elapsedTime;
      player.setDepth(player.y);
    });
  },

  update() {
    if (this.checkZones) {
      zones.checkDistances(this.player);
      this.checkZones = false;
    }

    this.interpolatePlayerPositions();
  },

  directionFromVector(vector) {
    if (Math.abs(vector.x) > Math.abs(vector.y)) {
      if (vector.x <= -1) return 'left';
      else if (vector.x >= 1) return 'right';
    }

    if (vector.y <= -1) return 'up';
    else if (vector.y >= 1) return 'down';

    return undefined;
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

    this.playerVelocity.set(0, 0);
    const inputPressed = this.handleUserInputs(keys, nippleMoving, nippleData);

    if (inputPressed) {
      this.playerVelocity.set(this.inputVector.x, this.inputVector.y);
      this.follow(undefined); // interrupts the follow action
      Session.set('menu', false);
    } else if (this.entityFollowed) {
      const minimumDistance = Meteor.settings.public.character.sensorNearDistance / 2;
      const diff = { x: this.entityFollowed.x - this.player.x, y: this.entityFollowed.y - this.player.y };

      const distance = Math.hypot(diff.x, diff.y);
      if (distance >= minimumDistance) {
        const { sensorNearDistance, runSpeed, walkSpeed } = Meteor.settings.public.character;
        speed = distance > sensorNearDistance ? runSpeed : walkSpeed;
        this.playerVelocity.set(diff.x, diff.y);
      }
    }

    this.playerVelocity.normalize().scale(speed);
    this.player.body.setVelocity(this.playerVelocity.x, this.playerVelocity.y);
    this.player.setDepth(this.player.y);

    const direction = this.directionFromVector(this.playerVelocity);
    const running = keys.shift.isDown && direction;
    if (!peer.hasActiveStreams()) peer.enableSensor(!running);

    if (direction) {
      this.player.direction = direction;
      this.pauseAnimation(this.player, false);
      this.updateAnimation(characterAnimations.run, this.player, direction);
    } else this.pauseAnimation(this.player, true);

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
    const tiles = this.getTilesInFrontOfPlayer(this.player, [4, 0]);
    const positionInFrontOfPlayer = this.getPositionInFrontOfPlayer(this.player);
    entityManager.onInteraction(tiles, positionInFrontOfPlayer);
  },

  getTilesUnderPlayer(player, layers = []) {
    return this.getTilesRelativeToPlayer(player, { x: 0, y: 0 }, layers);
  },

  getTilesInFrontOfPlayer(player, layers = []) {
    if (!player) return undefined;

    const positionOffset = { x: 0, y: 0 };
    if (player.direction) {
      const directionVector = this.directionToVector(player.direction);
      positionOffset.x = directionVector[0] * characterInteractionDistance.x;
      positionOffset.y = directionVector[1] * characterInteractionDistance.y;
    }

    return this.getTilesRelativeToPlayer(player, positionOffset, layers);
  },

  getPositionInFrontOfPlayer(player, distance = undefined) {
    const directionVector = this.directionToVector(player.direction);

    return {
      x: player.x + directionVector[0] * (distance || characterInteractionDistance.x),
      y: player.y + characterFootOffset.y + directionVector[1] * (distance || characterInteractionDistance.y),
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

  directionToVector(direction) {
    switch (direction) {
      case 'left':
        return [-1, 0];
      case 'right':
        return [1, 0];
      case 'up':
        return [0, -1];
      case 'down':
        return [0, 1];
      default:
        return [0, 0];
    }
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

  punch(users) {
    if (!users || !users.length) return;
    this.scene.cameras.main.shake(250, 0.015, 0.02);
    sounds.play('punch.mp3');
    if (Math.random() > 0.95) sounds.play('punch2.mp3');

    users.forEach(user => this.takeDamage(this.players[user._id]));

    peer.punchCall(users.map(user => user._id));
  },

  takeDamage(player) {
    this.flashColor(player, 0xFF0000);
  },

  clearTint(player) {
    this.setTint(player, 0xFFFFFF);
  },

  setTint(player, color) {
    const playerBodyParts = player.getByName('body');
    playerBodyParts.list.forEach(bodyPart => {
      bodyPart.tint = color;
    });
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
    this.setTintFromState(this.player);
    sounds.enabled = !enable;
  },

  setTintFromState(player) {
    const user = Meteor.users.findOne(player.userId);
    const currentZone = zones.currentZone(user);
    if (currentZone && currentZone.disableCommunications) this.setTint(player, unavailablePlayerColor);
    else this.setTint(player, 0xFFFFFF);
  },

  flashColor(player, color) {
    this.setTint(player, color);

    this.scene.time.addEvent({
      delay: 350,
      callback() { this.clearTint(player); },
      callbackScope: this,
    });
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

  onPeerDataReceived(data) {
    const emitterUserId = data.emitter;
    const userEmitter = Meteor.users.findOne(emitterUserId);
    if (!userEmitter) return;

    if (data.type === 'audio') sounds.playFromChunks(data.data);
    else if (data.type === 'punch') {
      if (!userProximitySensor.isUserNear(userEmitter)) return;

      sounds.play('punch.mp3');
      this.scene.cameras.main.shake(250, 0.015, 0.02);
      if (Math.random() > 0.95) sounds.play('punch2.mp3');

      this.takeDamage(this.players[Meteor.user()._id]);
    } else if (data.type === 'followed') {
      peer.lockCall(emitterUserId);
      lp.notif.warning(`${userEmitter.profile.name} is following you 👀`);
    } else if (data.type === 'unfollowed') {
      peer.unlockCall(emitterUserId);

      if (this.entityFollowed?.userId === emitterUserId) this.follow(undefined);
      else lp.notif.warning(`${userEmitter.profile.name} has finally stopped following you 🎉`);
    } else if (data.type === 'text') {
      const emitterPlayer = userManager.players[emitterUserId];
      if (!emitterPlayer) return;

      const { zoneMuted } = Meteor.user();
      const userEmitterZoneId = zones.currentZone(userEmitter)?._id;
      if (!zoneMuted || !zoneMuted[userEmitterZoneId]) sounds.play('text-sound.wav', 0.5);

      const popInIdentifier = `${emitterUserId}-pop-in`;
      characterPopIns.createOrUpdate(
        popInIdentifier,
        data.data,
        { target: emitterPlayer, className: messageReceived.style, autoClose: messageReceived.duration, parseURL: true, classList: 'copy', offset: characterPopInOffset },
      );

      if (emitterUserId !== Meteor.userId()) notify(userEmitter, `${userEmitter.profile.name}: ${data.data}`);
    }

    window.dispatchEvent(new CustomEvent(eventTypes.onPeerDataReceived, { detail: { data } }));
  },
};
