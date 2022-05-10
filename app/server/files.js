import FileType from 'file-type';
import '../collections';
import gm from 'gm';

const filesAfterUploadEditorTileset = (user, fileRef) => {
  log('filesAfterUploadEditorTileset: start', { userId: user._id, fileRef });
  if (!/png|jpe?g/i.test(fileRef.extension || '')) return;

  // Only Admin can upload files
  if (!user?.roles?.admin) { error('filesAfterUploadEditorTileset: someone unauthorized tried to do an action', { userId: user._id, fileRef }); return; }

  // Retrieve size
  let image;
  try {
    image = gm(fileRef.path);
  } catch (err) {
    error('filesAfterUploadEditorTileset: error with GraphicsMagick', { userId: user._id, fileRef, err });
    if (fileRef?._id) Files.remove({ _id: fileRef._id });
    return;
  }
  const size = lp.syncApi(image.size, image);
  const { width, height } = size;

  const existingTileset = Tilesets.findOne({ fileName: fileRef.name });

  if (existingTileset?._id) {
    // Update
    log('filesAfterUploadEditorTileset: update the tileset', { userId: user._id, tilesetId: existingTileset._id, fileId: fileRef._id });
    Tilesets.update({ _id: existingTileset._id }, { $set: { height, width, fileId: fileRef._id } });
  } else {
    // Create
    log('filesAfterUploadEditorTileset: create a new tileset', { userId: user._id, fileId: fileRef._id });
    const maxTileset = Tilesets.findOne({}, { sort: { gid: -1 }, limit: 1 });
    let maxTilesetGid = 0;
    if (maxTileset) maxTilesetGid = maxTileset.gid + 10000;

    const newId = Tilesets.id();
    Tilesets.insert({ _id: newId, createdAt: new Date(), createdBy: user._id, name: newId, gid: maxTilesetGid, height, width, fileId: fileRef._id, fileName: fileRef.name });

    log('filesAfterUploadEditorTileset: created tileset', { userId: user._id, tilesetId: newId });
  }
};

const filesAfterUploadEditorCharacter = (user, fileRef) => {
  log('filesAfterUploadEditorCharacter: start', { userId: user._id, fileRef });
  if (!/png|jpe?g/i.test(fileRef.extension || '')) return;

  // Only Admin can upload files
  if (!user?.roles?.admin) { error('filesAfterUploadEditorCharacter: someone unauthorized tried to do an action', { userId: user._id, fileRef }); return; }

  // Retrieve size
  let image;
  try {
    image = gm(fileRef.path);
  } catch (err) {
    error('filesAfterUploadEditorCharacter: error with GraphicsMagick', { userId: user._id, fileRef, err });
    if (fileRef?._id) Files.remove({ _id: fileRef._id });
    return;
  }
  const size = lp.syncApi(image.size, image);
  const { formats, frameHeight, frameWidth } = Meteor.settings.public.assets.character;
  const { width, height } = size;

  if (!formats[`w-${width}`]) {
    Files.remove({ _id: fileRef._id });
    error('filesAfterUploadEditorCharacter: image in wrong format', { userId: user._id, fileRef, width, height, frameHeight, frameWidth, formats: Object.keys(formats) });
    return;
  }

  if (height % frameHeight !== 0) log(`filesAfterUploadEditorCharacter: image height is invalid, last frames couldn't appear`, { userId: user._id, fileRef, width, height, frameHeight, frameWidth, formats: Object.keys(formats) });
  if (width % frameWidth !== 0) log(`filesAfterUploadEditorCharacter: image width is invalid, last frames couldn't appear`, { userId: user._id, fileRef, width, height, frameHeight, frameWidth, formats: Object.keys(formats) });

  const existingCharacters = Characters.findOne({ fileName: fileRef.name });

  if (existingCharacters?._id) {
    // Update
    log('filesAfterUploadEditorCharacter: update the character sheet', { userId: user._id, tilesetId: existingCharacters._id, fileId: fileRef._id });
    Characters.update({ _id: existingCharacters._id }, { $set: { height, width, fileId: fileRef._id } });
  } else {
    // Create
    log('filesAfterUploadEditorCharacter: create a character sheet', { userId: user._id, fileId: fileRef._id });

    const newId = Characters.id();
    Characters.insert({ _id: newId, createdAt: new Date(), createdBy: user._id, height, width, fileId: fileRef._id, fileName: fileRef.name });

    log('filesAfterUploadEditorCharacter: created character sheet', { userId: user._id, tilesetId: newId });
  }
};

const filesAfterUploadVoiceRecorder = (user, fileRef) => {
  log('filesAfterUploadVoiceRecorder: start', { userId: user._id, fileRef });
  if (!/webm|ogg|mp4/i.test(fileRef.extension || '')) return;

  const { userIds } = fileRef.meta;
  if (!userIds.length) return;

  _.each(userIds, userId => {
    Notifications.insert({
      _id: Notifications.id(),
      fileId: fileRef._id,
      userId,
      createdAt: new Date(),
      createdBy: user._id,
    });
  });

  log('filesAfterUploadVoiceRecorder: done', { userId: user._id });
};

Files.onBeforeUpload = function (file) {
  if (this.eof) {
    const { mime } = Promise.await(FileType.fromFile(file.path)) || file; // fallback to default mime for non binary-based file
    return fileOnBeforeUpload(file, mime);
  }

  return true;
};

Files.on('afterUpload', fileRef => {
  const user = Meteor.users.findOne(fileRef.userId);
  log('FilesCollection: afterUpload start', { userId: user._id, fileRef });

  if (fileRef.meta?.source === 'editor-tilesets') filesAfterUploadEditorTileset(user, fileRef);
  else if (fileRef.meta?.source === 'editor-characters') filesAfterUploadEditorCharacter(user, fileRef);
  else if (fileRef.meta?.source === 'voice-recorder') filesAfterUploadVoiceRecorder(user, fileRef);
});

Meteor.publish('files', fileIds => {
  check(fileIds, [String]);
  return Files.find({ _id: { $in: fileIds } }).cursor;
});
