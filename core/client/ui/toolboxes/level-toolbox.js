import { currentLevel } from '../../../lib/misc';
import { toggleUIInputs } from '../../helpers';

const checkLevelName = value => {
  if (!value) throw new Error('A name is required');
  if (value.length < 3) throw new Error('Level\'s name must be at least 2 characters');
};

const updateLevel = (name, spawnPosition, hide = false) => {
  try {
    checkLevelName(name);
  } catch (e) {
    lp.notif.error(e.name);
    return;
  }

  Meteor.call('updateLevel', name, spawnPosition, hide, err => {
    if (err) { lp.notif.error(err.reason); return; }
    lp.notif.success('Level updated!');
  });
};

Template.levelToolbox.events({
  'focus input'() { toggleUIInputs(true); },
  'blur input'() { toggleUIInputs(false); },
  'blur .js-name'(event) {
    const user = Meteor.user();
    const level = currentLevel(user);
    updateLevel(event.target.value, level.spawn, level.hide);
  },
  'change .js-hidden'(event) {
    const user = Meteor.user();
    const level = currentLevel(user);
    updateLevel(level.name, level.spawn, event.target.checked);
  },
  'click .js-spawn-position'() {
    const user = Meteor.user();
    const level = currentLevel(user);
    const { x, y } = user.profile;
    updateLevel(level.name, { x, y }, level.hide);
  },
});

Template.levelToolbox.helpers({
  name() { return currentLevel(Meteor.user()).name; },
  hidden() { return currentLevel(Meteor.user()).hide || false; },
  spawnPosition() {
    const { spawn } = currentLevel(Meteor.user());
    return `${Math.round(spawn.x)} - ${Math.round(spawn.y)}`;
  },
});
