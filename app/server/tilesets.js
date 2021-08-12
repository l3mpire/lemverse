Meteor.publish('tilesets', () => Tilesets.find());

Meteor.methods({
  removeTileset(id) {
    const user = Meteor.user();
    log('removeTileset: start', { userId: user._id, id });
    const tilesetToRemove = Tilesets.findOne(id);

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
