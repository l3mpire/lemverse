nearestDuration = duration => {
  const message = [];
  message.push(lp.s.lpad(moment.duration(duration).asHours() | 0, 2, '0'));
  message.push(lp.s.lpad(moment.duration(duration).minutes(), 2, '0'));
  message.push(lp.s.lpad(moment.duration(duration).seconds(), 2, '0'));

  return message.join(':');
};


isEditionAllowed = userId => {
  if (!userId) return false;
  const user = Meteor.users.findOne(userId);
  if (!user) return false;
  if (user?.roles?.admin) return true;

  const { levelId } = user.profile;
  const currentLevel = Levels.findOne(levelId);

  return currentLevel?.sandbox || currentLevel?.editorUserIds?.includes(user._id) || user._id === currentLevel.createdBy;
};

updateSkin = (user, levelId) => {
  if (!user) throw new Error('missing user parameter');
  if (!levelId) throw new Error('missing levelId parameter');

  let newProfile = { ...user.profile };
  const currentLevel = Levels.findOne({ _id: levelId });
  if (!user.profile?.body && currentLevel?.skins?.default) {
    newProfile = {
      ...newProfile,
      ...currentLevel.skins.default,
    };
  } else if (Characters.find({}).count() === 0) {
    newProfile.body = Meteor.settings.public.skins.default;
  } else {
    ['body', 'outfit', 'eye', 'hair', 'accessory'].forEach(part => {
      log('updateSkin: Randomize character parts...');
      const parts = Characters.find({ category: part, $or: [{ hide: { $exists: false } }, { hide: false }] }).fetch();
      if (parts.length) newProfile[part] = parts[_.random(0, parts.length - 1)]._id;
    });
  }

  Meteor.users.update(user._id, { $set: { profile: { ...newProfile } } });
};
