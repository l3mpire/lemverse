activityType = Object.freeze({
  userEnteredLevel: 'userEnteredLevel',
  userLeavedLevel: 'userLeavedLevel',
});

const activity = {
  type: undefined,
  userId: undefined,
  zoneId: undefined,
  entityId: undefined,
  meta: {},
  createdAt: new Date(),
};

callHooks = (level, type, content = {}) => {
  if (!level.hooks || !level.hooks.length) return;

  const data = { ...activity, ...content, type };
  console.log(data);
  let hooksCalledCount = 0;
  level.hooks.forEach(hook => {
    hooksCalledCount++;
    HTTP.post(hook.targetUrl, { data }, err => {
      if (err?.response?.statusCode === 410) {
        Levels.update(level._id, { $pull: { hooks: { _id: hook._id } } });
        log('callHooks: hook removed', { levelId: level._id, hook, data });
      } else if (err) {
        log('callHooks: post failed', { levelId: level._id, hook, data, err });
      }
    });
  });

  log('callHooks: end', { levelId: level._id, hooksCalledCount });
};
