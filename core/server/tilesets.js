Meteor.publish('tilesets', () => Tilesets.find());

Meteor.methods({
  removeTileset(id) {
    check(id, String);

    const user = Meteor.user();
    log('removeTileset: start', { userId: user._id, id });

    if (!lp.isGod()) {
      error('removeTileset: user not allowed');
      throw new Meteor.Error('not-authorized', 'only gods can do this');
    }

    const tilesetToRemove = Tilesets.findOne(id);
    if (!tilesetToRemove) {
      error('removeTileset: tileset not found');
      throw new Meteor.Error('not-found', 'tileset not found');
    }

    log('removeTileset: Removing tiles', { userId: user._id, id });
    Tiles.remove({ tilesetId: id });
    log('removeTileset: Removing tileset', { userId: user._id, id });
    Tilesets.remove({ _id: id });
    if (tilesetToRemove.fileId) {
      log('removeTileset: Removing file', { userId: user._id, id, fileId: tilesetToRemove.fileId });
      Files.remove({ _id: tilesetToRemove.fileId });
    }

    return true;
  },
});
