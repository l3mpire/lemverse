const checkLevelName = value => {
  if (!value) return 'A name is required';
  if (value.length < 3) return 'Level\'s name must be at least 2 characters';

  return true;
};

const currentLevel = () => Levels.findOne(Meteor.user().profile.levelId);

const updateLevel = (name, spawnPosition, hide = false) => {
  const levelNameState = checkLevelName(name);
  if (levelNameState !== true) { lp.notif.error(levelNameState); return; }

  Meteor.call('updateLevel', name, spawnPosition, hide, err => {
    if (err) { lp.notif.error(err.reason); return; }
    lp.notif.success('Level updated!');
  });
};

Template.levelToolbox.events({
  'focus input'() { hotkeys.setScope('form'); game?.scene?.keys?.WorldScene?.enableKeyboard(false, false); },
  'blur input'() { hotkeys.setScope(scopes.player); game?.scene?.keys?.WorldScene?.enableKeyboard(true, false); },
  'blur .js-name'(e) { updateLevel(e.target.value, currentLevel().spawn, currentLevel().hide); },
  'change .js-hidden'(e) { updateLevel(currentLevel().name, currentLevel().spawn, e.target.checked); },
  'click .js-spawn-position'() {
    const { name } = currentLevel();
    const { x, y } = Meteor.user().profile;
    updateLevel(name, { x, y }, currentLevel().hide);
  },
  'click .js-edit-tags'() {
    Session.set('modal', { template: 'levelTags' });
  },
});

Template.levelToolbox.helpers({
  name() { return currentLevel().name; },
  hidden() { return currentLevel().hide || false; },
  spawnPosition() {
    const { spawn } = currentLevel();
    return `${Math.round(spawn.x)} - ${Math.round(spawn.y)}`;
  },
});
