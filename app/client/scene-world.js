import nipplejs from 'nipplejs';

const Phaser = require('phaser');

const defaultCharacterDirection = 'down';
const defaultUserMediaColorError = '0xd21404';
const defaultLayer = 2;
const defaultLayerCount = 9;
const defaultLayerDepth = {
  6: 10000,
  7: 10001,
  8: 10002,
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
};

const throttledSavePlayer = throttle(savePlayer, 100, { leading: false });

const findTileset = tilesetId => game.scene.keys.WorldScene.map.getTileset(tilesetId);

tileGlobalIndex = tile => {
  const tileset = findTileset(tile.tilesetId);
  return (tileset.firstgid || 0) + tile.index;
};

tileLayer = tile => {
  if (!tile.tilesetId) return defaultLayer;
  const tileset = findTileset(tile.tilesetId);
  const tileProperties = tileset.tileData?.[tile.index];

  return tileProperties?.layer ?? defaultLayer;
};

WorldScene = new Phaser.Class({
  Extends: Phaser.Scene,

  initialize: function WorldScene() {
    Phaser.Scene.call(this, { key: 'WorldScene' });
  },

  init(data) {
    this.characterNameOffset = { x: 0, y: -40 };
    this.characterNamesObjects = {};
    this.isMouseDown = false;
    this.layers = [];
    this.players = {};
    this.wasMoving = false;
    this.input.keyboard.enabled = false;
    this.scene.sleep();
    this.teleporterGraphics = [];
    userChatCircle.destroy();
    userVoiceRecorderAbility.init(this);
    characterPopIns.init(this);
    Session.set('gameCreated', false);
    this.physics.disableUpdate();

    const { levelId } = data;
    if (levelId && Meteor.user()) {
      const { spawn } = Levels.findOne({ _id: levelId });
      throttledSavePlayer.cancel();
      Meteor.users.update(Meteor.userId(), { $set: { 'profile.levelId': levelId, 'profile.x': spawn?.x || 0, 'profile.y': spawn?.y || 0 } });
    }
  },

  setAsMainPlayer(userId) {
    if (this.player) this.physics.world.disableBody(this.player);

    const player = this.players[userId];
    if (!player) throw new Error(`Can't set as main player a non spawned character`);

    // enable collisions for the user only, each client has its own physics simulation and there isn't collision between characters
    this.physics.world.enableBody(player);
    player.body.setImmovable(true);
    player.body.setCollideWorldBounds(true);
    player.body.setSize(38, 16);
    player.body.setOffset(-20, 32);

    // add character's physic body to layers
    _.each(this.layers, layer => {
      if (layer.playerCollider) this.physics.world.removeCollider(layer.playerCollider);
      layer.playerCollider = this.physics.add.collider(player, layer);
    });

    // ask camera to follow the player
    this.cameras.main.startFollow(player);
    this.cameras.main.roundPixels = true;

    if (Meteor.user().guest) hotkeys.setScope('guest');
    else hotkeys.setScope(scopes.player);

    this.player = player;
  },

  playerRename(name) {
    this.updateUserName(this.player.userId, name);
    if (meet.api) meet.api.executeCommand('displayName', name);
  },

  playerCreate(user) {
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
    this.players[user._id] = this.add.container(x, y);
    this.players[user._id].userId = user._id;

    const playerParts = this.add.container(0, 0);
    playerParts.name = 'body';

    const bodyPlayer = this.add.sprite(0, 0, body || guest ? Meteor.settings.public.skins.guest : Meteor.settings.public.skins.default);
    bodyPlayer.setScale(3);
    bodyPlayer.name = 'body';
    playerParts.add(bodyPlayer);

    Object.keys(charactersParts).filter(part => part !== 'body' && user.profile[part]).forEach(part => {
      const spritePart = this.add.sprite(0, 0, user.profile[part]);
      spritePart.name = part;
      spritePart.setScale(3);
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

    this.playerUpdate(user);

    return this.players[user._id];
  },

  playerUpdate(user, oldUser) {
    const isMe = user._id === Meteor.userId();
    const player = this.players[user._id];
    if (!player) return;
    const { x, y, reaction, shareAudio, guest, userMediaError, name } = user.profile;

    // show reactions
    if (reaction && !player.reactionHandler) {
      this.spawnReaction(player, reaction);
      player.reactionHandler = setInterval(() => this.spawnReaction(player, reaction), 250);
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
        const missingPart = this.add.sprite(0, 0, user.profile[part]);
        missingPart.setScale(3);
        missingPart.name = part;
        characterBodyContainer.add(missingPart);
      } else characterPart.setTexture(user.profile[part]);
    });

    // remove potential item from the user
    charactersPartsKeys.filter(part => !user.profile[part] && part !== 'body').forEach(part => {
      if (!user.profile[part]) characterBodyContainer?.getByName(part)?.destroy();
    });

    if (hasUpdatedSkin) {
      delete player.lastDirection;
      this.playerUpdateAnimation(player);
      this.playerPauseAnimation(player, true, true);
    }

    // update tint
    if (userMediaError !== oldUser?.profile.userMediaError) {
      charactersPartsKeys.filter(part => user.profile[part] || part === 'body').forEach(part => {
        const characterPart = characterBodyContainer.getByName(part);
        if (characterPart) {
          if (userMediaError) characterPart.setTint(defaultUserMediaColorError);
          else characterPart.clearTint();
        }
      });
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
      if (hasMoved) zones.checkDistances();

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

  playerRemove(user) {
    if (user._id === Meteor.userId()) return;
    if (!this.players[user._id]) return;

    clearInterval(this.players[user._id].reactionHandler);
    delete this.players[user._id].reactionHandler;

    this.players[user._id].destroy();
    this.destroyUserName(user._id);

    delete this.players[user._id];
  },

  playerPauseAnimation(player, value, forceUpdate = false) {
    player = player ?? this.player;

    if (value === player.paused && !forceUpdate) return;
    player.paused = value;

    const user = Meteor.users.findOne(player.userId);
    const playerBodyParts = player.getByName('body');
    Object.keys(charactersParts).filter(part => user.profile[part]).forEach(part => {
      const characterPart = playerBodyParts.getByName(part);
      if (value) {
        characterPart.anims.pause();
        if (characterPart.anims.hasStarted) characterPart.anims.setProgress(0.5);
      } else characterPart.anims.resume();
    });
  },

  playerUpdateAnimation(player, direction) {
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

    Object.keys(charactersParts).filter(part => user.profile[part]).forEach(part => {
      const characterPart = player.getByName('body').getByName(part);
      if (characterPart) characterPart.anims.play(`${user.profile[part]}${direction}`, true);
    });
  },

  tileRefresh(x, y) {
    for (let i = 0; i < this.layers.length; i++) this.map.removeTileAt(x, y, false, false, i);

    Tiles.find({ x, y }).forEach(tile => {
      game.scene.keys.WorldScene.map.putTileAt(tileGlobalIndex(tile), tile.x, tile.y, false, tileLayer(tile));
    });
  },

  updateUserName(userId, name) {
    let textInstance = this.characterNamesObjects[userId];
    if (!this.characterNamesObjects[userId]) {
      textInstance = this.add.text(0, -40, name, {
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

  createUserStateIndicator() {
    const muteIndicatorMic = this.add.text(0, 0, '🎤', { font: '23px Sans Open' }).setDepth(99996).setOrigin(0.5, 1);
    const muteIndicatorCross = this.add.text(0, -3, '❌', { font: '23px Sans Open' }).setDepth(99997).setOrigin(0.5, 1).setScale(0.6);

    const userStateIndicatorContainer = this.add.container(0, 0);
    userStateIndicatorContainer.add([muteIndicatorMic, muteIndicatorCross]);

    return userStateIndicatorContainer;
  },

  destroyUserName(userId) {
    const nameObject = this.characterNamesObjects[userId];
    if (!nameObject) { return; }
    nameObject?.destroy();

    this.characterNamesObjects[userId] = undefined;
  },

  create() {
    // map
    hotkeys.setScope('guest');
    this.map = this.make.tilemap({ tileWidth: 48, tileHeight: 48, width: 100, height: 100 });

    // controls
    this.enableKeyboard(true, true);
    this.keys = this.input.keyboard.addKeys({
      ...this.input.keyboard.createCursorKeys(),
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      q: Phaser.Input.Keyboard.KeyCodes.Q,
      z: Phaser.Input.Keyboard.KeyCodes.Z,
      w: Phaser.Input.Keyboard.KeyCodes.W,
    }, false, false);

    // set focus to the canvas and blur focused element on scene clicked
    this.input.on('pointerdown', () => {
      if (isModalOpen()) return;
      this.enableKeyboard(true, true);
      document.activeElement.blur();
    });

    // layers
    this.initLayers();

    // Tilesets
    this.addTilesetsToLayers(Tilesets.find().fetch());

    // physics
    this.physics.world.bounds.width = this.map.widthInPixels;
    this.physics.world.bounds.height = this.map.heightInPixels;

    // cameras
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.cameras.main.roundPixels = true;

    // plugins
    userChatCircle.init(this);

    Session.set('gameCreated', true);
    Session.set('editor', 0);

    if (window.matchMedia('(pointer: coarse)').matches) {
      this.nippleManager = nipplejs.create({
        mode: 'dynamic',
        catchDistance: 150,
      });

      this.nippleManager.on('added', (evt, nipple) => {
        nipple.on('start move end dir plain', (evt2, data) => {
          if (evt2.type === 'move') {
            this.player.nippleMoving = true;
            this.player.nippleData = data;
          }
          if (evt2.type === 'end') {
            this.player.nippleMoving = false;
          }
        })
          .on('removed', () => {
            nipple.off('start move end dir plain');
          });
      });
    }

    // events
    this.events.on('postupdate', this.postUpdate.bind(this));

    zones.onZoneChanged = (zone, previousZone) => {
      if (previousZone && !previousZone.popInConfiguration?.autoOpen) characterPopIns.destroy(Meteor.userId(), previousZone._id);
      if (!zone) return;

      const { targetedLevelId: levelId, userLevelTeleporter, inlineURL } = zone;

      // special zone to load a level
      if (levelId) this.loadLevel(levelId);
      else if (userLevelTeleporter) {
        // special zone creating a level for the user or loading the existing one
        const levelToLoad = Levels.findOne({ createdBy: Meteor.userId() });
        if (levelToLoad) this.loadLevel(levelToLoad._id);
        else {
          Meteor.call('createLevel', undefined, (err, result) => {
            if (err) { error(err); return; }
            this.loadLevel(result);
          });
        }
      } else if (inlineURL) characterPopIns.initFromZone(zone);
    };

    characterPopIns.onPopInEvent = e => {
      const { detail: data } = e;
      if (data.userId !== Meteor.userId()) return;

      if (data.type === 'load-level') this.loadLevel(data.levelId);
    };
  },

  addTilesetsToLayers(tilesets) {
    const newTilesets = [];
    _.each(tilesets, tileset => {
      if (findTileset(tileset._id)) return;
      const tilesetImage = this.map.addTilesetImage(tileset._id, tileset._id, 16, 16, 0, 0, tileset.gid);
      if (!tilesetImage) {
        log('unable to load tileset', tileset._id);
        return;
      }

      tilesetImage.tileData = tileset.tiles;
      newTilesets.push(tilesetImage);

      const collisionTileIndexes = _.map(tileset.collisionTileIndexes, i => i + tileset.gid);
      _.each(this.layers, layer => layer.setCollision(collisionTileIndexes));
    });

    if (newTilesets.length) _.each(this.layers, layer => layer.setTilesets([...layer.tileset, ...newTilesets]));
  },

  initLayers() {
    // clean
    _.each(this.layers, layer => {
      if (layer.playerCollider) this.physics.world.removeCollider(layer.playerCollider);
      layer.destroy();
    });
    this.map.removeAllLayers();

    // create
    this.layers = [];
    _.times(defaultLayerCount, i => this.layers.push(this.map.createBlankLayer(`${i}`)));
    _.each(defaultLayerDepth, (value, key) => this.layers[key]?.setDepth(value));
  },

  spawnReaction(player, emoji) {
    const ReactionDiff = 10;
    const positionX = player.x - ReactionDiff + _.random(-10, 10);
    const positionY = player.y + this.characterNameOffset.y + _.random(-10, 10);
    const reaction = this.add.text(positionX, positionY, emoji, { font: '32px Sans Open' }).setDepth(99997).setOrigin(0.5, 1);

    this.tweens.add({
      targets: reaction,
      alpha: { value: 0, duration: 250, delay: 750, ease: 'Power1' },
      y: { value: positionY - 70, duration: 1300, ease: 'Power1' },
      x: { value: positionX + (ReactionDiff * 2), duration: 250, ease: 'Linear', yoyo: true, repeat: -1 },
      scale: { value: 1.2, duration: 175, ease: 'Quad.easeOut', yoyo: true, repeat: -1 },
      onComplete: () => reaction.destroy(),
    });
  },

  update() {
    this.interpolatePlayerPositions();

    if (!this.player) return;
    if (!this.player.nippleMoving) this.player.body.setVelocity(0);
    if (isModalOpen()) return;

    let velocity = this.keys.shift.isDown ? Meteor.settings.public.character.runSpeed : Meteor.settings.public.character.walkSpeed;
    let direction;

    if (this.player.nippleMoving) {
      const xVel = this.player.nippleData.vector.x * Meteor.settings.public.character.walkSpeed * 2;
      const yVel = this.player.nippleData.vector.y * -Meteor.settings.public.character.walkSpeed * 2;
      this.player.body.setVelocityX(xVel);
      this.player.body.setVelocityY(yVel);
      velocity = Math.max(Math.abs(xVel), Math.abs(yVel));
      direction = this.player.nippleData?.direction?.angle;
    } else {
      // Horizontal movement
      if (this.keys.left.isDown || this.keys.q.isDown || this.keys.a.isDown) this.player.body.setVelocityX(-velocity);
      else if (this.keys.right.isDown || this.keys.d.isDown) this.player.body.setVelocityX(velocity);

      // Vertical movement
      if (this.keys.up.isDown || this.keys.z.isDown || this.keys.w.isDown) this.player.body.setVelocityY(-velocity);
      else if (this.keys.down.isDown || this.keys.s.isDown) this.player.body.setVelocityY(velocity);
    }

    this.player.body.velocity.normalize().scale(velocity);

    if (this.keys.left.isDown || this.keys.q.isDown || this.keys.a.isDown) direction = 'left';
    else if (this.keys.right.isDown || this.keys.d.isDown) direction = 'right';
    else if (this.keys.up.isDown || this.keys.z.isDown || this.keys.w.isDown) direction = 'up';
    else if (this.keys.down.isDown || this.keys.s.isDown) direction = 'down';
    if (direction) this.player.direction = direction;

    if (direction) {
      this.playerPauseAnimation(this.player, false);
      this.playerUpdateAnimation(this.player, direction);
    } else this.playerPauseAnimation(this.player, true);

    this.player.setDepth(this.player.y);
  },

  interpolatePlayerPositions() {
    const currentUser = Meteor.user();

    _.each(this.players, (player, userId) => {
      if (userId === currentUser._id) return;

      if (!player.lwTargetDate) {
        this.playerPauseAnimation(player, true);
        return;
      }

      this.playerPauseAnimation(player, false);
      this.playerUpdateAnimation(player);

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

  postUpdate(time, delta) {
    this.updateCharacterNamesPositions();
    characterPopIns.update(this.player, this.players);
    if (!this.player) return;

    userChatCircle.update(this.player.x, this.player.y);
    userVoiceRecorderAbility.update(this.player.x, this.player.y, delta);

    const moving = Math.abs(this.player.body.velocity.x) > Number.EPSILON || Math.abs(this.player.body.velocity.y) > Number.EPSILON;
    if (moving || this.wasMoving) {
      this.physics.world.update(time, delta);
      throttledSavePlayer(this.player);
    }
    this.wasMoving = moving;
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
        player.x + this.characterNameOffset.x,
        player.y + this.characterNameOffset.y,
      );
    });
  },

  loadLevel(levelId) {
    const levelToLoad = Levels.findOne({ _id: levelId });
    if (!levelToLoad) { error(`Level with the id "${levelId}" not found`); return; }

    game.scene.keys.LoadingScene.setText(levelToLoad.name);
    game.scene.keys.LoadingScene.show();
    setTimeout(() => this.scene.restart({ levelId }), 0);
  },

  onLevelLoaded() {
    this.scene.wake();

    // simulate a first frame update to avoid weirds visual effects with characters animation and direction
    this.update(0, 0);

    setTimeout(() => game.scene.keys.LoadingScene.hide(() => {
      this.input.keyboard.enabled = true;
      if (this.player) this.player.visible = true;
    }), 0);

    if (Meteor.settings.public.debug) {
      this.layers[0].renderDebug(this.add.graphics(), {
        tileColor: null,
        collidingTileColor: new Phaser.Display.Color(243, 134, 48, 200),
        faceColor: new Phaser.Display.Color(40, 39, 37, 255),
      });
    }

    if (Tiles.find().count() === 0) this.drawTeleporters(true);
  },

  drawTeleporters(state) {
    // clean previous
    _.each(this.teleporterGraphics, zoneGraphic => zoneGraphic.destroy());
    this.teleporterGraphics = [];

    if (!state) return;

    // create new ones
    const zones = Zones.find({ $or: [{ targetedLevelId: { $exists: true, $ne: '' } }, { userLevelTeleporter: { $exists: true } }] }).fetch();
    _.each(zones, zone => {
      const graphic = game.scene.keys.WorldScene.add.rectangle(zone.x1, zone.y1, zone.x2 - zone.x1, zone.y2 - zone.y1, 0x9966ff, 0.2);
      graphic.setOrigin(0, 0);
      graphic.setStrokeStyle(1, 0xefc53f);
      graphic.setDepth(20000);
      this.teleporterGraphics.push(graphic);
    });
  },

  enableKeyboard(value, globalCapture) {
    const { keyboard } = this.input;
    if (!keyboard) return;
    keyboard.enabled = value;

    if (globalCapture) keyboard.enableGlobalCapture();
    else keyboard.disableGlobalCapture();
  },
});
