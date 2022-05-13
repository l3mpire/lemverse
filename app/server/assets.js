import * as fs from 'fs';

spritesheetValid = fileRef => {
  log('spritesheetValid: start', { fileRef });

  const rawData = fs.readFileSync(fileRef.path, { encoding: 'utf8' });
  const data = JSON.parse(rawData);
  if (!data.textures?.length) throw new Meteor.Error('invalid-spritesheet', 'invalid sprite sheet format');

  const linkedImageNames = data.textures.map(texture => texture.image);
  const linkedImageAssets = Files.find({ name: { $in: linkedImageNames } }).fetch();
  const imagesFound = [...new Set(linkedImageAssets.map(file => file.name))];

  if (imagesFound.length !== linkedImageNames.length) {
    const missingImages = linkedImageNames.filter(x => !imagesFound.includes(x)).join(', ');
    throw new Meteor.Error('missing-images', `Please upload all images required first (missing: ${missingImages})`);
  }

  log('spritesheetValid: done');

  return true;
};

rewriteSpritesheet = fileRef => {
  log('rewriteSpritesheet: start', { fileRef });

  const rawData = fs.readFileSync(fileRef.path, { encoding: 'utf8' });
  const data = JSON.parse(rawData);

  // replace texture packer file name with files collection identifier
  for (let i = 0; i < data.textures.length; i++) {
    const asset = Files.findOne({ name: data.textures[i].image }, { sort: { 'meta.createdAt': -1 } });
    if (!asset) throw new Meteor.Error('invalid-spritesheet', 'invalid sprite sheet format');

    data.textures[i].image = asset._id;
  }

  try {
    fs.writeFileSync(fileRef.path, JSON.stringify(data));
  } catch (err) {
    throw new Meteor.Error('spritesheet-rewrite', err);
  }

  log('rewriteSpritesheet: done');

  return true;
};

importSpritesheetFramesAsEntities = fileRef => {
  log('importSpritesheetFramesAsEntities: start', { fileRef });

  const asset = Assets.findOne({ fileId: fileRef._id });
  if (!asset) throw new Meteor.Error('invalid-asset', 'asset is missing');

  const rawData = fs.readFileSync(fileRef.path, { encoding: 'utf8' });
  const data = JSON.parse(rawData);

  // replace texture packer file name with files collection identifier
  data.textures.forEach(texture => {
    texture.frames.forEach(frame => {
      const name = frame.filename.split('/').pop();

      const { x, y, w, h } = frame.frame;
      const thumbnail = {
        fileId: texture.image,
        rect: [x, y, w, h],
      };

      const existingEntity = Entities.findOne({ name, 'gameObject.sprite.assetId': asset._id, prefab: true });
      if (existingEntity) {
        log('importSpritesheetFramesAsEntities: updating entity', { name, assetId: asset._id });
        Entities.update(existingEntity._id, { $set: { thumbnail } });

        return;
      }

      const entityId = Entities.id();
      Entities.insert({
        _id: entityId,
        createdBy: 'import-script',
        createdAt: new Date(),
        actionType: entityActionType.none,
        thumbnail,
        gameObject: {
          sprite: {
            key: frame.filename,
            assetId: asset._id,
          },
        },
        name,
        prefab: true,
      });

      log('importSpritesheetFramesAsEntities: created new entity prefab', { entityId, name, assetId: asset._id });
    });
  });

  log('importSpritesheetFramesAsEntities: done');
};

Meteor.publish('assets', function () {
  if (!this.userId) return undefined;

  return Assets.find();
});
