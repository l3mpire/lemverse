const Phaser = require('phaser');

const defaultCharacterDirection = 'down';
const defaultUserMediaColorError = '0xd21404';
const characterSpritesOrigin = { x: 0.5, y: 1 };
const characterInteractionDistance = { x: 32, y: 32 };
const characterFootOffset = { x: -20, y: -10 };
const characterColliderSize = { x: 38, y: 16 };
const characterInteractionConfiguration = {
  hitArea: new Phaser.Geom.Circle(0, -13, 13),
  hitAreaCallback: Phaser.Geom.Circle.Contains,
  cursor: 'pointer',
};
const characterAnimations = Object.freeze({
  idle: 'idle',
  run: 'run',
});
const unavailablePlayerColor = 0x888888;

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
};

const throttledSavePlayer = throttle(savePlayer, 100, { leading: false });

userManager = {
  entityFollowed: undefined,
  inputVector: new Phaser.Math.Vector2(),
  player: undefined,
  playerVelocity: new Phaser.Math.Vector2(),
  playerWasMoving: false,
  players: {},
  scene: undefined,

  init(scene) {
    this.entityFollowed = undefined;
    this.inputVector = new Phaser.Math.Vector2();
    this.player = undefined;
    this.playerVelocity = new Phaser.Math.Vector2();
    this.players = {};
    this.scene = scene;
  },

  destroy() {
    this.onSleep();
    this.player = undefined;
    this.players = {};
  },

  onSleep() {
    throttledSavePlayer.cancel();
  },

  rename(name, color) {
    game.scene.getScene('UIScene')?.updateUserName(this.player.userId, name, color);
    if (meet.api) meet.api.executeCommand('displayName', name);
  },

  computeGuestSkin(user) {
    if (!user.profile.guest) return user;

    if (_.isObject(Meteor.settings.public.skins.guest)) {
      user.profile = {
        ...user.profile,
        ...Meteor.settings.public.skins.guest,
      };
    }

    const currentLevel = Levels.findOne({ _id: user.profile.levelId });
    if (currentLevel?.skins?.guest) {
      user.profile = {
        ...user.profile,
        ...currentLevel.skins?.guest,
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

    if (!user.profile.guest) {
      playerParts.setInteractive(characterInteractionConfiguration);
      playerParts.on('pointerover', () => {
        if (Session.get('editor')) return;

        this.setTint(this.players[user._id], 0xFFAAFF);
        Session.set('menu', { userId: user._id });
        Session.set('menu-position', relativePositionToCamera(this.players[user._id], this.scene.cameras.main));
      });

      playerParts.on('pointerout', () => this.setTintFromState(this.players[user._id]));
      playerParts.on('pointerup', () => {
        if (Session.get('menu')) Session.set('menu', undefined);
        else Session.set('menu', { userId: user._id });
      });
    }

    const shadow = this.scene.add.circle(0, 6, 18, 0x000000);
    shadow.alpha = 0.1;
    shadow.scaleY = 0.4;
    shadow.setDepth(-1);
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

    this.updateUser(user);

    return this.players[user._id];
  },

  updateUser(user, oldUser) {
    const isMe = user._id === Meteor.userId();
    const player = this.players[user._id];
    if (!player) return;
    const { x, y, reaction, shareAudio, guest, userMediaError, name, nameColor } = user.profile;

    // show reactions
    if (reaction) {
      clearInterval(player.reactionHandler);
      delete player.reactionHandler;

      const animation = reaction === '❤️' ? 'zigzag' : 'linearUpScaleDown';
      const UIScene = game.scene.getScene('UIScene');
      UIScene.spawnReaction(player, reaction, animation, { randomOffset: 10 });
      player.reactionHandler = setInterval(() => UIScene.spawnReaction(player, reaction, animation, { randomOffset: 10 }), 250);
    } else {
      clearInterval(player.reactionHandler);
      delete player.reactionHandler;
    }

    // create missing character body parts or update it
    const characterBodyContainer = player.getByName('body');
    const charactersPartsKeys = Object.keys(charactersParts);

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

    if (!guest && name !== oldUser?.profile?.name) game.scene.getScene('UIScene')?.updateUserName(user._id, name, nameColor);

    let hasMoved = false;
    if (oldUser) {
      const { x: oldX, y: oldY } = oldUser.profile;
      hasMoved = x !== oldX || y !== oldY;
    }
    const mainUser = Meteor.user();
    const shouldCheckDistance = hasMoved && !guest && !meet.api;

    if (isMe) {
      // Check distance between players
      const dist = Math.sqrt(((player.x - x) ** 2) + ((player.y - y) ** 2));
      if (dist >= 160) {
        player.x = x;
        player.y = y;
      }

      // ensures this.player is assigned to the logged user
      if (this.player?.userId !== Meteor.userId() || !this.player.body) this.setAsMainPlayer(Meteor.userId());

      // check zone and near users on move
      if (hasMoved) zones.checkDistances(this.player);

      if (user.profile.avatar !== oldUser?.profile.avatar) userStreams.refreshVideoElementAvatar(userStreams.getVideoElement());

      if (shouldCheckDistance) {
        const otherUsers = Meteor.users.find({ _id: { $ne: mainUser._id } }).fetch();
        userProximitySensor.checkDistances(mainUser, otherUsers);
      }
    } else {
      if (hasMoved) {
        player.lwOriginX = player.x;
        player.lwOriginY = player.y;
        player.lwOriginDate = moment();
        player.lwTargetX = user.profile.x;
        player.lwTargetY = user.profile.y;
        player.lwTargetDate = moment().add(100, 'milliseconds');
        if (shouldCheckDistance) userProximitySensor.checkDistance(mainUser, user);
      }

      if (!guest && user.profile.shareScreen !== oldUser?.profile.shareScreen) peer.onStreamSettingsChanged(user);
    }

    player.getByName('stateIndicator').visible = !guest && !shareAudio;
  },

  removeUser(user) {
    if (!this.players[user._id]) return;

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

    const user = Meteor.users.findOne({ _id: userId });
    const level = Levels.findOne({ _id: user.profile.levelId });
    // enable collisions for the user only, each client has its own physics simulation and there isn't collision between characters
    this.scene.physics.world.enableBody(player);
    player.body.setImmovable(true);
    player.body.setCollideWorldBounds(true);
    player.body.setSize(characterColliderSize.x, characterColliderSize.y);
    player.body.setOffset(characterFootOffset.x, characterFootOffset.y);

    // add character's physic body to layers
    _.each(levelManager.layers, layer => {
      if (layer.playerCollider) this.scene.physics.world.removeCollider(layer.playerCollider);
      if (!level.godMode) layer.playerCollider = this.scene.physics.add.collider(player, layer);
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

    _.each(levelManager.layers, layer => {
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
    const currentUser = Meteor.user();

    const now = moment();
    _.each(this.players, (player, userId) => {
      if (userId === currentUser?._id) return;

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

    // todo: remove this old code
    const user = Meteor.user();
    if (user.profile.freeze) {
      this.pauseAnimation(this.player, true);
      this.player.body.setVelocity(0, 0);

      return;
    }

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

      // eslint-disable-next-line new-cap
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.entityFollowed.x, this.entityFollowed.y);
      if (distance >= minimumDistance) {
        speed = distance > Meteor.settings.public.character.sensorNearDistance ? Meteor.settings.public.character.runSpeed : Meteor.settings.public.character.walkSpeed;
        this.playerVelocity.set(this.entityFollowed.x - this.player.x, this.entityFollowed.y - this.player.y);
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

  getPositionInFrontOfPlayer(player) {
    const directionVector = this.directionToVector(player.direction);

    return {
      x: player.x + directionVector[0] * characterInteractionDistance.x,
      y: player.y + characterFootOffset.y + directionVector[1] * characterInteractionDistance.y,
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
};
