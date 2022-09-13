import { canUseLevelFeature, moduleType } from '../../../lib/misc';


window.addEventListener('load', () => {
  Tracker.nonreactive(() => {
    const user = Meteor.user();

    if (!user) return;

    const isAdmin = user.roles?.admin;
    const isShoutFeatureEnabled = canUseLevelFeature(Meteor.user(), 'shout');

    if (isAdmin || isShoutFeatureEnabled) {
      registerModules([
        { id: 'shout', icon: '📢', label: 'Shout', order: 40, shortcut: 55, scope: 'me' },
    moduleType.RADIAL_MENU,
      ]);
    }
  });

  hotkeys('r', { keyup: true, scope: scopes.player }, event => {
    if (event.repeat) return;

    const user = Meteor.user({ fields: { _id: 1, 'profile.levelId': 1, roles: 1 } });
    
    if (!user || !canUseLevelFeature(user, 'shout')) return;

    userVoiceRecorderAbility.recordVoice(event.type === 'keydown', sendAudioChunksToUsersInZone);
  });

  const onMenuOptionSelected = e => {
    const { option } = e.detail;
    const user = Meteor.user({ fields: { _id: 1, 'profile.levelId': 1, roles: 1 } });

    if (option.id !== 'shout') return;

    userVoiceRecorderAbility.recordVoice(true, sendAudioChunksToUsersInZone);
  };

  const onMenuOptionUnselected = e => {
    const { option } = e.detail;
    const user = Meteor.user({ fields: { _id: 1, 'profile.levelId': 1, roles: 1 } });

    if (option.id !== 'shout') return;

    userVoiceRecorderAbility.recordVoice(false, sendAudioChunksToUsersInZone);
  };

  window.addEventListener(eventTypes.onMenuOptionSelected, onMenuOptionSelected);
  window.addEventListener(eventTypes.onMenuOptionUnselected, onMenuOptionUnselected);
});
