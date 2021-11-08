const Phaser = require('phaser');

const defaultCharacterDirection = 'down';
const defaultUserMediaColorError = '0xd21404';
const characterNameOffset = { x: 0, y: -85 };
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
  characterNamesObjects: {},
  player: undefined,
  playerVelocity: new Phaser.Math.Vector2(),
  playerWasMoving: false,
  players: {},
  scene: undefined,

  init(scene) {
    this.characterNamesObjects = {};
    this.player = undefined;
    this.players = {};
    this.scene = scene;

    scene.input.keyboard.on('keydown-SHIFT', () => { peer.sensorEnabled = false; });
    scene.input.keyboard.on('keyup-SHIFT', () => {
      peer.sensorEnabled = true;
      userProximitySensor.callProximityStartedForAllNearUsers();
    });
  },

  destroy() {
    this.onSleep();
    _.each(this.players, player => {
      clearInterval(player.reactionHandler);
      delete player.reactionHandler;
    });

    this.player = undefined;
    this.players = {};
    this.characterNamesObjects = {};
  },

  onSleep() {
    throttledSavePlayer.cancel();
  },

  rename(name) {
    this.updateUserName(this.player.userId, name);
    if (meet.api) meet.api.executeCommand('displayName', name);
  },

  create(user) {
    if (this.players[user._id]) return null;

    if (user.profile.guest) {
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
    }

    const { x, y, shareAudio, guest, body, direction } = user.profile;
    this.players[user._id] = this.scene.add.container(x, y);
    this.players[user._id].userId = user._id;

    const playerParts = this.scene.add.container(0, 0);
    playerParts.setScale(3);
    playerParts.name = 'body';
    if (!guest) {
      playerParts.setInteractive(new Phaser.Geom.Circle(0, 0, 10), Phaser.Geom.Circle.Contains);
      playerParts.on('pointerup', () =>  {
        if (isModalOpen()) return;
        Session.set('displayProfile', user._id);
      })
    }

    if (!user.profile.guest) {
      playerParts.setInteractive(characterInteractionConfiguration);
      playerParts.on('pointerover', () => this.setTint(this.players[user._id], 0xFFAAFF));
      playerParts.on('pointerout', () => this.setTintFromState(this.players[user._id]));
      playerParts.on('pointerup', () => {
        if (isModalOpen() || Session.get('editor')) return;
        Session.set('modal', { template: 'profile', userId: user._id });
      });
    }

    const shadow = this.scene.add.circle(0, 6, 18, 0x000000);
    shadow.alpha = 0.1;
    shadow.scaleY = 0.4;
    shadow.setDepth(-1);
    shadow.setOrigin(characterSpritesOrigin.x, characterSpritesOrigin.y);
    this.players[user._id].add(shadow);

    const bodyPlayer = this.scene.add.sprite(0, 0, body || guest ? Meteor.settings.public.skins.guest : Meteor.settings.public.skins.default);
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

    this.update(user);

    return this.players[user._id];
  },

  update(user, oldUser) {
    const isMe = user._id === Meteor.userId();
    const player = this.players[user._id];
    if (!player) return;
    const { x, y, reaction, shareAudio, guest, userMediaError, name } = user.profile;

    // show reactions
    if (reaction && !player.reactionHandler) {
      const animation = reaction === '❤️' ? 'zigzag' : 'linearUpScaleDown';
      this.spawnReaction(player, reaction, animation, { randomOffset: 10 });
      player.reactionHandler = setInterval(() => this.spawnReaction(player, reaction, animation, { randomOffset: 10 }), 250);
    } else if (!reaction && player.reactionHandler) {
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

    if (hasUpdatedSkin) {
      delete player.lastDirection;
      this.updateAnimation(player);
      this.pauseAnimation(player, true, true);
    }

    // update tint
    if (userMediaError !== oldUser?.profile.userMediaError) {
      if (userMediaError) this.setTint(player, defaultUserMediaColorError);
      else this.clearTint(player);
    }
    characterBodyContainer.alpha = guest ? 0.7 : 1.0;

    if (!guest && name !== oldUser?.profile?.name) this.updateUserName(user._id, name);

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

  remove(user) {
    if (!this.players[user._id]) return;

    clearInterval(this.players[user._id].reactionHandler);
    delete this.players[user._id].reactionHandler;

    this.players[user._id].destroy();
    this.destroyUserName(user._id);

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

  updateAnimation(player, direction) {
    const user = Meteor.users.findOne(player.userId);
    if (!user) return;
    direction = direction ?? (user.profile.direction || defaultCharacterDirection);
    if (player.lastDirection === direction) return;
    player.lastDirection = direction;

    if (user.profile.guest) {
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
    }

    const playerBodyParts = player.getByName('body');
    playerBodyParts.list.forEach(bodyPart => {
      const element = user.profile[bodyPart.name];
      if (element) bodyPart.anims.play(`${element}${direction}`, true);
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

  destroyUserName(userId) {
    const nameObject = this.characterNamesObjects[userId];
    if (!nameObject) { return; }
    nameObject?.destroy();

    this.characterNamesObjects[userId] = undefined;
  },

  spawnReaction(player, content, animation, options) {
    const ReactionDiff = animation === 'zigzag' ? 10 : 0;
    const positionX = player.x - ReactionDiff + _.random(-options.randomOffset, options.randomOffset);
    const positionY = player.y + characterNameOffset.y + _.random(-options.randomOffset, options.randomOffset);
    const reaction = this.scene.add.text(positionX, positionY, content, { font: '32px Sans Open' }).setDepth(99997).setOrigin(0.5, 1);

    this.scene.tweens.add({
      targets: reaction,
      ...reactionsAnimations[animation](positionX, positionY, ReactionDiff),
      onComplete: () => reaction.destroy(),
    });
  },

  interpolatePlayerPositions() {
    const currentUser = Meteor.user();

    _.each(this.players, (player, userId) => {
      if (userId === currentUser?._id) return;

      if (!player.lwTargetDate) {
        this.pauseAnimation(player, true);
        return;
      }

      this.pauseAnimation(player, false);
      this.updateAnimation(player);

      if (player.lwTargetDate <= moment()) {
        player.x = player.lwTargetX;
        player.y = player.lwTargetY;
        delete player.lwTargetDate;
        return;
      }

      const elapsedTime = ((moment() - player.lwOriginDate) / (player.lwTargetDate - player.lwOriginDate));
      player.x = player.lwOriginX + (player.lwTargetX - player.lwOriginX) * elapsedTime;
      player.y = player.lwOriginY + (player.lwTargetY - player.lwOriginY) * elapsedTime;
      player.setDepth(player.y);
    });
  },

  handleUserInputs(keys, nippleMoving, nippleData) {
    if (!this.player || isModalOpen()) return;

    const user = Meteor.user();
    if (user.profile.freeze) {
      this.pauseAnimation(this.player, true);
      return;
    }

    const maxSpeed = keys.shift.isDown ? Meteor.settings.public.character.runSpeed : Meteor.settings.public.character.walkSpeed;
    this.playerVelocity.set(0, 0);
    let direction;

    if (nippleMoving) {
      this.playerVelocity.x = nippleData.vector.x;
      this.playerVelocity.y = -nippleData.vector.y;
      direction = nippleData?.direction?.angle;
    } else {
      // Horizontal movement
      if (keys.left.isDown || keys.q.isDown || keys.a.isDown) {
        this.playerVelocity.x = -1;
        direction = 'left';
      } else if (keys.right.isDown || keys.d.isDown) {
        this.playerVelocity.x = 1;
        direction = 'right';
      }

      // Vertical movement
      if (keys.up.isDown || keys.z.isDown || keys.w.isDown) {
        this.playerVelocity.y = -1;
        direction = 'up';
      } else if (keys.down.isDown || keys.s.isDown) {
        this.playerVelocity.y = 1;
        direction = 'down';
      }
    }

    this.playerVelocity.normalize().scale(maxSpeed);
    this.player.body.setVelocity(this.playerVelocity.x, this.playerVelocity.y);
    this.player.setDepth(this.player.y);

    if (direction) {
      this.player.direction = direction;
      this.pauseAnimation(this.player, false);
      this.updateAnimation(this.player, direction);
    } else this.pauseAnimation(this.player, true);
  },

  postUpdate(time, delta) {
    this.updateCharacterNamesPositions();
    characterPopIns.update(this.player, this.players);
    if (!this.player) return;

    userChatCircle.update(this.player.x, this.player.y);
    userVoiceRecorderAbility.update(this.player.x, this.player.y, delta);

    let moving = Math.abs(this.player.body.velocity.x) > Number.EPSILON || Math.abs(this.player.body.velocity.y) > Number.EPSILON;

    // Handle freeze
    const user = Meteor.user();
    if (user.profile.freeze) moving = false;

    if (moving || this.playerWasMoving) {
      this.scene.physics.world.update(time, delta);
      throttledSavePlayer(this.player);
    }
    this.playerWasMoving = moving;
  },

  updateCharacterNamesPositions() {
    _.each(this.characterNamesObjects, (value, key) => {
      if (!value) return;

      const player = this.players[key];
      if (!player) {
        this.destroyUserName(key);
        return;
      }

      value.setPosition(
        player.x + characterNameOffset.x,
        player.y + characterNameOffset.y,
      );
    });
  },

  updateUserName(userId, name) {
    let textInstance = this.characterNamesObjects[userId];
    if (!this.characterNamesObjects[userId]) {
      textInstance = this.scene.add.text(0, -40, name, {
        fontFamily: 'Verdana, "Times New Roman", Tahoma, serif',
        fontSize: 18,
        stroke: '#000',
        strokeThickness: 3,
      });
      textInstance.setOrigin(0.5);
      textInstance.setDepth(99999);
      this.characterNamesObjects[userId] = textInstance;
    } else if (textInstance) textInstance.text = name;
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
