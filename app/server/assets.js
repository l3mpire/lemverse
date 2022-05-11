const fs = require('fs/promises');

spritesheetValid = async fileRef => {
  log('spritesheetValid: start', { fileRef });

  const rawData = await fs.readFile(fileRef.path, { encoding: 'utf8' });
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

rewriteSpritesheet = async fileRef => {
  log('rewriteSpritesheet: start', { fileRef });
  if (!spritesheetValid(fileRef)) throw new Meteor.Error('invalid-spritesheet', 'invalid sprite sheet format');

  const rawData = await fs.readFile(fileRef.path, { encoding: 'utf8' });
  const data = JSON.parse(rawData);

  // replace texture packer file name with files collection identifier
  for (let i = 0; i < data.textures.length; i++) {
    const asset = Files.findOne({ name: data.textures[i].image }, { sort: { 'meta.createdAt': -1 } });
    if (!asset) throw new Meteor.Error('invalid-spritesheet', 'invalid sprite sheet format');

    data.textures[i].image = asset._id;
  }

  fs.writeFile(fileRef.path, JSON.stringify(data), err => {
    if (err) throw new Meteor.Error('spritesheet-rewrite', err);
  });

  log('rewriteSpritesheet: done');

  return true;
};

Meteor.publish('assets', function () {
  if (!this.userId) return undefined;

  return Assets.find();
});
